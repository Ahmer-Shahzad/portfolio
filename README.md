# Muhammad Ahmer Shahzad: Portfolio

A personal portfolio site with an editorial, digital-magazine look. It's plain HTML, CSS and vanilla JavaScript, with no build step and no dependencies. It's ready to deploy on Netlify's free tier.

```
/
├── index.html            ← all page content lives here
├── 404.html              ← custom "page not found" page
├── netlify.toml          ← publish settings + security headers
├── css/style.css         ← design tokens (colors, fonts, spacing) at the top
├── js/theme.js           ← applies saved light/dark theme before first paint
├── js/main.js            ← cursor, reveals, terminal, tilt, form, etc.
└── assets/
    ├── favicon.svg
    ├── resume.pdf                 ← your CV (hero, navbar and contact "Download CV" links)
    └── flyboys-certificate.jpg    ← TODO: add this file
```

## Editing content

All text is in **`index.html`**. Each section starts with a comment banner such as `<!-- ============ 03 PROJECTS ============ -->`, so search for those to find things.

| What | Where |
|---|---|
| Hero intro and buttons | `HERO` section |
| About text, quick facts | `01 ABOUT` |
| Terminal lines | the `<ol class="terminal__body">` list. Each `<li>` has a `.t-cmd` (command) and `.t-out` (output). Typing is automatic. |
| Skills marquee | `02 SKILLS`, the `.marquee__list` items. Edit **both** lists the same way; the second is a copy that makes the loop seamless. |
| Skill groups | `.skill-group` cards under the marquee |
| Projects | `03 PROJECTS`, one `<article class="project">` per project |
| Experience / Education / Honours | `04`, `05`, `06` sections |
| Contact details, socials | `07 CONTACT` |
| Interests line | `<footer>` |
| SEO (title, description, social preview, JSON-LD) | `<head>` |

**Updating your CV:** replace `assets/resume.pdf` with the new file, keeping the same name. Three links point to it: the hero button, the "CV" pill in the navbar and the button in the contact section. Each uses `download="Muhammad-Ahmer-Shahzad-CV.pdf"`, so visitors get a cleanly named file. If you rename the PDF, update the `href` on all three (search `index.html` for `resume.pdf`).

**Colors and fonts:** change the CSS variables at the top of `css/style.css` (`--ink`, `--paper`, `--amber`, `--font-display`, …). Light-theme overrides are in the `:root[data-theme="light"]` block just below them.

**Placeholders:** search the project for `TODO` to find everything that still needs real content. On the page, placeholder text uses the `.todo` class (muted italic). Remove the class once you put real text in.

### Adding a project screenshot
In the Flyboys card, replace the `<div class="mock">…</div>` block with:
```html
<img src="assets/flyboys-screenshot.jpg" alt="Flyboys Warehouse customizer screen"
     width="1200" height="800" loading="lazy" decoding="async">
```
Use a compressed JPG or WebP that is 1600px wide at most.

### Filling in AA Graphics
Each `<div class="subproject">` has a `TODO` comment above it. Replace the title, the `.todo` description, the stack chips and the "Link coming soon" text. For a real link, use:
```html
<a class="subproject__link mono" href="https://…" target="_blank" rel="noopener noreferrer">Visit site →</a>
```
When the work is done, remove the `<span class="badge">Work in progress</span>` and the `project--wip` class.

## Previewing locally

Use a local server rather than opening the file directly, so absolute paths and the 404 page behave like they will on Netlify:

```bash
# Python (Windows: use `py` if `python` isn't found)
python -m http.server 8080

# or Node
npx serve .
```

Then open http://localhost:8080.

> The contact form only works on Netlify. Locally, submitting it shows the "Something went wrong" message. That's expected.

## Deploying to Netlify

### Option A: drag and drop
1. Go to https://app.netlify.com/drop.
2. Drag the whole **portfolio folder** (the one containing `index.html`) onto the page.
3. Your site is live at a `*.netlify.app` URL. Rename it under **Site configuration → Change site name**.

### Option B: connect a GitHub repository (auto-deploys on every push)
1. Push this folder to a new GitHub repository.
2. In Netlify: **Add new site → Import an existing project → GitHub**, and pick the repository.
3. Leave the build command **empty** and set the publish directory to **`.`**. `netlify.toml` already sets both.
4. Click **Deploy**.

### After the first deploy
- **Set your real URL:** replace every `https://myportfolio-0188.netlify.app` in `index.html` (canonical, Open Graph, Twitter and JSON-LD) with your live URL, then redeploy.
- **Contact form:** Netlify detects the form automatically (`data-netlify="true"`). Submissions appear under **Forms** in the Netlify dashboard. To get them by email, go to **Site configuration → Forms → Form notifications → Add notification → Email notification**. If submissions don't show up, check that **Forms → Enable form detection** is turned on and redeploy.
- Spam is filtered by a hidden honeypot field (`bot-field`) plus Netlify's built-in filter.

## Notes
- **Accessibility:** semantic landmarks, skip link, visible focus rings, labelled controls, a `<dialog>` lightbox with Esc and backdrop close, and full `prefers-reduced-motion` support. With reduced motion on, animations, the custom cursor and typing are turned off, and the marquee becomes a static list.
- **Custom cursor and tilt** only turn on for mouse/trackpad users, never on touch devices.
- **Security:** `netlify.toml` sends a strict Content-Security-Policy. If you later add a third-party script (analytics, for example), add its domain to `script-src` and `connect-src`, or it will be blocked.
- **Privacy:** the site intentionally leaves out date of birth, home address, passport number and gender.
