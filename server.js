const fs = require('fs');
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Simple command line argument parsing
if (process.argv.length < 3) {
  console.error('Usage: node server.js <harfile>');
  process.exit(1);
}

const harFile = process.argv[2];
console.log(`Starting HAR replay server with HAR file: ${harFile}`);

// Read and parse the HAR file
let harData;
try {
  harData = JSON.parse(fs.readFileSync(harFile, 'utf8'));
  console.log('HAR file successfully read and parsed.');
} catch (error) {
  console.error(`Error reading or parsing HAR file: ${error.message}`);
  process.exit(1);
}

// Extract the main HTML content and assets
const mainEntry = harData.log.entries.find(entry => entry.response.content.mimeType.includes('html'));
if (!mainEntry) {
  console.error('No main HTML content found in HAR file.');
  process.exit(1);
}
const mainHtml = mainEntry.response.content.text;
const assets = harData.log.entries.filter(entry => !entry.response.content.mimeType.includes('html'));

// Function to get asset by URL
function getAssetByUrl(url) {
  return assets.find(entry => entry.request.url === url || entry.request.url.endsWith(url));
}

// Function to rewrite URLs
function rewriteUrl(url) {
  if (url.startsWith('http') || url.startsWith('//')) {
    const asset = getAssetByUrl(url);
    if (asset) {
      const parsedUrl = new URL(asset.request.url);
      return parsedUrl.pathname;
    }
  }
  return url;
}

// Rewrite URLs in the main HTML content
const rewrittenHtml = mainHtml.replace(/(src|href)="([^"]+)"/g, (match, attr, url) => {
  const rewrittenUrl = rewriteUrl(url);
  return `${attr}="${rewrittenUrl}"`;
});

// Serve the main HTML content at the root URL
app.get('/', (req, res) => {
  res.send(rewrittenHtml);
  console.log('Served main HTML content at root URL.');
});

// Serve assets
app.get('/*', (req, res) => {
  const assetPath = req.path.substring(1); // Remove leading slash
  const asset = getAssetByUrl(assetPath);
  
  if (asset) {
    const contentType = asset.response.content.mimeType;
    let content = asset.response.content.text;
    
    if (asset.response.content.encoding === 'base64') {
      content = Buffer.from(content, 'base64');
    }
    
    res.contentType(contentType);
    res.send(content);
    console.log(`Served asset: ${req.path}`);
  } else {
    res.status(404).send('Asset not found');
    console.warn(`Asset not found: ${req.path}`);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`HAR replay server running at http://localhost:${port}`);
});
