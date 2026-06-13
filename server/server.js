require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const { scrapeProduct, scrapePrice } = require('./scraper');

const app = express();
app.disable('x-powered-by');

const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com', 'https://*.amazon.com', 'https://*.amazon.es'],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'https://*.amazon.com', 'https://*.amazon.es', 'https://*.media-amazon.com', 'https://fonts.gstatic.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://fonts.googleapis.com'],
  connectSrc: ["'self'", 'https://api-inference.huggingface.co', 'https://*.netlify.app', 'https://*.vercel.app', 'https://*.onrender.com', 'https://*.railway.app'],
  frameSrc: ["'self'", 'https://*.amazon.com', 'https://*.amazon.es'],
  objectSrc: ["'none'"],
  upgradeInsecureRequests: []
};
app.use(helmet({ contentSecurityPolicy: { directives: CSP_DIRECTIVES }, crossOriginEmbedderPolicy: false }));

const PORT = process.env.PORT || 3000;
const TAG = process.env.AMAZON_ASSOCIATE_TAG || '2mideu-21';
const DOMAIN = process.env.AMAZON_DOMAIN || 'amazon.es';

// ── PAAPI (Creators API) setup ──
let paapi5 = null;
let paapiReady = false;
const credId = process.env.CREATORS_CREDENTIAL_ID || '';
const credSecret = process.env.CREATORS_CREDENTIAL_SECRET || '';

if (credId && credSecret) {
  try {
    paapi5 = require('paapi5-nodejs-sdk');
    const client = paapi5.ApiClient.instance;
    const region = process.env.AMAZON_REGION || 'eu-west-1';
    const marketplace = (process.env.AMAZON_MARKETPLACE || 'www.amazon.es').replace('www.', '');
    client.host = `webservices.amazon.${marketplace}`;
    client.region = region;
    client.authentications['basic'].username = credId;
    client.authentications['basic'].password = credSecret;
    paapiReady = true;
    console.log('[PAAPI] Creators API configurada');
  } catch (e) {
    console.warn('[PAAPI] Error cargando SDK:', e.message);
  }
}

// ── Fallback products ──
let fallbackProducts = [];
try {
  const raw = fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8');
  fallbackProducts = JSON.parse(raw);
} catch (e) {
  console.warn('[Products] No se pudo cargar products.json:', e.message);
}

function buildAffiliateUrl(asin) {
  return 'https://www.' + DOMAIN + '/dp/' + asin + '?tag=' + TAG;
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Admin auth ──
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_USER || !ADMIN_PASSWORD) {
  console.error('[Auth] ERROR: Debes definir ADMIN_USER y ADMIN_PASSWORD en .env');
  process.exit(1);
}
const adminSessions = new Map();

const BCRYPT_PREFIX = /^\$2[aby]\$\d{2}\$/;
let adminPasswordHash = null;

function cleanupSessions() {
  const now = Date.now();
  const limit = 24 * 60 * 60 * 1000;
  for (const [token, session] of adminSessions) {
    if (now - session.lastActivity > limit) {
      adminSessions.delete(token);
    }
  }
}

setInterval(cleanupSessions, 15 * 60 * 1000);
cleanupSessions();

app.use(express.json());

app.use(function(req, res, next) {
  var origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/css', express.static(path.join(__dirname, '..', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'js')));
app.use('/placeholder.svg', express.static(path.join(__dirname, '..', 'placeholder.svg')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

const loginAttempts = new Map();

function rateLimit(key, maxAttempts, windowMs) {
  const now = Date.now();
  const attempts = loginAttempts.get(key) || [];
  const recent = attempts.filter(t => now - t < windowMs);
  if (recent.length >= maxAttempts) return false;
  recent.push(now);
  loginAttempts.set(key, recent);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, attempts] of loginAttempts) {
    const recent = attempts.filter(t => now - t < 60000);
    if (recent.length === 0) loginAttempts.delete(key);
    else loginAttempts.set(key, recent);
  }
}, 60000);

app.post('/api/admin/login', async function(req, res) {
  const ip = req.ip || req.connection.remoteAddress;
  if (!rateLimit('login:' + ip, 5, 60000)) {
    return res.status(429).json({ ok: false, error: 'Demasiados intentos. Espera 1 minuto.' });
  }
  const { username, password } = req.body;
  if (username === ADMIN_USER && adminPasswordHash) {
    const match = await bcrypt.compare(password, adminPasswordHash);
    if (match) {
      const token = crypto.randomUUID();
      adminSessions.set(token, { createdAt: Date.now(), lastActivity: Date.now(), username });
      loginAttempts.delete('login:' + ip);
      return res.json({ ok: true, token });
    }
  }
  return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
});

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ ok: false, error: 'No autorizado' });
  const session = adminSessions.get(token);
  if (!session) return res.status(401).json({ ok: false, error: 'No autorizado' });
  if (Date.now() - session.lastActivity > 24 * 60 * 60 * 1000) {
    adminSessions.delete(token);
    return res.status(401).json({ ok: false, error: 'Sesión expirada' });
  }
  session.lastActivity = Date.now();
  next();
}

app.post('/api/scrape', requireAdmin, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL requerida' });
    if (!url.includes('amazon') && !url.includes('amzn')) {
      return res.status(400).json({ error: 'Debe ser una URL de Amazon' });
    }
    const data = await scrapeProduct(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/config', (req, res) => {
  res.json({ tag: TAG, domain: DOMAIN });
});

let seedData = [];
try {
  seedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf8'));
} catch (e) {
  console.warn('[Seed] No se pudo cargar seed-data.json');
}

app.get('/api/seed', (req, res) => {
  res.json(seedData);
});

app.post('/api/update-prices', requireAdmin, async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'products array required' });
    }
    const results = [];
    for (const p of products) {
      try {
        const price = await scrapePrice(p.asin);
        results.push({ id: p.id, price: price || '' });
      } catch (e) {
        results.push({ id: p.id, error: e.message });
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Chat Agent (Hugging Face Inference API) ──
const HF_MODEL = process.env.HF_MODEL || 'HuggingFaceH4/zephyr-7b-beta';
const HF_API = 'https://api-inference.huggingface.co/models/' + HF_MODEL;
const HF_TOKEN = process.env.HF_TOKEN || '';

const chatRateLimit = new Map();

app.post('/api/chat', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const userChat = chatRateLimit.get(ip) || [];
    const recentChat = userChat.filter(t => now - t < 30000);
    if (recentChat.length >= 10) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Espera unos segundos.' });
    }
    recentChat.push(now);
    chatRateLimit.set(ip, recentChat);

    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    // Extraer keywords relevantes eliminando palabras vacías
    const stopWords = ['busca','buscar','encuentra','encuentrame','quiero','necesito','recomiendame','recomendar','mejor','mejores','comprar','un','una','unos','unas','el','la','los','las','por','para','con','sin','que','de','del','en','y','o','a','e','i','u','lo','le','se','no','es','porfavor','por favor','gracias','hola','barato','barata','baratos','baratas','caro','cara','precio','euros','€','euro'];
    const clean = message.toLowerCase()
      .replace(/[^\w\sáéíóúñ]/gi, ' ')
      .replace(/\d+€?/g, '')
      .trim();
    const words = clean.split(/\s+/).filter(function(w) {
      return w.length > 1 && stopWords.indexOf(w) === -1;
    });
    const keywords = encodeURIComponent(words.join(' '));

    // Intentar Hugging Face si es accesible
    try {
      const systemPrompt = `Eres un asistente de compras en Amazon.es. Responde MUY BREVE, máximo 1 línea corta. Incluye SIEMPRE un enlace HTML como <a href="https://www.amazon.es/s?k=PALABRAS&tag=2mideu-21">Ver en Amazon</a>. Ejemplo: <a href="https://www.amazon.es/s?k=portatil+gaming&tag=2mideu-21">Ver en Amazon</a>`;

      const headers = { 'Content-Type': 'application/json' };
      if (HF_TOKEN) headers['Authorization'] = 'Bearer ' + HF_TOKEN;

      const hfResponse = await fetch(HF_API, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          inputs: `<|system|>\n${systemPrompt}\n<|user|>\n${message}\n<|assistant|>\n`,
          parameters: { max_new_tokens: 200, temperature: 0.5, return_full_text: false }
        }),
        signal: AbortSignal.timeout(20000)
      });

      if (hfResponse.ok) {
        const data = await hfResponse.json();
        let reply = '';
        if (Array.isArray(data) && data[0] && data[0].generated_text) {
          reply = data[0].generated_text.trim();
        } else if (data.generated_text) {
          reply = data.generated_text.trim();
        }
        if (reply) {
          if (!reply.includes('tag=2mideu-21')) {
            reply = reply.replace(/amazon\.es\/s\?k=/g, 'amazon.es/s?k=');
            reply = reply.replace(/amazon\.es\/dp\//g, 'amazon.es/dp/');
            if (!reply.includes('tag=')) reply += (reply.includes('?') ? '&' : '?') + 'tag=2mideu-21';
          }
          return res.json({ reply: reply.replace(/\n/g, '<br>'), source: 'hf' });
        }
      }
    } catch (_) {
      // Hugging Face no disponible, usar fallback
    }

    // Fallback por extracción de keywords
    let responseText = '';

    if (words.length === 0) {
      responseText = '\u00A1Hola! Puedes pedirme que busque productos en Amazon. Por ejemplo: <em>"busca un port\u00E1til gaming"</em> o <em>"recomi\u00E9ndame auriculares bluetooth"</em>.';
    } else {
      const searchUrl = 'https://www.amazon.es/s?k=' + keywords + '&tag=2mideu-21';
      responseText = '\u00A1Claro! He preparado un enlace de b\u00FAsqueda en Amazon con los productos que buscas:<br><br>' +
        '<a href="' + searchUrl + '" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 20px;background:#FF6B35;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Ver en Amazon.es &rarr;</a><br><br>' +
        'Tambi\u00E9n puedes refinar la b\u00FAsqueda con m\u00E1s detalles: precio, marca, etc.';
    }

    res.json({ reply: responseText, source: 'keyword' });
  } catch (err) {
    console.warn('[Chat] Error:', err.message);
    res.json({ reply: 'Lo siento, ocurri\u00F3 un error. Intenta de nuevo.', source: 'error' });
  }
});

app.get('/api/deals', async (req, res) => {
  const count = Math.min(parseInt(req.query.count, 10) || 10, 20);

  if (paapiReady) {
    try {
      const api = new paapi5.DefaultApi();
      const searchReq = new paapi5.SearchItemsRequest();

      searchReq['PartnerTag'] = TAG;
      searchReq['PartnerType'] = 'Associates';
      searchReq['ItemCount'] = Math.min(count, 10);
      searchReq['Keywords'] = 'electrónica oferta';
      searchReq['SearchIndex'] = 'Electronics';
      searchReq['Resources'] = [
        'Images.Primary.Medium',
        'ItemInfo.Title',
        'Offers.Listings.Price'
      ];

      const data = await new Promise((resolve, reject) => {
        api.searchItems(searchReq, (err, d) => err ? reject(err) : resolve(d));
      });

      const items = data?.ItemsResult?.Items || [];
      const products = items.map(item => ({
        asin: item.ASIN,
        title: item.ItemInfo?.Title?.DisplayValue || '',
        price: item.Offers?.Listings?.[0]?.Price?.DisplayAmount || '',
        image: item.Images?.Primary?.Medium?.URL || '',
        url: buildAffiliateUrl(item.ASIN),
        rating: null
      })).filter(p => p.title && p.image);

      if (products.length > 0) {
        return res.json({ source: 'paapi', products: products.slice(0, count) });
      }
    } catch (err) {
      console.warn('[PAAPI] Error:', err.message);
    }
  }

  const shuffled = shuffleArray(fallbackProducts);
  const selected = shuffled.slice(0, count);
  const products = selected.map(p => ({
    asin: p.asin,
    title: p.title,
    price: p.price,
    image: p.image,
    url: buildAffiliateUrl(p.asin),
    rating: p.rating || null
  }));

  res.json({ source: 'fallback', products });
});

(async function start() {
  if (BCRYPT_PREFIX.test(ADMIN_PASSWORD)) {
    adminPasswordHash = ADMIN_PASSWORD;
  } else {
    try {
      adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    } catch (e) {
      console.error('[Auth] Error al hashear contraseña:', e.message);
      process.exit(1);
    }
  }

  app.listen(PORT, () => {
    console.log('Tienda Afiliados Pro corriendo en:');
    console.log('  http://localhost:' + PORT);
    if (!paapiReady) {
      console.log('  [Sin credenciales PAAPI] Usando productos de respaldo');
      console.log('  Configura CREATORS_CREDENTIAL_ID y CREATORS_CREDENTIAL_SECRET en .env');
    }
  });
})();
