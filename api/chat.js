const maxPromptLength = 200000;

async function handler(request, response) {
	if (request.method !== 'POST') {
		response.status(405).json({ error: 'Method not allowed' });
		return;
	}

	const { prompt, attachments = [], settings = {} } = request.body || {};
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
		const upstream = await fetch('https://api.v0.dev/v2/chats/async', {
			method: 'POST',
			headers: { Authorization: `Bearer ${process.env.V0_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				message: prompt,
				systemPrompt: buildSystemPrompt(settings),
				attachments: attachments.filter((file) => file.data).map((file) => ({ url: file.data })),
			}),
		});
		const result = await upstream.json();
		if (!upstream.ok) throw new Error(result.error?.message || result.message || `v0 API returned ${upstream.status}`);
		response.status(202).json({ provider: 'v0', pending: true, chatId: result.chatId, messageId: result.messageId });
	} catch (error) {
		response.status(502).json({ error: error.message || 'v0 API request failed' });
	}
}

function buildSystemPrompt(settings) { const tone = { professional: 'Профессионально и структурированно.', friendly: 'Дружелюбно и понятно.', direct: 'Прямо, строго и без лишних слов.', playful: 'Легко и с уместным юмором.' }[settings.tone] || 'Профессионально и структурированно.'; const detail = { concise: 'Будь кратким.', balanced: 'Давай сбалансированное объяснение.', deep: 'Давай подробное объяснение с примерами.' }[settings.detail] || 'Давай сбалансированное объяснение.'; return `Ты CodeGPT, AI-конструктор приложений. ${tone} ${detail} Отвечай на ${settings.language === 'en' ? 'английском' : 'русском'} языке. ${settings.selfCheck !== false ? 'Проверяй решение перед ответом.' : ''} ${settings.uiCheck !== false ? 'Проверяй UX и адаптивность.' : ''}`; }


module.exports = handler;