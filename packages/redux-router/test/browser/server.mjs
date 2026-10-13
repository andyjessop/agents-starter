import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const app = join(root, 'test/browser/app/index.html');
const port = Number(process.env.PORT ?? 4173);

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
]);

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const candidate = resolve(root, `.${normalize(decoded)}`);
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null;
}

function sendFile(response, path) {
  response.writeHead(200, {
    'content-type': types.get(extname(path)) ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(path).pipe(response);
}

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    const candidate = safePath(url.pathname);
    if (candidate && existsSync(candidate) && statSync(candidate).isFile()) {
      sendFile(response, candidate);
      return;
    }

    // Extensionless requests are application routes and get the SPA shell.
    if (!extname(url.pathname)) {
      sendFile(response, app);
      return;
    }

    response.writeHead(404).end('Not found');
  } catch {
    response.writeHead(400).end('Bad request');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`router e2e server listening on http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
