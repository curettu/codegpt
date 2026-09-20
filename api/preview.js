module.exports = async function handler(request, response) {
	if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
	const chatId = new URL(request.url, `https://${request.headers.host}`).searchParams.get('chatId');
	if (!chatId) return response.status(400).json({ error: 'Нужен chatId' });
	try {
		const upstream = await fetch(`https://api.v0.dev/v2/chats/${encodeURIComponent(chatId)}/preview`, { headers: { Authorization: `Bearer ${process.env.V0_API_KEY}` } });
		const result = await upstream.json();
		if (!upstream.ok) throw new Error(result.error?.message || result.message || `v0 API returned ${upstream.status}`);
		response.status(200).json(result);
	} catch (error) {
		response.status(502).json({ error: error.message || 'Не удалось получить preview' });
	}
};