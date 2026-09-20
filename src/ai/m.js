const providers = [
	{ id: 'v0', name: 'v0', detail: 'Vercel app builder' },
	{ id: 'luna', name: 'GPT-5.6 Luna', detail: 'Основная модель' },
	{ id: 'claude', name: 'Claude', detail: 'Резервная модель' },
	{ id: 'gemini', name: 'Gemini 3.1 Flash-Lite', detail: 'Безлимитный резерв' },
];

const defaultEndpoint = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
	? 'http://127.0.0.1:3210/chat'
	: '/api/chat';

export function getProviders() {
	return providers.map((provider) => ({ ...provider }));
}

export function selectProvider(usage = {}) {
	return providers.find((provider) => usage[provider.id] !== 'exhausted') || providers.at(-1);
}

export async function askCodeGPT(prompt, options = {}) {
	const provider = selectProvider(options.usage);
	const endpoint = options.endpoint || window.CODEGPT_ENDPOINT || defaultEndpoint;

	try {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt, provider: provider.id, attachments: options.attachments || [] }),
		});
		const result = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(result.error || 'Сервер вернул ' + response.status);
		if (result.pending) return waitForGeneration(result.chatId, result.messageId, provider);
		return { provider: providers.find((item) => item.id === result.provider) || provider, text: result.text, project: result.project };
	} catch (error) {
		if (window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost') throw error;
		if (options.allowDemo === false) throw error;
	}

	await new Promise((resolve) => setTimeout(resolve, 850));
	return {
		provider,
		demo: true,
		text: 'Я понял задачу: «' + prompt + '»\n\n'
			+ 'Это демо-ответ CodeGPT. Публичный API ещё не настроен: добавьте AI_API_KEY и модели в настройках Vercel.',
	};
}

async function waitForGeneration(chatId, messageId, provider, startedAt = Date.now()) {
	if (Date.now() - startedAt > 10 * 60 * 1000) throw new Error('Генерация v0 заняла больше 10 минут');
	await new Promise((resolve) => setTimeout(resolve, 3000));
	const response = await fetch(`/api/message?chatId=${encodeURIComponent(chatId)}&messageId=${encodeURIComponent(messageId)}`);
	const result = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(result.error || 'Не удалось проверить генерацию v0');
	if (result.pending) return waitForGeneration(chatId, messageId, provider, startedAt);
	return { provider, text: result.text, project: result.project };
}
