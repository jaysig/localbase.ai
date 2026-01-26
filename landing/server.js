const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // Serve install script
  if (url === '/install' || url === '/install.sh') {
    const script = fs.readFileSync(path.join(__dirname, 'install'), 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache'
    });
    res.end(script);
    return;
  }

  // Serve landing page
  if (url === '/' || url === '/index.html') {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(html);
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Landing page server running on port ${PORT}`);
});
