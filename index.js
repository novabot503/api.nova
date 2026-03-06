const express = require('express');
const axios = require('axios');
const config = require('./setting.js');

const app = express();
const PORT = config.PORT || 8080;
const HOST = config.HOST || 'localhost';

app.use(require('cors')());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fungsi helper untuk fetch JSON dan buffer
async function fetchJson(url) {
  const res = await axios.get(url);
  return res.data;
}

async function getBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

// Fungsi kirim notifikasi error ke Telegram
async function sendErrorToTelegram(error) {
  if (!config.TELEGRAM_TOKEN || !config.OWNER_ID) return;
  const message = `❌ *API Error*\n\n${error.message}\n\n${error.stack || ''}`;
  try {
    await axios.post(`https://api.telegram.org/bot${config.TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: config.OWNER_ID,
      text: message,
      parse_mode: 'Markdown'
    });
  } catch (e) {
    console.error('Gagal kirim ke Telegram:', e.message);
  }
}

// ==================== API ROUTES ====================
app.get('/waifu', async (req, res) => {
  try {
    const data = await fetchJson('https://api.waifu.pics/sfw/waifu');
    const buffer = await getBuffer(data.url);
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  } catch (error) {
    await sendErrorToTelegram(error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// ==================== MAIN PAGE ====================
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=0.50, user-scalable=no" />
<title>NovaBot API</title>
<link rel="icon" href="https://files.catbox.moe/92681q.jpg" type="image/jpeg">
<link rel="apple-touch-icon" href="https://files.catbox.moe/92681q.jpg">
<meta property="og:type" content="website">
<meta property="og:url" content="${config.URL}">
<meta property="og:title" content="NovaBot API">
<meta property="og:description" content="API untuk bot WhatsApp Novabot">
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Orbitron:wght@500;700;900&family=VT323&display=swap" rel="stylesheet">
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
<style>
:root {
  --bg-main: #02040a;
  --bg-card: #0b0f19;
  --primary: #3a6df0;
  --accent-red: #ff3b30;
  --accent-gold: #ffcc00;
  --text-main: #ffffff;
  --text-sub: #8b9bb4;
  --border-color: #1c2538;
}
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
body {
  font-family: 'Rajdhani', sans-serif;
  background: var(--bg-main);
  color: var(--text-main);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-x: hidden;
  padding-bottom: 80px;
}
::-webkit-scrollbar { width: 0px; }
.custom-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 60px;
  background: rgba(2, 4, 10, 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 1000;
  border-bottom: 1px solid var(--border-color);
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
}
.header-left { display: flex; align-items: center; gap: 15px; }
.header-title { font-family: 'Orbitron', sans-serif; font-size: 20px; font-weight: 700; color: #fff; letter-spacing: 1px; }
.page-container { padding: 80px 20px 20px 20px; }
.lux-header-card {
  background: linear-gradient(135deg, #1e3c72, #2a5298);
  border-radius: 20px;
  padding: 25px 20px;
  color: white;
  box-shadow: 0 10px 30px rgba(30,60,114,0.3);
  margin-bottom: 30px;
  border: 1px solid rgba(255,255,255,0.1);
}
.lux-icon-box { width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; justify-content: center; align-items: center; font-size: 24px; backdrop-filter: blur(5px); }
.lux-head-text h2 { font-family: 'Orbitron'; font-size: 18px; margin-bottom: 2px; letter-spacing: 1px; }
.lux-head-text p { font-size: 12px; color: rgba(255,255,255,0.8); }
.lux-section-title { font-family: 'Orbitron'; font-size: 16px; color: #fff; margin-bottom: 15px; letter-spacing: 1px; padding-left: 5px; border-left: 3px solid var(--primary); line-height: 1; }
.slider-container {
  width: 100%;
  background: var(--bg-card);
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  box-shadow: 0 5px 20px rgba(0,0,0,0.3);
  margin-bottom: 30px;
  position: relative;
  height: 200px;
  touch-action: pan-y;
  cursor: grab;
  user-select: none;
}
.slider-container:active { cursor: grabbing; }
.slider-track {
  display: flex;
  width: 200%;
  height: 100%;
  transition: transform 0.4s ease-out;
}
.slide { width: 50%; height: 100%; position: relative; flex-shrink: 0; }
.slide video { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
.lux-news-content {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 20px;
  background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, transparent 100%);
  z-index: 5;
}
.lux-news-content h3 { font-family: 'Orbitron'; font-size: 16px; color: #fff; margin-bottom: 5px; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }
.lux-news-content p { font-size: 12px; color: #d0d0d0; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }

.api-card {
  background: var(--bg-card);
  border-radius: 20px;
  padding: 25px;
  border: 1px solid var(--border-color);
  margin-bottom: 30px;
}
.api-card h3 { font-family: 'Orbitron'; margin-bottom: 15px; color: var(--primary); }
.api-endpoint {
  background: rgba(0,0,0,0.3);
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 10px;
  border-left: 4px solid var(--primary);
}
.api-endpoint .method { color: var(--accent-gold); font-weight: bold; }
.api-endpoint .url { color: #00ff88; word-break: break-all; }
.api-endpoint .desc { color: var(--text-sub); font-size: 14px; margin-top: 5px; }

.footer {
  text-align: center;
  padding: 20px;
  margin-top: 30px;
  border-top: 1px solid var(--border-color);
  color: var(--text-sub);
  font-size: 12px;
}
</style>
</head>
<body>
<div class="custom-header">
  <div class="header-left">
    <div class="header-title">NOVABOT API</div>
  </div>
  <div style="color: var(--text-sub); font-size: 12px;"><i class="fas fa-robot"></i> WhatsApp Bot</div>
</div>

<div class="page-container">
  <div class="lux-header-card">
    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
      <div class="lux-icon-box"><i class="fas fa-robot"></i></div>
      <div class="lux-head-text">
        <p>Welcome to</p>
        <h2>Novabot API Service</h2>
      </div>
    </div>
    <div style="font-size: 14px; opacity: 0.9;">
      API untuk bot WhatsApp Novabot. Gunakan endpoint di bawah untuk mengakses fitur bot.
    </div>
  </div>

  <div class="lux-section-title">Latest News</div>
  <div class="slider-container" id="newsSlider">
    <div class="slider-track">
      <div class="slide">
        <video src="https://files.catbox.moe/7iyjd5.mp4" autoplay muted loop playsinline></video>
        <div class="lux-news-content">
          <h3>Novabot API v${config.VERSI_WEB || '1.0'}</h3>
          <p>API siap digunakan untuk bot WhatsApp</p>
        </div>
      </div>
      <div class="slide">
        <video src="https://files.catbox.moe/sbwa8f.mp4" autoplay muted loop playsinline></video>
        <div class="lux-news-content">
          <h3>Mudah & Cepat</h3>
          <p>Integrasi dengan bot Anda</p>
        </div>
      </div>
    </div>
  </div>

  <div class="lux-section-title">API Endpoints</div>
  <div class="api-card">
    <h3><i class="fas fa-code"></i> Tersedia:</h3>
    <div class="api-endpoint">
      <span class="method">GET</span> <span class="url">/waifu</span>
      <div class="desc">Mengembalikan gambar waifu random (format PNG)</div>
    </div>
    <div class="api-endpoint">
      <span class="method">GET</span> <span class="url">/api/status</span>
      <div class="desc">Cek status server</div>
    </div>
    <p style="color: var(--text-sub); margin-top: 15px;">Endpoint lain akan segera hadir.</p>
  </div>

  <div class="footer">
    <p>© 2026 Novabot - All rights reserved</p>
    <p style="margin-top: 10px;">
      <i class="fab fa-telegram"></i> ${config.DEVELOPER || '@Novabot403'} • 
      <i class="fas fa-code"></i> Version ${config.VERSI_WEB || '1.0'}
    </p>
  </div>
</div>

<script>
// ==================== SLIDER ====================
let currentSlide = 0;
let slideInterval;
const sliderContainer = document.getElementById('newsSlider');
const sliderTrack = document.querySelector('.slider-track');
function startSlider() { clearInterval(slideInterval); slideInterval = setInterval(nextSlide, 5000); }
function nextSlide() { currentSlide = (currentSlide + 1) % 2; updateSlider(); }
function previousSlide() { currentSlide = (currentSlide - 1 + 2) % 2; updateSlider(); }
function updateSlider() { if (sliderTrack) sliderTrack.style.transform = \`translateX(-\${currentSlide * 50}%)\`; }
function setupSlider() {
  if (!sliderContainer || !sliderTrack) return;
  let isSwiping = false, startX = 0, currentX = 0;
  function getPositionX(e) { return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX; }
  sliderContainer.addEventListener('touchstart', (e) => { startX = getPositionX(e); isSwiping = true; clearInterval(slideInterval); });
  sliderContainer.addEventListener('touchmove', (e) => { if (!isSwiping) return; currentX = getPositionX(e); const diff = currentX - startX; if (Math.abs(diff) > 20) sliderTrack.style.transform = \`translateX(-\${currentSlide * 50 + (diff / sliderContainer.offsetWidth) * 50}%)\`; });
  sliderContainer.addEventListener('touchend', () => { if (!isSwiping) return; isSwiping = false; const diff = currentX - startX; if (Math.abs(diff) > 80) diff > 0 ? previousSlide() : nextSlide(); else updateSlider(); startSlider(); });
  sliderContainer.addEventListener('mousedown', (e) => { e.preventDefault(); startX = getPositionX(e); isSwiping = true; clearInterval(slideInterval); sliderContainer.style.cursor = 'grabbing'; });
  sliderContainer.addEventListener('mousemove', (e) => { if (!isSwiping) return; e.preventDefault(); currentX = getPositionX(e); const diff = currentX - startX; if (Math.abs(diff) > 20) sliderTrack.style.transform = \`translateX(-\${currentSlide * 50 + (diff / sliderContainer.offsetWidth) * 50}%)\`; });
  sliderContainer.addEventListener('mouseup', () => { if (!isSwiping) return; isSwiping = false; sliderContainer.style.cursor = 'grab'; const diff = currentX - startX; if (Math.abs(diff) > 80) diff > 0 ? previousSlide() : nextSlide(); else updateSlider(); startSlider(); });
  sliderContainer.addEventListener('mouseleave', () => { if (isSwiping) { isSwiping = false; sliderContainer.style.cursor = 'grab'; updateSlider(); startSlider(); } });
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  setupSlider();
  startSlider();
  const videos = document.querySelectorAll('video');
  videos.forEach(v => v.play().catch(() => {}));
});
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || (e.ctrlKey && e.key === 'U')) e.preventDefault();
});
</script>
</body>
</html>
  `;
  res.send(html);
});

// ==================== STATUS ENDPOINT ====================
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', version: config.VERSI_WEB, developer: config.DEVELOPER });
});

// ==================== START SERVER ====================
app.listen(PORT, HOST, () => {
  console.log(`
\x1b[1m\x1b[34m╔═╗╦ ╦╦═╗╦ ╦╔╦╗╔═╗╔═╗╦  \x1b[0m
\x1b[1m\x1b[34m╠═╝╚╦╝╠╦╝║ ║ ║ ║╣ ╠═╝║  \x1b[0m
\x1b[1m\x1b[34m╩   ╩ ╩╚═╚═╝ ╩ ╚═╝╩  ╩═╝\x1b[0m
\x1b[1m\x1b[33mN O V A B O T   A P I   v${config.VERSI_WEB || '1.0'}\x1b[0m
\x1b[1m\x1b[32m═══════════════════════════════════════\x1b[0m
🌐 Server: http://${HOST}:${PORT}
👤 Developer: ${config.DEVELOPER || '@Novabot403'}
📦 Version: ${config.VERSI_WEB || '1.0'}
✅ API ready!
  `);
});