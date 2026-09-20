const { v0 } = require('v0');

module.exports = async function handler(request, response) {
	if (request.method !== 'POST') {
		response.status(405).json({ error: 'Method not allowed' });
		return;
	}
	if (!process.env.V0_API_KEY) {
		response.status(503).json({ error: 'V0_API_KEY ещё не добавлен в Vercel' });
		return;
	}
	const { chatId } = request.body || {};
	if (!chatId) {
		response.status(400).json({ error: 'Нужен chatId' });
		return;
	}
	try {
		const result = await v0.chats.deploy({ chatId });
		if (result.error) throw new Error(result.error.message);
		response.status(200).json(result.data);
	} catch (error) {
		response.status(502).json({ error: error.message || 'Не удалось задеплоить приложение' });
	}
};