const express = require('express');
const axios = require('axios');
const cloudscraper = require('cloudscraper');
const config = require('./setting.js');

const app = express();
const PORT = config.PORT || 8080;
const HOST = config.HOST || 'localhost';

app.use(require('cors')());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fungsi helper
async function fetchJson(url) {
  const res = await axios.get(url);
  return res.data;
}

async function getBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

// Notifikasi error ke Telegram
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

// ==================== API ENDPOINTS ====================
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

app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: config.VERSI_WEB, 
    developer: config.DEVELOPER,
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// ==================== WEBZIP ENDPOINT ====================
async function saveweb2zip(url, options = {}) {
    if (!url) throw new Error('Url is required');
    url = url.startsWith('https://') ? url : `https://${url}`;
    const {
        renameAssets = false,
        saveStructure = false,
        alternativeAlgorithm = false,
        mobileVersion = false
    } = options;

    let response = await cloudscraper.post('https://copier.saveweb2zip.com/api/copySite', {
        json: {
            url,
            renameAssets,
            saveStructure,
            alternativeAlgorithm,
            mobileVersion
        },
        headers: {
            accept: '*/*',
            'content-type': 'application/json',
            origin: 'https://saveweb2zip.com',
            referer: 'https://saveweb2zip.com/'
        }
    });

    const { md5 } = response;

    while (true) {
        let process = await cloudscraper.get(`https://copier.saveweb2zip.com/api/getStatus/${md5}`, {
            json: true,
            headers: {
                accept: '*/*',
                'content-type': 'application/json',
                origin: 'https://saveweb2zip.com',
                referer: 'https://saveweb2zip.com/'
            }
        });

        if (!process.isFinished) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
        } else {
            return {
                url,
                error: {
                    text: process.errorText,
                    code: process.errorCode,
                },
                copiedFilesAmount: process.copiedFilesAmount,
                downloadUrl: `https://copier.saveweb2zip.com/api/downloadArchive/${process.md5}`
            }
        }
    }
}

app.get('/webzip', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ status: false, error: 'Parameter ?url= wajib diisi.' });

    try {
        const result = await saveweb2zip(url, { renameAssets: true });

        if (result.error?.code) {
            return res.status(500).json({
                status: false,
                error: result.error.text || 'Gagal menyimpan website.'
            });
        }

        return res.json({
            status: true,
            originalUrl: result.url,
            copiedFilesAmount: result.copiedFilesAmount,
            downloadUrl: result.downloadUrl
        });

    } catch (e) {
        await sendErrorToTelegram(e);
        return res.status(500).json({ status: false, error: e.message });
    }
});

// ==================== HALAMAN UTAMA ====================
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
  --primary-light: #5b8cff;
  --accent-red: #ff3b30;
  --accent-gold: #ffcc00;
  --text-main: #ffffff;
  --text-sub: #8b9bb4;
  --border-color: #1c2538;
  --glass-bg: rgba(255, 255, 255, 0.05);
  --glass-border: rgba(255, 255, 255, 0.1);
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
.menu-btn {
  width: 40px;
  height: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
}
.menu-btn:hover { background: rgba(255,255,255,0.1); }
.menu-btn span {
  width: 24px;
  height: 2px;
  background: var(--text-main);
  border-radius: 2px;
  transition: 0.3s;
}
.menu-btn.active span:nth-child(1) { transform: rotate(45deg) translate(6px, 6px); }
.menu-btn.active span:nth-child(2) { opacity: 0; }
.menu-btn.active span:nth-child(3) { transform: rotate(-45deg) translate(6px, -6px); }
.page-container { padding: 80px 20px 20px 20px; transition: filter 0.3s; }
.page-container.blur { filter: blur(4px); pointer-events: none; }

/* STATUS PANEL */
.status-panel {
  position: fixed;
  top: 70px;
  right: 20px;
  width: 320px;
  background: var(--bg-card);
  border: 1px solid var(--primary);
  border-radius: 20px;
  padding: 20px;
  z-index: 999;
  box-shadow: 0 10px 30px rgba(0,0,0,0.7);
  transform: translateX(120%);
  transition: transform 0.3s ease;
}
.status-panel.show { transform: translateX(0); }
.status-panel h3 {
  font-family: 'Orbitron';
  color: var(--primary);
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-item {
  background: rgba(0,0,0,0.3);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
  border-left: 3px solid var(--primary);
}
.status-item .label { color: var(--text-sub); font-size: 12px; }
.status-item .value { color: var(--text-main); font-size: 16px; font-weight: bold; }
.wave-container {
  width: 100%;
  height: 60px;
  margin: 15px 0;
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(0,0,0,0.2);
}
.wave {
  position: absolute;
  width: 200%;
  height: 100%;
  background: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 20px,
    rgba(58, 109, 240, 0.2) 20px,
    rgba(58, 109, 240, 0.2) 40px
  );
  animation: wave 8s linear infinite;
}
@keyframes wave { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

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

/* Tampilan endpoint lebih modern */
.api-endpoint {
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  position: relative;
  overflow: hidden;
}
.api-endpoint:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(58, 109, 240, 0.3);
  border-color: var(--primary);
}
.api-endpoint::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(to bottom, var(--primary), var(--primary-light));
  border-radius: 4px 0 0 4px;
}
.api-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.api-header .method {
  background: rgba(255, 204, 0, 0.2);
  color: var(--accent-gold);
  font-weight: bold;
  padding: 4px 12px;
  border-radius: 30px;
  font-size: 14px;
  letter-spacing: 0.5px;
  border: 1px solid rgba(255, 204, 0, 0.4);
}
.api-header .url {
  color: #00ff88;
  word-break: break-all;
  font-family: 'VT323', monospace;
  font-size: 16px;
  background: rgba(0, 255, 136, 0.1);
  padding: 4px 12px;
  border-radius: 30px;
  flex: 1;
}
.copy-btn {
  background: transparent;
  border: 1px solid var(--primary);
  color: var(--primary);
  padding: 6px 16px;
  border-radius: 30px;
  cursor: pointer;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  font-weight: 600;
}
.copy-btn:hover {
  background: var(--primary);
  color: #000;
  box-shadow: 0 0 15px var(--primary);
}
.api-desc {
  color: var(--text-sub);
  font-size: 14px;
  margin-bottom: 15px;
  padding-left: 8px;
  border-left: 2px solid rgba(255,255,255,0.1);
}
.test-btn {
  background: linear-gradient(90deg, var(--primary), var(--primary-light));
  color: #000;
  border: none;
  padding: 8px 20px;
  border-radius: 30px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 10px rgba(58, 109, 240, 0.3);
}
.test-btn:hover {
  filter: brightness(1.1);
  transform: scale(1.02);
  box-shadow: 0 6px 15px rgba(58, 109, 240, 0.5);
}
.test-btn i { font-size: 12px; }
.test-result {
  margin-top: 15px;
  padding: 15px;
  background: rgba(0,0,0,0.4);
  border-radius: 12px;
  max-height: 250px;
  overflow: auto;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}
.test-result.success { border-left: 4px solid #00ff88; }
.test-result.error { border-left: 4px solid var(--accent-red); }
.test-result .status-code {
  font-size: 12px;
  margin-bottom: 8px;
}
.status-code .badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 30px;
  font-weight: bold;
  font-size: 12px;
}
.badge.success { background: #00ff88; color: #000; }
.badge.error { background: var(--accent-red); color: #fff; }
.test-result img { max-width: 100%; max-height: 150px; border-radius: 8px; }
.test-result pre { white-space: pre-wrap; word-wrap: break-word; font-size: 12px; color: #ccc; }

/* Input untuk webzip */
.webzip-input {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 15px;
  flex-wrap: wrap;
}
.webzip-input input {
  flex: 1;
  padding: 12px 16px;
  border-radius: 30px;
  border: 1px solid var(--border-color);
  background: var(--glass-bg);
  color: #fff;
  font-size: 14px;
  transition: all 0.2s;
  backdrop-filter: blur(4px);
}
.webzip-input input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 10px rgba(58, 109, 240, 0.3);
}
.webzip-input input::placeholder { color: var(--text-sub); }

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
  <div class="menu-btn" id="menuBtn">
    <span></span><span></span><span></span>
  </div>
</div>

<div class="status-panel" id="statusPanel">
  <h3><i class="fas fa-chart-line"></i> SERVER STATUS</h3>
  <div class="wave-container"><div class="wave"></div></div>
  <div id="statusContent">Memuat...</div>
</div>

<div class="page-container" id="pageContainer">
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
    
    <!-- WAIFU ENDPOINT -->
    <div class="api-endpoint">
      <div class="api-header">
        <span class="method">GET</span>
        <span class="url">/waifu</span>
        <button class="copy-btn" onclick="copyText('${config.URL}/waifu', 'waifu')"><i class="fas fa-copy"></i> waifu</button>
      </div>
      <div class="api-desc">Mengembalikan gambar waifu random (format PNG)</div>
      <button class="test-btn" onclick="testEndpoint('${config.URL}/waifu', 'waifuResult')"><i class="fas fa-play"></i> Start</button>
      <div id="waifuResult" class="test-result"></div>
    </div>

    <!-- WEBZIP ENDPOINT -->
    <div class="api-endpoint">
      <div class="api-header">
        <span class="method">GET</span>
        <span class="url">/webzip?url=...</span>
        <button class="copy-btn" onclick="copyText('${config.URL}/webzip?url=', 'webzip')"><i class="fas fa-copy"></i> webzip</button>
      </div>
      <div class="api-desc">Mengarsipkan website (menjadi ZIP). Parameter ?url= diisi URL target.</div>
      <div class="webzip-input">
        <input type="text" id="webzipUrl" placeholder="https://contoh.com">
        <button class="test-btn" onclick="testWebzip()"><i class="fas fa-play"></i> Start</button>
      </div>
      <div id="webzipResult" class="test-result"></div>
    </div>
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
// ==================== STATUS PANEL ====================
const menuBtn = document.getElementById('menuBtn');
const statusPanel = document.getElementById('statusPanel');
const pageContainer = document.getElementById('pageContainer');
const statusContent = document.getElementById('statusContent');

menuBtn.addEventListener('click', () => {
  menuBtn.classList.toggle('active');
  statusPanel.classList.toggle('show');
  pageContainer.classList.toggle('blur');
});

async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const uptime = formatUptime(data.uptime);
    statusContent.innerHTML = \`
      <div class="status-item">
        <div class="label">STATUS</div>
        <div class="value" style="color: #00ff88;">🟢 ONLINE</div>
      </div>
      <div class="status-item">
        <div class="label">VERSION</div>
        <div class="value">\${data.version}</div>
      </div>
      <div class="status-item">
        <div class="label">DEVELOPER</div>
        <div class="value">\${data.developer}</div>
      </div>
      <div class="status-item">
        <div class="label">UPTIME</div>
        <div class="value">\${uptime}</div>
      </div>
      <div class="status-item">
        <div class="label">TIMESTAMP</div>
        <div class="value">\${new Date(data.timestamp).toLocaleString('id-ID')}</div>
      </div>
    \`;
  } catch (err) {
    statusContent.innerHTML = '<div class="status-item" style="color: var(--accent-red);">❌ Gagal memuat status</div>';
  }
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return \`\${d}d \${h}h \${m}m \${s}s\`;
}
loadStatus();
setInterval(loadStatus, 30000);

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

// ==================== TEST ENDPOINT WAIFU ====================
async function testEndpoint(url, resultId) {
  const resultDiv = document.getElementById(resultId);
  resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  resultDiv.className = 'test-result';
  
  try {
    const res = await fetch(url);
    const status = res.status;
    const statusText = res.statusText;
    
    if (url.includes('waifu')) {
      // Untuk gambar
      const blob = await res.blob();
      const objectURL = URL.createObjectURL(blob);
      resultDiv.innerHTML = \`
        <div class="status-code"><span class="badge \${status === 200 ? 'success' : 'error'}">\${status} \${statusText}</span></div>
        <img src="\${objectURL}" alt="Waifu Image">
      \`;
    } else {
      const text = await res.text();
      resultDiv.innerHTML = \`
        <div class="status-code"><span class="badge \${status === 200 ? 'success' : 'error'}">\${status} \${statusText}</span></div>
        <pre>\${text}</pre>
      \`;
    }
    resultDiv.classList.add(status === 200 ? 'success' : 'error');
  } catch (err) {
    resultDiv.innerHTML = \`
      <div class="status-code"><span class="badge error">Network Error</span></div>
      <pre>\${err.message}</pre>
    \`;
    resultDiv.classList.add('error');
  }
}

// ==================== TEST WEBZIP ====================
async function testWebzip() {
  const urlInput = document.getElementById('webzipUrl').value.trim();
  if (!urlInput) {
    alert('Masukkan URL target!');
    return;
  }
  const resultDiv = document.getElementById('webzipResult');
  resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  resultDiv.className = 'test-result';
  
  try {
    const apiUrl = \`${config.URL}/webzip?url=\${encodeURIComponent(urlInput)}\`;
    const res = await fetch(apiUrl);
    const data = await res.json();
    const status = res.status;
    const statusText = res.statusText;
    
    resultDiv.innerHTML = \`
      <div class="status-code"><span class="badge \${status === 200 ? 'success' : 'error'}">\${status} \${statusText}</span></div>
      <pre>\${JSON.stringify(data, null, 2)}</pre>
    \`;
    resultDiv.classList.add(status === 200 ? 'success' : 'error');
  } catch (err) {
    resultDiv.innerHTML = \`
      <div class="status-code"><span class="badge error">Network Error</span></div>
      <pre>\${err.message}</pre>
    \`;
    resultDiv.classList.add('error');
  }
}

// ==================== COPY TEXT ====================
function copyText(text, label) {
  navigator.clipboard.writeText(text).then(() => {
    alert(\`Link \${label} disalin!\`);
  });
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