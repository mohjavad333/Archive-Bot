const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// اگه رو Railway بودیم مدیا رو تو پوشه‌ی دائمی بذار
const MEDIA_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'media')
  : path.join(__dirname, 'public', 'media');

if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

async function downloadTelegramFile(bot, fileId, extension, agent) {
  const file = await bot.telegram.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  const response = await fetch(fileUrl, { agent });
  const buffer = await response.buffer();

  const fileName = `${fileId}.${extension}`;
  fs.writeFileSync(path.join(MEDIA_DIR, fileName), buffer);

  return fileName;
}

module.exports = { downloadTelegramFile, MEDIA_DIR };