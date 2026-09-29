/* ==========================================================================
   Lumière Perfume — content store
   Holds every editable value (logo, introduction, social links) in
   localStorage and paints it onto the page.

   Design rules:
   - The HTML in index.html is the real content, so the page still reads
     fine with JavaScript disabled. This file only OVERRIDES those nodes
     once the admin has saved something.
   - No build step, no dependencies.
   ========================================================================== */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'lumiere-content-v1';

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
      phone: '0911 000 000',
      tel: '0911000000'
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
      { icon: 'instagram', label: 'Instagram',  sub: 'New scents & stories',  url: 'https://www.instagram.com/lumiereperfume', kind: 'custom' },
      { icon: 'tiktok',    label: 'TikTok',     sub: 'Scent stories',         url: 'https://www.tiktok.com/@lumiereperfume', kind: 'custom' },
      { icon: 'map-pin',   label: 'Location',   sub: 'Addis Ababa, Ethiopia', url: '', kind: 'map' }
    ],
    socials: [
      { name: 'Instagram', url: 'https://www.instagram.com/lumiereperfume', icon: 'instagram', sub: '@lumiereperfume — new scents & behind the scenes' },
      { name: 'TikTok', url: 'https://www.tiktok.com/@lumiereperfume', icon: 'tiktok', sub: '@lumiereperfume — scent stories & layering tips' },
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

  /* ---------- read / write ---------- */
  function load() {
    var raw = null;
    try {
      raw = global.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return clone(DEFAULTS); /* private mode: run on defaults */
    }
    if (!raw) { return clone(DEFAULTS); }

    try {
      return merge(clone(DEFAULTS), JSON.parse(raw));
    } catch (e) {
      return clone(DEFAULTS); /* corrupt data: fall back safely */
    }
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

  function save(data) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      /* Most likely the ~5MB quota, e.g. an oversized logo. */
      return false;
    }
  }

  function clear() {
    try { global.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  function hasSaved() {
    try { return !!global.localStorage.getItem(STORAGE_KEY); } catch (e) { return false; }
  }

  global.LumiereStore = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_LOGO: DEFAULT_LOGO,
    DEFAULT_LOGO_DARK: DEFAULT_LOGO_DARK,
    ICON_CHOICES: ICON_CHOICES,
    DEFAULTS: DEFAULTS,
    load: load,
    save: save,
    clear: clear,
    hasSaved: hasSaved,
    clone: clone,
    isExternal: isExternal,
    isPending: isPending,
    intlNumber: intlNumber,
    quickHref: quickHref
  };

})(window);

