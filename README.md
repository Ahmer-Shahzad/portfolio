# Muhammad Ahmer Shahzad: Portfolio

A personal portfolio site: six compact sections over one persistent 3D scene (Three.js) that follows the scroll, with GSAP ScrollTrigger motion. It's plain HTML, CSS and vanilla JavaScript with **no build step**. Three.js and GSAP are self-hosted in `js/vendor/`, so there's nothing to install for the site itself. It deploys as-is on Netlify's free tier.

```
/
├── index.html            ← all page content lives here
├── 404.html              ← custom "page not found" page
├── netlify.toml          ← publish settings, security headers, blocks /tools
├── css/style.css         ← design system (tokens) at the top, then components
├── js/theme.js           ← theme + intro decision before first paint
├── js/main.js            ← interactions, tabs, gallery, form, GSAP motion, loads the scene
├── js/scene.js           ← the persistent 3D scene (loaded lazily after first paint)
├── js/vendor/            ← three.module.min.js (r160), gsap.min.js + ScrollTrigger.min.js (3.12.5)
├── tools/                ← local screenshot script (NOT part of the site, see below)
└── assets/
    ├── favicon.svg
    ├── Muhammad_Ahmer_Shahzad_CV_Public.pdf   ← your CV ("Download CV" links)
    ├── printflow/*.webp                       ← PrintFlow screenshots (generated)
    ├── og-image.png                           ← social preview image (generated)
    └── flyboys-certificate.jpg                ← TODO: add this file
```

## Page structure

| # | Section | Notes |
|---|---|---|
| | Hero | Status line, name, typed role line, one tagline, View Projects + Download CV |
| 01 | About + Experience | Short bio, quick facts, two-item timeline |
| 02 | Skills | Category tabs (keyboard: arrow keys) + a draggable 3D sphere of skill icons |
| 03 | Work | Pinned horizontal showcase on screens ≥ 1024 × 780 px; a vertical stack elsewhere |
| 04 | Education + honours | Compact list + 2 × 2 certification grid |
| 05 | Contact | Email, CV, socials, Netlify form |

A short intro (under 1.3 s) plays once per browser session and is skipped with a click or any key. Section dots on the right (≥ 900 px wide) jump between sections.

## Editing content

All text is in **`index.html`**. Each section starts with a comment banner such as `<!-- ============ 03 PROJECTS ... ============ -->`.

- **Typing line:** the `data-type` attribute in the hero (keep the visible and `sr-only` copies the same).
- **Skills:** each `<li data-skill="s-…" data-cat="…">` in the tab panels. The 3D sphere builds itself from these items (icon = `data-skill`, label = text, highlight group = `data-cat`), so a skill added here appears on the sphere too. Icons are the `#s-…` symbols in the sprite at the top of the page. Also add the icon to `.orbit-fallback`, the static ring shown without WebGL.
- **Projects:** one `<article class="project">` per project, structured as Problem / What I built / Stack / My role.
- **AA Graphics:** the two upcoming websites have `TODO` comments. Replace "Coming soon" and "Stack to be announced". When they ship, remove the `badge` and the `project--wip` class.
- **CV:** replace `assets/Muhammad_Ahmer_Shahzad_CV_Public.pdf`, keeping the same name. The hero, navbar and contact links all point to it and download as `Muhammad-Ahmer-Shahzad-CV.pdf`.

**Design system** (top of `css/style.css`):
- Spacing uses an 8px scale (`--s1` = 8px … `--s8` = 128px), with one type scale (`--t-xs` … `--t-hero`) and two typefaces (Space Grotesk, Inter).
- Colours: one accent (`--accent`, cyan) and one neutral (`--muted`, slate) on the navy base.
- Radii are `--r-sm/md/lg`, there are two shadow levels (`--sh-1`, `--sh-2`), and one easing curve (`--ease`).
- Light-theme overrides sit in `:root[data-theme="light"]`.
- The 3D palette and section states are at the top of `js/scene.js`.

## The 3D scene

`js/scene.js` draws one fixed, full-viewport canvas behind the page. Each section has a state (camera position, which objects show, how far the shards split, where the particles gather), and the scroll position blends between them. Objects are positioned on invisible `data-anchor` boxes in the HTML, so they stay aligned with the layout at any screen size.

- Loads after first paint when the browser is idle. On phones and low-power devices it waits for the first touch or scroll and uses a lighter scene with no post-processing.
- Pixel ratio is capped (≤ 2), and rendering pauses while the tab is hidden.
- Without WebGL, or with `prefers-reduced-motion`, there's no 3D at all. A CSS gradient, a static orb and a static icon ring show instead, with no GSAP and no pinning.

## PrintFlow screenshots

Until screenshots exist, the gallery shows an animated app skeleton ("Screenshots coming soon") and **requests no images**, so there are no 404s. To add them:

1. Make sure the PrintFlow folder is readable from your account (e.g. `C:\Users\Ahmer\Desktop\AA Graphics PC Software`).
2. Run:
   ```bash
   cd tools
   npm install
   node capture-printflow.mjs "C:\Users\Ahmer\Desktop\AA Graphics PC Software"
   ```
3. In `index.html`, change the gallery's `data-ready="false"` to `data-ready="true"`.

The script opens only `demo\printflow-demo.html` and reads only `web\logo.svg`. It blocks `data\`, `secrets\`, `.env` files and Firebase inside the browser, and never writes into the PrintFlow folder. It signs in as **Sample Owner** and captures five business screens: dashboard, job orders, production board, invoices and quotations. It saves WebP files (2880 px plus a 1440 px version) and `assets/og-image.png`. It needs Google Chrome (or run `npx playwright install chromium` once). If sign-in fails, add `--headed` to watch it.

## Previewing locally

```bash
npx serve .
```

Then open the URL it prints (usually http://localhost:3000). Use a server rather than opening the file directly: the 3D scene and absolute paths need it.

> The contact form only works on Netlify. Locally, submitting it shows the "Something went wrong" message. That's expected.

## Deploying to Netlify

### GitHub-connected (auto-deploys)
1. Push the branch: `git push -u origin redesign`, then open a pull request on GitHub. Netlify builds a **Deploy Preview** link for the PR, and nothing goes live.
2. Merge into `main` to publish. To roll back, revert the merge, or use **Deploys → Publish deploy** on an older deploy.
3. Netlify settings: build command **empty**, publish directory **`.`** (`netlify.toml` already sets both).

### Drag and drop
Drag the whole portfolio folder onto your site's **Deploys** page (you can leave out `tools/node_modules`).

### After deploying
- **Contact form:** submissions appear under **Forms** in Netlify. To get them by email, go to **Site configuration → Forms → Form notifications → Email notification**.
- Spam is filtered by a hidden honeypot field (`bot-field`) plus Netlify's built-in filter.

## Notes
- **Accessibility:** semantic landmarks, skip link, visible focus rings, ARIA tabs (skills and gallery) with arrow-key support, a `<dialog>` lightbox, and every 3D/decorative layer marked `aria-hidden`. All content is in the HTML, so the 3D only adds to it.
- **Security:** `netlify.toml` sends a strict Content-Security-Policy (scripts only from this site). If you add a third-party script later, add its domain to `script-src` and `connect-src`.
- **Privacy:** the site intentionally leaves out phone number, WhatsApp, date of birth, home address, passport number and gender.
