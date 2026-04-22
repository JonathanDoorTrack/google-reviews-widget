require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_FILE = path.join(__dirname, 'cache', 'reviews.json');
const CACHE_DIR = path.join(__dirname, 'cache');

// ── Cache helpers ─────────────────────────────────────────────────────────────

function readCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(data) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Review fetcher ────────────────────────────────────────────────────────────

async function fetchReviews() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    throw new Error('GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID must be set');
  }

  const url = `https://places.googleapis.com/v1/places/${placeId}`;

  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'reviews,displayName,rating,userRatingCount',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Places API error ${response.status}: ${text}`);
  }

  const data = await response.json();

  // Normalise into a consistent shape for the widget
  const reviews = (data.reviews || []).map((r) => ({
    authorName: r.authorAttribution?.displayName || 'Anonymous',
    authorPhoto: r.authorAttribution?.photoUri || null,
    authorUrl: r.authorAttribution?.uri || null,
    rating: r.rating || 0,
    text: r.text?.text || '',
    publishTime: r.publishTime || null,
    relativeTime: r.relativePublishTimeDescription || '',
  }));

  return {
    businessName: data.displayName?.text || '',
    overallRating: data.rating || null,
    totalReviews: data.userRatingCount || null,
    reviews,
  };
}

// ── Cron job: daily refresh ───────────────────────────────────────────────────

async function refreshCache() {
  const now = new Date().toISOString();
  console.log(`[cron] ${now} — Starting review refresh...`);

  try {
    const data = await fetchReviews();
    const payload = {
      updatedAt: now,
      count: data.reviews.length,
      ...data,
    };
    writeCache(payload);
    console.log(`[cron] ${now} — Cached ${data.reviews.length} review(s) successfully`);
  } catch (err) {
    console.error(`[cron] ${now} — Failed to refresh reviews:`, err.message);
  }
}

// Run once at startup, then daily at 03:00
refreshCache();
cron.schedule('0 3 * * *', refreshCache);

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors());

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/reviews', (req, res) => {
  const cache = readCache();
  if (!cache) {
    return res.status(503).json({
      error: 'Reviews not yet available. Cache is warming up — try again shortly.',
    });
  }

  const age = Date.now() - new Date(cache.updatedAt).getTime();
  if (age > 24 * 60 * 60 * 1000) {
    refreshCache().catch(() => {});
  }

  res.json(cache);
});

app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'widget.js'));
});

app.get('/health', (req, res) => {
  const cache = readCache();
  res.json({
    status: 'ok',
    cacheAvailable: !!cache,
    cachedReviews: cache?.count ?? 0,
    lastUpdated: cache?.updatedAt ?? null,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[server] Google Reviews widget server running on port ${PORT}`);
});
