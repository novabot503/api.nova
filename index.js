// ==================== index.js ====================
// Novabot API - Versi Terstruktur dengan Pengelompokan Jelas
// Semua fitur dan tampilan tetap sama, internal dirapikan dan ditambah notifikasi error ke Telegram.

const express = require('express');
const axios = require('axios');
const cloudscraper = require('cloudscraper');
const https = require('https');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const config = require('./setting.js');

// ==================== INISIALISASI ====================
const app = express();
const PORT = config.PORT || 8080;
const HOST = config.HOST || 'localhost';

// ==================== KONFIGURASI & KONSTANTA ====================
const VERSION = config.VERSI_WEB || '1.0';
const DEVELOPER = config.DEVELOPER || '@Novabot403';
const BASE_URL = config.URL || `http://${HOST}:${PORT}`;
const TELEGRAM_TOKEN = config.TELEGRAM_TOKEN;
const OWNER_ID = config.OWNER_ID;

// HTTPS Agent untuk Pinterest
const httpsAgent = new https.Agent({
  rejectUnauthorized: true,
  maxVersion: 'TLSv1.3',
  minVersion: 'TLSv1.2',
});

// Daftar tipe NSFW
const NSFW_TYPES = ['blowjob', 'neko', 'trap', 'waifu'];

// ==================== MIDDLEWARE GLOBAL ====================
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Rate limiting per IP (khusus endpoint API)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { status: false, error: 'Terlalu banyak permintaan, coba lagi nanti.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// ==================== FUNGSI HELPER ====================

/**
 * Mengirim notifikasi error ke Telegram
 */
async function sendErrorToTelegram(error, req = null) {
  if (!TELEGRAM_TOKEN || !OWNER_ID) return;
  const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : 'unknown';
  const endpoint = req ? `${req.method} ${req.originalUrl}` : 'unknown';
  const message = `❌ *API Error*\n\n` +
    `*Endpoint:* ${endpoint}\n` +
    `*IP:* ${ip}\n` +
    `*Time:* ${new Date().toLocaleString('id-ID')}\n` +
    `*Message:* ${error.message}\n` +
    `*Stack:* ${error.stack || ''}`;
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: OWNER_ID,
      text: message,
      parse_mode: 'Markdown'
    });
  } catch (e) {
    console.error('Gagal kirim ke Telegram:', e.message);
  }
}

/**
 * Fetch JSON dari URL
 */
async function fetchJson(url) {
  const res = await axios.get(url);
  return res.data;
}

/**
 * Ambil buffer dari URL
 */
async function getBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

/**
 * Format angka (K, M)
 */
function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Format durasi (detik ke MM:SS)
 */
function formatDuration(seconds) {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format uptime
 */
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

/**
 * Validasi URL
 */
function isValidUrl(url) {
  return validator.isURL(url, { require_protocol: true, protocols: ['http', 'https'] });
}

// ==================== SERVICE: PINTEREST ====================

async function getPinterestCookies() {
  try {
    const response = await axios.get('https://www.pinterest.com/csrf_error/', { httpsAgent });
    const setCookieHeaders = response.headers['set-cookie'];
    if (setCookieHeaders) {
      const cookies = setCookieHeaders.map(c => c.split(';')[0].trim());
      return cookies.join('; ');
    }
    return null;
  } catch (error) {
    console.error('Gagal ambil cookie Pinterest:', error.message);
    return null;
  }
}

async function searchPinterest(query) {
  const cookies = await getPinterestCookies();
  if (!cookies) throw new Error('Tidak bisa mendapatkan cookies Pinterest');

  const url = 'https://www.pinterest.com/resource/BaseSearchResource/get/';
  const params = {
    source_url: `/search/pins/?q=${encodeURIComponent(query)}`,
    data: JSON.stringify({
      options: {
        isPrefetch: false,
        query,
        scope: 'pins',
        no_fetch_context_on_resource: false,
      },
      context: {},
    }),
    _: Date.now(),
  };

  const headers = {
    'accept': 'application/json, text/javascript, */*, q=0.01',
    'accept-encoding': 'gzip, deflate',
    'accept-language': 'en-US,en;q=0.9',
    'cookie': cookies,
    'dnt': '1',
    'referer': 'https://www.pinterest.com/',
    'sec-ch-ua': '"Not(A:Brand";v="99", "Microsoft Edge";v="133", "Chromium";v="133"',
    'sec-ch-ua-full-version-list': '"Not(A:Brand";v="99.0.0.0", "Microsoft Edge";v="133.0.3065.92", "Chromium";v="133.0.6943.142"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-model': '""',
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua-platform-version': '"10.0.0"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0',
    'x-app-version': 'c056fb7',
    'x-pinterest-appstate': 'active',
    'x-pinterest-pws-handler': 'www/[username]/[slug].js',
    'x-pinterest-source-url': '/hargr003/cat-pictures/',
    'x-requested-with': 'XMLHttpRequest'
  };

  const { data } = await axios.get(url, { httpsAgent, headers, params });
  const results = data?.resource_response?.data?.results || [];
  return results
    .filter(v => v.images?.orig)
    .map(v => ({
      upload_by: v.pinner?.username || 'unknown',
      caption: v.grid_title || '',
      image: v.images.orig.url,
      source: `https://id.pinterest.com/pin/${v.id}`,
    }));
}

// ==================== SERVICE: WEBZIP ====================

async function saveWeb2Zip(url, options = {}) {
  if (!url) throw new Error('URL diperlukan');
  const targetUrl = url.startsWith('https://') ? url : `https://${url}`;
  const {
    renameAssets = false,
    saveStructure = false,
    alternativeAlgorithm = false,
    mobileVersion = false
  } = options;

  const response = await cloudscraper.post('https://copier.saveweb2zip.com/api/copySite', {
    json: {
      url: targetUrl,
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

  const maxAttempts = 60;
  let attempts = 0;
  while (attempts < maxAttempts) {
    const process = await cloudscraper.get(`https://copier.saveweb2zip.com/api/getStatus/${md5}`, {
      json: true,
      headers: {
        accept: '*/*',
        'content-type': 'application/json',
        origin: 'https://saveweb2zip.com',
        referer: 'https://saveweb2zip.com/'
      }
    });

    if (process.isFinished) {
      return {
        url: targetUrl,
        error: {
          text: process.errorText,
          code: process.errorCode,
        },
        copiedFilesAmount: process.copiedFilesAmount,
        downloadUrl: `https://copier.saveweb2zip.com/api/downloadArchive/${process.md5}`
      };
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  throw new Error('Timeout: proses webzip terlalu lama');
}

// ==================== SERVICE: TIKTOK ====================

async function fetchTikTok(url) {
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
    params: { url, count: 12, cursor: 0, web: 1, hd: 1 }
  });
  return response.data.data;
}

// ==================== ENDPOINT: STATUS API ====================

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    version: VERSION,
    developer: DEVELOPER,
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// ==================== ENDPOINT: PINTEREST ====================

app.get('/pinterest', async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ status: false, error: 'Parameter q (string) diperlukan.' });
  }
  try {
    const results = await searchPinterest(q);
    res.json({ status: true, result: results });
  } catch (error) {
    console.error('Pinterest error:', error.message);
    await sendErrorToTelegram(error, req);
    res.status(500).json({ status: false, error: 'Gagal mengambil data dari Pinterest.' });
  }
});

// ==================== ENDPOINT: WAIFU ====================

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
    console.error('Waifu error:', error.message);
    await sendErrorToTelegram(error, req);
    res.status(500).send('Error mengambil gambar waifu.');
  }
});

// ==================== ENDPOINT: NSFW ====================

app.get('/nsfw', async (req, res) => {
  try {
    const randomType = NSFW_TYPES[Math.floor(Math.random() * NSFW_TYPES.length)];
    const data = await fetchJson(`https://api.waifu.pics/nsfw/${randomType}`);
    const buffer = await getBuffer(data.url);
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  } catch (error) {
    console.error('NSFW error:', error.message);
    await sendErrorToTelegram(error, req);
    res.status(500).send('Error mengambil gambar NSFW.');
  }
});

// ==================== ENDPOINT: WEBZIP ====================

app.get('/webzip', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ status: false, error: 'Parameter ?url= wajib diisi.' });
  }
  if (!isValidUrl(url)) {
    return res.status(400).json({ status: false, error: 'URL tidak valid.' });
  }

  try {
    const result = await saveWeb2Zip(url, { renameAssets: true });
    if (result.error?.code) {
      return res.status(500).json({
        status: false,
        error: result.error.text || 'Gagal menyimpan website.'
      });
    }
    res.json({
      status: true,
      originalUrl: result.url,
      copiedFilesAmount: result.copiedFilesAmount,
      downloadUrl: result.downloadUrl
    });
  } catch (error) {
    console.error('Webzip error:', error.message);
    await sendErrorToTelegram(error, req);
    res.status(500).json({ status: false, error: error.message });
  }
});

// ==================== ENDPOINT: TIKTOK ====================

app.get('/tiktok', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.includes('tiktok.com')) {
    return res.status(400).json({ status: false, error: 'URL TikTok tidak valid.' });
  }
  if (!isValidUrl(url)) {
    return res.status(400).json({ status: false, error: 'URL tidak valid.' });
  }

  try {
    const data = await fetchTikTok(url);
    if (!data) {
      return res.status(404).json({ status: false, error: 'Video tidak ditemukan.' });
    }

    res.json({
      status: true,
      result: {
        video: data.play ? 'https://www.tikwm.com' + data.play : null,
        audio: data.music ? 'https://www.tikwm.com' + data.music : (data.music_info?.play ? 'https://www.tikwm.com' + data.music_info.play : null),
        title: data.title || 'Tidak ada judul',
        author: data.author?.nickname || 'Unknown',
        author_username: data.author?.unique_id || '',
        duration: formatDuration(data.duration),
        duration_seconds: data.duration || 0,
        play_count: formatNumber(data.play_count),
        like_count: formatNumber(data.digg_count),
        comment_count: formatNumber(data.comment_count),
        share_count: formatNumber(data.share_count),
        download_count: formatNumber(data.download_count)
      }
    });
  } catch (error) {
    console.error('TikTok error:', error.message);
    await sendErrorToTelegram(error, req);
    res.status(500).json({ status: false, error: 'Gagal memproses permintaan TikTok.' });
  }
});

// ==================== ENDPOINT: BRAT ====================

app.get('/brat', async (req, res) => {
  const { text } = req.query;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ status: false, message: 'Parameter text diperlukan.' });
  }
  try {
    const apiUrl = `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('Brat error:', error.message);
    await sendErrorToTelegram(error, req);
    res.status(500).json({ status: false, message: 'Gagal mengambil gambar brat.' });
  }
});

// ==================== ENDPOINT: BRATVID ====================

app.get('/bratvid', async (req, res) => {
  const { text } = req.query;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ status: false, message: 'Parameter text diperlukan.' });
  }
  try {
    const apiUrl = `https://zelapioffciall.koyeb.app/canvas/bratvid?text=${encodeURIComponent(text)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('Bratvid error:', error.message);
    await sendErrorToTelegram(error, req);
    res.status(500).json({ status: false, message: 'Gagal mengambil gambar bratvid.' });
  }
});

// ==================== HALAMAN UTAMA (HTML) ====================
// HTML diambil persis dari kode asli, hanya variabel BASE_URL, VERSION, DEVELOPER digunakan.
// Semua backtick di dalam script telah di-escape agar tidak mengganggu template literal server.
app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=0.60" />
<title>NovaBot API</title>
<link rel="icon" href="https://files.catbox.moe/92681q.jpg" type="image/jpeg">
<link rel="apple-touch-icon" href="https://files.catbox.moe/92681q.jpg">
<meta property="og:type" content="website">
<meta property="og:url" content="${BASE_URL}">
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
  position: relative;
  overflow-x: hidden;
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
.menu-btn span {
  width: 22px; height: 2px; background: #fff; border-radius: 2px;
  transition: 0.3s;
}
.menu-btn.active span:nth-child(1) { transform: rotate(45deg) translate(6px, 6px); }
.menu-btn.active span:nth-child(2) { opacity: 0; }
.menu-btn.active span:nth-child(3) { transform: rotate(-45deg) translate(6px, -6px); }

/* STATUS PANEL (SLIDE DOWN) */
.status-panel {
  position: fixed;
  top: -100%;
  left: 0;
  width: 100%;
  background: #0f1320;
  border-bottom: 2px solid #2a3a60;
  box-shadow: 0 10px 20px rgba(0,0,0,0.7);
  z-index: 99;
  transition: top 0.4s ease;
  padding: 70px 20px 20px 20px;
  backdrop-filter: blur(8px);
}
.status-panel.show { top: 0; }
.status-panel h3 {
  font-family: 'Orbitron';
  color: #5b8cff;
  margin-bottom: 20px;
  font-size: 24px;
  text-align: center;
}

/* METRIC CARDS */
.metric-row {
  margin-bottom: 20px;
  background: #0b0e18;
  border-radius: 12px;
  padding: 15px;
  border: 1px solid #1f2a40;
}
.metric-header {
  display: flex;
  justify-content: space-between;
  color: #8a9bb0;
  font-size: 16px;
  margin-bottom: 10px;
}
.wave-container {
  position: relative;
  width: 100%;
  height: 60px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}
.wave-svg {
  position: absolute;
  width: 200%;
  height: 100%;
  animation: waveMove linear infinite;
}
.cpu-wave { animation-duration: 7s; }
.cpu-wave:nth-child(2) { animation-duration: 9s; }
.cpu-wave:nth-child(3) { animation-duration: 11s; }
.mem-wave { animation-duration: 6s; }
.mem-wave:nth-child(2) { animation-duration: 8s; }
.mem-wave:nth-child(3) { animation-duration: 10s; }
.net-wave { animation-duration: 5s; }
.net-wave:nth-child(2) { animation-duration: 7s; }
.net-wave:nth-child(3) { animation-duration: 9s; }
@keyframes waveMove {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-top: 25px;
}
.status-item {
  background: #1a1f30;
  border-radius: 8px;
  padding: 12px;
  border-left: 3px solid #3a6df0;
}
.status-item .label { color: #8a9bb0; font-size: 12px; text-transform: uppercase; }
.status-item .value { color: #fff; font-size: 18px; font-weight: bold; font-family: 'VT323'; }

/* PAGE CONTAINER */
.page-container { padding: 20px; transition: filter 0.3s; }
.page-container.blur { filter: blur(3px); pointer-events: none; }

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
  background: #101520;
  border: 1px solid #1f2a40;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 15px;
  transition: 0.2s;
}
.api-endpoint:hover { border-color: #5b8cff; }
.api-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.method {
  background: #1f2a40;
  color: #ffcc00;
  font-weight: bold;
  padding: 2px 10px;
  border-radius: 30px;
  font-size: 12px;
  border: 1px solid #ffcc00;
}
.url {
  color: #00ff88;
  word-break: break-all;
  font-family: 'VT323';
  font-size: 14px;
  background: #1a1f30;
  padding: 2px 10px;
  border-radius: 30px;
  flex: 1;
}
.copy-btn {
  background: transparent;
  border: 1px solid #5b8cff;
  color: #5b8cff;
  padding: 4px 12px;
  border-radius: 30px;
  cursor: pointer;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: 0.2s;
}
.copy-btn:hover {
  background: #5b8cff;
  color: #000;
}
.api-desc {
  color: #a0b0c0;
  font-size: 13px;
  margin-bottom: 12px;
}

/* TOMBOL START */
.start-btn {
  background: #5b8cff;
  color: #000;
  border: none;
  padding: 6px 16px;
  border-radius: 30px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: 0.2s;
}
.start-btn:hover {
  filter: brightness(1.1);
  transform: scale(1.02);
}

/* INPUT GROUP */
.input-group {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 10px 0;
  flex-wrap: wrap;
}
.input-group input {
  flex: 1;
  padding: 8px 14px;
  border-radius: 30px;
  border: 1px solid #1f2a40;
  background: #1a1f30;
  color: #fff;
  font-size: 13px;
}
.input-group input:focus {
  outline: none;
  border-color: #5b8cff;
}

/* RESPONSE CONTAINER */
.response-container {
  margin-top: 15px;
  padding: 12px;
  background: #1a1f30;
  border-radius: 8px;
  border-left: 4px solid #5b8cff;
  display: none;
  max-height: 500px;
  overflow: auto;
}
.response-container.show { display: block; }
.response-container.success { border-left-color: #00ff88; }
.response-container.error { border-left-color: #ff3b30; }
.response-container img {
  max-width: 100%;
  max-height: 300px;
  width: auto;
  height: auto;
  display: block;
  margin: 0 auto;
  object-fit: contain;
  border-radius: 8px;
  border: 2px solid #2a3a60;
}
.response-container video {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  display: block;
  margin: 10px auto;
}
.response-container pre {
  white-space: pre-wrap;
  font-family: 'VT323';
  font-size: 12px;
  color: #ccc;
  margin-top: 10px;
}
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 30px;
  font-weight: bold;
  font-size: 11px;
  margin-bottom: 8px;
}
.badge.success { background: #00ff88; color: #000; }
.badge.error { background: #ff3b30; color: #fff; }

/* COPY JSON BUTTON */
.copy-json-btn {
  background: #2a3a60;
  color: #fff;
  border: none;
  padding: 4px 10px;
  border-radius: 30px;
  font-size: 11px;
  cursor: pointer;
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.copy-json-btn:hover { background: #3a4a70; }

/* DOWNLOAD BUTTON */
.download-btn {
  background: #3a6df0;
  color: #fff;
  border: none;
  padding: 4px 10px;
  border-radius: 30px;
  font-size: 11px;
  cursor: pointer;
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.download-btn:hover { background: #2a5ac0; }

/* FOOTER */
.footer {
  text-align: center;
  padding: 20px;
  border-top: 1px solid #1f2a40;
  color: #8a9bb0;
  font-size: 12px;
  margin-top: 20px;
}
</style>
</head>
<body>
<div class="custom-header">
  <div class="header-title">NOVABOT API</div>
  <div class="menu-btn" id="menuBtn">
    <span></span><span></span><span></span>
  </div>
</div>

<!-- STATUS PANEL (SLIDE DOWN) -->
<div class="status-panel" id="statusPanel">
  <h3><i class="fas fa-chart-line"></i> SERVER STATUS</h3>
  
  <!-- CPU Load -->
  <div class="metric-row">
    <div class="metric-header">
      <span>CPU Load</span>
      <span id="cpuValue">0.0%</span>
    </div>
    <div class="wave-container">
      <svg class="wave-svg cpu-wave" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0,40 Q200,0 400,40 T800,40 T1200,40 L1200,60 L0,60 Z" fill="#3a6df0" opacity="0.4"/>
      </svg>
      <svg class="wave-svg cpu-wave" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0,25 Q200,45 400,25 T800,25 T1200,25 L1200,60 L0,60 Z" fill="#5b8cff" opacity="0.4"/>
      </svg>
      <svg class="wave-svg cpu-wave" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0,35 Q200,10 400,35 T800,35 T1200,35 L1200,60 L0,60 Z" fill="#1a4a9f" opacity="0.4"/>
      </svg>
    </div>
  </div>

  <!-- Memory -->
  <div class="metric-row">
    <div class="metric-header">
      <span>Memory</span>
      <span id="memValue">0 MiB</span>
    </div>
    <div class="wave-container">
      <svg class="wave-svg mem-wave" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0,40 Q200,0 400,40 T800,40 T1200,40 L1200,60 L0,60 Z" fill="#f97316" opacity="0.4"/>
      </svg>
      <svg class="wave-svg mem-wave" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0,25 Q200,45 400,25 T800,25 T1200,25 L1200,60 L0,60 Z" fill="#fb923c" opacity="0.4"/>
      </svg>
      <svg class="wave-svg mem-wave" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0,35 Q200,10 400,35 T800,35 T1200,35 L1200,60 L0,60 Z" fill="#ea580c" opacity="0.4"/>
      </svg>
    </div>
  </div>

  <!-- Network -->
  <div class="metric-row">
    <div class="metric-header">
      <span>Network</span>
      <span id="netValue">0 B/s</span>
    </div>
    <div class="wave-container">
      <svg class="wave-svg net-wave" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0,40 Q200,0 400,40 T800,40 T1200,40 L1200,60 L0,60 Z" fill="#a855f7" opacity="0.4"/>
      </svg>
      <svg class="wave-svg net-wave" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0,25 Q200,45 400,25 T800,25 T1200,25 L1200,60 L0,60 Z" fill="#c084fc" opacity="0.4"/>
      </svg>
      <svg class="wave-svg net-wave" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0,35 Q200,10 400,35 T800,35 T1200,35 L1200,60 L0,60 Z" fill="#9333ea" opacity="0.4"/>
      </svg>
    </div>
  </div>

  <!-- Status Info Grid -->
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
      <div class="slide"><video src="https://files.catbox.moe/7iyjd5.mp4" autoplay muted loop playsinline></video><div class="slide-content"><h3>Novabot API v${VERSION}</h3><p>API siap digunakan</p></div></div>
      <div class="slide"><video src="https://files.catbox.moe/sbwa8f.mp4" autoplay muted loop playsinline></video><div class="slide-content"><h3>Mudah & Cepat</h3><p>Integrasi dengan bot Anda</p></div></div>
    </div>
  </div>

  <div class="lux-section-title">API Endpoints</div>
  <div class="api-card">
    <!-- WAIFU -->
    <div class="api-endpoint">
      <div class="api-header">
        <span class="method">GET</span><span class="url">/waifu</span>
        <button class="copy-btn" onclick="copyText('${BASE_URL}/waifu', 'waifu')"><i class="fas fa-copy"></i> waifu</button>
      </div>
      <div class="api-desc">Gambar waifu random (PNG)</div>
      <div class="input-group" style="justify-content: flex-end;">
        <button class="start-btn" onclick="testWaifu()"><i class="fas fa-play"></i> Start</button>
      </div>
      <div id="waifuResponse" class="response-container"></div>
    </div>

    <!-- NSFW -->
    <div class="api-endpoint">
      <div class="api-header">
        <span class="method">GET</span><span class="url">/nsfw</span>
        <button class="copy-btn" onclick="copyText('${BASE_URL}/nsfw', 'nsfw')"><i class="fas fa-copy"></i> nsfw</button>
      </div>
      <div class="api-desc">Gambar NSFW random (blowjob, neko, trap, waifu)</div>
      <div class="input-group" style="justify-content: flex-end;">
        <button class="start-btn" onclick="testNsfw()"><i class="fas fa-play"></i> Start</button>
      </div>
      <div id="nsfwResponse" class="response-container"></div>
    </div>

    <!-- WEBZIP -->
    <div class="api-endpoint">
      <div class="api-header">
        <span class="method">GET</span><span class="url">/webzip?url=</span>
        <button class="copy-btn" onclick="copyText('${BASE_URL}/webzip?url=', 'webzip')"><i class="fas fa-copy"></i> webzip</button>
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
        <button class="copy-btn" onclick="copyText('${BASE_URL}/tiktok?url=', 'tiktok')"><i class="fas fa-copy"></i> tiktok</button>
      </div>
      <div class="api-desc">Download video TikTok (tanpa watermark). Parameter ?url=</div>
      <div class="input-group">
        <input type="text" id="tiktokUrl" placeholder="https://www.tiktok.com/@user/video/123456">
        <button class="start-btn" onclick="testTiktok()"><i class="fas fa-play"></i> Start</button>
      </div>
      <div id="tiktokResponse" class="response-container"></div>
    </div>

    <!-- BRAT -->
    <div class="api-endpoint">
      <div class="api-header">
        <span class="method">GET</span><span class="url">/brat?text=</span>
        <button class="copy-btn" onclick="copyText('${BASE_URL}/brat?text=', 'brat')"><i class="fas fa-copy"></i> brat</button>
      </div>
      <div class="api-desc">Buat gambar brat (via API eksternal). Parameter ?text=</div>
      <div class="input-group">
        <input type="text" id="bratText" placeholder="Masukkan teks">
        <button class="start-btn" onclick="testBrat()"><i class="fas fa-play"></i> Start</button>
      </div>
      <div id="bratResponse" class="response-container"></div>
    </div>

<!-- PINTEREST -->
<div class="api-endpoint">
  <div class="api-header">
    <span class="method">GET</span><span class="url">/pinterest?q=</span>
    <button class="copy-btn" onclick="copyText('${BASE_URL}/pinterest?q=', 'pinterest')"><i class="fas fa-copy"></i> pinterest</button>
  </div>
  <div class="api-desc">Cari gambar di Pinterest. Parameter ?q= (kata kunci)</div>
  <div class="input-group">
    <input type="text" id="pinterestQuery" placeholder="Masukkan kata kunci">
    <button class="start-btn" onclick="testPinterest()"><i class="fas fa-play"></i> Start</button>
  </div>
  <div id="pinterestResponse" class="response-container"></div>
</div>

    <!-- BRATVID -->
    <div class="api-endpoint">
      <div class="api-header">
        <span class="method">GET</span><span class="url">/bratvid?text=</span>
        <button class="copy-btn" onclick="copyText('${BASE_URL}/bratvid?text=', 'bratvid')"><i class="fas fa-copy"></i> bratvid</button>
      </div>
      <div class="api-desc">Buat gambar brat video (via API eksternal). Parameter ?text=</div>
      <div class="input-group">
        <input type="text" id="bratvidText" placeholder="Masukkan teks">
        <button class="start-btn" onclick="testBratvid()"><i class="fas fa-play"></i> Start</button>
      </div>
      <div id="bratvidResponse" class="response-container"></div>
    </div>
  </div>

  <div class="footer">
    <p>© 2026 Novabot • <i class="fab fa-telegram"></i> ${DEVELOPER} • v${VERSION}</p>
  </div>
</div>

<script>
// ==================== STATUS PANEL TOGGLE ====================
const menuBtn = document.getElementById('menuBtn');
const statusPanel = document.getElementById('statusPanel');
const pageContainer = document.getElementById('pageContainer');

menuBtn.addEventListener('click', () => {
  menuBtn.classList.toggle('active');
  statusPanel.classList.toggle('show');
  pageContainer.classList.toggle('blur');
});

// ==================== LOAD STATUS INFO ====================
const statusContent = document.getElementById('statusContent');
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
loadStatus();
setInterval(loadStatus, 30000);

// ==================== SIMULASI NILAI CPU, MEMORY, NETWORK ====================
setInterval(() => {
  const cpu = (Math.random() * 30).toFixed(1) + '%';
  const mem = Math.floor(Math.random() * 400) + ' MiB';
  const net = Math.floor(Math.random() * 500) + ' B/s';
  document.getElementById('cpuValue').innerText = cpu;
  document.getElementById('memValue').innerText = mem;
  document.getElementById('netValue').innerText = net;
}, 2000);

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

// ==================== PINTEREST ====================
async function testPinterest() {
  const query = document.getElementById('pinterestQuery').value.trim();
  if (!query) return alert('Masukkan kata kunci!');
  const respDiv = document.getElementById('pinterestResponse');
  respDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  respDiv.className = 'response-container show';
  try {
    const apiUrl = '${BASE_URL}' + '/pinterest?q=' + encodeURIComponent(query);
    const res = await fetch(apiUrl);
    const data = await res.json();
    const status = res.status;
    const jsonStr = JSON.stringify(data, null, 2);
    if (data.status) {
      let html = \`
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <div class="badge success">200 OK</div>
          <button class="copy-json-btn" onclick="copyText('\${encodeURIComponent(jsonStr)}', 'json')"><i class="fas fa-copy"></i> Copy JSON</button>
        </div>
        <p>Ditemukan \${data.result.length} hasil.</p>
      \`;
      if (data.result.length > 0) {
        html += '<div style="display: flex; flex-wrap: wrap; gap: 5px;">';
        data.result.forEach(item => {
          if (item.image) {
            html += \`<img src="\${item.image}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 5px;">\`;
          }
        });
        html += '</div>';
      }
      html += \`<pre>\${jsonStr}</pre>\`;
      respDiv.innerHTML = html;
      respDiv.classList.add('success');
    } else {
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

// ==================== WAIFU ====================
async function testWaifu() {
  const respDiv = document.getElementById('waifuResponse');
  respDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  respDiv.className = 'response-container show';
  try {
    const res = await fetch('${BASE_URL}' + '/waifu');
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

// ==================== NSFW ====================
async function testNsfw() {
  const respDiv = document.getElementById('nsfwResponse');
  respDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  respDiv.className = 'response-container show';
  try {
    const res = await fetch('${BASE_URL}' + '/nsfw');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    respDiv.innerHTML = \`
      <div class="badge success">200 OK</div>
      <img src="\${url}" alt="NSFW Image">
    \`;
    respDiv.classList.add('success');
  } catch (err) {
    respDiv.innerHTML = \`<div class="badge error">Network Error</div><pre>\${err.message}</pre>\`;
    respDiv.classList.add('error');
  }
}

// ==================== WEBZIP ====================
async function testWebzip() {
  const urlInput = document.getElementById('webzipUrl').value.trim();
  if (!urlInput) return alert('Masukkan URL!');
  const respDiv = document.getElementById('webzipResponse');
  respDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  respDiv.className = 'response-container show';
  try {
    const apiUrl = '${BASE_URL}' + '/webzip?url=' + encodeURIComponent(urlInput);
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

// ==================== TIKTOK ====================
async function testTiktok() {
  const urlInput = document.getElementById('tiktokUrl').value.trim();
  if (!urlInput) return alert('Masukkan URL TikTok!');
  const respDiv = document.getElementById('tiktokResponse');
  respDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  respDiv.className = 'response-container show';
  try {
    const apiUrl = '${BASE_URL}' + '/tiktok?url=' + encodeURIComponent(urlInput);
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

// ==================== BRAT ====================
async function testBrat() {
  const textInput = document.getElementById('bratText').value.trim();
  if (!textInput) return alert('Masukkan teks!');
  const respDiv = document.getElementById('bratResponse');
  respDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  respDiv.className = 'response-container show';
  try {
    const apiUrl = '${BASE_URL}' + '/brat?text=' + encodeURIComponent(textInput);
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(\`HTTP \${res.status}: \${errText}\`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    respDiv.innerHTML = \`
      <div class="badge success">200 OK</div>
      <img src="\${url}" alt="Brat Image">
    \`;
    respDiv.classList.add('success');
  } catch (err) {
    console.error('Brat fetch error:', err);
    respDiv.innerHTML = \`<div class="badge error">Error</div><pre>\${err.message}</pre>\`;
    respDiv.classList.add('error');
  }
}

// ==================== BRATVID ====================
async function testBratvid() {
  const textInput = document.getElementById('bratvidText').value.trim();
  if (!textInput) return alert('Masukkan teks!');
  const respDiv = document.getElementById('bratvidResponse');
  respDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  respDiv.className = 'response-container show';
  try {
    const apiUrl = '${BASE_URL}' + '/bratvid?text=' + encodeURIComponent(textInput);
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(\`HTTP \${res.status}: \${errText}\`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    respDiv.innerHTML = \`
      <div class="badge success">200 OK</div>
      <img src="\${url}" alt="Bratvid Image">
    \`;
    respDiv.classList.add('success');
  } catch (err) {
    console.error('Bratvid fetch error:', err);
    respDiv.innerHTML = \`<div class="badge error">Error</div><pre>\${err.message}</pre>\`;
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

// ==================== ERROR HANDLER GLOBAL ====================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  sendErrorToTelegram(err, req);
  res.status(500).json({ status: false, error: 'Terjadi kesalahan internal server.' });
});

// ==================== START SERVER ====================

app.listen(PORT, HOST, () => {
  console.log(`
\x1b[1m\x1b[34m╔╗ ╦  ╔═\x1b[0m╗╔═╗╔═╗╦═╗╔═╗ \x1b[31m
\x1b[1m\x1b[34m╠╩╗║  ╠═╣╔═╝\x1b[0m║╣ ╠╦╝╚═╗ \x1b[31m
\x1b[1m\x1b[34m╚═╝╩═╝╩ ╩╚═╝╚═╝╩\x1b[0m╚═╚═╝ \x1b[31m
\x1b[1m\x1b[33mN O V A B O T   A P I   v${VERSION}\x1b[0m
\x1b[1m\x1b[32m═══════════════════════════════════════\x1b[0m
🌐 Server: http://${HOST}:${PORT}
👤 Developer: ${DEVELOPER}
📦 Version: ${VERSION}
✅ API ready!
  `);
});