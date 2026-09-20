module.exports = async function handler(request, response) {
	if (request.method !== 'GET') return response.status(405).send('Method not allowed');
	const url = new URL(request.url, `https://${request.headers.host}`);
	const chatId = url.searchParams.get('chatId');
	const requestedPath = url.searchParams.get('path') || '/';
	if (!chatId) return response.status(400).send('Missing chatId');
	try {
		const previewResponse = await fetch(`https://api.v0.dev/v2/chats/${encodeURIComponent(chatId)}/preview`, { headers: { Authorization: `Bearer ${process.env.V0_API_KEY}` } });
		const preview = await previewResponse.json();
		if (!previewResponse.ok || !preview.url) throw new Error(preview.error?.message || 'Preview ещё не готов');
		const target = new URL(requestedPath, preview.url);
		const upstream = await fetch(target, { headers: { 'x-v0-preview-token': preview.token } });
		const contentType = upstream.headers.get('content-type') || 'text/plain; charset=utf-8';
		let body = await upstream.text();
		if (contentType.includes('text/html')) {
			const prefix = `/api/preview-proxy?chatId=${encodeURIComponent(chatId)}&path=`;
			body = body.replace(/((?:src|href)=['"])(\/(?!\/)[^'"]+)/g, `$1${prefix}$2`);
		}
		response.setHeader('Content-Type', contentType);
		response.setHeader('Cache-Control', 'no-store');
		response.status(upstream.status).send(body);
	} catch (error) {
		response.status(502).send(error.message || 'Preview unavailable');
	}
};