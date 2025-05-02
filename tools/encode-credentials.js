/**
 * This utility script converts your Google credentials JSON file to a Base64 string
 * that you can safely store as an environment variable on Render.com
 * 
 * Usage: node encode-credentials.js path/to/your/google-credentials.json
 */

const fs = require('fs');
const path = require('path');

// Get the file path from command line arguments
const filePath = process.argv[2];

if (!filePath) {
  console.error('Please provide the path to your credentials file.');
  console.error('Usage: node encode-credentials.js path/to/your/google-credentials.json');
  process.exit(1);
}

try {
  // Read the file
  const fullPath = path.resolve(filePath);
  console.log(`Trying to read file from: ${fullPath}`);
  
  const fileContent = fs.readFileSync(fullPath, 'utf8');
  
  // Parse JSON to validate it's a valid JSON file
  JSON.parse(fileContent);
  
  // Convert to Base64
  const base64Content = Buffer.from(fileContent).toString('base64');
  
  console.log('\nYour Base64-encoded Google credentials:');
  console.log('----------------------------------------');
  console.log(base64Content);
  console.log('----------------------------------------');
  console.log('\nAdd this as an environment variable named GOOGLE_CREDENTIALS_BASE64 on Render.com');
  console.log('Important: Keep this string secure and do not share it publicly!\n');
  
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error(`Error: File not found at ${filePath}`);
  } else if (error instanceof SyntaxError) {
    console.error('Error: The file is not valid JSON');
  } else {
    console.error('Error:', error.message);
  }
  process.exit(1);
}
