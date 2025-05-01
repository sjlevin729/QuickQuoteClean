import React from 'react';
import { createRoot } from 'react-dom/client';

// Simple component for testing
const SimpleApp = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>QuickQuote - Simple Test</h1>
      <p>If you can see this, the React application is working correctly.</p>
      <button 
        style={{ 
          padding: '10px 15px', 
          backgroundColor: '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px',
          cursor: 'pointer'
        }}
        onClick={() => alert('Button clicked!')}
      >
        Test Button
      </button>
    </div>
  );
};

// Render the simple app
const root = createRoot(document.getElementById('root'));
root.render(<SimpleApp />);
