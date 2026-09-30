/* ==========================================================================
   server/database.js
   The single source of truth for website content.

   The DEFAULTS are NOT duplicated here. They are read straight out of the
   existing browser file js/store.js, so the shipped copy and the server copy
   can never drift apart.

   Rules:
   - The parent directory of DATABASE_PATH is created automatically.
   - The table is created if missing.
   - DEFAULTS are inserted ONLY when the table has no content row. Every
     later boot keeps whatever the admin saved.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Database = require('better-sqlite3');

/* Project root is one level above server/. */
const ROOT = path.resolve(__dirname, '..');

/* Rows in `content` are addressed by this single id. */
const CONTENT_ID = 1;

/**
 * Load the existing DEFAULTS object out of js/store.js without a browser.
 * store.js is a browser IIFE that assigns itself to `window`, so it is run in
 * a throwaway vm context with a fake `window`. The result is cloned through
 * JSON so nothing from the sandbox realm leaks into this one.
 */
function readDefaultsFromStore() {
  const storeFile = path.join(ROOT, 'js', 'store.js');
  const source = fs.readFileSync(storeFile, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'js/store.js' });

  const store = sandbox.window.LumiereStore;
  if (!store || !store.DEFAULTS) {
    throw new Error('Could not read DEFAULTS from js/store.js');
  }
  return JSON.parse(JSON.stringify(store.DEFAULTS));
}

/* ---------- connection ---------- */

const DB_PATH = path.resolve(
  ROOT,
  process.env.DATABASE_PATH || './data/database.sqlite'
);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

/* WAL keeps readers (visitors) from blocking on the writer (an admin save). */
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS content (
    id INTEGER PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const DEFAULTS = readDefaultsFromStore();

/* ---------- prepare ---------- */

const selectContent = db.prepare('SELECT data, updated_at FROM content WHERE id = ?');
const insertContent = db.prepare(
  'INSERT INTO content (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
);
const updateContent = db.prepare(
  'UPDATE content SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
);

/**
 * Seed the database with the existing DEFAULTS, but only if it is empty.
 * Never overwrites: once the admin has saved, SQLite is the truth.
 */
const seed = db.transaction((defaults) => {
  const row = selectContent.get(CONTENT_ID);
  if (row) return false; // already has content -> keep it

  insertContent.run(CONTENT_ID, JSON.stringify(defaults));
  return true;
});

const wasSeeded = seed(DEFAULTS);

/* ---------- public API ---------- */

/**
 * Current content, merged over DEFAULTS so a row saved by an older version
 * of the page still paints correctly.
 */
function getContent() {
  const row = selectContent.get(CONTENT_ID);
  if (!row) return { data: DEFAULTS, updatedAt: null };

  let stored = {};
  try {
    stored = JSON.parse(row.data) || {};
  } catch (err) {
    // Corrupt row: fall back to defaults rather than serving a broken page.
    stored = {};
  }

  return { data: merge(clone(DEFAULTS), stored), updatedAt: row.updated_at };
}

/** Persist the whole content object. Returns { data, updatedAt }. */
function saveContent(content) {
  const payload = merge(clone(DEFAULTS), content);
  const data = JSON.stringify(payload);

  const row = selectContent.get(CONTENT_ID);
  if (row) {
    updateContent.run(data, CONTENT_ID);
  } else {
    insertContent.run(CONTENT_ID, data);
  }

  return { data: payload, updatedAt: new Date().toISOString() };
}

/** Put the original DEFAULTS back (the admin panel's "Reset everything"). */
function resetContent() {
  return saveContent(clone(DEFAULTS));
}

/* ---------- helpers ---------- */

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/* Per-section merge, mirroring the browser store so both sides agree. */
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

/** Simple liveness probe used by GET /api/health. */
function isConnected() {
  return db.open && db.prepare('SELECT 1').get() !== undefined;
}

module.exports = {
  getContent,
  saveContent,
  resetContent,
  isConnected,
  DEFAULTS,
  DB_PATH,
  wasSeeded
};
