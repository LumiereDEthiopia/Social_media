/* ==========================================================================
   server/routes/content.js
   The content API.

   GET  /api/content        -> current content from SQLite
   PUT  /api/content        -> replace current content in SQLite
   POST /api/content/reset  -> restore the original DEFAULTS
   ========================================================================== */
'use strict';

const express = require('express');
const db = require('../database');

const router = express.Router();

/* Guards against a runaway payload (an oversized uploaded logo). */
const MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * True only for a plain JSON object. Arrays, null, strings and numbers are
 * rejected, because the admin form always submits an object.
 */
function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

/* ---------- GET /api/content ---------- */

router.get('/', async (req, res) => {
  try {
    const { data, updatedAt } = await db.getContent();
    res.json({ success: true, data, updatedAt });
  } catch (err) {
    console.error('[api] GET /api/content failed:', err);
    res.status(500).json({ success: false, message: 'Could not read content' });
  }
});

/* ---------- PUT /api/content ---------- */

router.put('/', async (req, res) => {
  if (!isPlainObject(req.body)) {
    res.status(400).json({
      success: false,
      message: 'Invalid content: expected a JSON object'
    });
    return;
  }

  const body = JSON.stringify(req.body);
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
    res.status(413).json({
      success: false,
      message: 'Content is too large to save — please use a smaller logo'
    });
    return;
  }

  try {
    const { data, updatedAt } = await db.saveContent(req.body);
    res.json({
      success: true,
      message: 'Content saved successfully',
      data,
      updatedAt
    });
  } catch (err) {
    console.error('[api] PUT /api/content failed:', err);
    res.status(500).json({ success: false, message: 'Could not save content' });
  }
});

/* ---------- POST /api/content/reset ---------- */

router.post('/reset', async (req, res) => {
  try {
    const { data, updatedAt } = await db.resetContent();
    res.json({
      success: true,
      message: 'Content reset to defaults',
      data,
      updatedAt
    });
  } catch (err) {
    console.error('[api] POST /api/content/reset failed:', err);
    res.status(500).json({ success: false, message: 'Could not reset content' });
  }
});

module.exports = router;
