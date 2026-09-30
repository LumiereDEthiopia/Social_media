# Lumière Perfume — Social Link Hub

A single-page website that puts **every Lumière Perfume social media link in one
place**, along with an introduction to the fragrance house.

Built with **plain HTML, CSS and JavaScript** for the front end. The admin's
content is stored in a **hosted PostgreSQL** database and reached through a
small **Vercel serverless function**. No React, no Tailwind, no build step.

---

## Project structure

```
Social Media link/
├── index.html          # The whole page (header, hero, about, social, contact, footer, admin)
├── css/
│   └── style.css       # All styling, incl. light + dark themes + admin panel
├── js/
│   ├── store.js        # Default content + API read/write
│   ├── render.js       # Paints saved content onto the page
│   ├── admin.js        # Hidden admin panel (7-tap unlock)
│   └── main.js         # Theme, nav, share, copy, vCard, reveal
├── api/
│   └── content.js      # Vercel function: GET / PUT / reset, backed by PostgreSQL
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
number once and every button stays in sync. The default is
`+251963992222`; type the number in international form (a leading `+` and
the country code) and WhatsApp converts it automatically. If you leave the
number blank, those buttons go grey, show "Not set up yet" and do nothing
when tapped — the rest keep working.

> The "first one is highlighted" — keep the phone button at the top of the
> list, since it gets the gold treatment.

### Where your data lives

Everything is stored in a **hosted PostgreSQL** database. When the admin
presses **Save changes**, the content is sent to `PUT /api/content`, written
to the database, and every visitor gets the new version on their next page
load.

That means:

- Changes show for **every visitor**, on every device and browser.
- They survive a refresh, a browser restart, a cold start and a redeploy.
- Clearing your browser data no longer erases them.

The table is created and seeded with the original content the first time the
API runs. From then on the database is the only source of truth — the
shipped defaults are never written back over your changes.

> If a browser that saved content under the old `localStorage` setup visits the
> site, that content is handed to the database once so it is not lost. It is
> only used while the database is still untouched, so a stale browser can never
> roll back something you have since saved properly.

---

## API

`api/content.js` is a Vercel serverless function. It does not listen on a
port and does not use local files.

| Method | Endpoint | What it does |
| --- | --- | --- |
| `GET` | `/api/content` | Returns the current content: `{ success, data, updatedAt }` |
| `PUT` | `/api/content` | Replaces the content. Body is the content object. Returns `{ success, message, data, updatedAt }` |
| `POST` | `/api/content/reset` | Restores the original content ("Reset everything") |

The page and the API are on the same domain, so the frontend uses the
relative path `/api/content` and no CORS configuration is needed.

The whole website content is **one record** in **one table**:

```sql
CREATE TABLE IF NOT EXISTS content (
  id         INTEGER PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`id` is always `1` and `data` holds the existing content object exactly as
`js/store.js` defines it — no new content model was invented.

---

## Running it locally

```bash
npm install
npx vercel dev
```

`vercel dev` runs the site and the function together, exactly as Vercel does
in production. Point `POSTGRES_URL` at any hosted PostgreSQL (a free Neon or
Supabase database works) and the whole flow behaves identically to the
deployed site.

> **The site must be served by Vercel**, not opened as a file and not put on
> a static host like GitHub Pages. Saved content lives in the PostgreSQL
> database, so if there is no API behind the page the admin's change can only
> ever be seen in that one browser. If that happens the admin panel says
> *"No server found"* and refuses to pretend it saved. When the Vercel
> function is running, every visitor sees every change.

---

## Deploying to Vercel

The project is ready as-is — there is no build step and no start command.

| Setting | Value |
| --- | --- |
| Framework preset | **Other** |
| Build command | *(leave empty)* |
| Install command | `npm install` |
| Output directory | *(leave empty)* |

Vercel serves `index.html`, `css/`, `js/`, `icon/` and `profile/` as static
files and turns `api/content.js` into a serverless function at
`/api/content`.

### Connect the database

Vercel has no persistent disk, so the database must be external. The quickest
route is Vercel's own:

1. **Vercel dashboard → Storage → Create Database** (choose Postgres)
2. Vercel creates `POSTGRES_URL` for you automatically.

Any hosted PostgreSQL works too (Neon, Supabase, RDS). Put its **pooled**
connection string in `POSTGRES_URL` in
**Project → Settings → Environment Variables**. Nothing is hard-coded and no
credentials are committed.

Then deploy. The `content` table is created and seeded with the default
content on the first request, and never overwritten afterwards.

---

## Before you go live — checklist

The site is ready to go live, but **four things must be set first.** They are
not bugs; they are values only you know.

### 1. Replace the placeholder handles

The Instagram and TikTok links are already set to the real accounts:

- **Instagram** — `instagram.com/lumiere_perfumeet`
- **TikTok** — `tiktok.com/@yeab645`

Still placeholders: the `brand.handle` line, and the Telegram, Pinterest,
Facebook and YouTube URLs. The fastest way to change anything is the
admin panel (7-tap the footer logo) rather than editing code:

- **Brand tab** → set the phone. The Call, WhatsApp and Map buttons all
  build themselves from it, so you only type it once.
- **Contact buttons** → paste the real Telegram, Instagram and TikTok URLs.
- **Social links** → the same for the full social grid.

Then **Save changes**. The content is written to the SQLite database and
every visitor sees it. If you later press **Reset everything**, the site
goes back to the defaults in `js/store.js` — which is where the phone
number `+251963992222` is defined, so a reset always restores it.

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

> **Note:** the Instagram and TikTok links are the real accounts. The
> remaining handles in the file (`lumiereperfume` for the `brand.handle`
> line, Telegram, Pinterest, Facebook and YouTube) are still
> **placeholders**. The phone number (`+251963992222`) is already set.

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
