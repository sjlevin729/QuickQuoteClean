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

/**
 * Adds a quote to the Google Sheet
 * @param {Object} quoteData - The quote data to add
 * @param {string} quoteData.quoteId - The unique ID of the quote
 * @param {string} quoteData.timestamp - ISO timestamp of when the quote was created
 * @param {Object} quoteData.userInfo - User information (name, email, phone, address)
 * @param {string} quoteData.cleaningContext - Additional context provided by the user
 * @param {string} quoteData.activityCounts - JSON string of the activity counts
 * @param {string} quoteData.analysis - The full quote text
 * @param {string} quoteData.estimatedPrice - The estimated price extracted from the quote
 * @param {string} quoteData.videoUrl - The URL of the video
 * @returns {Promise<void>}
 */
async function addQuoteToSheet(quoteData) {
  try {
    const sheets = await getGoogleSheetsClient();
    
    // Parse activity counts to create a readable summary
    let activitySummary = '';
    try {
      if (quoteData.activityCounts) {
        const counts = typeof quoteData.activityCounts === 'string' 
          ? JSON.parse(quoteData.activityCounts) 
          : quoteData.activityCounts;
        
        // Format rooms in a more readable way
        if (counts.rooms) {
          activitySummary = 'Rooms:\n';
          Object.entries(counts.rooms).forEach(([room, count]) => {
            if (count > 0) {
              // Convert camelCase to Title Case (e.g., "livingDiningRooms" to "Living Dining Rooms")
              const formattedRoom = room
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase());
              
              activitySummary += `${formattedRoom}: ${count}\n`;
            }
          });
        }
        
        // Format activities in a more readable way
        if (counts.activities) {
          activitySummary += '\nActivities:\n';
          Object.entries(counts.activities).forEach(([activity, included]) => {
            if (included) {
              // Convert camelCase to Title Case
              const formattedActivity = activity
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase());
              
              activitySummary += `${formattedActivity}: Yes\n`;
            }
          });
        }
      }
    } catch (error) {
      console.error('Error parsing activity counts:', error);
      activitySummary = 'Error parsing activity counts';
    }
    
    // Prepare row data with proper formatting for each column
    const values = [
      [
        quoteData.quoteId || '',
        new Date().toLocaleDateString('en-GB'), // Format date as DD/MM/YYYY
        quoteData.userInfo?.name || '',
        quoteData.userInfo?.email || '',
        quoteData.userInfo?.phone || '',
        quoteData.userInfo?.address || '',
        quoteData.cleaningContext || '',
        activitySummary,
        quoteData.analysis || '',
        quoteData.estimatedPrice || '',
        quoteData.videoUrl || ''
      ]
    ];
    
    // Append data to the sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:L',  // Updated to include all columns including address and video URL
      valueInputOption: 'RAW',
      resource: {
        values
      }
    });
    
    console.log(`Quote ${quoteData.quoteId} added to Google Sheet`);
  } catch (error) {
    console.error('Error adding quote to Google Sheet:', error);
    throw error;
  }
}

module.exports = {
  addQuoteToSheet
};
