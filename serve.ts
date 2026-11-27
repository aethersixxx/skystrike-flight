import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const port = Number(process.env.PORT || 8080);
const gameRoot = resolve(process.cwd(), 'game');
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  let pathname = normalize(decodeURIComponent(requestUrl.pathname));
  if (pathname === '/' || pathname === '/.') pathname = '/index.html';
  const relative = pathname.replace(/^\/+/, '');
  const filePath = resolve(gameRoot, relative);
  if (filePath !== gameRoot && !filePath.startsWith(gameRoot + sep)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  const servePath = () => {
    const contentType = mimeTypes.get(extname(filePath).toLowerCase()) || 'application/octet-stream';
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(response);
  };

  const serveIndex = () => {
    const indexPath = join(gameRoot, 'index.html');
    if (!existsSync(indexPath)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('game/index.html not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    createReadStream(indexPath).pipe(response);
  };

  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) serveIndex();
    else servePath();
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`SKYSTRIKE serving game/ at http://localhost:${port}`);
});
