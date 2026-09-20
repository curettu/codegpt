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
const attachments = [];
const storageKey = 'codegpt-chats-v1';

let chats = loadChats();
let activeChat = getChatFromUrl();
let isTemporaryChat = false;

lucide.createIcons();
const markdown = window.markdownit({ html: false, breaks: true, linkify: true });

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
	activeChat.messages.forEach((message) => addMessage(message.role, message.text, message.provider, message.files || [], false));
	messages.lastElementChild?.scrollIntoView({ block: 'nearest' });
}

function addMessage(role, text, provider, attachedFiles = [], persist = true) {
	const message = document.createElement('article');
	message.className = `message ${role}`;
	message.innerHTML = role === 'user'
		? `<div class="message-avatar user-avatar">A</div><div class="message-body"><div class="message-meta">Вы <time>сейчас</time></div><p>${escapeHtml(text)}</p>${renderFileChips(attachedFiles)}</div>`
		: `<div class="message-avatar ai-avatar"><span></span><span></span><span></span></div><div class="message-body"><div class="message-meta">CodeGPT <span class="provider-label">${provider || 'GPT-5.6 Luna'}</span><time>сейчас</time></div><div class="assistant-content">${formatAnswer(text)}</div></div>`;
	messages.append(message);
	lucide.createIcons();
	if (persist) {
		ensureActiveChat();
		activeChat.messages.push({ role, text, provider, files: attachedFiles.map(({ name, type, size }) => ({ name, type, size })) });
		activeChat.updatedAt = Date.now();
		saveChats();
		renderChatList();
	}
	message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
		const answer = await askCodeGPT(prompt || 'Проанализируй прикреплённые файлы.', { attachments: encodedFiles });
		addMessage('assistant', answer.text, answer.provider.name);
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
document.querySelector('#new-chat').addEventListener('click', startNewChat);
document.querySelector('#menu-toggle').addEventListener('click', () => toggleSidebar(true));
document.querySelector('.sidebar-close').addEventListener('click', () => toggleSidebar(false));
overlay.addEventListener('click', () => toggleSidebar(false));
window.addEventListener('popstate', () => { activeChat = getChatFromUrl(); isTemporaryChat = !activeChat; renderChat(); renderChatList(); });

if (activeChat) openChat(activeChat, true);
else { ensureActiveChat(); renderChat(); renderChatList(); }
