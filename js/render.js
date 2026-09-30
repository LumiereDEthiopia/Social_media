/* ==========================================================================
   Lumière Perfume — renderer
   Paints the saved content (logo, brand, introduction, social links) onto
   the existing markup. Loaded before main.js so handlers bind to the final
   DOM.

   All text is written with textContent, so admin input is never injected
   as HTML.
   ========================================================================== */
(function (global) {
  'use strict';

  var doc = global.document;
  var Store = global.LumiereStore;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
  }

  function setText(node, value) {
    if (node) { node.textContent = value == null ? '' : String(value); }
  }

  function isDark() {
    return doc.documentElement.getAttribute('data-theme') === 'dark';
  }

  /* ---------- logo ---------- */
  function applyLogo(data) {
    /* A dark theme needs the lifted variant, unless the admin has uploaded
       their own image (a data: URL is used on both themes as-is). */
    var custom = data.logo && data.logo.indexOf('data:') === 0;
    var src = custom ? data.logo
            : (isDark() ? (data.logoDark || Store.DEFAULT_LOGO_DARK) : data.logo)
              || Store.DEFAULT_LOGO;

    $$('img').forEach(function (img) {
      var cur = img.getAttribute('src') || '';
      /* Only touch our own logo images, leave other pictures alone. */
      if (cur.indexOf('profile/') === 0 || cur.indexOf('data:image') === 0) {
        img.setAttribute('src', src);
      }
    });
    var meta = $('meta[property="og:image"]');
    if (meta && src.indexOf('data:') !== 0) { meta.setAttribute('content', src); }
  }

  /* ---------- brand ---------- */
  function applyBrand(data) {
    var b = data.brand || {};
    var name = b.name || 'Lumière Perfume';

    setText($('.profile-title'), name);
    setText($('.brand-text strong'), name);
    setText($('.footer-brand strong'), name);
    setText($('.profile-handle'), b.handle);
    setText($('.profile-tagline'), b.tagline);
    setText($('.brand-text small'), b.tagline);
    setText($('.footer-brand small'), b.tagline);

    var locNode = $('.profile-location');
    if (locNode) {
      /* Keep the icon element; replace only the trailing text node. */
      var textNode = Array.prototype.filter.call(locNode.childNodes, function (n) {
        return n.nodeType === 3;
      })[0];
      if (textNode) { textNode.nodeValue = ' ' + (b.location || ''); }
    }

    $$('a[href^="tel:"]').forEach(function (a) {
      a.setAttribute('href', 'tel:' + (b.tel || ''));
    });
    /* Only the two tiles that actually show the number, so the captions on
       the other contact cards are not overwritten with digits. */
    $$('[data-phone-text]').forEach(function (s) { setText(s, b.phone); });

    doc.title = name + (b.tagline ? ' — ' + b.tagline : '');
  }

  /* ---------- introduction ---------- */
  function applyAbout(data) {
    var a = data.about || {};

    setText($('#about .section-title'), a.title);
    setText($('#about .section-lead'), a.lead);

    var copy = $('#about .about-copy');
    if (copy) {
      var points = $('.about-points', copy);
      var intro = doc.createElement('div');
      intro.className = 'about-body';

      (a.body || []).forEach(function (line) {
        if (!String(line).trim()) { return; }
        intro.appendChild(doc.createElement('p')).textContent = String(line).trim();
      });

      /* Drop the static paragraphs but keep the bullet list node. */
      $$('p', copy).forEach(function (p) {
        if (!points || !points.contains(p)) { p.remove(); }
      });
      copy.insertBefore(intro, points || null);

      if (points) {
        points.textContent = '';
        (a.points || []).forEach(function (line) {
          if (!String(line).trim()) { return; }
          var li = doc.createElement('li');
          var ic = doc.createElement('span');
          ic.className = 'ico ico-check';
          ic.setAttribute('aria-hidden', 'true');
          li.appendChild(ic);
          li.appendChild(doc.createTextNode(' ' + String(line).trim()));
          points.appendChild(li);
        });
      }
    }

    applyFeatures(data.features || []);
  }

  var FEATURE_TONES = ['fi-1', 'fi-2', 'fi-3', 'fi-4'];

  function applyFeatures(features) {
    var wrap = $('.about-cards');
    if (!wrap) { return; }
    wrap.textContent = '';

    features.forEach(function (f, i) {
      var card = doc.createElement('article');
      card.className = 'feature-card reveal is-visible';

      var badge = doc.createElement('span');
      badge.className = 'feature-icon ' + FEATURE_TONES[i % FEATURE_TONES.length];
      var ic = doc.createElement('span');
      ic.className = 'ico ico-' + (f.icon || 'store');
      ic.setAttribute('aria-hidden', 'true');
      badge.appendChild(ic);
      card.appendChild(badge);

      var h3 = doc.createElement('h3');
      h3.textContent = f.title || 'Feature';
      card.appendChild(h3);

      var p = doc.createElement('p');
      p.textContent = f.text || '';
      card.appendChild(p);

      wrap.appendChild(card);
    });
  }


  /* ---------- quick contact actions ----------
     The big buttons at the top of the contact section. Phone is first by
     default, and the tel / WhatsApp / maps links are rebuilt from the brand
     fields so the admin only ever types the number once. */
  function applyQuickContact(data) {
    var box = $('#contactQuick');
    if (!box) { return; }
    box.textContent = '';

    var items = data.contactQuick || [];
    items.forEach(function (item, i) {
      var href = Store.quickHref(item, data.brand);
      var ready = !!href;

      var el = doc.createElement('a');
      el.className = 'qc-btn qc-' + (item.icon || 'phone') +
                     (i === 0 ? ' qc-lead' : '') + ' reveal is-visible';

      if (ready) {
        el.setAttribute('href', href);
        if (Store.isExternal(href)) {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      } else {
        /* No number typed yet: stay tappable, show a hint instead of a dead link. */
        el.setAttribute('href', '#');
        el.setAttribute('data-pending', 'true');
        el.classList.add('is-pending');
      }

      var badge = doc.createElement('span');
      badge.className = 'qc-icon';
      var ic = doc.createElement('span');
      ic.className = 'ico ico-' + (item.icon || 'phone');
      ic.setAttribute('aria-hidden', 'true');
      badge.appendChild(ic);
      el.appendChild(badge);

      var text = doc.createElement('span');
      text.className = 'qc-text';
      var strong = doc.createElement('strong');
      strong.textContent = item.label || 'Contact';
      text.appendChild(strong);
      var small = doc.createElement('small');
      small.textContent = ready ? (item.sub || '') : 'Not set up yet';
      text.appendChild(small);
      el.appendChild(text);

      box.appendChild(el);
    });
  }

  /* ---------- profile card channel chips ----------
     The compact icon row inside the profile card. It renders the same
     contactQuick list the Contact tab edits, so the admin only ever
     maintains one set of links for the whole page. */
  function applyProfileChannels(data) {
    var box = $('#profileChannels');
    if (!box) { return; }
    box.textContent = '';

    (data.contactQuick || []).forEach(function (item) {
      var href = Store.quickHref(item, data.brand);
      var ready = !!href;
      var label = item.label || 'Contact';

      var el = doc.createElement('a');
      el.className = 'pc-chip qc-' + (item.icon || 'phone');
      el.setAttribute('title', ready ? label : label + ' — not set up yet');
      el.setAttribute('aria-label', label);

      if (ready) {
        el.setAttribute('href', href);
        if (Store.isExternal(href)) {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      } else {
        /* Same contract as the big buttons: tappable, but explains itself. */
        el.setAttribute('href', '#');
        el.setAttribute('data-pending', 'true');
        el.setAttribute('data-name', label);
        el.classList.add('is-pending');
      }

      var ic = doc.createElement('span');
      ic.className = 'ico ico-' + (item.icon || 'phone');
      ic.setAttribute('aria-hidden', 'true');
      el.appendChild(ic);

      box.appendChild(el);
    });
  }

  /* ---------- social links ---------- */
  function applySocials(data) {
    var grid = $('#social .social-grid');
    if (!grid) { return; }
    grid.textContent = '';

    (data.socials || []).forEach(function (link) {
      var pending = Store.isPending(link);

      var el = doc.createElement('a');
      el.className = 'social-card sc-' + (link.icon || 'share') + ' reveal is-visible';
      if (pending) { el.classList.add('is-pending'); }

      if (pending) {
        /* No URL: stay clickable but do not navigate (main.js shows a toast). */
        el.setAttribute('href', '#');
        el.setAttribute('data-pending', 'true');
        el.setAttribute('aria-disabled', 'true');
      } else {
        el.setAttribute('href', link.url);
        if (Store.isExternal(link.url)) {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      }

      var iconWrap = doc.createElement('span');
      iconWrap.className = 'sc-icon';
      var ic = doc.createElement('span');
      ic.className = 'ico ico-' + (link.icon || 'share');
      ic.setAttribute('aria-hidden', 'true');
      iconWrap.appendChild(ic);
      el.appendChild(iconWrap);

      var body = doc.createElement('span');
      body.className = 'sc-body';
      var strong = doc.createElement('strong');
      strong.textContent = link.name || 'Link';
      body.appendChild(strong);
      var small = doc.createElement('small');
      small.textContent = pending ? 'Coming soon' : (link.sub || link.url);
      body.appendChild(small);
      el.appendChild(body);

      var go = doc.createElement('span');
      go.className = 'ico ico-arrow sc-go';
      go.setAttribute('aria-hidden', 'true');
      el.appendChild(go);

      grid.appendChild(el);
    });
  }

  /* ---------- footer shortcuts ---------- */
  function applyFooterSocials(data) {
    var box = $('.footer-social');
    if (!box) { return; }
    var brandName = (data.brand && data.brand.name) || 'Lumière Perfume';
    box.textContent = '';

    (data.socials || []).filter(function (l) {
      return !Store.isPending(l) && Store.isExternal(l.url);
    }).slice(0, 5).forEach(function (link) {
      var a = doc.createElement('a');
      a.setAttribute('href', link.url);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.setAttribute('aria-label', brandName + ' on ' + (link.name || 'social media'));
      var ic = doc.createElement('span');
      ic.className = 'ico ico-' + (link.icon || 'share');
      ic.setAttribute('aria-hidden', 'true');
      a.appendChild(ic);
      box.appendChild(a);
    });
  }

  function applyAll(data) {
    applyLogo(data);
    applyBrand(data);
    applyAbout(data);
    applyQuickContact(data);
    applyProfileChannels(data);
    applySocials(data);
    applyFooterSocials(data);
  }

  global.LumiereRender = {
    apply: applyAll,
    applyLogo: applyLogo,
    applyBrand: applyBrand,
    applyAbout: applyAbout,
    applyQuickContact: applyQuickContact,
    applyProfileChannels: applyProfileChannels,
    applySocials: applySocials
  };

  /* main.js calls this after flipping the theme so the logo variant
     follows the colour scheme. */
  global.refreshLumiereLogo = function () {
    applyLogo(Store.load());
  };

  /* Fetch the content from the API, then paint it over the static HTML.
     The HTML in index.html is already correct, so this only overrides it
     once real, saved content has arrived — the page never shows a flash of
     defaults followed by the real thing. */
  Store.ready().then(function (content) {
    if (Store.hasSaved()) { applyAll(content); }
    /* The grid was rebuilt, so re-attach the "coming soon" handlers. */
    if (global.LumiereRefresh) { global.LumiereRefresh(); }
  });

})(window);

