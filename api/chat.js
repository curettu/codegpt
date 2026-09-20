const providers = [
	{ id: 'luna', model: process.env.AI_MODEL_LUNA },
	{ id: 'claude', model: process.env.AI_MODEL_CLAUDE },
	{ id: 'gemini', model: process.env.AI_MODEL_GEMINI },
];

const maxPromptLength = 200000;

async function handler(request, response) {
	if (request.method !== 'POST') {
		response.status(405).json({ error: 'Method not allowed' });
		return;
	}

	const { prompt, provider, attachments = [] } = request.body || {};
	if (typeof prompt !== 'string' || !prompt.trim()) {
		response.status(400).json({ error: 'Нужен непустой prompt' });
		return;
	}
	if (prompt.length > maxPromptLength) {
		response.status(413).json({ error: 'Сообщение слишком большое' });
		return;
	}
	if (!process.env.AI_API_KEY) {
		response.status(503).json({ error: 'Публичный AI backend ещё не настроен' });
		return;
	}

	const requestedIndex = Math.max(providers.findIndex((item) => item.id === provider), 0);
	const attempts = [...providers.slice(requestedIndex), ...providers.slice(0, requestedIndex)].filter((item) => item.model);
	let lastError;
	for (const item of attempts) {
		try {
			const text = await askModel(item.model, prompt, attachments);
			response.status(200).json({ provider: item.id, text });
			return;
		} catch (error) {
			lastError = error;
		}
	}
	response.status(502).json({ error: lastError?.message || 'Нет доступной модели' });
}

async function askModel(model, prompt, attachments) {
	const content = [{ type: 'text', text: prompt + formatAttachmentContext(attachments) }];
	for (const file of attachments) {
		if (file.type?.startsWith('image/') && file.data) content.push({ type: 'image_url', image_url: { url: file.data } });
	}
	const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
	const result = await fetch(`${baseUrl}/chat/completions`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ model, messages: [{ role: 'system', content: 'You are CodeGPT, a precise coding assistant. Answer with Markdown and LaTeX when useful.' }, { role: 'user', content }] }),
	});
	const data = await result.json();
	if (!result.ok) throw new Error(data.error?.message || `Model server returned ${result.status}`);
	return data.choices?.[0]?.message?.content || 'Модель вернула пустой ответ.';
}

function formatAttachmentContext(attachments) {
	if (!Array.isArray(attachments) || !attachments.length) return '';
	return `\n\nВложения пользователя:\n${attachments.map((file) => `- ${file.name} (${file.type || 'unknown'}, ${file.size || 0} bytes)`).join('\n')}\n${attachments.map(readTextAttachment).join('\n')}`;
}

function readTextAttachment(file) {
	if (!file.data || (!/^text\//i.test(file.type || '') && !/\.(txt|md|json|js|ts|css|html|xml|csv|yaml|yml|py|java|c|cpp|cs|go|rs|sh|sql)$/i.test(file.name || ''))) return '';
	try {
		return `\n--- ${file.name} ---\n${Buffer.from(String(file.data).split(',')[1] || '', 'base64').toString('utf8')}`;
	} catch {
		return '';
	}
}

module.exports = handler;