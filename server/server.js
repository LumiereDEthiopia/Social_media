/* ==========================================================================
   server/server.js
   Serves the existing website exactly as it was, plus the content API that
   makes admin edits global.

   - Frontend files are unchanged HTML / CSS / JS.
   - Content lives in SQLite via server/database.js.
   - Admin access is unchanged: still the hidden tap gesture in admin.js.
   ========================================================================== */
'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');

const db = require('./database');
const contentRoutes = require('./routes/content');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;

const app = express();

/* Behind Railway / any proxy, so req.ip and secure flags are correct. */
app.set('trust proxy', true);

/* The admin form can carry an uploaded logo as a data URL. */
app.use(express.json({ limit: '10mb' }));

/* Never let a browser sit on an old copy of the page scripts. A stale
   store.js would still write to localStorage, which is exactly the bug where
   one browser behaves differently from everyone else. Revalidate every time. */
const STATIC_OPTS = { etag: true, lastModified: true, maxAge: 0 };

/* ---------- API ---------- */

app.use('/api/content', contentRoutes);

app.get('/api/health', async (req, res) => {
  const connected = await db.isConnected();
  res.status(connected ? 200 : 503).json({
    success: connected,
    status: connected ? 'ok' : 'error',
    database: connected ? 'connected' : 'disconnected'
  });
});

/* ---------- existing website ----------
   Each folder is mounted explicitly rather than serving ROOT, so the
   database, the server source and .env can never be downloaded. */

app.use('/css', express.static(path.join(ROOT, 'css'), STATIC_OPTS));
app.use('/js', express.static(path.join(ROOT, 'js'), STATIC_OPTS));
app.use('/icon', express.static(path.join(ROOT, 'icon'), STATIC_OPTS));
app.use('/profile', express.static(path.join(ROOT, 'profile'), STATIC_OPTS));

const INDEX = path.join(ROOT, 'index.html');

/* The page is a single file: / and /index.html both return it. */
app.get('/', (req, res) => res.sendFile(INDEX));
app.get('/index.html', (req, res) => res.sendFile(INDEX));

/* Unknown /api/* paths are a client error, not an HTML page. */
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

/* ---------- errors ---------- */

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    res.status(413).json({ success: false, message: 'Content is too large' });
    return;
  }
  /* Malformed JSON, or a body that is not JSON at all. */
  if (err && (err.type === 'entity.parse.failed' || err.status === 400)) {
    res.status(400).json({ success: false, message: 'Invalid JSON body' });
    return;
  }
  if (err && err.type === 'encoding.unsupported') {
    res.status(415).json({ success: false, message: 'Content-Type must be application/json' });
    return;
  }
  console.error('[server] error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

/* ---------- listen ---------- */

/* On Vercel the app is imported as a serverless function and Vercel owns the
   port, so binding one there would fail. Everywhere else (npm start, a normal
   host) the server listens itself. */
if (!process.env.VERCEL) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    db.wasSeeded().then((seeded) => {
      console.log('Lumiere Perfume');
      console.log('  site      http://localhost:' + PORT);
      console.log('  database  ' + db.DB_LABEL);
      console.log(
        '  content   ' + (seeded ? 'seeded from existing defaults' : 'loaded from database')
      );
    });
  });

  /* Close cleanly so nothing is left half-written. */
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = app;
