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
  --glass-bg: rgba(255, 255, 255, 0.03);
  --glass-border: rgba(255, 255, 255, 0.05);
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
  padding-bottom: 60px;
}
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
  z-index: 100;
  border-bottom: 1px solid var(--border-color);
}
.header-left { display: flex; align-items: center; gap: 15px; }
.header-title { font-family: 'Orbitron'; font-size: 20px; font-weight: 700; color: #fff; letter-spacing: 1px; }
.menu-btn {
  width: 40px; height: 40px; display: flex; flex-direction: column; justify-content: center;
  align-items: center; gap: 6px; cursor: pointer; border-radius: 8px;
  transition: background 0.2s;
}
.menu-btn:hover { background: rgba(255,255,255,0.1); }
.menu-btn span {
  width: 24px; height: 2px; background: var(--text-main); border-radius: 2px;
  transition: 0.3s;
}
.menu-btn.active span:nth-child(1) { transform: rotate(45deg) translate(6px, 6px); }
.menu-btn.active span:nth-child(2) { opacity: 0; }
.menu-btn.active span:nth-child(3) { transform: rotate(-45deg) translate(6px, -6px); }
.page-container { padding: 80px 20px 20px; transition: filter 0.3s; }
.page-container.blur { filter: blur(4px); pointer-events: none; }

/* STATUS PANEL */
.status-panel {
  position: fixed; top: 70px; right: 20px; width: 320px;
  background: var(--bg-card); border: 1px solid var(--primary); border-radius: 16px;
  padding: 20px; z-index: 200; box-shadow: 0 10px 30px rgba(0,0,0,0.7);
  transform: translateX(120%); transition: transform 0.3s ease;
  backdrop-filter: blur(8px);
}
.status-panel.show { transform: translateX(0); }
.status-panel h3 {
  font-family: 'Orbitron'; color: var(--primary); margin-bottom: 15px;
  display: flex; align-items: center; gap: 8px;
}
/* Wave ala Pterodactyl */
.wave-container {
  position: relative; width: 100%; height: 50px; margin: 15px 0;
  background: #0a0e1a; border-radius: 8px; overflow: hidden;
}
.wave-group {
  position: absolute; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent 0%, transparent 20%, var(--primary) 20%, var(--primary) 40%, transparent 40%);
  background-size: 200% 100%;
  animation: waveMove 8s linear infinite;
  opacity: 0.15;
}
.wave-group:nth-child(2) {
  background: linear-gradient(90deg, transparent 0%, transparent 30%, var(--primary-light) 30%, var(--primary-light) 50%, transparent 50%);
  background-size: 250% 100%;
  animation: waveMove 12s linear infinite reverse;
  opacity: 0.1;
}
.wave-group:nth-child(3) {
  background: linear-gradient(90deg, transparent 0%, transparent 10%, #00ff88 10%, #00ff88 25%, transparent 25%);
  background-size: 180% 100%;
  animation: waveMove 6s linear infinite;
  opacity: 0.08;
}
@keyframes waveMove { 0% { background-position: 0 0; } 100% { background-position: 200% 0; } }
.status-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;
}
.status-item {
  background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;
  border-left: 2px solid var(--primary);
}
.status-item .label { color: var(--text-sub); font-size: 11px; text-transform: uppercase; }
.status-item .value { color: #fff; font-size: 14px; font-weight: bold; font-family: 'VT323'; }

/* HEADER CARD */
.lux-header-card {
  background: linear-gradient(135deg, #1e3c72, #2a5298);
  border-radius: 16px; padding: 20px; color: white; margin-bottom: 25px;
  border: 1px solid rgba(255,255,255,0.1);
}
.lux-header-card h2 { font-family: 'Orbitron'; font-size: 18px; }
.lux-section-title {
  font-family: 'Orbitron'; font-size: 16px; color: #fff; margin-bottom: 15px;
  padding-left: 5px; border-left: 3px solid var(--primary);
}

/* SLIDER */
.slider-container {
  width: 100%; background: var(--bg-card); border-radius: 16px; overflow: hidden;
  border: 1px solid var(--border-color); margin-bottom: 25px; height: 150px;
  touch-action: pan-y; cursor: grab; user-select: none;
}
.slider-track { display: flex; width: 200%; height: 100%; transition: transform 0.4s; }
.slide { width: 50%; height: 100%; position: relative; flex-shrink: 0; }
.slide video { width: 100%; height: 100%; object-fit: cover; display: block; }
.slide-content {
  position: absolute; bottom: 0; left: 0; width: 100%; padding: 15px;
  background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent);
}
.slide-content h3 { font-family: 'Orbitron'; font-size: 14px; }

/* API CARD */
.api-card { margin-bottom: 25px; }
.api-endpoint {
  background: var(--glass-bg); backdrop-filter: blur(4px);
  border: 1px solid var(--glass-border); border-radius: 12px;
  padding: 16px; margin-bottom: 15px; transition: all 0.2s;
}
.api-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;
}
.api-header .method {
  background: rgba(255,204,0,0.15); color: var(--accent-gold); font-weight: bold;
  padding: 2px 10px; border-radius: 30px; font-size: 12px; border: 1px solid rgba(255,204,0,0.3);
}
.api-header .url {
  color: #00ff88; word-break: break-all; font-family: 'VT323'; font-size: 14px;
  background: rgba(0,255,136,0.05); padding: 2px 10px; border-radius: 30px; flex: 1;
}
.copy-btn {
  background: transparent; border: 1px solid var(--primary); color: var(--primary);
  padding: 4px 12px; border-radius: 30px; cursor: pointer; font-size: 12px;
  display: inline-flex; align-items: center; gap: 5px; transition: 0.2s;
}
.copy-btn:hover { background: var(--primary); color: #000; }
.api-desc { color: var(--text-sub); font-size: 13px; margin-bottom: 10px; }
.start-btn {
  background: linear-gradient(90deg, var(--primary), var(--primary-light)); color: #000;
  border: none; padding: 6px 18px; border-radius: 30px; font-size: 13px; font-weight: bold;
  cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; gap: 6px;
}
.start-btn:hover { filter: brightness(1.1); transform: scale(1.02); }
.test-result {
  margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.3);
  border-radius: 8px; max-height: 200px; overflow: auto;
  font-family: 'VT323'; font-size: 13px; border: 1px solid var(--border-color);
}
.test-result.success { border-left: 3px solid #00ff88; }
.test-result.error { border-left: 3px solid var(--accent-red); }
.badge {
  display: inline-block; padding: 2px 8px; border-radius: 30px; font-weight: bold; font-size: 11px;
}
.badge.success { background: #00ff88; color: #000; }
.badge.error { background: var(--accent-red); color: #fff; }
.test-result img { max-width: 100%; max-height: 150px; border-radius: 8px; }
.test-result pre { white-space: pre-wrap; font-size: 11px; color: #ccc; }

/* MODAL UNTUK GAMBAR */
.modal {
  display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.9); z-index: 1000; justify-content: center; align-items: center;
}
.modal.show { display: flex; }
.modal-content {
  max-width: 90%; max-height: 90%; border-radius: 12px; box-shadow: 0 0 30px var(--primary);
}
.modal-close {
  position: absolute; top: 20px; right: 30px; color: #fff; font-size: 40px;
  cursor: pointer; transition: 0.2s;
}
.modal-close:hover { color: var(--primary); }

/* INPUT */
.webzip-input {
  display: flex; gap: 10px; align-items: center; margin: 10px 0; flex-wrap: wrap;
}
.webzip-input input {
  flex: 1; padding: 10px 14px; border-radius: 30px; border: 1px solid var(--border-color);
  background: var(--glass-bg); color: #fff; font-size: 13px;
}
.webzip-input input:focus { outline: none; border-color: var(--primary); }

.footer {
  text-align: center; padding: 20px; border-top: 1px solid var(--border-color);
  color: var(--text-sub); font-size: 12px; margin-top: 20px;
}
</style>
</head>
<body>
<div class="custom-header">
  <div class="header-left"><div class="header-title">NOVABOT API</div></div>
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
    <p style="font-size:13px; opacity:0.8;">API untuk bot WhatsApp Novabot</p>
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
      <div id="waifuResult" class="test-result" style="display:none;"></div>
    </div>

    <!-- WEBZIP -->
    <div class="api-endpoint">
      <div class="api-header">
        <span class="method">GET</span><span class="url">/webzip?url=...</span>
        <button class="copy-btn" onclick="copyText('${config.URL}/webzip?url=', 'webzip')"><i class="fas fa-copy"></i> webzip</button>
      </div>
      <div class="api-desc">Arsip website (ZIP). Parameter ?url=</div>
      <div class="webzip-input">
        <input type="text" id="webzipUrl" placeholder="https://contoh.com">
        <button class="start-btn" onclick="testWebzip()"><i class="fas fa-play"></i> Start</button>
      </div>
      <div id="webzipResult" class="test-result" style="display:none;"></div>
    </div>
  </div>

  <div class="footer">
    <p>© 2026 Novabot • <i class="fab fa-telegram"></i> ${config.DEVELOPER} • v${config.VERSI_WEB}</p>
  </div>
</div>

<!-- MODAL GAMBAR -->
<div id="imageModal" class="modal" onclick="this.classList.remove('show')">
  <span class="modal-close" onclick="document.getElementById('imageModal').classList.remove('show')">&times;</span>
  <img class="modal-content" id="modalImage" src="">
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

// ==================== WAIFU (MODAL) ====================
async function testWaifu() {
  const resultDiv = document.getElementById('waifuResult');
  resultDiv.style.display='block';
  resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  resultDiv.className = 'test-result';
  try {
    const res = await fetch('${config.URL}/waifu');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modalImg.src = url;
    modal.classList.add('show');
    resultDiv.style.display='none';
  } catch (err) {
    resultDiv.innerHTML = \`<div class="badge error">Error</div> \${err.message}\`;
    resultDiv.classList.add('error');
  }
}

// ==================== WEBZIP ====================
async function testWebzip() {
  const urlInput = document.getElementById('webzipUrl').value.trim();
  if (!urlInput) return alert('Masukkan URL!');
  const resultDiv = document.getElementById('webzipResult');
  resultDiv.style.display='block';
  resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  resultDiv.className = 'test-result';
  try {
    const apiUrl = \`${config.URL}/webzip?url=\${encodeURIComponent(urlInput)}\`;
    const res = await fetch(apiUrl);
    const data = await res.json();
    const status = res.status;
    resultDiv.innerHTML = \`
      <div class="badge \${status===200?'success':'error'}">\${status}</div>
      <pre>\${JSON.stringify(data,null,2)}</pre>
    \`;
    resultDiv.classList.add(status===200?'success':'error');
  } catch (err) {
    resultDiv.innerHTML = \`<div class="badge error">Network Error</div><pre>\${err.message}</pre>\`;
    resultDiv.classList.add('error');
  }
}

function copyText(text, label) {
  navigator.clipboard.writeText(text).then(()=>alert(\`Link \${label} disalin!\`));
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