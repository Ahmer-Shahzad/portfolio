# Muhammad Ahmer Shahzad: Portfolio

A personal portfolio site with a modern dark look: deep navy, cyan/teal accents, glass cards, an interactive 3D hero (Three.js) and scroll animations (GSAP ScrollTrigger). It's plain HTML, CSS and vanilla JavaScript with **no build step**. Three.js and GSAP are self-hosted in `js/vendor/`, so there's nothing to install for the site itself. It deploys as-is on Netlify's free tier.

```
/
├── index.html            ← all page content lives here
├── 404.html              ← custom "page not found" page
├── netlify.toml          ← publish settings, security headers, blocks /tools
├── css/style.css         ← design tokens (colors, fonts, spacing) at the top
├── js/theme.js           ← applies saved light/dark theme before first paint
├── js/main.js            ← reveals, typing, gallery, cursor, tilt, form, etc.
├── js/hero3d.js          ← the 3D hero scene (loaded lazily after page load)
├── js/vendor/            ← three.module.min.js (r160), gsap.min.js + ScrollTrigger.min.js (3.12.5)
├── tools/                ← local screenshot script (NOT part of the site, see below)
└── assets/
    ├── favicon.svg
    ├── Muhammad_Ahmer_Shahzad_CV_Public.pdf   ← your CV ("Download CV" links)
    ├── printflow/*.webp                       ← PrintFlow screenshots (generated)
    ├── og-image.png                           ← social preview image (generated)
    └── flyboys-certificate.jpg                ← TODO: add this file
```

## Editing content

All text is in **`index.html`**. Each section starts with a comment banner such as `<!-- ============ 03 PROJECTS ============ -->`, so search for those to find things.

| What | Where |
|---|---|
| Hero name, typing line, intro and buttons | `HERO` section. The typing text is the `data-type` attribute (keep the visible and `sr-only` copies the same). |
| About text, quick facts | `01 ABOUT` |
| Terminal lines | the `<ol class="terminal__body">` list. Each `<li>` has a `.t-cmd` (command) and `.t-out` (output). Typing is automatic. |
| Skills | `02 SKILLS`: the `.marquee__list` items (edit **both** lists the same way) and the `.skill` tiles. Each tile uses an icon from the sprite at the top of the page (`#s-…`). |
| Projects | `03 PROJECTS`, one `<article class="project">` per project. PrintFlow is first. |
| Experience / Education / Honours | `04`, `05`, `06` sections |
| Contact details, socials | `07 CONTACT` (no phone number on purpose) |
| Interests line | `<footer>` |
| SEO (title, description, social preview, JSON-LD) | `<head>` |

**Updating your CV:** replace `assets/Muhammad_Ahmer_Shahzad_CV_Public.pdf`, keeping the same name. Three links point to it: the hero button, the navbar button and the contact section button. Each uses `download="Muhammad-Ahmer-Shahzad-CV.pdf"`, so visitors get a cleanly named file. If you rename the PDF, search `index.html` for `CV_Public.pdf` and update all three.

**Colors and fonts:** change the CSS variables at the top of `css/style.css` (`--cyan`, `--teal`, `--bg`, `--grad`, `--font-display`, …). Light-theme overrides are in the `:root[data-theme="light"]` block just below them. The 3D scene has its own palette at the top of `js/hero3d.js`.

**Placeholders:** search the project for `TODO` to find everything that still needs real content.

## PrintFlow screenshots

The gallery in the PrintFlow card shows five screens from the **demo with sample data**. Until the images exist, each slide shows "Screenshot coming soon". To (re)generate them:

```bash
cd tools
npm install                 # once; installs playwright-core
node capture-printflow.mjs "C:\Users\<you>\Desktop\AA Graphics PC Software"
```

It needs Google Chrome installed (or run `npx playwright install chromium` once). What it does:

- Opens only `demo\printflow-demo.html` and reads only `web\logo.svg`. It never writes into the PrintFlow folder.
- Blocks, inside the browser, any request into `data\`, `secrets\` or a `.env` file, and every Firebase backend, so no real business data can load.
- Signs in as **Sample Owner**, then loads each screen fresh at 1440×900 (2× pixel density): `#/overview`, `#/jobs`, `#/floor`, `#/invoices`, `#/quotes`. It hides `#demo-bar` and toasts, closes modals, and swaps the broken `/logo.svg` for the real logo. No HR, attendance, employee or payroll screens.
- Saves `assets/printflow/<screen>.webp` (2880 px) and `<screen>-1440.webp`, plus `assets/og-image.png` (1200×630 combined preview for link sharing).

If sign-in fails, run it with `--headed` to watch the browser. `tools/` is blocked from being served by `netlify.toml`. If you deploy by drag-and-drop, you can leave `tools/node_modules` out.

## Previewing locally

Use a local server rather than opening the file directly (the 3D scene and absolute paths need it):

```bash
# Python (Windows: use `py` if `python` isn't found)
python -m http.server 8080

# or Node
npx serve .
```

Then open http://localhost:8080.

> The contact form only works on Netlify. Locally, submitting it shows the "Something went wrong" message. That's expected.

## Deploying to Netlify

### Option A: GitHub-connected (auto-deploys on every push)
1. Push the repository to GitHub.
2. In Netlify: **Add new site → Import an existing project → GitHub**, and pick the repository.
3. Leave the build command **empty** and set the publish directory to **`.`**. `netlify.toml` already sets both.
4. Click **Deploy**. Every push to the production branch (usually `main`) redeploys the site.

### Option B: drag and drop
1. Go to https://app.netlify.com/drop, or open your site's **Deploys** tab.
2. Drag the whole **portfolio folder** (the one containing `index.html`) onto the page.

### After deploying
- **Contact form:** Netlify detects the form automatically (`data-netlify="true"`). Submissions appear under **Forms** in the Netlify dashboard. To get them by email, go to **Site configuration → Forms → Form notifications → Add notification → Email notification**. If submissions don't show up, check that **Forms → Enable form detection** is turned on and redeploy.
- Spam is filtered by a hidden honeypot field (`bot-field`) plus Netlify's built-in filter.

## Notes
- **Performance:** Three.js (~170 KB gzipped) loads only after the page has finished loading and the browser is idle. It pauses when the hero is off-screen and uses fewer particles and a lower resolution on phones. GSAP loads right after the page. Screenshots are lazy-loaded WebP with 1440 px and 2880 px versions.
- **Accessibility:** semantic landmarks, skip link, visible focus rings, labelled controls, keyboard-friendly gallery tabs (arrow keys), a `<dialog>` lightbox with Esc and backdrop close. With `prefers-reduced-motion`, there's no 3D scene (a static orb shows instead), no GSAP, no typing, cursor or tilt, the mockup sits flat and the marquee becomes a static list.
- **Custom cursor and tilt** only turn on for mouse/trackpad users, never on touch devices.
- **Security:** `netlify.toml` sends a strict Content-Security-Policy (scripts only from this site). If you later add a third-party script (analytics, for example), add its domain to `script-src` and `connect-src`, or it will be blocked.
- **Privacy:** the site intentionally leaves out phone number, date of birth, home address, passport number and gender.
