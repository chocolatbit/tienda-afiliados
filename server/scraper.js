require('dotenv').config();
const cheerio = require('cheerio');

function extractASIN(url) {
  const patterns = [
    /(?:dp|product|gp\/product)\/([A-Z0-9]{10})/i,
    /amzn\.eu\/d\/([a-zA-Z0-9]{5,20})/i,
    /[?&]asin=([A-Z0-9]{10})/i,
    /\/([A-Z][A-Z0-9]{9})(?:[\/?#&]|$)/i
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

function cleanPrice(raw) {
  if (!raw) return '';
  const cleaned = String(raw).replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return '';
  return '\u20AC' + num.toFixed(2).replace('.', ',');
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function extractPrice($) {
  let price = '';
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const offers = data.offers || (data.mainEntity && data.mainEntity.offers);
      if (offers) {
        const raw = offers.price || offers.lowPrice || offers.highPrice || '';
        if (raw) price = parseFloat(String(raw).replace(',', '.')).toFixed(2);
      }
    } catch {}
  });
  if (!price) {
    const whole = $('.a-price-whole').first().text().trim();
    const fraction = $('.a-price-fraction').first().text().trim();
    if (whole) price = whole + (fraction ? ',' + fraction : ',00');
  }
  return cleanPrice(price);
}

function extractOriginalPrice($) {
  const txt = $('.a-price.a-text-price .a-offscreen, .a-text-price .a-offscreen').first().text().trim();
  if (txt) return cleanPrice(txt.replace(/EUR|€|\u20AC/g, '').trim());
  try {
    let result = '';
    $('script[type="application/ld+json"]').each((_, el) => {
      if (result) return false;
      const data = JSON.parse($(el).html());
      const offers = data.offers || (data.mainEntity && data.mainEntity.offers);
      if (offers) {
        const p = offers.highPrice || offers.price || '';
        if (p) {
          const num = parseFloat(String(p).replace(',', '.'));
          if (num) {
            result = cleanPrice(num.toFixed(2));
            return false;
          }
        }
      }
    });
    if (result) return result;
  } catch {}
  return '';
}

function extractDiscountPercent($) {
  const savings = $('.a-price-savings').first().text().trim();
  if (savings) {
    const m = savings.match(/-(\d+)/);
    if (m) return '-' + m[1] + '%';
  }
  const curr = $('.a-price .a-offscreen').first().text().trim();
  const orig = $('.a-text-price .a-offscreen').first().text().trim();
  if (curr && orig) {
    const cn = parseFloat(curr.replace(/[^0-9.,]/g, '').replace(',', '.'));
    const on = parseFloat(orig.replace(/[^0-9.,]/g, '').replace(',', '.'));
    if (cn && on && on > cn) return '-' + Math.round(((on - cn) / on) * 100) + '%';
  }
  return '';
}

function extractDealBadge($) {
  return $('#dealBadge').first().text().trim() || $('.truncationMsg').first().text().trim() || '';
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(function() { controller.abort(); }, 15000);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' },
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('Amazon no permiti\u00f3 el acceso (HTTP ' + res.status + ')');
    return { html: await res.text(), finalUrl: res.url };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('La solicitud a Amazon tard\u00f3 demasiado. Verifica la URL o int\u00e9ntalo m\u00e1s tarde.');
    throw err;
  }
}

async function scrapePrice(asin) {
  const domain = process.env.AMAZON_DOMAIN || 'amazon.es';
  const { html } = await fetchPage('https://www.' + domain + '/dp/' + asin);
  const $ = cheerio.load(html);
  const price = extractPrice($);
  const originalPrice = extractOriginalPrice($) || price;
  return { price, originalPrice };
}

async function scrapeProduct(url) {
  let asin = extractASIN(url);

  const { html, finalUrl } = await fetchPage(url);

  if (!asin) {
    asin = extractASIN(finalUrl || url);
    if (!asin) throw new Error('No se pudo extraer el ASIN del producto de la URL');
  }

  const $ = cheerio.load(html);

  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');
  const pageTitle = $('title').first().text().trim();
  const name = ogTitle || pageTitle || '';

  let image = ogImage || '';
  if (image && image.includes('._')) {
    image = image.replace(/\._.*?\._/, '.');
  }

  const price = extractPrice($);
  const originalPrice = extractOriginalPrice($);
  const discountPercent = extractDiscountPercent($);
  const dealBadge = extractDealBadge($);

  const domain = process.env.AMAZON_DOMAIN || 'amazon.es';
  const tag = process.env.AMAZON_ASSOCIATE_TAG || '2mideu-21';
  const affiliateLink = 'https://www.' + domain + '/dp/' + asin + '?tag=' + tag;

  return { name, image, price, originalPrice, discountPercent, dealBadge, asin, affiliateLink };
}

module.exports = { scrapeProduct, scrapePrice, extractASIN };
