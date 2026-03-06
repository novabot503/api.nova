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

// ==================== TIKTOK ENDPOINT (LENGKAP) ====================
app.get('/tiktok', async (req, res) => {
    const url = req.query.url;
    if (!url || !url.includes('tiktok.com')) {
        return res.status(400).json({ status: false, error: 'URL TikTok tidak valid.' });
    }

    try {
        const response = await axios.post('https://www.tikwm.com/api/', {}, {
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Origin': 'https://www.tikwm.com',
                'Referer': 'https://www.tikwm.com/',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest'
            },
            params: {
                url: url,
                count: 12,
                cursor: 0,
                web: 1,
                hd: 1
            }
        });

        const data = response.data.data;
        if (!data) {
            return res.status(404).json({ status: false, error: 'Video tidak ditemukan.' });
        }

        // Format angka (K/M)
        const formatNumber = (num) => {
            if (!num) return 0;
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toString();
        };

        // Durasi dalam format mm:ss
        const duration = data.duration ? Math.floor(data.duration / 60) + ':' + (data.duration % 60).toString().padStart(2, '0') : 'N/A';

        res.json({
            status: true,
            result: {
                video: data.play ? 'https://www.tikwm.com' + data.play : null,
                audio: data.music ? 'https://www.tikwm.com' + data.music : (data.music_info?.play ? 'https://www.tikwm.com' + data.music_info.play : null),
                title: data.title || 'Tidak ada judul',
                author: data.author?.nickname || 'Unknown',
                author_username: data.author?.unique_id || '',
                thumbnail: data.origin_cover || data.cover || '',
                duration: duration,
                duration_seconds: data.duration || 0,
                play_count: formatNumber(data.play_count),
                like_count: formatNumber(data.digg_count),
                comment_count: formatNumber(data.comment_count),
                share_count: formatNumber(data.share_count),
                download_count: formatNumber(data.download_count)
            }
        });

    } catch (error) {
        console.error('TikTok error:', error);
        res.status(500).json({ status: false, error: 'Gagal memproses permintaan.' });
    }
});

// ==================== HALAMAN UTAMA ====================
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=0.55" />
<title>NovaBot API</title>
<link rel="icon" href="https://files.catbox.moe/92681q.jpg" type="image/jpeg">
<link rel="apple-touch-icon" href="https://files.catbox.moe/92681q.jpg">
<meta property="og:type" content="website">
<meta property="og:url" content="${config.URL}">
<meta property="og:title" content="NovaBot API">
<meta property="og:description" content="API untuk bot WhatsApp Novabot">
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600&family=Orbitron:wght@500;700&family=VT323&display=swap" rel="stylesheet">
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body {
  font-family: 'Rajdhani', sans-serif;
  background: #0a0c14;
  color: #fff;
  min-height: 100vh;
  padding-bottom: 40px;
}
/* HEADER */
.custom-header {
  position: sticky; top: 0; width: 100%; height: 55px;
  background: rgba(10, 12, 20, 0.95); backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; z-index: 100; border-bottom: 1px solid #1f2a40;
}
.header-title { font-family: 'Orbitron'; font-size: 20px; color: #5b8cff; letter-spacing: 1px; }
.menu-btn {
  width: 40px; height: 40px; display: flex; flex-direction: column;
  justify-content: center; align-items: center; gap: 5px; cursor: pointer;
  border-radius: 8px; transition: 0.2s;
}
.menu-btn:hover { background: #1f2a40; }
.menu-btn span { width: 22px; height: 2px; background: #fff; border-radius: 2px; transition: 0.3s; }
.menu-btn.active span:nth-child(1) { transform: rotate(45deg) translate(6px, 6px); }
.menu-btn.active span:nth-child(2) { opacity: 0; }
.menu-btn.active span:nth-child(3) { transform: rotate(-45deg) translate(6px, -6px); }

/* PAGE CONTAINER */
.page-container { padding: 20px; transition: 0.3s; }
.page-container.blur { filter: blur(3px); pointer-events: none; }

/* STATUS PANEL */
.status-panel {
  position: fixed; top: 70px; right: 20px; width: 300px;
  background: #0f1320; border: 1px solid #2a3a60; border-radius: 16px;
  padding: 20px; z-index: 200; box-shadow: 0 10px 30px rgba(0,0,0,0.7);
  transform: translateX(120%); transition: transform 0.3s ease;
  backdrop-filter: blur(8px);
}
.status-panel.show { transform: translateX(0); }
.status-panel h3 { font-family: 'Orbitron'; color: #5b8cff; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }

/* WAVE IMPROVED */
.wave-container {
  position: relative; width: 100%; height: 80px; margin: 20px 0;
  background: #0b0e18; border-radius: 12px; overflow: hidden;
  border: 1px solid #1f2a40;
}
.wave-group {
  position: absolute; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, transparent 20%, #3a6df0 20%, #3a6df0 40%, transparent 40%, transparent 60%, #5b8cff 60%, #5b8cff 80%, transparent 80%);
  background-size: 250% 100%;
  animation: waveMove 10s linear infinite;
  opacity: 0.15;
}
.wave-group:nth-child(2) {
  background: linear-gradient(90deg, transparent, transparent 30%, #00ff88 30%, #00ff88 50%, transparent 50%, transparent 70%, #3a6df0 70%, #3a6df0 90%, transparent 90%);
  background-size: 300% 100%;
  animation: waveMove 14s linear infinite reverse;
  opacity: 0.1;
}
.wave-group:nth-child(3) {
  background: linear-gradient(90deg, transparent, transparent 10%, #ffcc00 10%, #ffcc00 25%, transparent 25%, transparent 40%, #5b8cff 40%, #5b8cff 55%, transparent 55%);
  background-size: 200% 100%;
  animation: waveMove 8s linear infinite;
  opacity: 0.08;
}
@keyframes waveMove { 0% { background-position: 0 0; } 100% { background-position: 200% 0; } }

.status-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;
}
.status-item {
  background: #1a1f30; border-radius: 8px; padding: 10px;
  border-left: 3px solid #3a6df0;
}
.status-item .label { color: #8a9bb0; font-size: 10px; text-transform: uppercase; }
.status-item .value { color: #fff; font-size: 14px; font-weight: bold; font-family: 'VT323'; }

/* HEADER CARD */
.lux-header-card {
  background: linear-gradient(135deg, #1a2a48, #14233c);
  border-radius: 16px; padding: 20px; margin-bottom: 25px;
  border: 1px solid #2a3a60;
}
.lux-header-card h2 { font-family: 'Orbitron'; font-size: 20px; color: #5b8cff; }
.lux-header-card p { font-size: 14px; color: #a0b0c0; }

/* SECTION TITLE */
.lux-section-title {
  font-family: 'Orbitron'; font-size: 16px; color: #fff; margin-bottom: 15px;
  padding-left: 8px; border-left: 4px solid #5b8cff;
}

/* SLIDER */
.slider-container {
  width: 100%; background: #101520; border-radius: 12px; overflow: hidden;
  border: 1px solid #1f2a40; margin-bottom: 25px; height: 150px;
  touch-action: pan-y; cursor: grab; user-select: none;
}
.slider-track { display: flex; width: 200%; height: 100%; transition: transform 0.4s; }
.slide { width: 50%; height: 100%; position: relative; flex-shrink: 0; }
.slide video { width: 100%; height: 100%; object-fit: cover; display: block; }
.slide-content {
  position: absolute; bottom: 0; left: 0; width: 100%; padding: 15px;
  background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
}
.slide-content h3 { font-family: 'Orbitron'; font-size: 14px; color: #fff; }
.slide-content p { font-size: 12px; color: #ccc; }

/* API ENDPOINT CARDS */
.api-card { margin-bottom: 20px; }
.api-endpoint {
  background: #101520; border: 1px solid #1f2a40; border-radius: 12px;
  padding: 16px; margin-bottom: 15px; transition: 0.2s;
}
.api-endpoint:hover { border-color: #5b8cff; }
.api-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;
}
.method {
  background: #1f2a40; color: #ffcc00; font-weight: bold; padding: 2px 10px;
  border-radius: 30px; font-size: 12px; border: 1px solid #ffcc00;
}
.url {
  color: #00ff88; word-break: break-all; font-family: 'VT323'; font-size: 14px;
  background: #1a1f30; padding: 2px 10px; border-radius: 30px; flex: 1;
}
.copy-btn {
  background: transparent; border: 1px solid #5b8cff; color: #5b8cff;
  padding: 4px 12px; border-radius: 30px; cursor: pointer; font-size: 12px;
  display: inline-flex; align-items: center; gap: 5px; transition: 0.2s;
}
.copy-btn:hover { background: #5b8cff; color: #000; }
.api-desc { color: #a0b0c0; font-size: 13px; margin-bottom: 12px; }

/* TOMBOL START */
.start-btn {
  background: #5b8cff; color: #000; border: none; padding: 6px 16px;
  border-radius: 30px; font-size: 13px; font-weight: bold; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px; transition: 0.2s;
}
.start-btn:hover { filter: brightness(1.1); transform: scale(1.02); }

/* INPUT GROUP */
.input-group {
  display: flex; gap: 10px; align-items: center; margin: 10px 0; flex-wrap: wrap;
}
.input-group input {
  flex: 1; padding: 8px 14px; border-radius: 30px; border: 1px solid #1f2a40;
  background: #1a1f30; color: #fff; font-size: 13px;
}
.input-group input:focus { outline: none; border-color: #5b8cff; }

/* RESPONSE CONTAINER (UNTUK GAMBAR DAN JSON) */
.response-container {
  margin-top: 15px; padding: 12px; background: #1a1f30; border-radius: 8px;
  border-left: 4px solid #5b8cff; display: none; max-height: 500px; overflow: auto;
}
.response-container.show { display: block; }
.response-container.success { border-left-color: #00ff88; }
.response-container.error { border-left-color: #ff3b30; }
.response-container img {
  max-width: 100%; max-height: 200px; border-radius: 8px; display: block; margin: 0 auto;
}
.response-container video {
  max-width: 100%; max-height: 300px; border-radius: 8px; display: block; margin: 10px auto;
}
.response-container pre {
  white-space: pre-wrap; font-family: 'VT323'; font-size: 12px; color: #ccc;
  margin-top: 10px;
}
.badge {
  display: inline-block; padding: 2px 8px; border-radius: 30px; font-weight: bold; font-size: 11px;
  margin-bottom: 8px;
}
.badge.success { background: #00ff88; color: #000; }
.badge.error { background: #ff3b30; color: #fff; }

/* COPY JSON BUTTON */
.copy-json-btn {
  background: #2a3a60; color: #fff; border: none; padding: 4px 10px;
  border-radius: 30px; font-size: 11px; cursor: pointer; margin-left: 8px;
  display: inline-flex; align-items: center; gap: 4px;
}
.copy-json-btn:hover { background: #3a4a70; }

/* FOOTER */
.footer {
  text-align: center; padding: 20px; border-top: 1px solid #1f2a40;
  color: #8a9bb0; font-size: 12px; margin-top: 20px;
}
</style>
</head>
<body>
<div class="custom-header">
  <div class="header-title">NOVABOT API</div>
  <div class="menu-btn" id="menuBtn"><span></span><span></span><span></span></div>
</div>

<div class="status-panel" id="statusPanel">
  <h3><i class="fas fa-chart-line"></i> SERVER STATUS</h3>
  <div class="wave-container">
    <div class="wave-group"></div><div class="wave-group"></div><div class="wave-group"></div>
  </div>
  <div id="statusContent" class="status-grid">Memuat...</div>
</div>

<div class="page-container" id="pageContainer">
  <div class="lux-header-card">
    <h2>Novabot API Service</h2>
    <p>API untuk bot WhatsApp Novabot</p>
  </div>

  <div class="lux-section-title">Latest News</div>
  <div class="slider-container" id="newsSlider">
    <div class="slider-track">
      <div class="slide"><video src="https://files.catbox.moe/7iyjd5.mp4" autoplay muted loop playsinline></video><div class="slide-content"><h3>Novabot API v${config.VERSI_WEB}</h3><p>API siap digunakan</p></div></div>
      <div class="slide"><video src="https://files.catbox.moe/sbwa8f.mp4" autoplay muted loop playsinline></video><div class="slide-content"><h3>Mudah & Cepat</h3><p>Integrasi dengan bot Anda</p></div></div>
    </div>
  </div>

  <div class="lux-section-title">API Endpoints</div>
  <div class="api-card">
    <!-- WAIFU -->
    <div class="api-endpoint">
      <div class="api-header">
        <span class="method">GET</span><span class="url">/waifu</span>
        <button class="copy-btn" onclick="copyText('${config.URL}/waifu', 'waifu')"><i class="fas fa-copy"></i> waifu</button>
      </div>
      <div class="api-desc">Gambar waifu random (PNG)</div>
      <button class="start-btn" onclick="testWaifu()"><i class="fas fa-play"></i> Start</button>
      <div id="waifuResponse" class="response-container"></div>
    </div>

    <!-- WEBZIP -->
    <div class="api-endpoint">
      <div class="api-header">
        <span class="method">GET</span><span class="url">/webzip?url=</span>
        <button class="copy-btn" onclick="copyText('${config.URL}/webzip?url=', 'webzip')"><i class="fas fa-copy"></i> webzip</button>
      </div>
      <div class="api-desc">Arsip website (ZIP). Parameter ?url=</div>
      <div class="input-group">
        <input type="text" id="webzipUrl" placeholder="https://contoh.com">
        <button class="start-btn" onclick="testWebzip()"><i class="fas fa-play"></i> Start</button>
      </div>
      <div id="webzipResponse" class="response-container"></div>
    </div>

    <!-- TIKTOK -->
    <div class="api-endpoint">
      <div class="api-header">
        <span class="method">GET</span><span class="url">/tiktok?url=</span>
        <button class="copy-btn" onclick="copyText('${config.URL}/tiktok?url=', 'tiktok')"><i class="fas fa-copy"></i> tiktok</button>
      </div>
      <div class="api-desc">Download video TikTok (tanpa watermark). Parameter ?url=</div>
      <div class="input-group">
        <input type="text" id="tiktokUrl" placeholder="https://www.tiktok.com/@user/video/123456">
        <button class="start-btn" onclick="testTiktok()"><i class="fas fa-play"></i> Start</button>
      </div>
      <div id="tiktokResponse" class="response-container"></div>
    </div>
  </div>

  <div class="footer">
    <p>© 2026 Novabot • <i class="fab fa-telegram"></i> ${config.DEVELOPER} • v${config.VERSI_WEB}</p>
  </div>
</div>

<script>
// ==================== STATUS ====================
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
      <div class="status-item"><div class="label">STATUS</div><div class="value" style="color:#0f0;">🟢 ONLINE</div></div>
      <div class="status-item"><div class="label">VERSION</div><div class="value">\${data.version}</div></div>
      <div class="status-item"><div class="label">DEV</div><div class="value">\${data.developer}</div></div>
      <div class="status-item"><div class="label">UPTIME</div><div class="value">\${uptime}</div></div>
      <div class="status-item"><div class="label">TIME</div><div class="value">\${new Date(data.timestamp).toLocaleTimeString('id-ID')}</div></div>
    \`;
  } catch { statusContent.innerHTML = '<div class="status-item">❌ Gagal</div>'; }
}
function formatUptime(s) {
  const d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60), sec=Math.floor(s%60);
  return \`\${d}d \${h}h \${m}m \${sec}s\`;
}
loadStatus(); setInterval(loadStatus, 30000);

// ==================== SLIDER ====================
let slideIdx=0, slideInt;
const slider=document.getElementById('newsSlider'), track=document.querySelector('.slider-track');
function startSlider(){clearInterval(slideInt);slideInt=setInterval(()=>{slideIdx=(slideIdx+1)%2;updateSlide();},5000);}
function updateSlide(){if(track)track.style.transform=\`translateX(-\${slideIdx*50}%)\`;}
function setupSlider(){
if(!slider||!track)return;
let isSwiping=false,startX=0,curX=0;
const getX=e=>e.type.includes('mouse')?e.pageX:e.touches[0].clientX;
slider.addEventListener('touchstart',e=>{startX=getX(e);isSwiping=true;clearInterval(slideInt);});
slider.addEventListener('touchmove',e=>{if(!isSwiping)return;curX=getX(e);const diff=curX-startX;if(Math.abs(diff)>20)track.style.transform=\`translateX(-\${slideIdx*50+(diff/slider.offsetWidth)*50}%)\`;});
slider.addEventListener('touchend',e=>{if(!isSwiping)return;isSwiping=false;const diff=curX-startX;if(Math.abs(diff)>80)diff>0?slideIdx=(slideIdx-1+2)%2:slideIdx=(slideIdx+1)%2;updateSlide();startSlider();});
['mousedown','mousemove','mouseup','mouseleave'].forEach(ev=>slider.addEventListener(ev,e=>{e.preventDefault();}));
}
startSlider(); setupSlider();

// ==================== WAIFU ====================
async function testWaifu() {
  const respDiv = document.getElementById('waifuResponse');
  respDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  respDiv.className = 'response-container show';
  try {
    const res = await fetch('${config.URL}/waifu');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    respDiv.innerHTML = \`
      <div class="badge success">200 OK</div>
      <img src="\${url}" alt="Waifu Image">
    \`;
    respDiv.classList.add('success');
  } catch (err) {
    respDiv.innerHTML = \`<div class="badge error">Network Error</div><pre>\${err.message}</pre>\`;
    respDiv.classList.add('error');
  }
}

// ==================== WEBZIP (dengan tombol copy JSON) ====================
async function testWebzip() {
  const urlInput = document.getElementById('webzipUrl').value.trim();
  if (!urlInput) return alert('Masukkan URL!');
  const respDiv = document.getElementById('webzipResponse');
  respDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  respDiv.className = 'response-container show';
  try {
    const apiUrl = \`${config.URL}/webzip?url=\${encodeURIComponent(urlInput)}\`;
    const res = await fetch(apiUrl);
    const data = await res.json();
    const status = res.status;
    const jsonStr = JSON.stringify(data, null, 2);
    respDiv.innerHTML = \`
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <div class="badge \${status===200?'success':'error'}">\${status}</div>
        <button class="copy-json-btn" onclick="copyText('\${encodeURIComponent(jsonStr)}', 'json')"><i class="fas fa-copy"></i> Copy JSON</button>
      </div>
      <pre>\${jsonStr}</pre>
    \`;
    respDiv.classList.add(status===200?'success':'error');
  } catch (err) {
    respDiv.innerHTML = \`<div class="badge error">Network Error</div><pre>\${err.message}</pre>\`;
    respDiv.classList.add('error');
  }
}

// ==================== TIKTOK (lengkap + tombol copy JSON) ====================
async function testTiktok() {
  const urlInput = document.getElementById('tiktokUrl').value.trim();
  if (!urlInput) return alert('Masukkan URL TikTok!');
  const respDiv = document.getElementById('tiktokResponse');
  respDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  respDiv.className = 'response-container show';
  try {
    const apiUrl = \`${config.URL}/tiktok?url=\${encodeURIComponent(urlInput)}\`;
    const res = await fetch(apiUrl);
    const data = await res.json();
    const status = res.status;
    if (data.status) {
      const r = data.result;
      const jsonStr = JSON.stringify(data, null, 2);
      let html = \`
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <div class="badge success">200 OK</div>
          <button class="copy-json-btn" onclick="copyText('\${encodeURIComponent(jsonStr)}', 'json')"><i class="fas fa-copy"></i> Copy JSON</button>
        </div>
      \`;
      html += \`<p><strong>Judul:</strong> \${r.title}</p>\`;
      html += \`<p><strong>Author:</strong> \${r.author} (@\${r.author_username})</p>\`;
      if (r.thumbnail) html += \`<img src="\${r.thumbnail}" style="max-width:100%; max-height:150px; border-radius:8px; margin-bottom:10px;">\`;
      html += \`<p><strong>Durasi:</strong> \${r.duration} (\${r.duration_seconds} detik)</p>\`;
      html += \`<p><strong>👍 Likes:</strong> \${r.like_count} • <strong>💬 Komentar:</strong> \${r.comment_count} • <strong>🔄 Dibagikan:</strong> \${r.share_count} • <strong>📥 Download:</strong> \${r.download_count}</p>\`;
      if (r.video) html += \`<video src="\${r.video}" controls style="max-width:100%; margin-top:10px;"></video>\`;
      if (r.audio) html += \`<p><strong>Audio:</strong> <a href="\${r.audio}" target="_blank">Download Audio</a></p>\`;
      respDiv.innerHTML = html;
      respDiv.classList.add('success');
    } else {
      const jsonStr = JSON.stringify(data, null, 2);
      respDiv.innerHTML = \`
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <div class="badge error">\${status}</div>
          <button class="copy-json-btn" onclick="copyText('\${encodeURIComponent(jsonStr)}', 'json')"><i class="fas fa-copy"></i> Copy JSON</button>
        </div>
        <pre>\${jsonStr}</pre>
      \`;
      respDiv.classList.add('error');
    }
  } catch (err) {
    respDiv.innerHTML = \`<div class="badge error">Network Error</div><pre>\${err.message}</pre>\`;
    respDiv.classList.add('error');
  }
}

// ==================== COPY TEXT ====================
function copyText(text, label) {
  if (label === 'json') text = decodeURIComponent(text);
  navigator.clipboard.writeText(text).then(() => alert('Teks disalin!'));
}

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('video').forEach(v=>v.play().catch(()=>{}));
});
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&e.key==='I')||(e.ctrlKey&&e.key==='U'))e.preventDefault();
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
\x1b[1m\x1b[34m╔╗ ╦  ╔═╗╔═╗╔═╗╦═╗╔═╗ \x1b[31m
\x1b[1m\x1b[34m╠╩╗║  ╠═╣╔═╝║╣ ╠╦╝╚═╗ \x1b[31m
\x1b[1m\x1b[34m╚═╝╩═╝╩ ╩╚═╝╚═╝╩╚═╚═╝ \x1b[31m
\x1b[1m\x1b[33mN O V A B O T   A P I   v${config.VERSI_WEB || '1.0'}\x1b[0m
\x1b[1m\x1b[32m═══════════════════════════════════════\x1b[0m
🌐 Server: http://${HOST}:${PORT}
👤 Developer: ${config.DEVELOPER || '@Novabot403'}
📦 Version: ${config.VERSI_WEB || '1.0'}
✅ API ready!
  `);
});