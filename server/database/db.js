const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure the database directory exists
const dbDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const dbPath = path.join(dbDir, 'quickquote.db');
const db = new Database(dbPath);

// Create tables if they don't exist
function initializeDatabase() {
  // Create quotes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      quote_text TEXT NOT NULL,
      video_url TEXT
    )
  `);

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id TEXT NOT NULL,
      name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quote_id) REFERENCES quotes(id)
    )
  `);

  console.log('Database initialized successfully');
}

// Save a quote to the database
function saveQuote(quoteId, quoteText, videoUrl = null) {
  const stmt = db.prepare('INSERT INTO quotes (id, quote_text, video_url) VALUES (?, ?, ?)');
  const result = stmt.run(quoteId, quoteText, videoUrl);
  return result;
}

// Save user information
function saveUserInfo(quoteId, userInfo) {
  const { name, email, phone, address, notes } = userInfo;
  const stmt = db.prepare(`
    INSERT INTO users (quote_id, name, email, phone, address, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(quoteId, name, email, phone, address, notes);
  return result;
}

// Get a quote by ID
function getQuoteById(quoteId) {
  const stmt = db.prepare('SELECT * FROM quotes WHERE id = ?');
  return stmt.get(quoteId);
}

// Get user information by quote ID
function getUserByQuoteId(quoteId) {
  const stmt = db.prepare('SELECT * FROM users WHERE quote_id = ?');
  return stmt.get(quoteId);
}

// Get all quotes with user information
function getAllQuotes() {
  const stmt = db.prepare(`
    SELECT q.*, u.name, u.email, u.phone
    FROM quotes q
    LEFT JOIN users u ON q.id = u.quote_id
    ORDER BY q.created_at DESC
  `);
  return stmt.all();
}

// Update video URL for a quote
function updateVideoUrl(quoteId, videoUrl) {
  const stmt = db.prepare('UPDATE quotes SET video_url = ? WHERE id = ?');
  const result = stmt.run(videoUrl, quoteId);
  return result;
}

// Delete a quote and associated user information
function deleteQuote(quoteId) {
  // First delete the user information (due to foreign key constraint)
  const deleteUserStmt = db.prepare('DELETE FROM users WHERE quote_id = ?');
  deleteUserStmt.run(quoteId);
  
  // Then delete the quote
  const deleteQuoteStmt = db.prepare('DELETE FROM quotes WHERE id = ?');
  const result = deleteQuoteStmt.run(quoteId);
  
  return result;
}

// Update quote text
function updateQuoteText(quoteId, quoteText) {
  const stmt = db.prepare('UPDATE quotes SET quote_text = ? WHERE id = ?');
  const result = stmt.run(quoteText, quoteId);
  return result;
}

// Update user information
function updateUserInfo(quoteId, userInfo) {
  const { name, email, phone, address, notes } = userInfo;
  const stmt = db.prepare(`
    UPDATE users 
    SET name = ?, email = ?, phone = ?, address = ?, notes = ?
    WHERE quote_id = ?
  `);
  const result = stmt.run(name, email, phone, address, notes, quoteId);
  return result;
}

// Initialize the database when this module is loaded
initializeDatabase();

module.exports = {
  saveQuote,
  saveUserInfo,
  getQuoteById,
  getUserByQuoteId,
  getAllQuotes,
  updateVideoUrl,
  deleteQuote,
  updateQuoteText,
  updateUserInfo
};
