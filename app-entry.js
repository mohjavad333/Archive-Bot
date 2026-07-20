require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { downloadTelegramFile } = require('./media');

// پروکسی فقط رو سیستم خودت لازمه (USE_PROXY=true تو .env محلی)
let agent = undefined;
if (process.env.USE_PROXY === 'true') {
  const { SocksProxyAgent } = require('socks-proxy-agent');
  agent = new SocksProxyAgent('socks5h://127.0.0.1:9909');
}

const bot = new Telegraf(process.env.BOT_TOKEN, agent ? { telegram: { agent } } : {});

// ---------- دستورات بات (همون قبلی‌ها) ----------
bot.start((ctx) => {
  ctx.reply(
    'سلام! 👋\n\nیه پست از هر کانالی که می‌خوای فوروارد کن برام.\n\nبرای دیدن آرشیو، رو دکمه‌ی زیر بزن.',
    {
      reply_markup: {
        inline_keyboard: [[{ text: '📂 باز کردن آرشیو', web_app: { url: process.env.WEBAPP_URL } }]]
      }
    }
  );
});

bot.command('ping', (ctx) => ctx.reply('pong ✅'));

bot.command('archive', (ctx) => {
  ctx.reply('📂 آرشیو کانال‌هات:', {
    reply_markup: {
      inline_keyboard: [[{ text: '📂 باز کردن آرشیو', web_app: { url: process.env.WEBAPP_URL } }]]
    }
  });
});

bot.command('debug', (ctx) => {
  const channels = db.prepare('SELECT * FROM channels').all();
  const posts = db.prepare('SELECT * FROM posts').all();
  ctx.reply(`تعداد کانال‌ها: ${channels.length}\nتعداد پست‌ها: ${posts.length}`);
});

bot.command('search', async (ctx) => {
  const keyword = ctx.message.text.split(' ').slice(1).join(' ').trim();
  if (!keyword) return ctx.reply('مثال: /search هوش مصنوعی');

  const results = db.prepare(`
    SELECT posts.*, channels.title as channel_title
    FROM posts JOIN channels ON posts.channel_id = channels.id
    WHERE posts.text LIKE ? ORDER BY posts.date DESC
  `).all(`%${keyword}%`);

  if (results.length === 0) return ctx.reply(`چیزی برای «${keyword}» پیدا نشد 🔍`);

  await ctx.reply(`🔍 ${results.length} نتیجه:`);
  for (const post of results) {
    try {
      await ctx.reply(`📍 از کانال: ${post.channel_title}`);
      await ctx.telegram.copyMessage(ctx.chat.id, post.chat_id, post.message_id);
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) { console.error(err.message); }
  }
});

bot.on('message', async (ctx) => {
  const msg = ctx.message;
  if (msg.forward_origin && msg.forward_origin.type === 'channel') {
    const channel = msg.forward_origin.chat;
    db.prepare(`
      INSERT INTO channels (id, title, username) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, username = excluded.username
    `).run(channel.id, channel.title, channel.username || null);

    let mediaType = 'none', mediaFile = null;
    try {
      if (msg.photo && msg.photo.length > 0) {
        mediaType = 'photo';
        mediaFile = await downloadTelegramFile(bot, msg.photo[msg.photo.length - 1].file_id, 'jpg', agent);
      } else if (msg.video) {
        mediaType = 'video';
        mediaFile = await downloadTelegramFile(bot, msg.video.file_id, 'mp4', agent);
      }
    } catch (err) { console.error('خطای مدیا:', err.message); }

    db.prepare(`
      INSERT INTO posts (channel_id, chat_id, message_id, text, media_type, media_file)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(channel.id, ctx.chat.id, msg.message_id, msg.text || msg.caption || null, mediaType, mediaFile);

    ctx.reply(`✅ پست از کانال «${channel.title}» ذخیره شد.`);
  } else {
    ctx.reply('این پیام از یه کانال فوروارد نشده بود 🤔');
  }
});

// ---------- سرور وب (API + فایل‌های Mini App) ----------
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/channels', (req, res) => {
  const channels = db.prepare('SELECT * FROM channels ORDER BY title').all();
  const result = channels.map((channel) => {
    const count = db.prepare('SELECT COUNT(*) as c FROM posts WHERE channel_id = ?').get(channel.id).c;
    const lastPost = db.prepare('SELECT * FROM posts WHERE channel_id = ? ORDER BY date DESC LIMIT 1').get(channel.id);
    return {
      id: channel.id, title: channel.title, username: channel.username, postCount: count,
      lastMessagePreview: lastPost ? (lastPost.text ? lastPost.text.slice(0, 60) : (lastPost.media_type === 'photo' ? '📷 عکس' : lastPost.media_type === 'video' ? '🎥 ویدیو' : '')) : '',
      lastDate: lastPost ? lastPost.date : null
    };
  });
  res.json(result);
});

app.get('/api/channels/:id/posts', (req, res) => {
  const { id } = req.params;
  const q = req.query.q;
  const posts = q
    ? db.prepare('SELECT * FROM posts WHERE channel_id = ? AND text LIKE ? ORDER BY date ASC').all(id, `%${q}%`)
    : db.prepare('SELECT * FROM posts WHERE channel_id = ? ORDER BY date ASC').all(id);
  res.json(posts);
});

app.get('/api/search', (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);
  const results = db.prepare(`
    SELECT posts.*, channels.title as channel_title
    FROM posts JOIN channels ON posts.channel_id = channels.id
    WHERE posts.text LIKE ? ORDER BY posts.date DESC
  `).all(`%${q}%`);
  res.json(results);
});

// ---------- روشن کردن همزمان بات و سرور ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`server is listening on port: ${PORT}`));

bot.launch().then(() => {
  bot.telegram.setChatMenuButton({
    menuButton: { type: 'web_app', text: 'آرشیو', web_app: { url: process.env.WEBAPP_URL } }
  });
  console.log('Bot turn on seccesfully😉');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));