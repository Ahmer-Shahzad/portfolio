#!/usr/bin/env node
/*
 * capture-printflow.mjs: takes fresh PrintFlow screenshots for the portfolio.
 *
 *   cd tools && npm install
 *   node capture-printflow.mjs "C:\path\to\AA Graphics PC Software"   [--out <dir>] [--headed]
 *
 * Safety rules (enforced, not just documented):
 *  - Opens ONLY <PrintFlow>/demo/printflow-demo.html (sample data) and reads ONLY
 *    <PrintFlow>/web/logo.svg. Nothing is ever written into the PrintFlow folder.
 *  - Inside the browser, any request into data/, secrets/ or a .env file is blocked,
 *    and every Firebase / Google backend endpoint is blocked, so no real business
 *    data can load.
 *  - Captures only the 5 business screens below. No HR / attendance / employee /
 *    payroll screens (they show staff names).
 *
 * Output (default: ../assets): printflow/<name>.webp (2880×1800) and
 * printflow/<name>-1440.webp, plus og-image.png (1200×630 combined preview).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROUTES = [
  { hash: '#/overview', name: 'overview', label: 'Business dashboard' },
  { hash: '#/jobs', name: 'jobs', label: 'Job orders' },
  { hash: '#/floor', name: 'floor', label: 'Production board' },
  { hash: '#/invoices', name: 'invoices', label: 'Sales invoices' },
  { hash: '#/quotes', name: 'quotes', label: 'Quotations' }
];
const ACCOUNT = 'Sample Owner';

// ---- arguments --------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : null; };
const pfRoot = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
if (!pfRoot) {
  console.error('Usage: node capture-printflow.mjs "<PrintFlow folder>" [--out <dir>] [--headed]');
  process.exit(1);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const outRoot = path.resolve(opt('--out') || path.join(here, '..', 'assets'));
const demoFile = path.resolve(pfRoot, 'demo', 'printflow-demo.html');
const logoFile = path.resolve(pfRoot, 'web', 'logo.svg');
for (const f of [demoFile, logoFile]) {
  if (!fs.existsSync(f)) { console.error('Not found: ' + f); process.exit(1); }
}
const logoDataUri = 'data:image/svg+xml;base64,' + fs.readFileSync(logoFile).toString('base64');
const demoUrl = pathToFileURL(demoFile).href;
const pfRootUrl = pathToFileURL(path.resolve(pfRoot)).href.toLowerCase();

// ---- request guard ------------------------------------------------------------
const BLOCKED_HOSTS = /(firebaseio\.com|firebaseapp\.com|firebasestorage|firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|firebaseinstallations\.googleapis\.com|firebase\.googleapis\.com|firebaselogging|googleapis\.com\/(?!css))/i;
function isBlocked(url) {
  const u = url.toLowerCase();
  if (u.startsWith('file:')) {
    const rel = decodeURIComponent(u.startsWith(pfRootUrl) ? u.slice(pfRootUrl.length) : u);
    return /(^|\/)(data|secrets)(\/|$)/.test(rel) || /(^|\/)\.env(\.|$|\/)/.test(rel);
  }
  if (/^https?:/.test(u) && BLOCKED_HOSTS.test(u) && !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(u)) return true;
  return false;
}

// ---- page preparation (runs in the page before its own scripts) -----------------
function initScript(logo) {
  const css = '#demo-bar{display:none!important}' +
    '[class*="toast" i],[id*="toast" i],[class*="snackbar" i],[class*="notification" i][role="status"]{display:none!important}';
  const swapLogos = () => {
    document.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (/(^|\/)logo\.svg(\?|#|$)/i.test(src) && src !== logo) img.setAttribute('src', logo);
    });
  };
  const addStyle = () => {
    if (document.getElementById('__capture-style')) return;
    const s = document.createElement('style');
    s.id = '__capture-style';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  };
  new MutationObserver(() => { addStyle(); swapLogos(); })
    .observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  document.addEventListener('DOMContentLoaded', () => { addStyle(); swapLogos(); });
}

async function signInIfNeeded(page) {
  const pwd = page.locator('input[type="password"]:visible').first();
  if (!(await pwd.count())) return;

  // 1) many demo pages let you click a listed account to fill / sign in
  const acct = page.locator(`text=${ACCOUNT} >> visible=true`).first();
  if (await acct.count()) {
    await acct.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(600);
    if (!(await page.locator('input[type="password"]:visible').count())) return; // signed in already
  }

  // 2) otherwise read the demo account list from the page and fill the form
  // textContent (not innerText): the account list may sit in #demo-bar, which we hide
  const text = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
  const pass = (text.match(/password\s*(?:is|:|=|-)?\s*[`"'“]?([^\s`"'”<,;)]+)/i) || [])[1];
  const at = text.toLowerCase().indexOf(ACCOUNT.toLowerCase());
  const near = at > -1 ? text.slice(at, at + 200) : '';
  const email = (near.match(/[\w.+-]+@[\w-]+\.[\w.-]*\w/) || [])[0];
  const user = email || (near.match(/(?:user(?:name)?|login|id)\s*[:=]\s*([^\s,;)]+)/i) || [])[1];

  if ((await pwd.inputValue()) === '' && pass) await pwd.fill(pass);
  const userField = page.locator('input[type="email"]:visible, input[type="text"]:visible, input:not([type]):visible').first();
  if (user && (await userField.count()) && (await userField.inputValue()) === '') await userField.fill(user);

  await pwd.press('Enter');
  await page.waitForTimeout(1500);
  if (await page.locator('input[type="password"]:visible').count()) {
    throw new Error('Could not sign in as "' + ACCOUNT + '" automatically. Re-run with --headed to see the login screen.');
  }
}

async function closeModals(page) {
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
  const closers = page.locator([
    '[role="dialog"] [aria-label*="close" i]', '.modal [aria-label*="close" i]',
    '.modal .close', '.modal [data-close]', '[role="dialog"] [data-close]', '.modal-close'
  ].join(', '));
  for (let i = 0, n = await closers.count(); i < n; i++) await closers.nth(i).click({ timeout: 500 }).catch(() => {});
  await page.waitForTimeout(300);
}

// ---- main -----------------------------------------------------------------------
const launchOpts = { headless: !flag('--headed') };
let browser;
try { browser = await chromium.launch(launchOpts); }
catch { browser = await chromium.launch({ ...launchOpts, channel: 'chrome' }); } // fall back to installed Chrome

const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
await context.route('**/*', (route) => {
  const url = route.request().url();
  if (isBlocked(url)) { console.log('  blocked: ' + url); return route.abort(); }
  return route.continue();
});
await context.addInitScript(initScript, logoDataUri);

const shots = {};
for (const r of ROUTES) {
  process.stdout.write(`Capturing ${r.label} (${r.hash})… `);
  const page = await context.newPage(); // fresh page load for every screen
  await page.goto(demoUrl, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await signInIfNeeded(page);
  await page.evaluate((h) => { location.hash = h; }, r.hash);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await closeModals(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (!(await page.evaluate(() => location.hash))?.startsWith(r.hash)) throw new Error('Route did not load: ' + r.hash);
  shots[r.name] = await page.screenshot({ type: 'png' });
  await page.close();
  console.log('ok');
}

// ---- encode WebP + build the Open Graph image (Chromium's canvas does the encoding) ----
const tool = await context.newPage();
await tool.setContent('<!doctype html><html><body></body></html>');
fs.mkdirSync(path.join(outRoot, 'printflow'), { recursive: true });

const toB64 = (buf) => 'data:image/png;base64,' + buf.toString('base64');
for (const [name, buf] of Object.entries(shots)) {
  const out = await tool.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const enc = (w) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = Math.round(img.height * (w / img.width));
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', 0.82).split(',')[1];
    };
    return { full: enc(img.width), half: enc(1440) };
  }, toB64(buf));
  fs.writeFileSync(path.join(outRoot, 'printflow', name + '.webp'), Buffer.from(out.full, 'base64'));
  fs.writeFileSync(path.join(outRoot, 'printflow', name + '-1440.webp'), Buffer.from(out.half, 'base64'));
  console.log('Saved printflow/' + name + '.webp + -1440.webp');
}

const og = await tool.evaluate(async (srcs) => {
  const load = async (s) => { const i = new Image(); i.src = s; await i.decode(); return i; };
  const [main, a, b] = await Promise.all([srcs.overview, srcs.jobs, srcs.floor].map(load));
  const W = 1200, H = 630, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  // navy background with cyan glow
  x.fillStyle = '#050912'; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(950, 80, 20, 950, 80, 650);
  g.addColorStop(0, 'rgba(34,211,238,0.28)'); g.addColorStop(1, 'rgba(34,211,238,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // framed screenshot helper
  const frame = (img, dx, dy, dw, rot) => {
    const dh = dw * (img.height / img.width);
    x.save(); x.translate(dx + dw / 2, dy + dh / 2); x.rotate(rot);
    x.shadowColor = 'rgba(0,0,0,0.55)'; x.shadowBlur = 40; x.shadowOffsetY = 18;
    x.fillStyle = '#0a1222'; x.beginPath(); x.roundRect(-dw / 2 - 6, -dh / 2 - 6, dw + 12, dh + 12, 14); x.fill();
    x.shadowColor = 'transparent';
    x.strokeStyle = 'rgba(34,211,238,0.45)'; x.lineWidth = 1.5; x.stroke();
    x.beginPath(); x.roundRect(-dw / 2, -dh / 2, dw, dh, 9); x.clip();
    x.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    x.restore();
  };
  frame(a, 610, 300, 400, 0.06);
  frame(b, 760, 360, 400, -0.04);
  frame(main, 540, 70, 560, -0.03);
  // text
  const grad = x.createLinearGradient(60, 0, 520, 0);
  grad.addColorStop(0, '#38bdf8'); grad.addColorStop(1, '#2dd4bf');
  x.fillStyle = '#e7eef8'; x.font = '600 26px "Segoe UI", Inter, system-ui, sans-serif';
  x.fillText('Muhammad Ahmer Shahzad', 60, 110);
  x.fillStyle = 'rgba(203,216,235,0.75)'; x.font = '400 20px "Segoe UI", Inter, system-ui, sans-serif';
  x.fillText('Junior Full Stack Developer', 60, 142);
  x.fillStyle = grad; x.font = '700 76px "Segoe UI", Inter, system-ui, sans-serif';
  x.fillText('PrintFlow', 56, 300);
  x.fillStyle = '#e7eef8'; x.font = '500 28px "Segoe UI", Inter, system-ui, sans-serif';
  x.fillText('Business Management System', 60, 346);
  x.fillStyle = 'rgba(203,216,235,0.7)'; x.font = '400 18px "Segoe UI", Inter, system-ui, sans-serif';
  x.fillText('React · Next.js · Node.js · Firebase', 60, 392);
  x.fillStyle = 'rgba(203,216,235,0.55)'; x.font = '400 15px Consolas, monospace';
  x.fillText('ahmershahzad.netlify.app  ·  screenshots use sample demo data', 60, 575);
  return c.toDataURL('image/png').split(',')[1];
}, { overview: toB64(shots.overview), jobs: toB64(shots.jobs), floor: toB64(shots.floor) });
fs.writeFileSync(path.join(outRoot, 'og-image.png'), Buffer.from(og, 'base64'));
console.log('Saved og-image.png');

await browser.close();
console.log('\nDone. Files are in ' + outRoot);
