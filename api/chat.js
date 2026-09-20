const maxPromptLength = 200000;

async function handler(request, response) {
	if (request.method !== 'POST') {
		response.status(405).json({ error: 'Method not allowed' });
		return;
	}

	const { prompt, attachments = [] } = request.body || {};
	if (typeof prompt !== 'string' || !prompt.trim()) {
		response.status(400).json({ error: 'Нужен непустой prompt' });
		return;
	}
	if (prompt.length > maxPromptLength) {
		response.status(413).json({ error: 'Сообщение слишком большое' });
		return;
	}
	if (!process.env.V0_API_KEY) {
		response.status(503).json({ error: 'V0_API_KEY ещё не добавлен в Vercel' });
		return;
	}

	try {
		const upstream = await fetch('https://api.v0.dev/v2/chats', {
			method: 'POST',
			headers: { Authorization: `Bearer ${process.env.V0_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				message: prompt,
				attachments: attachments.filter((file) => file.data).map((file) => ({ url: file.data })),
			}),
		});
		const result = await upstream.json();
		if (!upstream.ok) throw new Error(result.error?.message || result.message || `v0 API returned ${upstream.status}`);
		const chat = result.chat;
		const message = result.messages?.at(-1);
		response.status(200).json({ provider: 'v0', chatId: chat.id, preview: chat.previewUrl || null, text: extractText(message), project: { chatId: chat.id, vercelProjectId: chat.vercelProjectId || null } });
	} catch (error) {
		response.status(502).json({ error: error.message || 'v0 API request failed' });
	}
}

function extractText(message) {
	if (!message) return 'v0 создал приложение.';
	if (typeof message.content === 'string') return message.content;
	if (Array.isArray(message.parts)) return message.parts.filter((part) => part.type === 'text').map((part) => part.text).join('\n');
	return 'v0 создал приложение.';
}

module.exports = handler;