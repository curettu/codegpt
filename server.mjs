import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
};

createServer(async (request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
	const relativePath = requestPath.startsWith('/chat/') ? 'index.html' : requestPath.slice(1) || 'index.html';
	const filePath = path.resolve(root, relativePath);
	if (!filePath.startsWith(root)) {
		response.writeHead(403);
		response.end('Forbidden');
		return;
	}
	try {
		const content = await fs.readFile(filePath);
		response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
		response.end(content);
	} catch {
		response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
		response.end('Not found');
	}
}).listen(port, '127.0.0.1', () => {
	console.log(`CodeGPT ready at http://127.0.0.1:${port}`);
});