// scrape-osa.js

/**
 * Ontario Sign Association Directory Scraper
 * - Scrapes member data from https://www.ontariosignassociation.com/member-directory
 * - Saves to both a CSV file and Google Sheet
 * - Includes retry logic and screenshot saving
 */

import puppeteer from 'puppeteer';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ silent: true });

const SHEET_ID = '1NuIVorcmtPUN_r__NVcHvPuOyX8W8-xLdDHFlYC__ww';
const CREDS = JSON.parse(fs.readFileSync('./google-creds.json'));
const csvPath = 'osa_members.csv';

const csvWriter = createObjectCsvWriter({
  path: csvPath,
  header: [
    { id: 'company', title: 'Company Name' },
    { id: 'contact', title: 'Contact Name' },
    { id: 'phone', title: 'Phone' },
    { id: 'email', title: 'Email' },
    { id: 'city', title: 'City' },
    { id: 'province', title: 'Province' },
    { id: 'website', title: 'Website' },
    { id: 'memberType', title: 'Member Type' },
  ],
});

const scrapeData = async () => {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });
  const page = await browser.newPage();
  
  // Set a longer default timeout
  page.setDefaultTimeout(120000);
  
  // Set user agent to avoid detection
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let retries = 3;
  while (retries--) {
    try {
      await page.goto('https://www.ontariosignassociation.com/member-directory', {
        waitUntil: 'networkidle2',
        timeout: 120000, // Increased to 2 minutes
      });

      // Wait for any content to load first
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Get all pagination options and loop through each one
      const allMemberLinks = [];
      
      try {
        await page.waitForSelector('#idPagingData2 select', { timeout: 10000 });
        
        // Get all available pagination options
        const paginationOptions = await page.evaluate(() => {
          const select = document.querySelector('#idPagingData2 select');
          if (select) {
            return Array.from(select.options).map(opt => opt.value);
          }
          return [];
        });
        
        console.log('Available pagination options:', paginationOptions);
        
        // Loop through each pagination option
        for (const optionValue of paginationOptions) {
          console.log(`🔄 Processing pagination option: ${optionValue}`);
          
          // Select the current option
          await page.evaluate((value) => {
            const select = document.querySelector('#idPagingData2 select');
            if (select) {
              select.value = value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, optionValue);
          
          // Wait for the page to reload
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Get member links from this page
          const pageMemberLinks = await page.evaluate(() => {
            const allLinks = Array.from(document.querySelectorAll('a'));
            const publicProfileLinks = allLinks.filter(link => 
              link.href && link.href.includes('PublicProfile')
            );
            return publicProfileLinks.map(link => link.href);
          });
          
          console.log(`Found ${pageMemberLinks.length} links on page with option ${optionValue}`);
          
          // Add unique links to our collection
          pageMemberLinks.forEach(link => {
            if (!allMemberLinks.includes(link)) {
              allMemberLinks.push(link);
            }
          });
          
          // Take a screenshot for debugging
          await page.screenshot({ path: `page_option_${optionValue}.png` });
        }
        
        console.log(`✅ Total unique member links found: ${allMemberLinks.length}`);
        
      } catch (error) {
        console.log('⚠️ Error with pagination:', error.message);
      }
      
      // Take a screenshot to see what's on the page
      await page.screenshot({ path: 'screenshot.png' });
      
      // Get the page HTML to debug what selectors are available
      const pageContent = await page.content();
      console.log('Page title:', await page.title());
      console.log('Page URL:', page.url());
      
      // Check if we're on the right page or if there's a redirect
      if (!page.url().includes('member-directory')) {
        console.log('⚠️ Warning: Page may have redirected. Current URL:', page.url());
      }

      // Debug: Let's see what's actually on the page
      console.log('🔍 Debugging page content...');
      
      const pageInfo = await page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a'));
        const publicProfileLinks = allLinks.filter(link => link.href && link.href.includes('PublicProfile'));
        
        // Get all elements with member-related classes
        const memberElements = Array.from(document.querySelectorAll('[class*="member"]'));
        const memberValueElements = Array.from(document.querySelectorAll('[class*="memberValue"]'));
        
        return {
          totalLinks: allLinks.length,
          publicProfileLinks: publicProfileLinks.length,
          memberElements: memberElements.length,
          memberValueElements: memberValueElements.length,
          sampleLinks: publicProfileLinks.slice(0, 5).map(link => link.href),
          allClasses: Array.from(document.querySelectorAll('*'))
            .map(el => el.className)
            .filter(className => className && className.includes('member'))
            .slice(0, 10)
        };
      });
      
      console.log('Page debug info:', pageInfo);
      
      // Try to scroll and wait for more content to load
      console.log('🔄 Scrolling to load more content...');
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Scroll back to top
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Use the collected member links from all pagination options
      const memberLinks = allMemberLinks;
      
      console.log(`Processing ${memberLinks.length} unique member profile links`);
      
      if (memberLinks.length === 0) {
        console.log('No member links found. Taking screenshot for debugging...');
        await page.screenshot({ path: 'debug_no_links.png', fullPage: true });
        return [];
      }
      
      // Now visit each member profile page and extract detailed information
      const members = [];
      for (let i = 0; i < memberLinks.length; i++) {
        const link = memberLinks[i];
        console.log(`Processing member ${i + 1}/${memberLinks.length}: ${link}`);
        
        try {
          // Navigate to the member profile page
          await page.goto(link, { waitUntil: 'networkidle2', timeout: 30000 });
          
          // Wait for the page to load
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Extract member information from the profile page
          const memberInfo = await page.evaluate(() => {
            const getText = (label) => {
              // Find the label and get the next element's text
              const labels = Array.from(document.querySelectorAll('*'));
              for (const el of labels) {
                if (el.textContent && el.textContent.trim() === label) {
                  const nextEl = el.nextElementSibling;
                  if (nextEl) return nextEl.textContent.trim();
                  // If no next sibling, try parent's next sibling
                  const parent = el.parentElement;
                  if (parent && parent.nextElementSibling) {
                    return parent.nextElementSibling.textContent.trim();
                  }
                }
              }
              return '';
            };
            
            // Extract company name (usually in a heading)
            const company = document.querySelector('h3')?.textContent.trim() || 
                           document.querySelector('h2')?.textContent.trim() || '';
            
            // Extract contact name (First name + Last name)
            const firstName = getText('First name') || '';
            const lastName = getText('Last name') || '';
            const contact = `${firstName} ${lastName}`.trim();
            
            // Extract other fields
            const email = getText('Email') || '';
            const city = getText('City') || '';
            const province = getText('Province/State') || '';
            const website = getText('Web Site') || '';
            
            // Phone and Member Type are empty as specified
            const phone = '';
            const memberType = '';
            
            return {
              company,
              contact,
              phone,
              email,
              city,
              province,
              website,
              memberType
            };
          });
          
          members.push(memberInfo);
          
          // Take a screenshot for debugging
          await page.screenshot({ path: `member_${i + 1}.png` });
          
        } catch (error) {
          console.error(`Error processing member ${i + 1}:`, error.message);
          // Continue with next member
        }
      }

      await browser.close();
      return members;

    } catch (err) {
      console.warn(`Retrying... attempts left: ${retries}`);
      if (retries === 0) throw err;
    }
  }
};

const saveToGoogleSheet = async (rows) => {
  try {
    // Use absolute path to credentials file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const keyFilePath = path.resolve(__dirname, './google-creds.json');
    console.log('Using credentials file:', keyFilePath);
    
    // Use the credentials file directly
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Get the authenticated client
    const authClient = await auth.getClient();
    console.log('✅ Google Sheets authentication successful');

    // Create Google Sheets API client
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Prepare the data for upload
    const headers = ['Company Name', 'Contact Name', 'Phone', 'Email', 'City', 'Province', 'Website', 'Member Type'];
    const data = rows.map(row => [
      row.company,
      row.contact,
      row.phone,
      row.email,
      row.city,
      row.province,
      row.website,
      row.memberType
    ]);

    // Clear existing data and add new data
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: 'A:Z'
    });

    // Add headers and data
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'A1',
      valueInputOption: 'RAW',
      resource: {
        values: [headers, ...data]
      }
    });

    console.log(`✅ Successfully uploaded ${rows.length} records to Google Sheets`);
    
  } catch (error) {
    console.error('❌ Error saving to Google Sheets:', error.message);
    console.error('Full error:', error);
    // Continue with CSV export even if Google Sheets fails
  }
};

(async () => {
  try {
    const rows = await scrapeData();
    
    if (rows.length > 0) {
      await csvWriter.writeRecords(rows);
      console.log(`✅ Saved ${rows.length} records to ${csvPath}`);
      
      // Upload to Google Sheets
      await saveToGoogleSheet(rows);
    } else {
      console.log('⚠️ No data found to save');
    }

  } catch (err) {
    console.error('❌ Error scraping:', err);
  }
})();
