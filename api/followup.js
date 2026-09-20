module.exports = async function handler(request, response) {
	if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
	const { chatId, prompt, attachments = [] } = request.body || {};
	if (!chatId || typeof prompt !== 'string' || !prompt.trim()) return response.status(400).json({ error: 'Нужны chatId и prompt' });
	if (!process.env.V0_API_KEY) return response.status(503).json({ error: 'V0_API_KEY ещё не добавлен в Vercel' });
	try {
		const upstream = await fetch(`https://api.v0.dev/v2/chats/${encodeURIComponent(chatId)}/messages/async`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${process.env.V0_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: prompt, attachments: attachments.filter((file) => file.data).map((file) => ({ url: file.data })) }),
		});
		const result = await upstream.json();
		if (!upstream.ok) throw new Error(result.error?.message || result.message || `v0 API returned ${upstream.status}`);
		response.status(202).json({ provider: 'v0', pending: true, chatId, messageId: result.messageId });
	} catch (error) {
		response.status(502).json({ error: error.message || 'Не удалось изменить приложение' });
	}
};