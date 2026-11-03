/*
 * theme.js — runs synchronously in <head> (before first paint) to:
 *  1. apply the saved light/dark theme, so there is no flash of the wrong theme
 *  2. flag that JavaScript is available (enables reveal animations in CSS)
 * Kept as an external file so the Content-Security-Policy can stay strict (no inline scripts).
 */
(function () {
  var root = document.documentElement;
  var theme = 'dark'; // dark is the default look
  try {
    var saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch (e) { /* storage blocked: keep default */ }
  root.setAttribute('data-theme', theme);
  root.classList.add('js');
})();
