const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'build')));

// Handle React routing - return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`Biodesign Metadata Tool is running!`);
  console.log(`========================================`);
  console.log(`\nOpen your browser and navigate to:`);
  console.log(`  http://localhost:${PORT}\n`);
  console.log(`Press Ctrl+C to stop the server.\n`);
  
  // Try to open browser automatically (optional, works on most systems)
  // Note: xdg-open may not work in packaged executables, so we gracefully handle failures
  try {
    const start = process.platform === 'darwin' ? 'open' : 
                  process.platform === 'win32' ? 'start' : 'xdg-open';
    execAsync(`${start} http://localhost:${PORT}`).catch(() => {
      // Ignore errors if browser can't be opened automatically
      // User can manually navigate to the URL
    });
  } catch (error) {
    // Ignore errors - browser opening is optional
  }
});
