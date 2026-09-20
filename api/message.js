module.exports = async function handler(request, response) {
	if (request.method !== 'GET') {
		response.status(405).json({ error: 'Method not allowed' });
		return;
	}
	const url = new URL(request.url, `https://${request.headers.host}`);
	const chatId = url.searchParams.get('chatId');
	const messageId = url.searchParams.get('messageId');
	if (!chatId || !messageId) {
		response.status(400).json({ error: 'Нужны chatId и messageId' });
		return;
	}
	try {
		const upstream = await fetch(`https://api.v0.dev/v2/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`, { headers: { Authorization: `Bearer ${process.env.V0_API_KEY}` } });
		const message = await upstream.json();
		if (!upstream.ok) throw new Error(message.error?.message || message.message || `v0 API returned ${upstream.status}`);
		const text = typeof message.content === 'string' ? message.content : (message.parts || []).filter((part) => part.type === 'text').map((part) => part.text).join('\n');
		response.status(200).json({ pending: !message.finishReason, text: text || 'v0 создаёт приложение...', project: { chatId }, finishReason: message.finishReason || null });
	} catch (error) {
		response.status(502).json({ error: error.message || 'Не удалось получить статус генерации' });
	}
};