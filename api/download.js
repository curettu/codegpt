const { v0 } = require('v0');

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
		const result = await v0.chats.downloadFiles({ chatId });
		if (result.error) throw new Error(result.error.message);
		const archive = result.data;
		response.setHeader('Content-Type', 'application/zip');
		response.setHeader('Content-Disposition', `attachment; filename="codegpt-${chatId}.zip"`);
		response.status(200).send(archive);
	} catch (error) {
		response.status(502).json({ error: error.message || 'Не удалось скачать ZIP' });
	}
};