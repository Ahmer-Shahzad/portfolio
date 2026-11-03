/*
 * main.js: all interactions for the portfolio. Vanilla JS, no dependencies.
 * Every feature checks that its elements exist, so this file also runs on 404.html.
 *
 *  1. Helpers + environment flags
 *  2. Footer year
 *  3. Theme toggle
 *  4. Hero name split + load reveal
 *  5. Scroll progress + navbar state
 *  6. Active section highlight
 *  7. Scroll reveals
 *  8. Mobile menu
 *  9. Custom cursor + magnetic elements
 * 10. Project card tilt
 * 11. Terminal typing
 * 12. Certificate lightbox
 * 13. Contact form (Netlify Forms via fetch)
 */
(function () {
  'use strict';

  /* 1. Helpers ----------------------------------------------------------- */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* 2. Footer year ------------------------------------------------------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* 3. Theme toggle ------------------------------------------------------ */
  var themeBtn = $('.theme-toggle');
  var themeMeta = $('meta[name="theme-color"]');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.setAttribute('content', theme === 'light' ? '#f3efe6' : '#0b0b0f');
    if (themeBtn) themeBtn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  }
  applyTheme(root.getAttribute('data-theme') || 'dark');

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked */ }
    });
  }

  /* 4. Hero name split ----------------------------------------------------
     Wraps each letter in a span with an index (--i) used for the stagger delay. */
  var charIndex = 0;
  $$('[data-split]').forEach(function (el) {
    var text = el.textContent;
    el.textContent = '';
    for (var i = 0; i < text.length; i++) {
      var span = document.createElement('span');
      span.className = 'char';
      span.textContent = text[i];
      span.style.setProperty('--i', charIndex++);
      el.appendChild(span);
    }
  });
  // two frames so the initial (hidden) state is painted before animating in
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { root.classList.add('is-loaded'); });
  });

  /* 5. Scroll progress + navbar ----------------------------------------- */
  var bar = $('.progress__bar');
  var nav = $('.nav');
  var ticking = false;

  function onScroll() {
    var max = root.scrollHeight - window.innerHeight;
    var p = max > 0 ? window.scrollY / max : 0;
    if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 24);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* 6. Active section highlight ----------------------------------------- */
  var navLinks = $$('.nav__links a[href^="#"]');
  if (navLinks.length && 'IntersectionObserver' in window) {
    var linkFor = {};
    navLinks.forEach(function (a) { linkFor[a.getAttribute('href').slice(1)] = a; });

    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
        var link = linkFor[entry.target.id];
        if (link) { link.classList.add('is-active'); link.setAttribute('aria-current', 'true'); }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    Object.keys(linkFor).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) sectionObserver.observe(section);
    });
    // the hero has no nav link, so reaching it clears the highlight
    var hero = $('.hero');
    if (hero) sectionObserver.observe(hero);
  }

  /* 7. Scroll reveals ---------------------------------------------------- */
  var revealEls = $$('[data-reveal]');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  /* 8. Mobile menu ------------------------------------------------------- */
  var menuBtn = $('.nav__toggle');
  if (menuBtn && nav) {
    var setMenu = function (open) {
      nav.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    menuBtn.addEventListener('click', function () {
      setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
    });
    navLinks.forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
    });
    // close the panel if the viewport grows into the desktop layout
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* 9. Custom cursor + magnetic ----------------------------------------- */
  var cursor = $('.cursor');
  if (cursor && finePointer && !reducedMotion) {
    root.classList.add('has-cursor');
    var dot = $('.cursor__dot', cursor);
    var ring = $('.cursor__ring', cursor);
    var mouse = { x: -100, y: -100 };
    var ringPos = { x: -100, y: -100 };

    window.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      cursor.classList.add('is-visible');
    }, { passive: true });
    document.addEventListener('mouseleave', function () { cursor.classList.remove('is-visible'); });
    window.addEventListener('mousedown', function () { cursor.classList.add('is-down'); });
    window.addEventListener('mouseup', function () { cursor.classList.remove('is-down'); });

    // magnetic pull: element drifts toward the pointer while hovered.
    // Uses the CSS `translate` property (eased here in JS) so it never fights
    // an element's own transform or CSS transitions.
    var magnets = $$('[data-magnetic]').map(function (el) {
      var m = { el: el, tx: 0, ty: 0, x: 0, y: 0 };
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        m.tx = (e.clientX - (r.left + r.width / 2)) * 0.3;
        m.ty = (e.clientY - (r.top + r.height / 2)) * 0.3;
      });
      el.addEventListener('mouseleave', function () { m.tx = 0; m.ty = 0; });
      return m;
    });

    // the dot follows exactly, the ring trails behind with easing
    (function loop() {
      ringPos.x += (mouse.x - ringPos.x) * 0.18;
      ringPos.y += (mouse.y - ringPos.y) * 0.18;
      dot.style.transform = 'translate3d(' + mouse.x + 'px,' + mouse.y + 'px,0)';
      ring.style.transform = 'translate3d(' + ringPos.x + 'px,' + ringPos.y + 'px,0)';
      magnets.forEach(function (m) {
        var dx = m.tx - m.x, dy = m.ty - m.y;
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return;
        m.x += dx * 0.15;
        m.y += dy * 0.15;
        m.el.style.translate = m.x.toFixed(2) + 'px ' + m.y.toFixed(2) + 'px';
      });
      requestAnimationFrame(loop);
    })();

    // grow the ring over anything interactive
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest('a, button, [data-magnetic], .project')) cursor.classList.add('is-hover');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest('a, button, [data-magnetic], .project')) cursor.classList.remove('is-hover');
    });
  }

  /* 10. Project card tilt ------------------------------------------------ */
  if (finePointer && !reducedMotion) {
    $$('[data-tilt]').forEach(function (card) {
      var max = 3; // degrees
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;   // 0 → 1
        var py = (e.clientY - r.top) / r.height;
        card.classList.add('is-tilting');
        card.style.setProperty('--ry', ((px - 0.5) * 2 * max).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - py) * 2 * max).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
      card.addEventListener('mouseleave', function () {
        card.classList.remove('is-tilting');
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* 11. Terminal typing --------------------------------------------------
     Reads the lines already in the HTML (so it works without JS), clears them,
     then types them out the first time the terminal scrolls into view. */
  var term = $('.terminal__body');
  if (term && !reducedMotion && 'IntersectionObserver' in window) {
    var lines = $$('li', term).map(function (li) {
      return {
        cmd: $('.t-cmd', li).textContent,
        out: $('.t-out', li).textContent,
        accent: $('.t-out', li).classList.contains('t-out--accent')
      };
    });
    term.innerHTML = '';
    var caret = document.createElement('span');
    caret.className = 't-caret';

    var typeText = function (el, text, speed, done) {
      var i = 0;
      (function step() {
        el.textContent = text.slice(0, ++i);
        el.appendChild(caret);
        if (i < text.length) setTimeout(step, speed + Math.random() * speed);
        else done();
      })();
    };

    var run = function (n) {
      if (n >= lines.length) {
        // finish with an idle prompt and blinking caret
        var li = document.createElement('li');
        var idle = document.createElement('span');
        idle.className = 't-cmd';
        idle.appendChild(caret);
        li.appendChild(idle);
        term.appendChild(li);
        return;
      }
      var line = lines[n];
      var item = document.createElement('li');
      var cmd = document.createElement('span');
      cmd.className = 't-cmd';
      item.appendChild(cmd);
      term.appendChild(item);
      typeText(cmd, line.cmd, 38, function () {
        setTimeout(function () {
          var out = document.createElement('span');
          out.className = 't-out' + (line.accent ? ' t-out--accent' : '');
          out.textContent = line.out;
          item.appendChild(out);
          setTimeout(function () { run(n + 1); }, 420);
        }, 260);
      });
    };

    var termObserver = new IntersectionObserver(function (entries, obs) {
      if (entries[0].isIntersecting) { obs.disconnect(); setTimeout(function () { run(0); }, 400); }
    }, { threshold: 0.4 });
    termObserver.observe(term);
  }

  /* 12. Certificate lightbox --------------------------------------------- */
  $$('[data-dialog-open]').forEach(function (btn) {
    var dialog = document.getElementById(btn.getAttribute('data-dialog-open'));
    if (!dialog || typeof dialog.showModal !== 'function') return;

    var img = $('img[data-src]', dialog);
    var fallback = $('.lightbox__fallback', dialog);
    if (img) {
      img.addEventListener('error', function () { img.hidden = true; if (fallback) fallback.hidden = false; });
    }

    btn.addEventListener('click', function () {
      // lazy-load the image the first time the dialog opens
      if (img && !img.getAttribute('src')) img.setAttribute('src', img.getAttribute('data-src'));
      dialog.showModal();
    });
    $$('[data-dialog-close]', dialog).forEach(function (c) {
      c.addEventListener('click', function () { dialog.close(); });
    });
    // click on the backdrop closes it
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  });

  /* 13. Contact form ----------------------------------------------------- */
  var form = $('form[data-netlify]');
  if (form) {
    var status = $('.form__status', form);
    var setStatus = function (msg, type) {
      status.textContent = msg;
      status.className = 'form__status' + (type ? ' is-' + type : '');
    };

    // no-JS fallback redirects back with ?sent=1
    if (/[?&]sent=1/.test(window.location.search)) {
      setStatus('Thank you, your message has been sent. I\'ll get back to you soon.', 'success');
    }

    // Validation rules: each returns an error message, or '' when valid.
    // The form has `novalidate`, so these messages replace the browser's own.
    var rules = {
      name: function (v) {
        if (!v) return 'Please enter your name.';
        if (v.length < 2) return 'Your name should be at least 2 characters.';
        return '';
      },
      email: function (v) {
        if (!v) return 'Please enter your email address.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Please enter a valid email, like name@example.com.';
        return '';
      },
      message: function (v) {
        if (!v) return 'Please write a message.';
        if (v.length < 10) return 'Your message should be at least 10 characters.';
        return '';
      }
    };

    // Shows or clears one field's inline error. Returns true when valid.
    var validateField = function (field) {
      var error = rules[field.name](field.value.trim());
      var errorEl = document.getElementById(field.getAttribute('aria-describedby'));
      if (errorEl) errorEl.textContent = error;
      if (error) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
      return !error;
    };

    var fields = Object.keys(rules).map(function (name) { return form.elements[name]; });
    fields.forEach(function (field) {
      field.addEventListener('blur', function () { validateField(field); });
      // once a field is flagged, clear the error as soon as it's fixed
      field.addEventListener('input', function () {
        if (field.getAttribute('aria-invalid') === 'true') validateField(field);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var submitBtn = $('button[type="submit"]', form);
      if (submitBtn.disabled) return;

      var invalid = fields.filter(function (field) { return !validateField(field); });
      if (invalid.length) {
        setStatus('');
        invalid[0].focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      setStatus('Sending…');

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      })
        .then(function (res) {
          if (!res.ok) throw new Error(res.status);
          form.reset();
          setStatus('Thank you, your message has been sent. I\'ll get back to you soon.', 'success');
        })
        .catch(function () {
          setStatus('Something went wrong. Please email me directly at itxahmer00@gmail.com.', 'error');
        })
        .then(function () {
          submitBtn.disabled = false;
          submitBtn.removeAttribute('aria-busy');
        });
    });
  }
})();
