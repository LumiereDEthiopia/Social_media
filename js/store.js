/* ==========================================================================
   Lumière Perfume — content store
   Holds every editable value (logo, introduction, social links) and paints
   it onto the page.

   Storage is the hosted PostgreSQL database behind the Vercel API:
   GET  /api/content   load
   PUT  /api/content   save

   The content is read asynchronously, so this file keeps a plain in-memory
   cache. `load()` is still synchronous — it returns the cached content
   (the DEFAULTS until the API answers) — so the existing callers in
   render.js, main.js and admin.js keep working untouched. `ready()` is the
   promise that resolves once the real content has arrived.

   Design rules:
   - The HTML in index.html is the real content, so the page still reads
     fine with JavaScript disabled. This file only OVERRIDES those nodes
     once the admin has saved something.
   - No build step, no dependencies.
   ========================================================================== */
(function (global) {
  'use strict';

  var API_URL = '/api/content';

  /* The old localStorage key. It is only read once, to migrate a browser that
     saved content before the database switch; the database is the source of
     truth from then on. */
  var LEGACY_KEY = 'lumiere-content-v1';

  /* Two variants of the house mark: the champagne one is tuned for the
     light theme, the lifted one stays legible on the near-black theme. */
  var DEFAULT_LOGO = 'profile/lumiere-monogram.png';
  var DEFAULT_LOGO_DARK = 'profile/lumiere-monogram-dark.png';

  /* Icon sets the admin can pick from when creating a new link. */
  var ICON_CHOICES = [
    'instagram', 'tiktok', 'telegram', 'whatsapp', 'facebook', 'x-twitter',
    'youtube', 'pinterest', 'linkedin', 'message', 'phone', 'mail',
    'perfume-bottle', 'droplet', 'flower', 'flame', 'sparkles', 'gift',
    'map-pin', 'users', 'star', 'tag', 'share'
  ];

  var DEFAULTS = {
    logo: DEFAULT_LOGO,
    logoDark: DEFAULT_LOGO_DARK,
    brand: {
      name: 'Lumière Perfume',
      handle: '@lumiereperfume',
      tagline: 'Fragrance crafted in light.',
      location: 'Addis Ababa, Ethiopia',
      phone: '+251963992222',
      tel: '+251963992222'
    },
    about: {
      title: 'The Lumière Story',
      lead: 'An independent fragrance house from Addis Ababa, making eaux de parfum in small batches.',
      body: [
        'Lumière — the French word for light — is what we set out to bottle. Perfume is memory made visible: a single whiff can return you to a courtyard, a season, someone you loved. We founded this house on the belief that a fragrance should be composed with that much care.',
        'Every Lumière scent begins in our atelier with an accord — a small architecture of notes built around one idea. Bergamot and pink pepper lift the opening, Turkish rose and orris settle into the heart, and oud, amber and vanilla hold the whole composition close to the skin for hours after the first spray has gone.',
        'We work in small batches, macerate every formula for weeks before bottling, and hand-finish each flacon. Nothing is rushed and nothing is over-formulated, because fragrance crafted in light is not a slogan — it is simply how the work should be done.'
      ],
      points: [
        'Composed in small batches',
        'Rare, traceable botanicals',
        'Macerated for depth, not speed',
        'Hand-filled and hand-finished'
      ]
    },
    features: [
      { icon: 'perfume-bottle', title: 'Signature scents', text: 'From bright citrus florals to deep resinous oud — a wardrobe of scents built to be worn every day.' },
      { icon: 'flower', title: 'Rare botanicals', text: 'Turkish rose, orris butter, saffron and oud — sourced from growers and distillers we know by name.' },
      { icon: 'droplet', title: 'True concentration', text: 'Generous parfum concentrations that open brightly, settle beautifully and stay close to the skin.' },
      { icon: 'gift', title: 'Bespoke & gifting', text: 'Layering consultation, private appointments and hand-wrapped gift sets for the people who matter.' }
    ],
    /* The first thing a customer reaches for. Order matters: the phone
       leads. Each entry is { icon, label, sub, url, kind }, where kind is
       one of 'custom' | 'tel' | 'wa' | 'map'. The non-custom kinds build
       their link from the phone number / location in the Brand tab, so
       editing the number once updates every button on the page. */
    contactQuick: [
      { icon: 'phone',     label: 'Call us',     sub: 'Ring the atelier',      url: '', kind: 'tel' },
      { icon: 'whatsapp',  label: 'WhatsApp',   sub: 'Message us instantly', url: '', kind: 'wa' },
      { icon: 'telegram',  label: 'Telegram',   sub: 'Join the channel',      url: 'https://t.me/lumiereperfume', kind: 'custom' },
      { icon: 'instagram', label: 'Instagram',  sub: 'New scents & stories',  url: 'https://www.instagram.com/lumiere_perfumeet?stkn=MWE0MzRkdGlreXZibw==', kind: 'custom' },
      { icon: 'tiktok',    label: 'TikTok',     sub: 'Scent stories',         url: 'https://www.tiktok.com/@yeab645?_r=1&_t=ZS-9A9w1yxER2P', kind: 'custom' },
      { icon: 'map-pin',   label: 'Location',   sub: 'Addis Ababa, Ethiopia', url: '', kind: 'map' }
    ],
    socials: [
      { name: 'Instagram', url: 'https://www.instagram.com/lumiere_perfumeet?stkn=MWE0MzRkdGlreXZibw==', icon: 'instagram', sub: '@lumiere_perfumeet — new scents & behind the scenes' },
      { name: 'TikTok', url: 'https://www.tiktok.com/@yeab645?_r=1&_t=ZS-9A9w1yxER2P', icon: 'tiktok', sub: '@yeab645 — scent stories & layering tips' },
      { name: 'Telegram', url: 'https://t.me/lumiereperfume', icon: 'telegram', sub: 'lumiereperfume — restocks & private offers' },
      { name: 'WhatsApp', url: '', icon: 'whatsapp', sub: 'Message us on WhatsApp' },
      { name: 'Pinterest', url: 'https://www.pinterest.com/lumiereperfume', icon: 'pinterest', sub: 'Lookbooks and scent mood boards' },
      { name: 'Facebook', url: 'https://www.facebook.com/lumiereperfume', icon: 'facebook', sub: 'Events and community' },
      { name: 'YouTube', url: 'https://www.youtube.com/@lumiereperfume', icon: 'youtube', sub: 'Long-form scent stories' },
      { name: 'X', url: '', icon: 'x-twitter', sub: 'News & quick updates' }
    ]
  };

  /* ---------- small helpers ---------- */
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isExternal(url) {
    return /^https?:\/\//i.test(url || '');
  }

  /* A card with no URL is "coming soon" and will not navigate. */
  function isPending(link) {
    return !link.url || !String(link.url).trim();
  }

  /* WhatsApp needs the number in international form with no punctuation.
     An Ethiopian local number like 0911... becomes 251911... . */
  function intlNumber(tel) {
    var digits = String(tel || '').replace(/[^\d]/g, '');
    if (!digits) { return ''; }
    if (digits.charAt(0) === '0') { return '251' + digits.slice(1); }
    return digits;
  }

  /* Turn a quick-action entry into a real href. 'tel' | 'wa' | 'map' are
     derived from the brand fields so the number is only ever typed once. */
  function quickHref(item, brand) {
    var b = brand || {};
    switch (item && item.kind) {
      case 'tel':
        return b.tel ? 'tel:' + b.tel : '';
      case 'wa':
        return intlNumber(b.tel) ? 'https://wa.me/' + intlNumber(b.tel) : '';
      case 'map':
        return 'https://www.google.com/maps/search/?api=1&query=' +
               encodeURIComponent((b.name || '') + ' ' + (b.location || '')).trim();
      default:
        return (item && item.url) || '';
    }
  }

  /* ---------- read / write ----------
     The database is the source of truth, so `content` is an in-memory
     cache that the first GET /api/content fills in. Until then — and if the
     API is unreachable — it holds the DEFAULTS, which is exactly the state the
     page was in before an admin had ever saved anything. */

  var content = clone(DEFAULTS);
  var pending = null;   /* the single in-flight (then settled) ready() promise */
  var offline = false;  /* true once a request failed at the network level */

  /* A network failure means there is no Node server behind the page: the file
     was opened directly, or it is on a static host such as GitHub Pages.
     Saved content lives on that server, so without it nothing is shared and
     only this browser would ever see a change. Say so plainly instead of
     leaving the admin with a bare "Failed to fetch". */
  function offlineError() {
    var e = new Error(
      'No server found. Run "npx vercel dev" locally, or make sure the site ' +
      'is deployed on Vercel — changes are shared through the database, ' +
      'so they only reach every visitor while the API is reachable.'
    );
    e.lumiereOffline = true;
    return e;
  }

  /* Whether the last attempt to reach the content API failed. */
  function isOffline() {
    return offline;
  }

  /* Synchronous accessor: the cached content, DEFAULTS until it is loaded.
     Kept synchronous so the existing callers in render.js, main.js and
     admin.js need no changes. */
  function load() {
    return content;
  }

  /* Promise for the content once it has been read from the database.
     Only one request is made; every later caller reuses the same promise. */
  function ready() {
    if (pending) { return pending; }

    pending = fetch(API_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    }).then(function (response) {
      if (!response.ok) { throw new Error('Failed to load content'); }
      return response.json();
    }).then(function (result) {
      if (!result || !result.data || typeof result.data !== 'object') {
        throw new Error('Unexpected content response');
      }
      content = merge(clone(DEFAULTS), result.data);
      /* Only hand the old local copy over while the database is still
         untouched. Otherwise a stale browser could silently roll back
         content that was properly saved from another device. */
      if (JSON.stringify(result.data) === JSON.stringify(DEFAULTS)) {
        migrateLegacy();
      }
      return content;
    }).catch(function () {
      /* Server unreachable: run on the DEFAULTS so the page still renders. */
      offline = true;
      content = clone(DEFAULTS);
      return content;
    });

    return pending;
  }

  /* The old localStorage copy, read only to migrate a browser that saved
     content before the database switch. */
  function readLegacy() {
    try {
      var raw = global.localStorage.getItem(LEGACY_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null; /* private mode, or corrupt: nothing to migrate */
    }
  }

  function dropLegacy() {
    try { global.localStorage.removeItem(LEGACY_KEY); } catch (e) { /* ignore */ }
  }

  /* Hand a pre-database browser's edits to the database exactly once, so old
     content is not silently lost. A failed write is simply dropped. */
  function migrateLegacy() {
    var legacy = readLegacy();
    if (!legacy) { return; }
    save(merge(clone(DEFAULTS), legacy)).then(dropLegacy, dropLegacy);
  }

  /* Per-section merge, so a file saved before a new key existed still works. */
  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') { return base; }

    ['brand', 'about'].forEach(function (key) {
      if (saved[key] && typeof saved[key] === 'object') {
        Object.keys(saved[key]).forEach(function (k) { base[key][k] = saved[key][k]; });
      }
    });

    if (Array.isArray(saved.features)) { base.features = saved.features; }
    if (Array.isArray(saved.socials))  { base.socials = saved.socials; }
    if (Array.isArray(saved.contactQuick)) { base.contactQuick = saved.contactQuick; }
    if (typeof saved.logo === 'string') { base.logo = saved.logo; }
    if (typeof saved.logoDark === 'string') { base.logoDark = saved.logoDark; }

    return base;
  }

  /* Save to the database. Resolves with the API response and rejects on failure,
     so the caller can tell the admin their work was NOT stored. */
  function save(data) {
    return fetch(API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data)
    }).then(function (response) {
      offline = false;
      return response.json().catch(function () { return {}; }).then(function (result) {
        if (!response.ok) {
          throw new Error(result.message || 'Failed to save content');
        }
        if (result && result.data) {
          content = merge(clone(DEFAULTS), result.data);
        }
        return result;
      });
    }).catch(function (err) {
      /* A network error here means the page is not being served by Node, so
         the change would land nowhere shared. */
      if (err && err.lumiereOffline) { throw err; }
      throw offlineError();
    });
  }

  /* Back to the original content (the admin's "Reset everything"). */
  function clear() {
    return fetch(API_URL + '/reset', {
      method: 'POST',
      headers: { 'Accept': 'application/json' }
    }).then(function (response) {
      if (!response.ok) { throw new Error('Failed to reset content'); }
      return response.json();
    }).then(function (result) {
      dropLegacy();
      if (result && result.data) {
        content = merge(clone(DEFAULTS), result.data);
      }
      return result;
    });
  }

  /* True once content that differs from the shipped DEFAULTS is in the cache.
     Until then the HTML in index.html is already correct, so render.js leaves
     it alone. */
  function hasSaved() {
    if (!pending) { return false; }
    return JSON.stringify(content) !== JSON.stringify(DEFAULTS);
  }

  global.LumiereStore = {
    API_URL: API_URL,
    DEFAULT_LOGO: DEFAULT_LOGO,
    DEFAULT_LOGO_DARK: DEFAULT_LOGO_DARK,
    ICON_CHOICES: ICON_CHOICES,
    DEFAULTS: DEFAULTS,
    load: load,
    ready: ready,
    isOffline: isOffline,
    save: save,
    clear: clear,
    hasSaved: hasSaved,
    clone: clone,
    merge: merge,
    isExternal: isExternal,
    isPending: isPending,
    intlNumber: intlNumber,
    quickHref: quickHref
  };

})(window);

