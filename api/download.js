module.exports = async function handler(request, response) {
	if (request.method !== 'GET') {
		response.status(405).json({ error: 'Method not allowed' });
		return;
	}
	if (!process.env.V0_API_KEY) {
		response.status(503).json({ error: 'V0_API_KEY ещё не добавлен в Vercel' });
		return;
	}
	const chatId = new URL(request.url, `https://${request.headers.host}`).searchParams.get('chatId');
	if (!chatId) {
		response.status(400).json({ error: 'Нужен chatId' });
		return;
	}
	try {
		const upstream = await fetch(`https://api.v0.dev/v2/chats/${encodeURIComponent(chatId)}/files/download`, {
			headers: { Authorization: `Bearer ${process.env.V0_API_KEY}` },
		});
		if (!upstream.ok) {
			const result = await upstream.json().catch(() => ({}));
			throw new Error(result.error?.message || result.message || `v0 API returned ${upstream.status}`);
		}
		const archive = Buffer.from(await upstream.arrayBuffer());
		response.setHeader('Content-Type', 'application/zip');
		response.setHeader('Content-Disposition', `attachment; filename="codegpt-${chatId}.zip"`);
		response.status(200).send(archive);
	} catch (error) {
		response.status(502).json({ error: error.message || 'Не удалось скачать ZIP' });
	}
};