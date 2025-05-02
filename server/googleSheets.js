const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// This function initializes the Google Sheets API client
async function getGoogleSheetsClient() {
  try {
    let credentials;
    
    // Check if credentials are provided as a Base64-encoded environment variable
    if (process.env.GOOGLE_CREDENTIALS_BASE64) {
      try {
        // Decode the Base64 string to get the JSON credentials
        const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString();
        credentials = JSON.parse(credentialsJson);
        console.log('Using Google credentials from environment variable');
      } catch (decodeError) {
        console.error('Error decoding Google credentials from environment variable:', decodeError);
        throw new Error('Invalid Google credentials in environment variable');
      }
    } else {
      // Fall back to file-based credentials
      const CREDENTIALS_PATH = path.join(__dirname, 'google-credentials.json');
      
      // Check if credentials file exists
      if (!fs.existsSync(CREDENTIALS_PATH)) {
        console.error('Google credentials file not found at:', CREDENTIALS_PATH);
        throw new Error('Google credentials not found. Please provide either a credentials file or set GOOGLE_CREDENTIALS_BASE64 environment variable');
      }
      
      // Load credentials from file
      credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
      console.log('Using Google credentials from file');
    }
    
    // Create JWT client
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    
    // Create and return the sheets client
    return google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error('Error initializing Google Sheets client:', error);
    throw error;
  }
}

// Add a new quote to the Google Sheet
async function addQuoteToSheet(quoteData) {
  try {
    // Get the Google Sheets client
    const sheets = await getGoogleSheetsClient();
    
    // Get the spreadsheet ID from environment variable
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID environment variable not set');
    }
    
    // Format the data for Google Sheets
    // Adjust these fields based on your actual data structure
    const values = [
      [
        quoteData.quoteId,
        quoteData.timestamp || new Date().toISOString(),
        quoteData.userInfo.name,
        quoteData.userInfo.email,
        quoteData.userInfo.phone,
        quoteData.userInfo.address,
        quoteData.userInfo.notes || '',
        JSON.stringify(quoteData.cleaningServices),
        quoteData.cleaningContext || '',
        quoteData.analysis,
        quoteData.estimatedPrice || 'Not specified'
      ]
    ];
    
    // Append the data to the sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:K', // Adjust range based on your sheet structure
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values
      }
    });
    
    console.log('Quote added to Google Sheet:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error adding quote to Google Sheet:', error);
    throw error;
  }
}

module.exports = {
  addQuoteToSheet
};
