# OSA Member Directory Scraper

A powerful Node.js web scraper that extracts comprehensive member data from the Ontario Sign Association (OSA) member directory. Features intelligent pagination handling, individual profile scraping, and dual export capabilities.

## ✨ Features

### Core Functionality
- **Intelligent Pagination**: Automatically loops through all pagination options to capture every member
- **Individual Profile Scraping**: Visits each member's detailed profile page for comprehensive data extraction
- **Dual Export**: Saves data to both CSV file and Google Sheets simultaneously
- **Robust Error Handling**: Continues processing even if individual members fail
- **Modern ES6**: Built with modern JavaScript and ES6 modules

### Data Extracted
- **Company Name** - Extracted from profile headings
- **Contact Name** - Combined First Name + Last Name
- **Email** - Direct email address from profile
- **City** - Member's city location
- **Province/State** - Member's province (e.g., ON)
- **Website** - Company website URL
- **Phone** - Currently set to empty (configurable)
- **Member Type** - Currently set to empty (configurable)

### Technical Features
- **Puppeteer Automation**: Headless browser automation with custom user agents
- **Google Sheets API Integration**: Direct upload to specified Google Sheet
- **CSV Export**: Local file export with proper headers
- **Debug Screenshots**: Automatic screenshots for troubleshooting
- **Progress Tracking**: Real-time logging of scraping progress

## Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/osa-directory-scraper.git
cd osa-directory-scraper
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Google Sheets Setup
1. Create a Google Cloud Project
2. Enable Google Sheets API
3. Create a Service Account
4. Download the service account JSON file as `google-creds.json`
5. **Place `google-creds.json` in the project root** (this file is gitignored for security)
6. Share your Google Sheet with the service account email
7. Update the `SHEET_ID` in the script with your Google Sheet ID

**⚠️ Security Note:** The `google-creds.json` file contains sensitive credentials and is automatically excluded from Git via `.gitignore`. Never commit this file to version control.

### 4. Environment Variables (Optional)
Create a `.env` file if it doesn't exist or rename the current `env` file:
```env
SHEET_ID=your_google_sheet_id_here
```

## Usage

### Basic Usage
```bash
node scrape-osa.js
```

### What Happens
1. **Navigates** to OSA member directory
2. **Detects** all pagination options (10, 25, 50, 100, 139, etc.)
3. **Loops** through each pagination option to collect all member links
4. **Visits** each individual member profile page
5. **Extracts** detailed information from each profile
6. **Saves** to `osa_members.csv`
7. **Uploads** to your Google Sheet

## Output Files

- `osa_members.csv` - Main data export
- `screenshot.png` - Main page screenshot
- `page_option_X.png` - Screenshots for each pagination option
- `member_X.png` - Individual member profile screenshots

## Configuration

### Google Sheet ID
Update the `SHEET_ID` constant in `scrape-osa.js`:
```javascript
const SHEET_ID = 'your_google_sheet_id_here';
```

### Data Fields
Modify the data extraction in the `memberInfo` object to capture additional fields or change field mappings.

## Troubleshooting

### Common Issues
- **Authentication Errors**: Ensure `google-creds.json` is properly configured
- **Pagination Issues**: Check if the website structure has changed
- **Missing Data**: Verify member profile page structure hasn't changed

### Debug Mode
The script includes extensive logging and screenshot capture for debugging:
- Check console output for detailed progress
- Review screenshots in the project directory
- Verify Google Sheet permissions

## Dependencies

- `puppeteer` - Web scraping automation
- `googleapis` - Google Sheets API integration
- `csv-writer` - CSV file export
- `dotenv` - Environment variable management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Disclaimer

This scraper is for educational and legitimate business purposes only. Please respect the website's terms of service and robots.txt file. Use responsibly and in accordance with applicable laws and regulations.

---

**Built for efficient data extraction**
