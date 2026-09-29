# Lumière Perfume — Social Link Hub

A single-page website that puts **every Lumière Perfume social media link in one
place**, along with an introduction to the fragrance house.

Built with **plain HTML, CSS and JavaScript only** — no React, no Tailwind,
no build step, no `npm install`. Just open `index.html` in a browser.

---

## Project structure

```
Social Media link/
├── index.html          # The whole page (header, hero, about, social, contact, footer, admin)
├── css/
│   └── style.css       # All styling, incl. light + dark themes + admin panel
├── js/
│   ├── store.js        # Default content + localStorage read/write
│   ├── render.js       # Paints saved content onto the page
│   ├── admin.js        # Hidden admin panel (7-tap unlock)
│   └── main.js         # Theme, nav, share, copy, vCard, reveal
├── icon/               # 36 standalone SVG icons
└── profile/            # Logo / monogram images
```

### The logo files

| File | Used for |
| --- | --- |
| `lumiere-monogram.png` | Default logo — the gold **LP** mark (light theme) |
| `lumiere-monogram-dark.png` | Same mark, lightened so it reads on the dark theme |
| `lumiere-logo.png` | Full lockup: monogram **+** "LUMIERE PERFUME" wordmark |
| `lumiere-logo-on-dark.png` | Full lockup, lightened for the dark theme |
| `favicon.png` / `apple-touch-icon.png` | Browser tab and iOS home screen |

The site swaps between the light and dark logo automatically when you flip the
theme. If you upload your own logo in the admin panel, that image is used on
both themes.

---

## Admin panel (add / edit / delete)

**To open it: tap the Lumière logo in the footer 7 times in a row.**

You get a hint after the 4th tap, and the count resets if you pause for
more than 2.5 seconds. (Keyboard users can focus it and press Enter 7 times.)

It has four tabs:

| Tab | What you can change |
| --- | --- |
| **Brand** | Upload or reset the logo, brand name, handle, tagline, location, phone number |
| **Introduction** | Section title, lead line, the paragraphs, the bullet points, and add/remove feature cards |
| **Contact buttons** | Add, edit, reorder and delete the contact buttons — label, caption, URL and icon. These appear in **two** places: the large buttons in the Contact section, and the small round icons on the profile card. |
| **Social links** | Add, edit and delete any social link — name, URL, caption and which icon it uses |

Press **Save changes** to apply. The page updates immediately and the panel
stays open, so you can keep tweaking.

**To close the panel, click the ✕ button in the top-right corner.** That is
the only way out — a tap on the dimmed background, the Escape key and a
Cancel button are all deliberately disabled, so you cannot lose your edits
by tapping the panel by accident.

### Call, WhatsApp and map links

The **Call**, **WhatsApp** and **Map** buttons build their link from the
phone number and location on the Brand tab, so you only ever type the
number once and every button stays in sync. Enter the dial number in
digits only (`0911000000`) and WhatsApp converts it to international form
automatically. If you leave the number blank, those buttons go grey, show
"Not set up yet" and do nothing when tapped — the rest keep working.

> The "first one is highlighted" — keep the phone button at the top of the
> list, since it gets the gold treatment.

### Where your data lives

Everything is stored in your browser's `localStorage` under the key
`lumiere-content-v1`. **There is no server and no database.**

That means:

- Changes show on **this device and this browser** only.
- They survive a refresh and a browser restart.
- They are **not** shared with visitors, and not visible on a phone.
- Clearing your browser data ("cookies and site data") erases them.

---

## How to run it

**Option A — just open it**
Double-click `index.html`. Everything works.

**Option B — local server** (recommended, so the share/copy features get a real URL)

```bash
# from inside the "Social Media link" folder
python -m http.server 8000
# then visit http://localhost:8000
```

To publish, upload the entire folder to any static host
(Netlify, Vercel, GitHub Pages, cPanel, Firebase Hosting).

---

## Before you go live — checklist

The site is ready to upload, but **four things must be set first.** They are
not bugs; they are values only you know.

### 1. Replace the placeholder handles and phone number

`lumiereperfume` and `0911 000 000` are placeholders. The fastest way is the
admin panel (7-tap the footer logo) rather than editing code:

- **Brand tab** → set the real phone. The Call, WhatsApp and Map buttons all
  build themselves from it, so you only type it once.
- **Contact buttons** → paste the real Telegram, Instagram and TikTok URLs.
- **Social links** → the same for the full social grid.

Then **Save changes**. Everything is written to your browser, so remember
the point in **§ Where your data lives** below: those edits live on this
device only and are not what your visitors see. Visitors always get the
content in `index.html` and `js/store.js`, so to publish a change for
everyone, edit those two files as well.

### 2. Make the share image absolute

`og:image` and the JSON-LD `image` are **relative** paths. Facebook,
WhatsApp, X and LinkedIn require a **full URL** or the preview will show no
image. In `index.html`:

```html
<meta property="og:image" content="https://YOUR-DOMAIN.com/profile/lumiere-monogram.png" />
```

Do the same for the `"image"` line in the JSON-LD block, and add
`<meta property="og:url" content="https://YOUR-DOMAIN.com/" />`.

For a square preview that is not cropped awkwardly, prefer
`profile/apple-touch-icon.png` or the full lockup
`profile/lumiere-logo.png` (1800×1800 works well) over the monogram.

### 3. Optional — delete the unused lockups

`profile/lumiere-logo.png` and `profile/lumiere-logo-on-dark.png` (≈350 KB
together) are **not referenced by the page** — only the monograms are. Keep
them if you want to use one as a share image (see step 2), otherwise they
are dead weight on every page load. The monograms are already sized in the
HTML (`width`/`height` set), so there is no layout shift.

### 4. Optional — raise the share card size

```html
<meta name="twitter:card" content="summary_large_image" />
```

Uses more space in a tweet/X post. `summary` (the current value) is smaller
and safer.

---

## Editing the content

All text and links live directly in `index.html` — search for what you want to change.

### Change a social link
Find the card in the `<!-- SOCIAL LINKS -->` section and edit its `href`:

```html
<a class="social-card sc-instagram reveal" href="https://www.instagram.com/YOUR-HANDLE">
```

> **Note:** the handles currently in the file (`lumiereperfume`, and the phone
> number `0911 000 000`) are **placeholders**. Replace them with the real
> Lumière Perfume profiles and phone number before going live.

### Turn on a "coming soon" channel
A social card with an empty URL is treated as "coming soon": it stays visible
but does not navigate, and shows a *Coming soon* label. Paste the real URL into
that row in the admin panel and save, and the dimmed look disappears.

### Change the colours
Every colour is a CSS variable at the top of `css/style.css` (section 1).
The palette is a champagne-gold ramp sampled from the logo:

```css
:root {
  --brand-500: #c69a3f;   /* the house gold */
  --brand-700: #8a6322;   /* light-theme accent */
}
```

Change `--brand-700` to rebrand the whole page. Supporting tones
(`--rose-*`, `--plum-*`, `--bronze-*`) colour the feature and contact tiles.

### Change the logo
Drop your image into `profile/` and update the `<img src="profile/...">` paths
in `index.html`. To have a different mark on the dark theme, add a second file
and point `logoDark` in `js/store.js` at it.

- "Reset everything" in the panel restores the original content.

> **To publish your changes to everyone**, open the panel, then copy your
> content into the matching defaults in `js/store.js` (`DEFAULTS`) and the
> static markup in `index.html`. That writes the changes into the site itself.

### Change the unlock

In `js/admin.js`, edit the numbers near the top of the trigger:

```js
var REQUIRED = 7;    // taps needed to open the admin panel
var WINDOW  = 2500;  // ms of inactivity before the count resets
var HINT_AT = 4;     // start showing a hint after this many taps

---

## What the page includes

| Feature | Notes |
| --- | --- |
| **Profile hero** | Logo, handle, tagline, location, stats, quick actions |
| **House introduction** | "Our story" section plus four feature cards |
| **Social grid** | 8 channels in one grid — the core of the page |
| **Contact section** | Call, SMS, directions, copy-number |
| **Light / dark theme** | Follows the OS by default, remembers your choice |
| **Share sheet** | Native OS share on mobile, plus WhatsApp / Telegram / Facebook / X / copy link |
| **Save contact** | Downloads a `.vcf` file you can import into your phone |
| **Scroll reveal** | Cards fade in as you scroll |
| **Accessibility** | Skip link, ARIA labels, keyboard support, `prefers-reduced-motion` |
| **Responsive** | Mobile nav, fluid grids, tested down to 360px |
| **SEO** | Meta description, Open Graph tags, JSON-LD `Organization` schema |

---

## Icons

The 36 SVGs in `icon/` are rendered with CSS `mask-image`, so they automatically
inherit `currentColor` and adapt to both themes. To add a new one:

1. Drop `myicon.svg` into `icon/`.
2. Add a rule to `css/style.css`:

```css
.ico-myicon { -webkit-mask-image: url("../icon/myicon.svg"); mask-image: url("../icon/myicon.svg"); }
```

3. Use it: `<span class="ico ico-myicon"></span>`

The icon list offered in the admin panel lives in `ICON_CHOICES` in
`js/store.js` — add the new name there too if you want it in the picker.

---

## Notes

- The page works fully **with JavaScript disabled** — all links still function;
  JS only adds the theme switch, sharing, copying and animations.
- The Google Fonts link is the only external request. If the site is used fully
  offline, delete that `<link>` and the page falls back to system fonts.
- Typography is Cormorant Garamond (display) and Jost (body), both from
  Google Fonts.

```
