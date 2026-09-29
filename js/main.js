/* ==========================================================================
   Lumière Perfume — single page social hub
   Plain JavaScript. No frameworks, no build step, no dependencies.
   Every feature degrades safely: with JS off the page stays fully readable
   and every link still works.
   ========================================================================== */
(function () {
  'use strict';

  /* Remove the no-js flag as soon as this file executes. */
  document.documentElement.classList.remove('no-js');

  var THEME_KEY = 'lumiere-theme';
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */
  var toastEl = $('#toast');
  var toastMsg = $('#toastMsg');
  var toastTimer = null;

  function toast(message) {
    if (!toastEl) { return; }
    toastMsg.textContent = message;
    toastEl.hidden = false;
    toastEl.classList.remove('is-hiding');

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.add('is-hiding');
      toastTimer = window.setTimeout(function () { toastEl.hidden = true; }, 260);
    }, 2400);
  }

  /* ------------------------------------------------------------------
     1. Theme toggle
     ------------------------------------------------------------------ */
  (function initTheme() {
    var toggle = $('#themeToggle');
    var root = document.documentElement;
    if (!toggle) { return; }

    function currentTheme() {
      return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch (e) { /* storage unavailable: the theme just will not persist */ }
      /* Swap the logo to the variant that reads on this background. */
      if (typeof window.refreshLumiereLogo === 'function') {
        window.refreshLumiereLogo();
      }
      toast(next === 'dark' ? 'Dark theme on' : 'Light theme on');
    });

    /* Follow the OS only while the user has made no explicit choice. */
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function (e) {
      var saved = null;
      try { saved = window.localStorage.getItem(THEME_KEY); } catch (err) { /* ignore */ }
      if (!saved) {
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        if (typeof window.refreshLumiereLogo === 'function') {
          window.refreshLumiereLogo();
        }
      }
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(onChange); /* older Safari */
    }
  })();

  /* ------------------------------------------------------------------
     2. Mobile navigation
     ------------------------------------------------------------------ */
  (function initNav() {
    var nav = $('#siteNav');
    var navToggle = $('#navToggle');
    if (!nav || !navToggle) { return; }

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    navToggle.addEventListener('click', function () {
      setOpen(!nav.classList.contains('is-open'));
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { setOpen(false); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        navToggle.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 760) { setOpen(false); }
    });
  })();

  /* ------------------------------------------------------------------
     3. Header shadow + active nav link + back-to-top
     ------------------------------------------------------------------ */
  (function initScrollChrome() {
    var header = $('#siteHeader');
    var toTop = $('#toTop');

    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      if (header) { header.classList.toggle('is-stuck', y > 8); }
      if (toTop) { toTop.classList.toggle('is-hidden', y < 400); }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (toTop) {
      toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    var links = $$('[data-navlink]');
    var sections = links
      .map(function (link) { return document.querySelector(link.getAttribute('href')); })
      .filter(Boolean);

    if (!sections.length || typeof IntersectionObserver !== 'function') { return; }

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        links.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (section) { spy.observe(section); });
  })();

  /* ------------------------------------------------------------------
     4. Scroll reveal
     ------------------------------------------------------------------ */
  (function initReveal() {
    var items = $$('.reveal');
    if (!items.length) { return; }

    /* No IntersectionObserver, or reduced motion: show everything at once. */
    if (typeof IntersectionObserver !== 'function' ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        /* Stagger siblings slightly for a softer cascade. */
        var delay = (Number(entry.target.dataset.revealDelay) || 0) * 70;
        window.setTimeout(function () {
          entry.target.classList.add('is-visible');
        }, delay);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    items.forEach(function (el, i) {
      if (!el.dataset.revealDelay) { el.dataset.revealDelay = String(i % 4); }
      observer.observe(el);
    });
  })();

  /* Expose the toast so admin.js can reuse it instead of building its own. */
  /* Expose the toast so admin.js can reuse the same on-screen toast. */
  window.LumiereToast = toast;

  /* ------------------------------------------------------------------
     5. Pending social channels
     Cards marked data-pending="true" are placeholders: they are dimmed and
     will not navigate. Set a real href in the admin (or index.html) and the
     card becomes live automatically.
     Exported so the admin panel can re-bind after it repaints the grid.
     ------------------------------------------------------------------ */
  function bindPendingCards() {
    $$('[data-pending="true"]').forEach(function (card) {
      if (card.dataset.pendingBound === '1') { return; }
      card.dataset.pendingBound = '1';

      card.classList.add('is-pending');
      card.setAttribute('aria-disabled', 'true');
      card.setAttribute('tabindex', '0');

      function warn(e) {
        e.preventDefault();
        /* Icon-only chips carry their name on the element itself; the big
           cards carry it in a <strong>. */
        var name = card.getAttribute('data-name') ||
          (($('.sc-body strong', card) || $('.qc-text strong', card) || {}).textContent) ||
          'This channel';
        toast(name + ' is not set up yet');
      }

      card.addEventListener('click', warn);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { warn(e); }
      });
    });
  }

  bindPendingCards();

  /* Called by admin.js after a save, so freshly rendered "coming soon"
     cards get their click handler again. */
  window.LumiereRefresh = function () {
    bindPendingCards();
    /* Keep the logo variant in step with the active theme. */
    if (typeof window.refreshLumiereLogo === 'function') {
      window.refreshLumiereLogo();
    }
  };

  /* ------------------------------------------------------------------
     6. Clipboard helper (with a non-secure-context fallback)
     ------------------------------------------------------------------ */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }


  /* ------------------------------------------------------------------
     7. Share sheet
     ------------------------------------------------------------------ */
  (function initShare() {
    var openBtn = $('#shareBtn');
    var sheet = $('#shareSheet');
    var closeBtn = $('#shareClose');
    var nativeBtn = $('#shareNative');
    if (!openBtn || !sheet) { return; }

    var pageUrl = window.location.href.split('#')[0];
    var pageTitle = document.title;
    var Store = window.LumiereStore;
    var b = (Store && Store.load().brand) || {};
    var text = (b.name || 'Lumière Perfume') +
      (b.tagline ? ' — ' + b.tagline : '');
    var lastFocused = null;

    function open() {
      lastFocused = document.activeElement;
      sheet.hidden = false;
      document.body.classList.add('no-scroll');
      if (closeBtn) { closeBtn.focus(); }
    }

    function close() {
      sheet.hidden = true;
      document.body.classList.remove('no-scroll');
      if (lastFocused && lastFocused.focus) { lastFocused.focus(); }
    }

    openBtn.addEventListener('click', open);
    if (closeBtn) { closeBtn.addEventListener('click', close); }

    /* Click the dimmed backdrop (but not the panel) to dismiss. */
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet) { close(); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !sheet.hidden) { close(); }
    });

    /* Prefer the OS share sheet where it exists. */
    if (nativeBtn && navigator.share) {
      nativeBtn.hidden = false;
      nativeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        close();
        navigator.share({ title: pageTitle, text: text, url: pageUrl }).catch(function () {
          /* The user dismissed the OS sheet — nothing to report. */
        });
      });
    }

    var targets = {
      whatsapp: 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + pageUrl),
      telegram: 'https://t.me/share/url?url=' + encodeURIComponent(pageUrl) + '&text=' + encodeURIComponent(text),
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl),
      x: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(pageUrl)
    };

    $$('[data-share]', sheet).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.getAttribute('data-share');

        if (kind === 'copy') {
          copyText(pageUrl).then(function () {
            close();
            toast('Link copied to clipboard');
          }).catch(function () {
            close();
            toast('Could not copy — long-press the address bar');
          });
          return;
        }

        if (targets[kind]) {
          window.open(targets[kind], '_blank', 'noopener,noreferrer,width=640,height=560');
          close();
        }
      });
    });
  })();

  /* ------------------------------------------------------------------
     8. Copy phone number
     ------------------------------------------------------------------ */
  (function initCopyPhone() {
    var btn = $('#copyPhoneBtn');
    if (!btn) { return; }

    var Store = window.LumiereStore;
    /* Read the number from the store so an admin edit is respected. */
    var number = (Store && Store.load().brand.phone) || '0911 000 000';

    btn.addEventListener('click', function () {
      copyText(number).then(function () {
        toast('Number ' + number + ' copied');
        btn.classList.add('is-copied');
        window.setTimeout(function () { btn.classList.remove('is-copied'); }, 1400);
      }).catch(function () {
        toast('Could not copy the number');
      });
    });
  })();

  /* ------------------------------------------------------------------
     9. Save contact (vCard)
     Downloads a .vcf the user can import into their phone.
     ------------------------------------------------------------------ */
  (function initVCard() {
    var btn = $('#vcardBtn');
    if (!btn) { return; }

    var Store = window.LumiereStore;
    var b = (Store && Store.load().brand) || {};

    var lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Perfume;Lumière;;;',
      'FN:Lumière Perfume',
      'ORG:Lumière Perfume',
      'TITLE:Fragrance House',
      'NOTE:Fragrance crafted in light.',
      'URL:' + window.location.href.split('#')[0],
      'TEL;TYPE=CELL,VOICE:' + (b.tel || '0911000000'),
      'ADR;TYPE=WORK:;;' + (b.location || 'Addis Ababa, Ethiopia') + ';;;;',
      'END:VCARD'
    ];

    btn.addEventListener('click', function () {
      try {
        var blob = new Blob([lines.join('\r\n')], { type: 'text/vcard;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'lumiere-perfume-contact.vcf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        toast('Contact file downloaded');
      } catch (e) {
        toast('Could not create the contact file');
      }
    });
  })();

  /* ------------------------------------------------------------------
     10. Footer year
     ------------------------------------------------------------------ */
  (function initYear() {
    var el = $('#year');
    if (el) { el.textContent = String(new Date().getFullYear()); }
  })();

})();

