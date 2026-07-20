// ---------- تنظیمات اولیه‌ی Telegram Mini App ----------
const tg = window.Telegram ? window.Telegram.WebApp : null;

if (tg) {
  tg.ready();
  tg.expand();
  applyTelegramTheme();
  tg.onEvent('themeChanged', applyTelegramTheme);
}

function applyTelegramTheme() {
  const p = tg.themeParams || {};
  const root = document.documentElement.style;
  if (p.bg_color) root.setProperty('--tg-bg', p.bg_color);
  if (p.text_color) root.setProperty('--tg-text', p.text_color);
  if (p.hint_color) root.setProperty('--tg-hint', p.hint_color);
  if (p.link_color) root.setProperty('--tg-link', p.link_color);
  if (p.button_color) root.setProperty('--tg-button', p.button_color);
  if (p.button_text_color) root.setProperty('--tg-button-text', p.button_text_color);
  if (p.secondary_bg_color) root.setProperty('--tg-secondary-bg', p.secondary_bg_color);
  root.setProperty('--header-bg', p.bg_color || '#ffffff');
  root.setProperty('--bubble-bg', p.bg_color || '#ffffff');
}

// ---------- عناصر صفحه ----------
const screenList = document.getElementById('screen-list');
const screenChat = document.getElementById('screen-chat');
const channelListEl = document.getElementById('channel-list');
const searchResultsEl = document.getElementById('search-results');
const emptyStateEl = document.getElementById('empty-state');

const btnOpenSearch = document.getElementById('btn-open-search');
const globalSearchBar = document.getElementById('global-search-bar');
const globalSearchInput = document.getElementById('global-search-input');

const btnBack = document.getElementById('btn-back');
const chatAvatar = document.getElementById('chat-avatar');
const chatTitleEl = document.getElementById('chat-title');
const chatSubtitleEl = document.getElementById('chat-subtitle');
const btnChatSearch = document.getElementById('btn-chat-search');
const chatSearchBar = document.getElementById('chat-search-bar');
const chatSearchInput = document.getElementById('chat-search-input');
const messagesEl = document.getElementById('messages');

let currentChannel = null;
let searchDebounce = null;

// ---------- ابزارهای کمکی ----------
function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function highlight(text, query) {
  const safe = escapeHtml(text || '');
  if (!query) return safe;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${escapedQuery})`, 'gi'), '<mark>$1</mark>');
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return '';
  return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return '';
  return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
}

function initials(title) {
  return (title || '?').trim().charAt(0).toUpperCase();
}

function showScreen(name) {
  screenList.classList.toggle('active', name === 'list');
  screenChat.classList.toggle('active', name === 'chat');
  if (tg) {
    if (name === 'chat') tg.BackButton.show();
    else tg.BackButton.hide();
  }
}

if (tg) {
  tg.BackButton.onClick(() => goBackToList());
}

// ---------- بارگذاری لیست کانال‌ها ----------
async function loadChannels() {
  const res = await fetch('/api/channels');
  const channels = await res.json();

  channelListEl.innerHTML = '';

  if (channels.length === 0) {
    emptyStateEl.classList.remove('hidden');
    channelListEl.classList.add('hidden');
    return;
  }
  emptyStateEl.classList.add('hidden');
  channelListEl.classList.remove('hidden');

  channels.forEach((ch) => {
    const row = document.createElement('div');
    row.className = 'channel-row';
    row.innerHTML = `
      <div class="avatar">${initials(ch.title)}</div>
      <div class="row-body">
        <div class="row-top">
          <div class="row-title">${escapeHtml(ch.title)}</div>
          <div class="row-date">${formatDate(ch.lastDate)}</div>
        </div>
        <div class="row-bottom">
          <div class="row-preview">${escapeHtml(ch.lastMessagePreview)}</div>
          <div class="row-badge">${ch.postCount}</div>
        </div>
      </div>
    `;
    row.addEventListener('click', () => openChannel(ch));
    channelListEl.appendChild(row);
  });
}

// ---------- سرچ سراسری ----------
btnOpenSearch.addEventListener('click', () => {
  globalSearchBar.classList.toggle('hidden');
  if (!globalSearchBar.classList.contains('hidden')) {
    globalSearchInput.focus();
  } else {
    globalSearchInput.value = '';
    showChannelList();
  }
});

globalSearchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  const q = globalSearchInput.value.trim();
  if (!q) {
    showChannelList();
    return;
  }
  searchDebounce = setTimeout(() => runGlobalSearch(q), 250);
});

function showChannelList() {
  searchResultsEl.classList.add('hidden');
  channelListEl.classList.remove('hidden');
}

async function runGlobalSearch(q) {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  const results = await res.json();

  channelListEl.classList.add('hidden');
  searchResultsEl.classList.remove('hidden');
  searchResultsEl.innerHTML = '';

  if (results.length === 0) {
    searchResultsEl.innerHTML = `<div class="no-results">چیزی برای «${escapeHtml(q)}» پیدا نشد 🔍</div>`;
    return;
  }

  results.forEach((post) => {
    const row = document.createElement('div');
    row.className = 'result-row';
    const preview = post.text ? highlight(post.text.slice(0, 80), q) : (post.media_type === 'photo' ? '📷 عکس' : post.media_type === 'video' ? '🎥 ویدیو' : '');
    row.innerHTML = `
      <div class="avatar">${initials(post.channel_title)}</div>
      <div class="row-body">
        <div class="row-top">
          <div class="result-channel-tag">${escapeHtml(post.channel_title)}</div>
          <div class="row-date">${formatDate(post.date)}</div>
        </div>
        <div class="row-preview">${preview}</div>
      </div>
    `;
    row.addEventListener('click', () => {
      globalSearchBar.classList.add('hidden');
      globalSearchInput.value = '';
      openChannelById(post.channel_id, post.channel_title, q);
    });
    searchResultsEl.appendChild(row);
  });
}

// ---------- باز کردن صفحه‌ی چت یک کانال ----------
function openChannel(ch) {
  currentChannel = ch;
  chatAvatar.textContent = initials(ch.title);
  chatTitleEl.textContent = ch.title;
  chatSubtitleEl.textContent = `${ch.postCount} پست`;
  chatSearchInput.value = '';
  chatSearchBar.classList.add('hidden');
  showScreen('chat');
  loadPosts();
}

async function openChannelById(id, title, presetQuery) {
  currentChannel = { id, title };
  chatAvatar.textContent = initials(title);
  chatTitleEl.textContent = title;
  chatSubtitleEl.textContent = '';
  showScreen('chat');
  if (presetQuery) {
    chatSearchBar.classList.remove('hidden');
    chatSearchInput.value = presetQuery;
    await loadPosts(presetQuery);
  } else {
    chatSearchBar.classList.add('hidden');
    chatSearchInput.value = '';
    await loadPosts();
  }
}

function goBackToList() {
  showScreen('list');
  loadChannels();
}
btnBack.addEventListener('click', goBackToList);

// ---------- سرچ داخل کانال ----------
btnChatSearch.addEventListener('click', () => {
  chatSearchBar.classList.toggle('hidden');
  if (!chatSearchBar.classList.contains('hidden')) {
    chatSearchInput.focus();
  } else {
    chatSearchInput.value = '';
    loadPosts();
  }
});

chatSearchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  const q = chatSearchInput.value.trim();
  searchDebounce = setTimeout(() => loadPosts(q), 250);
});

// ---------- بارگذاری پست‌های یک کانال (به‌شکل حباب چت) ----------
async function loadPosts(query) {
  const url = query
    ? `/api/channels/${currentChannel.id}/posts?q=${encodeURIComponent(query)}`
    : `/api/channels/${currentChannel.id}/posts`;

  const res = await fetch(url);
  const posts = await res.json();

  messagesEl.innerHTML = '';

  if (posts.length === 0) {
    messagesEl.innerHTML = `<div class="no-results">${query ? 'نتیجه‌ای پیدا نشد 🔍' : 'هنوز پستی از این کانال ذخیره نشده'}</div>`;
    return;
  }

  posts.forEach((post) => {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    let mediaHtml = '';
    if (post.media_type === 'photo') {
      mediaHtml = `<div class="bubble-media"><img src="/media/${post.media_file}" loading="lazy"></div>`;
    } else if (post.media_type === 'video') {
      mediaHtml = `<div class="bubble-media"><video src="/media/${post.media_file}" controls></video></div>`;
    }

    const textHtml = post.text ? `<div class="bubble-text">${highlight(post.text, query)}</div>` : '';

    bubble.innerHTML = `
      ${mediaHtml}
      ${textHtml}
      <div class="bubble-time">${formatTime(post.date)}</div>
    `;
    messagesEl.appendChild(bubble);
  });

  // اسکرول به پایین (آخرین پیام) وقتی سرچ فعال نیست
  if (!query) {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }
}

// ---------- شروع ----------
loadChannels();