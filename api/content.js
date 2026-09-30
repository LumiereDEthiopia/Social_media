/* ==========================================================================
   api/content.js  —  Vercel serverless function

   The shared content store for the Lumière Perfume site.

     GET  /api/content   the latest saved content
     PUT  /api/content   replace the content

   The database is hosted PostgreSQL, reached over the network through the
   connection string in the environment. There is no local file and no
   long-running server: this is a plain serverless function.

   The DEFAULTS are NOT duplicated here. They are read out of the existing
   browser file js/store.js, so the shipped copy and the database can never
   drift apart.

   Seeding happens exactly once: the table is filled from the DEFAULTS only
   while it is empty, so saved content is never overwritten on a later
   request or a redeploy.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Pool } = require('pg');

/* The one row that holds the whole website content. */
const CONTENT_ID = 1;

/* Reject an absurd upload (the admin can post a logo as a data URL). */
const MAX_BODY_BYTES = 5 * 1024 * 1024;

/* ---------- the existing DEFAULTS, read from js/store.js ---------- */

/**
 * store.js is a browser IIFE that assigns itself to `window`, so it is run in
 * a throwaway vm context with a fake `window`. The result is cloned through
 * JSON so nothing from the sandbox realm leaks into this one.
 */
function readDefaultsFromStore() {
  const candidates = [
    path.join(process.cwd(), 'js', 'store.js'),
    path.join(__dirname, '..', 'js', 'store.js')
  ];

  let source = null;
  for (const file of candidates) {
    try {
      source = fs.readFileSync(file, 'utf8');
      break;
    } catch (err) {
      /* try the next location */
    }
  }
  if (source === null) {
    throw new Error('Could not read js/store.js (is it bundled with this function?)');
  }

  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'js/store.js' });

  const store = sandbox.window.LumiereStore;
  if (!store || !store.DEFAULTS) {
    throw new Error('Could not read DEFAULTS from js/store.js');
  }
  return JSON.parse(JSON.stringify(store.DEFAULTS));
}

/* ---------- database ---------- */

const CONNECTION_STRING =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

let pool = null;

function getPool() {
  if (!CONNECTION_STRING) {
    const err = new Error(
      'No database configured. Set POSTGRES_URL (or DATABASE_URL) in the Vercel environment variables.'
    );
    err.missingConfig = true;
    throw err;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: CONNECTION_STRING,
      /* Hosted providers terminate TLS with their own certificate. */
      ssl: { rejectUnauthorized: false },
      /* Serverless: keep at most one connection per warm instance so the
         database is never overwhelmed by parallel invocations. */
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000
    });
  }
  return pool;
}

const DEFAULTS = readDefaultsFromStore();

/* Create the table if it is missing, then seed it ONLY while it is empty.
   ON CONFLICT DO NOTHING makes the insert a no-op the moment a row exists,
   so no request can ever overwrite saved content with the DEFAULTS. */
let readyPromise = null;

function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      const db = getPool();
      await db.query(`
        CREATE TABLE IF NOT EXISTS content (
          id         INTEGER PRIMARY KEY,
          data       TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await db.query(
        'INSERT INTO content (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [CONTENT_ID, JSON.stringify(DEFAULTS)]
      );
    })().catch((err) => {
      /* Let the next request retry rather than caching a failure forever. */
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}


/* ---------- helpers ---------- */

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/* Per-section merge, mirroring js/store.js so both sides agree. */
function merge(base, saved) {
  if (!saved || typeof saved !== 'object') return base;

  ['brand', 'about'].forEach((key) => {
    if (saved[key] && typeof saved[key] === 'object') {
      Object.keys(saved[key]).forEach((k) => {
        base[key][k] = saved[key][k];
      });
    }
  });

  if (Array.isArray(saved.features)) base.features = saved.features;
  if (Array.isArray(saved.socials)) base.socials = saved.socials;
  if (Array.isArray(saved.contactQuick)) base.contactQuick = saved.contactQuick;
  if (typeof saved.logo === 'string') base.logo = saved.logo;
  if (typeof saved.logoDark === 'string') base.logoDark = saved.logoDark;

  return base;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/* ---------- the endpoints ---------- */

/* The admin panel's existing "Reset everything" button. Restores the
   shipped DEFAULTS, which is why the real TikTok and Instagram links come
   back after a reset. */
async function resetContent(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  await ensureReady();

  const data = JSON.stringify(DEFAULTS);
  const { rows } = await getPool().query(
    `UPDATE content SET data = $1, updated_at = NOW()
       WHERE id = $2
     RETURNING updated_at`,
    [data, CONTENT_ID]
  );

  if (!rows.length) {
    await getPool().query(
      'INSERT INTO content (id, data, updated_at) VALUES ($1, $2, NOW())',
      [CONTENT_ID, data]
    );
  }

  return res.status(200).json({
    success: true,
    message: 'Content reset to defaults',
    data: DEFAULTS,
    updatedAt: rows.length ? rows[0].updated_at : new Date().toISOString()
  });
}

async function getContent(req, res) {
  /* Always hand back the newest content; never let a cache hold it. */
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  await ensureReady();
  const { rows } = await getPool().query(
    'SELECT data, updated_at FROM content WHERE id = $1',
    [CONTENT_ID]
  );

  if (!rows.length) {
    return res
      .status(200)
      .json({ success: true, data: DEFAULTS, updatedAt: null });
  }

  let stored = {};
  try {
    stored = JSON.parse(rows[0].data) || {};
  } catch (err) {
    /* Corrupt row: fall back rather than serving a broken page. */
    stored = {};
  }

  return res.status(200).json({
    success: true,
    data: merge(clone(DEFAULTS), stored),
    updatedAt: rows[0].updated_at
  });
}

async function putContent(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  let body = req.body;
  /* Vercel parses application/json for us, but be forgiving if a client
     sends the raw text. */
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (err) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid JSON body' });
    }
  }

  if (!isPlainObject(body)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid content: expected a JSON object'
    });
  }

  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) {
    return res.status(413).json({
      success: false,
      message: 'Content is too large to save — please use a smaller logo'
    });
  }

  await ensureReady();

  const payload = merge(clone(DEFAULTS), body);
  const data = JSON.stringify(payload);

  const { rows } = await getPool().query(
    `UPDATE content SET data = $1, updated_at = NOW()
       WHERE id = $2
     RETURNING updated_at`,
    [data, CONTENT_ID]
  );

  /* The row can only be missing if the table was dropped out from under us. */
  if (!rows.length) {
    await getPool().query(
      'INSERT INTO content (id, data, updated_at) VALUES ($1, $2, NOW())',
      [CONTENT_ID, data]
    );
  }

  return res.status(200).json({
    success: true,
    message: 'Content saved successfully',
    data: payload,
    updatedAt: rows.length ? rows[0].updated_at : new Date().toISOString()
  });
}

/* ---------- Vercel entry point ---------- */

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') return await getContent(req, res);
    if (req.method === 'PUT') return await putContent(req, res);
    /* POST is only ever the admin's "Reset everything" button. vercel.json
       rewrites /api/content/reset onto this same function, and the rewrite
       hides the path, so the method is what distinguishes the two writes. */
    if (req.method === 'POST') return await resetContent(req, res);

    res.setHeader('Allow', 'GET, PUT, POST');
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    if (err && err.missingConfig) {
      console.error('[api] ' + err.message);
      return res.status(503).json({ success: false, message: err.message });
    }
    console.error('[api] request failed:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Could not reach the content database' });
  }
};
