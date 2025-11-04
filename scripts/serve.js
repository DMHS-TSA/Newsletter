const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'docs');
const port = process.env.PORT || 5173;

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript';
  if (file.endsWith('.xml')) return 'application/xml';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(root, urlPath.replace(/^\//, ''));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      res.end(data);
    } else {
      // try index.html fallback in directories
      const alt = path.join(filePath, 'index.html');
      if (fs.existsSync(alt)) {
        const data = fs.readFileSync(alt);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    }
  } catch (e) {
    res.writeHead(500);
    res.end('Server error ' + e.message);
  }
});

server.listen(port, () => console.log(`Preview server running at http://localhost:${port}/`));
