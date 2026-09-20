import { askCodeGPT } from './ai/m.js';

const input = document.querySelector('#prompt-input');
const sendButton = document.querySelector('#send-button');
const messages = document.querySelector('#messages');
const welcomeBlock = document.querySelector('#welcome-block');
const composer = document.querySelector('#composer');
const sidebar = document.querySelector('.sidebar');
const overlay = document.querySelector('#mobile-overlay');
const fileInput = document.querySelector('#file-input');
const attachButton = document.querySelector('#attach-button');
const attachmentList = document.querySelector('#attachment-list');
const conversationList = document.querySelector('#conversation-list');
const workspacePanel = document.querySelector('#workspace-panel');
const workspaceTitle = document.querySelector('#workspace-title');
const previewFrame = document.querySelector('#preview-frame');
const previewStatus = document.querySelector('#preview-status');
const previewLink = document.querySelector('#preview-link');
const fileTree = document.querySelector('#file-tree');
const activeFileName = document.querySelector('#active-file-name');
const codeEditor = document.querySelector('#code-editor');
const codeStatus = document.querySelector('#code-status');
const settings = loadSettings();
const attachments = [];
let workspaceProject = null;
let workspaceFiles = [];
const storageKey = 'codegpt-chats-v1';

let chats = loadChats();
let activeChat = getChatFromUrl();
let isTemporaryChat = false;

lucide.createIcons();
const markdown = window.markdownit({ html: false, breaks: true, linkify: true });

function loadSettings() { try { return { tone: 'professional', language: 'ru', detail: 'balanced', selfCheck: true, uiCheck: true, autoPreview: true, ...JSON.parse(localStorage.getItem('codegpt-settings') || '{}') }; } catch { return { tone: 'professional', language: 'ru', detail: 'balanced', selfCheck: true, uiCheck: true, autoPreview: true }; } }
function saveSettings() { localStorage.setItem('codegpt-settings', JSON.stringify(settings)); document.querySelector('#settings-saved').textContent = 'Сохранено'; }

function loadChats() {
	try {
		const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
		return Array.isArray(saved) ? saved : [];
	} catch {
		return [];
	}
}
function saveChats() {
	localStorage.setItem(storageKey, JSON.stringify(chats));
}
function createChat() {
	return { id: crypto.randomUUID(), title: 'Новый диалог', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
}
function getChatFromUrl() {
	const match = window.location.pathname.match(/^\/chat\/([^/]+)/);
	return chats.find((chat) => chat.id === match?.[1]);
}

function ensureActiveChat() {
	if (activeChat) return activeChat;
	activeChat = createChat();
	isTemporaryChat = true;
	return activeChat;
}

function openChat(chat, replace = false) {
	activeChat = chat;
	isTemporaryChat = false;
	const url = `/chat/${encodeURIComponent(chat.id)}`;
	history[replace ? 'replaceState' : 'pushState']({ chatId: chat.id }, '', url);
	renderChat();
	renderChatList();
	toggleSidebar(false);
}

function startNewChat() {
	activeChat = createChat();
	isTemporaryChat = true;
	history.pushState({}, '', '/');
	renderChat();
	input.focus();
	toggleSidebar(false);
}

function titleFromPrompt(prompt) {
	const clean = prompt.replace(/\s+/g, ' ').trim();
	return clean.length > 42 ? `${clean.slice(0, 42).trim()}...` : clean || 'Новый диалог';
}
function relativeTime(timestamp) {
	const minutes = Math.floor((Date.now() - timestamp) / 60000);
	if (minutes < 1) return 'сейчас';
	if (minutes < 60) return `${minutes} мин.`;
	if (minutes < 1440) return `${Math.floor(minutes / 60)} ч.`;
	return new Date(timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function renderChatList() {
	conversationList.innerHTML = chats
		.slice()
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.map((chat) => `<button class="conversation ${chat.id === activeChat?.id ? 'active' : ''}" type="button" data-chat-id="${chat.id}"><span class="conversation-dot"></span><span class="conversation-title">${escapeHtml(chat.title)}</span><span class="conversation-time">${relativeTime(chat.updatedAt)}</span></button>`)
		.join('');
	conversationList.querySelectorAll('[data-chat-id]').forEach((button) => button.addEventListener('click', () => {
		const chat = chats.find((item) => item.id === button.dataset.chatId);
		if (chat) openChat(chat);
	}));
}

function renderChat() {
	if (!activeChat || !activeChat.messages.length) {
		messages.innerHTML = createWelcomeBlock().outerHTML;
		return;
	}
	messages.innerHTML = '';
	activeChat.messages.forEach((message) => addMessage(message.role, message.text, message.provider, message.files || [], false, message.project));
	messages.lastElementChild?.scrollIntoView({ block: 'nearest' });
}

function addMessage(role, text, provider, attachedFiles = [], persist = true, project = null) {
	const message = document.createElement('article');
	message.className = `message ${role}`;
	message.innerHTML = role === 'user'
		? `<div class="message-avatar user-avatar">A</div><div class="message-body"><div class="message-meta">Вы <time>сейчас</time></div><p>${escapeHtml(text)}</p>${renderFileChips(attachedFiles)}</div>`
		: `<div class="message-avatar ai-avatar"><span></span><span></span><span></span></div><div class="message-body"><div class="message-meta">CodeGPT <span class="provider-label">${provider || 'v0'}</span><time>сейчас</time></div><div class="assistant-content">${formatAnswer(text)}</div>${renderProjectActions(project)}</div>`;
	messages.append(message);
	lucide.createIcons();
	if (persist) {
		ensureActiveChat();
		activeChat.messages.push({ role, text, provider, project, files: attachedFiles.map(({ name, type, size }) => ({ name, type, size })) });
		activeChat.updatedAt = Date.now();
		saveChats();
		renderChatList();
	}
	message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderProjectActions(project) {
	if (!project?.chatId) return '';
	return `<div class="project-actions"><button class="project-action workspace-action" type="button" data-open-workspace="${escapeHtml(project.chatId)}"><i data-lucide="panels-top-left"></i><span>Открыть workspace</span></button><button class="project-action deploy-action" type="button" data-deploy-chat="${escapeHtml(project.chatId)}"><i data-lucide="rocket"></i><span>Опубликовать на Vercel</span></button><a class="project-action" href="/api/download?chatId=${encodeURIComponent(project.chatId)}"><i data-lucide="download"></i><span>Скачать ZIP</span></a><span class="deploy-status" aria-live="polite"></span></div>`;
}

function renderFileChips(files) {
	if (!files.length) return '';
	return `<div class="message-files">${files.map((file) => `<span class="message-file"><i data-lucide="file"></i>${escapeHtml(file.name)}</span>`).join('')}</div>`;
}

function escapeHtml(value) {
	const element = document.createElement('div');
	element.textContent = value;
	return element.innerHTML;
}

function formatAnswer(value) {
	const mathParts = [];
	const protectedValue = value.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (match, block, inline) => {
		const index = mathParts.push({ value: block || inline, displayMode: Boolean(block) }) - 1;
		return `CODEGPT_MATH_${index}_END`;
	});
	let rendered = DOMPurify.sanitize(markdown.render(protectedValue), { USE_PROFILES: { html: true } });
	mathParts.forEach((part, index) => {
		const math = katex.renderToString(part.value, { displayMode: part.displayMode, throwOnError: false, strict: 'ignore' });
		rendered = rendered.split(`CODEGPT_MATH_${index}_END`).join(math);
	});
	return rendered;
}

function setLoading(loading) {
	sendButton.disabled = loading;
	composer.classList.toggle('is-loading', loading);
	sendButton.innerHTML = loading ? '<span class="loader"></span>' : '<i data-lucide="arrow-up"></i>';
	if (!loading) lucide.createIcons();
}

async function submitPrompt(value = input.value) {
	const prompt = value.trim();
	if ((!prompt && !attachments.length) || sendButton.disabled) return;
	const selectedFiles = attachments.splice(0, attachments.length);
	const chat = ensureActiveChat();
	const projectChatId = chat.messages.slice().reverse().find((message) => message.project?.chatId)?.project.chatId;
	if (isTemporaryChat) {
		chats.push(chat);
		isTemporaryChat = false;
		history.replaceState({ chatId: chat.id }, '', `/chat/${encodeURIComponent(chat.id)}`);
	}
	if (chat.messages.length === 0) chat.title = titleFromPrompt(prompt || selectedFiles[0]?.name);
	addMessage('user', prompt || 'Посмотри прикреплённые файлы.', undefined, selectedFiles);
	input.value = '';
	input.style.height = 'auto';
	renderAttachments();
	setLoading(true);
	try {
		const encodedFiles = await Promise.all(selectedFiles.map(encodeFile));
		const answer = await askCodeGPT(prompt || 'Проанализируй прикреплённые файлы.', { attachments: encodedFiles, chatId: projectChatId, settings });
		addMessage('assistant', answer.text, answer.provider.name, [], true, answer.project || (projectChatId ? { chatId: projectChatId } : null));
	} catch (error) {
		addMessage('assistant', `Не удалось получить ответ: ${error.message}`);
	} finally {
		setLoading(false);
		input.focus();
	}
}

function createWelcomeBlock() {
	const block = document.createElement('div');
	block.className = 'welcome-block';
	block.innerHTML = '<div class="eyebrow"><span class="eyebrow-line"></span>Ваш AI для разработки</div><h1>Что создадим<br /><em>сегодня?</em></h1><p class="welcome-copy">Пишите код, разбирайте ошибки и превращайте идеи в рабочие решения.</p><div class="prompt-grid"><button class="prompt-card" type="button" data-prompt="Спроектируй архитектуру нового приложения"><span class="prompt-icon orange"><i data-lucide="layers-3"></i></span><span>Спроектировать архитектуру</span><i data-lucide="arrow-up-right"></i></button><button class="prompt-card" type="button" data-prompt="Найди и исправь ошибку в моём коде"><span class="prompt-icon blue"><i data-lucide="bug"></i></span><span>Найти ошибку в коде</span><i data-lucide="arrow-up-right"></i></button><button class="prompt-card" type="button" data-prompt="Сделай code review моего проекта"><span class="prompt-icon green"><i data-lucide="scan-search"></i></span><span>Провести code review</span><i data-lucide="arrow-up-right"></i></button></div>';
	block.querySelectorAll('[data-prompt]').forEach((button) => button.addEventListener('click', () => submitPrompt(button.dataset.prompt)));
	return block;
}

function encodeFile(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: reader.result });
		reader.onerror = () => reject(new Error(`Не удалось прочитать файл ${file.name}`));
		reader.readAsDataURL(file);
	});
}

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} Б`;
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} КБ`;
	if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
	return `${(bytes / 1024 ** 3).toFixed(1)} ГБ`;
}

function renderAttachments() {
	attachmentList.innerHTML = attachments.map((file, index) => `<div class="attachment-chip"><span class="attachment-icon"><i data-lucide="${file.type.startsWith('image/') ? 'image' : 'file-text'}"></i></span><span class="attachment-copy"><strong>${escapeHtml(file.name)}</strong><small>${formatBytes(file.size)}</small></span><button type="button" data-remove-file="${index}" aria-label="Удалить ${escapeHtml(file.name)}"><i data-lucide="x"></i></button></div>`).join('');
	attachmentList.querySelectorAll('[data-remove-file]').forEach((button) => button.addEventListener('click', () => {
		attachments.splice(Number(button.dataset.removeFile), 1);
		renderAttachments();
	}));
	lucide.createIcons();
}

function toggleSidebar(open) {
	sidebar.classList.toggle('is-open', open);
	overlay.classList.toggle('is-visible', open);
}

input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 140)}px`; });
input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitPrompt(); } });
sendButton.addEventListener('click', () => submitPrompt());
attachButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { attachments.push(...Array.from(fileInput.files)); fileInput.value = ''; renderAttachments(); input.focus(); });
messages.addEventListener('click', async (event) => {
		const workspaceButton = event.target.closest('[data-open-workspace]');
		if (workspaceButton) openWorkspace(workspaceButton.dataset.openWorkspace);
		const button = event.target.closest('[data-deploy-chat]');
		if (!button) return;
		const status = button.parentElement.querySelector('.deploy-status');
		button.disabled = true;
		status.textContent = 'Публикуем...';
		try {
			const response = await fetch('/api/deploy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: button.dataset.deployChat }) });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || 'Ошибка публикации');
			status.textContent = result.url ? 'Опубликовано' : `Deployment: ${result.deploymentId || 'готов'}`;
			if (result.url) status.innerHTML = `<a href="${escapeHtml(result.url)}" target="_blank" rel="noreferrer">Открыть приложение</a>`;
		} catch (error) {
			status.textContent = error.message;
			button.disabled = false;
		}
});
document.querySelectorAll('[data-workspace-tab]').forEach((tab) => tab.addEventListener('click', () => {
		document.querySelectorAll('.workspace-tab').forEach((item) => item.classList.toggle('active', item === tab));
		document.querySelectorAll('.workspace-view').forEach((view) => view.classList.toggle('active', view.id === `${tab.dataset.workspaceTab}-view`));
}));
document.querySelector('#close-workspace').addEventListener('click', () => { workspacePanel.hidden = true; });
document.querySelector('#save-file').addEventListener('click', () => {
		const file = workspaceFiles.find((item) => item.path === activeFileName.dataset.path);
		if (!file) return;
		file.content = codeEditor.value;
		codeStatus.textContent = 'Изменения сохранены локально';
});
document.querySelector('#new-chat').addEventListener('click', startNewChat);
const settingsBackdrop = document.querySelector('#settings-backdrop');
document.querySelector('#settings-button').addEventListener('click', () => { settingsBackdrop.hidden = false; });
document.querySelector('#close-settings').addEventListener('click', () => { settingsBackdrop.hidden = true; });
document.querySelector('#settings-done').addEventListener('click', () => { settingsBackdrop.hidden = true; saveSettings(); });
['tone', 'language', 'detail'].forEach((key) => { const field = document.querySelector(`#ai-${key}`); field.value = settings[key]; field.addEventListener('change', () => { settings[key] = field.value; saveSettings(); }); });
[['selfCheck', '#ai-self-check'], ['uiCheck', '#ai-ui-check'], ['autoPreview', '#auto-preview']].forEach(([key, selector]) => { const field = document.querySelector(selector); field.checked = settings[key]; field.addEventListener('change', () => { settings[key] = field.checked; saveSettings(); }); });
document.querySelector('#menu-toggle').addEventListener('click', () => toggleSidebar(true));
document.querySelector('.sidebar-close').addEventListener('click', () => toggleSidebar(false));
overlay.addEventListener('click', () => toggleSidebar(false));
window.addEventListener('popstate', () => { activeChat = getChatFromUrl(); isTemporaryChat = !activeChat; renderChat(); renderChatList(); });

if (activeChat) openChat(activeChat, true);
else { ensureActiveChat(); renderChat(); renderChatList(); }

async function openWorkspace(chatId) {
	workspaceProject = { chatId };
	workspacePanel.hidden = false;
	workspaceTitle.textContent = 'Загруженное приложение';
	previewStatus.textContent = 'Получаем preview...';
	try {
		const [previewResponse, filesResponse] = await Promise.all([fetch(`/api/preview?chatId=${encodeURIComponent(chatId)}`), fetch(`/api/files?chatId=${encodeURIComponent(chatId)}`)]);
		const preview = await previewResponse.json();
		const fileResult = await filesResponse.json();
		if (!previewResponse.ok) throw new Error(preview.error || 'Preview недоступен');
		if (!filesResponse.ok) throw new Error(fileResult.error || 'Файлы недоступны');
		previewFrame.src = `/api/preview-proxy?chatId=${encodeURIComponent(chatId)}&path=/`;
		previewLink.href = preview.url;
		previewLink.hidden = false;
		previewStatus.textContent = 'Preview готов';
		workspaceFiles = normalizeFiles(fileResult);
		renderFileTree();
		loadSelectedFile();
	} catch (error) {
		previewStatus.textContent = error.message;
		codeStatus.textContent = error.message;
	}
}

function normalizeFiles(result) {
	const files = result.files || result.data?.files || [];
	return files.map((file) => ({ path: file.path || file.name, content: file.content || file.text || '' })).filter((file) => file.path);
}

function loadSelectedFile() {
	const file = workspaceFiles.find((item) => item.path === activeFileName.dataset.path) || workspaceFiles[0];
	if (file) activeFileName.dataset.path = file.path;
	activeFileName.textContent = file?.path?.split('/').pop() || 'Выберите файл';
	codeEditor.value = file?.content || '';
	codeStatus.textContent = file ? `${file.path} · локальная копия` : 'Выберите файл';
}

function renderFileTree() {
	fileTree.innerHTML = workspaceFiles.map((file) => `<button class="file-tree-item" type="button" data-file-path="${escapeHtml(file.path)}"><i data-lucide="${file.path.endsWith('.css') ? 'palette' : file.path.endsWith('.json') ? 'braces' : 'file-code-2'}"></i><span>${escapeHtml(file.path)}</span></button>`).join('');
	fileTree.querySelectorAll('[data-file-path]').forEach((button) => button.addEventListener('click', () => {
		activeFileName.dataset.path = button.dataset.filePath;
		fileTree.querySelectorAll('.active').forEach((item) => item.classList.remove('active'));
		button.classList.add('active');
		loadSelectedFile();
	}));
	lucide.createIcons();
	fileTree.querySelector('.file-tree-item')?.click();
}
