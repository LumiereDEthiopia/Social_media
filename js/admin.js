/* ==========================================================================
   Lumière Perfume — admin panel
   Hidden editor. Open it by tapping the footer logo 7 times in a row.
   Saving sends the content to PUT /api/content, where the Express server
   stores it in SQLite. Every visitor then reads it from GET /api/content.
   ========================================================================== */
(function (global) {
  'use strict';

  var doc = global.document;
  var Store = global.LumiereStore;
  var Render = global.LumiereRender;

  var $  = function (sel, ctx) { return (ctx || doc).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
  };

  /* ------------------------------------------------------------------
     Toast bridge — resolved lazily so it picks up the page toast that
     main.js creates, whichever script happens to load first.
     ------------------------------------------------------------------ */
  var notify = function (msg) {
    if (global.LumiereToast) {
      global.LumiereToast(msg);
      return;
    }
    var t = doc.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    doc.body.appendChild(t);
    global.setTimeout(function () { t.remove(); }, 2200);
  };

  /* ------------------------------------------------------------------
     1. Secret trigger: 7 taps on the footer logo
     ------------------------------------------------------------------ */
  (function initSecretTrigger() {
    var trigger = $('#adminTrigger');
    if (!trigger) { return; }

    var REQUIRED = 7;      /* how many taps to open admin  */
    var WINDOW = 2500;     /* ms of inactivity before the count resets */
    var HINT_AT = 4;       /* start hinting after this many taps */

    var taps = 0;
    var resetTimer = null;
    var hintShown = false;

    function reset() {
      taps = 0;
      hintShown = false;
      trigger.classList.remove('is-counting', 'is-hint');
    }

    function onTap() {
      taps += 1;
      trigger.classList.add('is-counting');

      global.clearTimeout(resetTimer);
      resetTimer = global.setTimeout(reset, WINDOW);

      if (taps >= REQUIRED) {
        reset();
        Admin.open();
        return;
      }

      /* Give feedback part way through so the gesture feels intentional. */
      if (taps >= HINT_AT && !hintShown) {
        hintShown = true;
        trigger.classList.add('is-hint');
        notify((REQUIRED - taps) + ' more tap' + (REQUIRED - taps === 1 ? '' : 's') + ' to open admin');
      }
    }

    trigger.addEventListener('click', onTap);

    /* Keyboard route for anyone who cannot tap. */
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTap();
      }
    });
  })();

  /* ------------------------------------------------------------------
     2. Image helper — shrink uploads so the stored content stays a sane size
     ------------------------------------------------------------------ */
  function readImage(file, maxSize) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('Please choose an image file.'));
        return;
      }

      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that file.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('That image could not be opened.')); };
        img.onload = function () {
          var max = maxSize || 512;
          var w = img.naturalWidth;
          var h = img.naturalHeight;

          /* Only shrink; never enlarge a small logo. */
          if (w <= max && h <= max) { resolve(String(reader.result)); return; }

          var scale = Math.min(max / w, max / h);
          var canvas = doc.createElement('canvas');
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);

          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          /* PNG keeps transparency for logos; JPEG is far smaller. */
          var isPng = /png|svg/i.test(file.type);
          var out = isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);

          if (out.length > 600000) { out = canvas.toDataURL('image/jpeg', 0.6); }
          resolve(out);
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  /* ------------------------------------------------------------------
     3. Small DOM builders
     ------------------------------------------------------------------ */
  function el(tag, className, text) {
    var node = doc.createElement(tag);
    if (className) { node.className = className; }
    if (text != null) { node.textContent = String(text); }
    return node;
  }

  function iconSelect(value) {
    var sel = el('select', 'inp inp-icon');
    Store.ICON_CHOICES.forEach(function (name) {
      var opt = el('option', null, name);
      opt.value = name;
      if (name === value) { opt.selected = true; }
      sel.appendChild(opt);
    });
    return sel;
  }

  function field(labelText, control) {
    var wrap = el('div', 'field');
    var label = el('label', null, labelText);
    wrap.appendChild(label);
    wrap.appendChild(control);
    return wrap;
  }

  function input(placeholder, value) {
    var i = el('input', 'inp');
    i.type = 'text';
    i.placeholder = placeholder || '';
    i.value = value == null ? '' : String(value);
    return i;
  }

  /* ------------------------------------------------------------------
     4. Repeatable rows — feature cards
     ------------------------------------------------------------------ */
  function buildFeatureRow(item, index, onRemove) {
    var row = el('div', 'repeat-row');
    row.dataset.index = String(index);

    var top = el('div', 'repeat-top');
    top.appendChild(el('span', 'repeat-label', 'Card ' + (index + 1)));

    var del = el('button', 'row-del');
    del.type = 'button';
    del.setAttribute('aria-label', 'Delete card ' + (index + 1));
    del.appendChild(el('span', 'ico ico-close'));
    del.addEventListener('click', function () { onRemove(index); });
    top.appendChild(del);
    row.appendChild(top);

    var title = input('Title', item.title);
    var text = el('textarea', 'inp');
    text.rows = 2;
    text.placeholder = 'Short description';
    text.value = item.text || '';

    var icon = iconSelect(item.icon);
    var preview = el('span', 'row-preview');
    var ic = el('span', 'ico ico-' + (item.icon || 'store'));
    ic.setAttribute('aria-hidden', 'true');
    preview.appendChild(ic);

    icon.addEventListener('change', function () {
      ic.className = 'ico ico-' + icon.value;
    });

    row._get = function () {
      return { title: title.value, text: text.value, icon: icon.value };
    };

    row.appendChild(field('Title', title));
    row.appendChild(field('Description', text));
    row.appendChild(field('Icon', icon));
    row.insertBefore(preview, row.firstChild);
    return row;
  }

  /* ------------------------------------------------------------------
     5. Repeatable rows — contact buttons
     Each row picks a "kind": the auto kinds take their link from the phone
     number / location typed in the Brand tab, so the number is entered once.
     ------------------------------------------------------------------ */
  var QUICK_KINDS = [
    { value: 'custom', label: 'Custom URL' },
    { value: 'tel',    label: 'Call (use phone number)' },
    { value: 'wa',     label: 'WhatsApp (use phone number)' },
    { value: 'map',    label: 'Map (use location)' }
  ];

  function buildQuickRow(item, index, onRemove) {
    var row = el('div', 'repeat-row');
    row.dataset.index = String(index);

    var top = el('div', 'repeat-top');
    top.appendChild(el('span', 'repeat-label', 'Button ' + (index + 1) + (index === 0 ? ' — highlighted' : '')));

    var del = el('button', 'row-del');
    del.type = 'button';
    del.setAttribute('aria-label', 'Delete button ' + (index + 1));
    del.appendChild(el('span', 'ico ico-close'));
    del.addEventListener('click', function () { onRemove(index); });
    top.appendChild(del);
    row.appendChild(top);

    var label = input('e.g. Call us', item.label);
    var sub = input('e.g. Ring the atelier', item.sub);

    var kind = el('select', 'inp');
    QUICK_KINDS.forEach(function (k) {
      var opt = el('option', null, k.label);
      opt.value = k.value;
      if (k.value === (item.kind || 'custom')) { opt.selected = true; }
      kind.appendChild(opt);
    });

    var url = input('https://…', item.url);
    var urlField = field('URL', url);

    /* The URL box is meaningless for the auto kinds, so hide it. */
    function syncUrl() {
      var auto = kind.value !== 'custom';
      urlField.hidden = auto;
      if (auto) { url.value = ''; }
    }
    kind.addEventListener('change', syncUrl);
    syncUrl();

    var icon = iconSelect(item.icon);
    var preview = el('span', 'row-preview');
    var ic = el('span', 'ico ico-' + (item.icon || 'phone'));
    ic.setAttribute('aria-hidden', 'true');
    preview.appendChild(ic);
    icon.addEventListener('change', function () {
      ic.className = 'ico ico-' + icon.value;
    });

    row._get = function () {
      return {
        label: label.value,
        sub: sub.value,
        url: kind.value === 'custom' ? url.value : '',
        kind: kind.value,
        icon: icon.value
      };
    };

    row.appendChild(field('Label', label));
    row.appendChild(field('Small caption', sub));
    row.appendChild(field('Link type', kind));
    row.appendChild(urlField);
    row.appendChild(field('Icon', icon));
    row.insertBefore(preview, row.firstChild);
    return row;
  }

  /* ------------------------------------------------------------------
     6. Repeatable rows — social links
     ------------------------------------------------------------------ */
  function buildSocialRow(item, index, onRemove) {
    var row = el('div', 'repeat-row');
    row.dataset.index = String(index);

    var top = el('div', 'repeat-top');
    top.appendChild(el('span', 'repeat-label', 'Link ' + (index + 1)));

    var del = el('button', 'row-del');
    del.type = 'button';
    del.setAttribute('aria-label', 'Delete link ' + (index + 1));
    del.appendChild(el('span', 'ico ico-close'));
    del.addEventListener('click', function () { onRemove(index); });
    top.appendChild(del);
    row.appendChild(top);

    var name = input('e.g. Instagram', item.name);
    var url = input('https://… (leave empty for "coming soon")', item.url);
    var sub = input('Short caption', item.sub);

    var icon = iconSelect(item.icon);
    var preview = el('span', 'row-preview');
    var ic = el('span', 'ico ico-' + (item.icon || 'share'));
    ic.setAttribute('aria-hidden', 'true');
    preview.appendChild(ic);
    icon.addEventListener('change', function () {
      ic.className = 'ico ico-' + icon.value;
    });

    row._get = function () {
      return { name: name.value, url: url.value, sub: sub.value, icon: icon.value };
    };

    row.appendChild(field('Name', name));
    row.appendChild(field('URL', url));
    row.appendChild(field('Caption', sub));
    row.appendChild(field('Icon', icon));
    row.insertBefore(preview, row.firstChild);
    return row;
  }


  /* ------------------------------------------------------------------
     6. Admin controller
     ------------------------------------------------------------------ */
  var Admin = (function () {
    var panel = $('#adminPanel');
    if (!panel) { return { open: function () {} }; }

    var working = null;   /* editable copy while the panel is open */
    var logoData = null;      /* staged logo (data URL) */
    var logoDataDark = null;  /* dark-theme variant of the same logo */
    var lastFocused = null;
    var touched = false;      /* admin has edited the form since it opened */
    var saveBtn = null;       /* the existing Save button, disabled while saving */

    /* ---------- open / close ---------- */
    function open() {
      /* The content lives in SQLite and arrives over the API, so the form is
         filled as soon as that resolves. The panel still opens instantly. */
      touched = false;
      lastFocused = doc.activeElement;

      Store.ready().then(function () {
        if (touched) { return; }   /* a late response must not wipe an edit */
        working = Store.load();
        logoData = working.logo;
        logoDataDark = working.logoDark || working.logo;
        fillForm();
      });

      panel.hidden = false;
      doc.body.classList.add('no-scroll');
      var first = panel.querySelector('input, select, textarea, button');
      if (first) { first.focus(); }
    }

    function close() {
      panel.hidden = true;
      doc.body.classList.remove('no-scroll');
      working = null;
      if (lastFocused && lastFocused.focus) { lastFocused.focus(); }
    }

    /* Escape used to close the panel, but now the X is the only exit.
     * Without a focus trap, Tab would walk out of the dialog and into the
     * page behind it, leaving keyboard users stranded with no visible way
     * back. This keeps focus cycling inside the panel instead. */
    function trapFocus(e) {
      if (e.key !== 'Tab' || panel.hidden) { return; }

      var focusable = $$(
        'a[href], button:not([disabled]), input:not([disabled]), ' +
        'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        panel
      ).filter(function (el) {
        /* Skip anything hidden or collapsed (e.g. an inactive tab pane). */
        return el.offsetParent !== null;
      });

      if (!focusable.length) { return; }

      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (e.shiftKey && doc.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && doc.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    /* ---------- fill the form from `working` ---------- */
    function fillForm() {
      $$('[data-bind]').forEach(function (node) {
        var path = node.dataset.bind.split('.');
        var value = working[path[0]];
        if (path.length > 1 && value) { value = value[path[1]]; }
        if (node.tagName === 'TEXTAREA') {
          node.value = Array.isArray(value) ? value.join('\n') : (value || '');
        } else {
          node.value = value == null ? '' : value;
        }
      });

      var preview = $('#adLogoPreview');
      if (preview) { preview.setAttribute('src', logoData || Store.DEFAULT_LOGO); }

      buildFeatureList();
      buildQuickList();
      buildSocialList();
    }

    /* ---------- contact button list ---------- */
    function buildQuickList() {
      var box = $('#adQuick');
      if (!box) { return; }
      box.textContent = '';

      (working.contactQuick || []).forEach(function (item, i) {
        box.appendChild(buildQuickRow(item, i, function (index) {
          working.contactQuick.splice(index, 1);
          buildQuickList();
        }));
      });
    }

    /* ---------- feature list ---------- */
    function buildFeatureList() {
      var box = $('#adFeatures');
      if (!box) { return; }
      box.textContent = '';

      (working.features || []).forEach(function (item, i) {
        box.appendChild(buildFeatureRow(item, i, function (index) {
          working.features.splice(index, 1);
          buildFeatureList();
        }));
      });
    }

    /* ---------- social list ---------- */
    function buildSocialList() {
      var box = $('#adSocials');
      if (!box) { return; }
      box.textContent = '';

      (working.socials || []).forEach(function (item, i) {
        box.appendChild(buildSocialRow(item, i, function (index) {
          working.socials.splice(index, 1);
          buildSocialList();
        }));
      });
    }

    /* ---------- collect the form back into `working` ---------- */
    function collect() {
      $$('[data-bind]').forEach(function (node) {
        var path = node.dataset.bind.split('.');
        if (path.length === 2) {
          working[path[0]][path[1]] = node.value;
        } else {
          working[path[0]] = node.value;
        }
      });

      /* Textareas: one line per item, blanks dropped. */
      working.about.body = ($('#ad-about-body').value || '')
        .split('\n').map(function (s) { return s.trim(); })
        .filter(Boolean);

      working.about.points = ($('#ad-about-points').value || '')
        .split('\n').map(function (s) { return s.trim(); })
        .filter(Boolean);

      /* Repeatable rows. */
      working.features = $$('#adFeatures .repeat-row').map(function (row) { return row._get(); })
        .filter(function (f) { return (f.title || '').trim(); });

      working.socials = $$('#adSocials .repeat-row').map(function (row) { return row._get(); })
        .filter(function (s) { return (s.name || '').trim() || (s.url || '').trim(); });

      working.contactQuick = $$('#adQuick .repeat-row').map(function (row) { return row._get(); })
        .filter(function (q) { return (q.label || '').trim(); });

      working.logo = logoData || Store.DEFAULT_LOGO;
      working.logoDark = logoDataDark || logoData || Store.DEFAULT_LOGO_DARK;
      return working;
    }


    /* ---------- actions ---------- */
    /* Save sends the collected content to PUT /api/content. The Express
       server writes it to SQLite, so the change is now global. The existing
       form, preview, buttons and success toast all behave as before. */
    function save() {
      /* The very first open can be pressed before GET /api/content has
         answered. Wait for it rather than saving a half-built object. */
      if (!working) {
        Store.ready().then(function () {
          working = Store.load();
          logoData = working.logo;
          logoDataDark = working.logoDark || working.logo;
          save();
        });
        return;
      }

      var data = collect();

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.setAttribute('aria-busy', 'true');
      }

      Store.save(data).then(function () {
        Render.apply(data);
        /* The grid was rebuilt, so re-attach the "coming soon" handlers. */
        if (global.LumiereRefresh) { global.LumiereRefresh(); }
        /* Saving keeps the panel open so you can keep tweaking. The X is
           the only way out, so closing here would be inconsistent. */
        notify('Changes saved');
      }).catch(function (err) {
        /* Nothing is pretended and nothing is lost: the edited values stay in
           the form so the admin can fix the problem and press Save again. */
        notify((err && err.message) || 'Failed to save content. Please try again.');
      }).then(function () {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.removeAttribute('aria-busy');
        }
      });
    }

    function resetAll() {
      if (!global.confirm('Reset everything back to the original content?\n\nThis clears your saved logo, introduction and social links.')) {
        return;
      }
      Store.clear().then(function () {
        location.reload();
      }).catch(function (err) {
        notify((err && err.message) || 'Could not reset the content. Please try again.');
      });
    }

    function switchTab(name) {
      $$('.admin-tab', panel).forEach(function (t) {
        var on = t.dataset.tab === name;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      $$('.admin-pane', panel).forEach(function (p) {
        p.classList.toggle('is-active', p.dataset.pane === name);
      });
    }

    /* ---------- wiring ---------- */
    function init() {
      /* The X in the header is the ONLY way to close the panel.
         Deliberately not wired up: the Cancel button, the Escape key and
         a tap on the backdrop. An accidental tap on the dimmed area used
         to throw away edits without warning, so closing is now always
         an explicit, labelled action. */
      $('#adminClose').addEventListener('click', close);
      $('#adminSave').addEventListener('click', save);
      $('#adminResetAll').addEventListener('click', resetAll);

      saveBtn = $('#adminSave');

      /* Remember that the admin started editing, so a slow content response
         cannot overwrite what they have already typed. */
      panel.addEventListener('input', function () { touched = true; });

      /* Keep Tab inside the panel, so the X is always reachable. */
      doc.addEventListener('keydown', trapFocus);

      $$('.admin-tab', panel).forEach(function (tab) {
        tab.addEventListener('click', function () { switchTab(tab.dataset.tab); });
      });

      /* add rows */
      var addFeature = $('#adFeatureAdd');
      if (addFeature) {
        addFeature.addEventListener('click', function () {
          working.features = working.features || [];
          working.features.push({ icon: 'store', title: 'New card', text: '' });
          buildFeatureList();
        });
      }

      var addQuick = $('#adQuickAdd');
      if (addQuick) {
        addQuick.addEventListener('click', function () {
          working.contactQuick = working.contactQuick || [];
          working.contactQuick.push({
            label: 'New button', sub: '', url: '', kind: 'custom', icon: 'phone'
          });
          buildQuickList();
        });
      }

      var addSocial = $('#adSocialAdd');
      if (addSocial) {
        addSocial.addEventListener('click', function () {
          working.socials = working.socials || [];
          working.socials.push({ name: 'New link', url: '', icon: 'share', sub: '' });
          buildSocialList();
        });
      }

      /* logo upload */
      var pick = $('#adLogoPick');
      var file = $('#adLogoFile');
      if (pick && file) {
        pick.addEventListener('click', function () { file.click(); });
        file.addEventListener('change', function () {
          var f = file.files && file.files[0];
          if (!f) { return; }
          readImage(f, 512).then(function (dataUrl) {
            /* An upload applies to both themes, so fill both slots. */
            logoData = dataUrl;
            logoDataDark = dataUrl;
            var preview = $('#adLogoPreview');
            if (preview) { preview.setAttribute('src', dataUrl); }
            notify('Logo ready — press Save to apply');
          }).catch(function (err) {
            notify(err.message || 'Could not read that image');
          }).then(function () {
            file.value = '';
          });
        });
      }

      var logoReset = $('#adLogoReset');
      if (logoReset) {
        logoReset.addEventListener('click', function () {
          logoData = Store.DEFAULT_LOGO;
          logoDataDark = Store.DEFAULT_LOGO_DARK;
          var preview = $('#adLogoPreview');
          if (preview) { preview.setAttribute('src', Store.DEFAULT_LOGO); }
        });
      }
    }

    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

    return { open: open, close: close };
  })();

  global.LumiereAdmin = Admin;

})(window);

