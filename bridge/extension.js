const vscode = require('vscode');
const http = require('node:http');

const providerOrder = ['luna', 'claude', 'gemini'];
const providerMatchers = {
	luna: /(luna|gpt)/i,
	claude: /claude/i,
	gemini: /(gemini|flash)/i,
};

let server;

function activate(context) {
	startServer(context);
	context.subscriptions.push(vscode.commands.registerCommand('codegptBridge.restart', () => {
		stopServer();
		startServer(context);
	}));
}

function startServer(context) {
	const port = vscode.workspace.getConfiguration('codegptBridge').get('port', 3210);
	server = http.createServer(handleRequest);
	server.on('error', (error) => {
		vscode.window.showErrorMessage(`CodeGPT Bridge не запустился на порту ${port}: ${error.message}`);
	});
	server.listen(port, '127.0.0.1', () => {
		vscode.window.setStatusBarMessage(`CodeGPT Bridge: 127.0.0.1:${port}`, 5000);
	});
	context.subscriptions.push({ dispose: stopServer });
}

function stopServer() {
	if (server) {
		server.close();
		server = undefined;
	}
}

function handleRequest(request, response) {
	setCorsHeaders(response);
	if (request.method === 'OPTIONS') {
		response.writeHead(204);
		response.end();
		return;
	}
	if (request.method === 'GET' && request.url === '/health') {
		writeJson(response, 200, { ok: true, service: 'codegpt-vscode-bridge' });
		return;
	}
	if (request.method !== 'POST' || request.url !== '/chat') {
		writeJson(response, 404, { error: 'Not found' });
		return;
	}

	readJson(request)
		.then(({ prompt, provider, attachments }) => requestModel(prompt, provider, attachments))
		.then((result) => writeJson(response, 200, result))
		.catch((error) => writeJson(response, 502, { error: error.message }));
}

function setCorsHeaders(response) {
	const origin = response.req.headers.origin;
	if (origin === 'http://127.0.0.1:4173' || origin === 'http://localhost:4173') {
		response.setHeader('Access-Control-Allow-Origin', origin);
	}
	response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readJson(request) {
	return new Promise((resolve, reject) => {
		let body = '';
		request.setEncoding('utf8');
		request.on('data', (chunk) => {
			body += chunk;
		});
		request.on('end', () => {
			try {
				const data = JSON.parse(body || '{}');
				if (typeof data.prompt !== 'string' || !data.prompt.trim()) throw new Error('Нужен непустой prompt');
				if (!Array.isArray(data.attachments)) data.attachments = [];
				resolve({ prompt: data.prompt.trim(), provider: data.provider, attachments: data.attachments });
			} catch (error) {
				reject(error);
			}
		});
		request.on('error', reject);
	});
}

async function requestModel(prompt, requestedProvider, attachments = []) {
	const startIndex = Math.max(providerOrder.indexOf(requestedProvider), 0);
	const attempts = [...providerOrder.slice(startIndex), ...providerOrder.slice(0, startIndex)];
	const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
	if (!models.length) throw new Error('В VS Code нет доступных Copilot моделей. Проверьте вход в GitHub Copilot.');

	let lastError;
	for (const provider of attempts) {
		const model = findModel(models, provider);
		if (!model) continue;
		try {
			const text = await sendPrompt(model, prompt, attachments);
			return { provider, model: model.name || model.id, text };
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError || new Error('Ни одна настроенная модель не найдена в Copilot.');
}

function findModel(models, provider) {
	const matcher = providerMatchers[provider];
	return models.find((model) => matcher.test(`${model.id} ${model.name} ${model.family}`));
}


async function sendPrompt(model, prompt, attachments) {
	const attachmentContext = attachments.length
		? `\n\nВложения пользователя:\n${attachments.map((file) => `- ${file.name} (${file.type || 'неизвестный тип'}, ${file.size} байт)`).join('\n')}\n\nДля текстовых вложений содержимое передано ниже:\n${attachments.map(readTextAttachment).join('\n\n')}`
		: '';
	const content = [vscode.LanguageModelTextPart ? new vscode.LanguageModelTextPart(prompt + attachmentContext) : prompt + attachmentContext];
	if (vscode.LanguageModelDataPart) {
		for (const file of attachments) {
			if (!file.type || !file.type.startsWith('image/') || !file.data) continue;
			const encoded = String(file.data).split(',')[1] || '';
			try {
				content.push(new vscode.LanguageModelDataPart(Buffer.from(encoded, 'base64'), file.type));
			} catch {
			}
		}
	}
	const response = await model.sendRequest(
		[vscode.LanguageModelChatMessage.User(content)],
		{},
		new vscode.CancellationTokenSource().token,
	);
	let text = '';
	for await (const fragment of response.text) text += fragment;
	return text;
}

function readTextAttachment(file) {
	if (!file.data || !/^text\//i.test(file.type || '') && !/\.(txt|md|json|js|ts|css|html|xml|csv|yaml|yml|py|java|c|cpp|cs|go|rs|sh|sql)$/i.test(file.name)) return `\n[Файл ${file.name}: бинарное или графическое вложение доступно bridge, но его содержимое не преобразуется в текст.]`;
	const encoded = String(file.data).split(',')[1] || '';
	try {
		return `\n--- ${file.name} ---\n${Buffer.from(encoded, 'base64').toString('utf8')}`;
	} catch {
		return `\n[Не удалось прочитать текстовый файл ${file.name}]`;
	}
}

function writeJson(response, status, payload) {
	response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
	response.end(JSON.stringify(payload));
}

function deactivate() {
	stopServer();
}

module.exports = { activate, deactivate };