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
		const upstream = await fetch(`https://api.v0.dev/v2/chats/${encodeURIComponent(chatId)}/deploy`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${process.env.V0_API_KEY}` },
		});
		const result = await upstream.json();
		if (!upstream.ok) throw new Error(result.error?.message || result.message || `v0 API returned ${upstream.status}`);
		response.status(200).json(result);
	} catch (error) {
		response.status(502).json({ error: error.message || 'Не удалось задеплоить приложение' });
	}
};