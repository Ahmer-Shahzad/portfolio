/*
 * main.js: all interactions for the portfolio. Vanilla JS; GSAP and Three.js are
 * self-hosted in js/vendor and loaded on demand (never when reduced motion is on).
 * Every feature checks that its elements exist, so this file also runs on 404.html.
 *
 *  1. Helpers + environment flags
 *  2. Footer year
 *  3. Theme toggle
 *  4. Hero name split + load reveal, typing line
 *  5. Scroll progress + navbar state
 *  6. Active section highlight
 *  7. Scroll reveals + 3D device straighten (GSAP ScrollTrigger)
 *  8. Mobile menu
 *  9. Custom cursor + magnetic elements
 * 10. Project card tilt
 * 11. Terminal typing
 * 12. Certificate lightbox
 * 13. Contact form (Netlify Forms via fetch)
 * 14. PrintFlow screenshot gallery
 * 15. Hero 3D scene (Three.js, lazy)
 */
(function () {
  'use strict';

  /* 1. Helpers ----------------------------------------------------------- */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // base URL for files next to this script (js/), used for on-demand loading
  var scriptBase = document.currentScript ? document.currentScript.src : window.location.href;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = new URL(src, scriptBase).href;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* 2. Footer year ------------------------------------------------------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* 3. Theme toggle ------------------------------------------------------ */
  var themeBtn = $('.theme-toggle');
  var themeMeta = $('meta[name="theme-color"]');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.setAttribute('content', theme === 'light' ? '#f3f7fb' : '#050912');
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
     Wraps each word (so lines only break between words) and each letter in it,
     with an index (--i) used for the stagger delay. */
  var charIndex = 0;
  $$('[data-split]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (word, w) {
      if (w > 0) el.appendChild(document.createTextNode(' '));
      var wordEl = document.createElement('span');
      wordEl.className = 'word';
      for (var i = 0; i < word.length; i++) {
        var span = document.createElement('span');
        span.className = 'char';
        span.textContent = word[i];
        span.style.setProperty('--i', charIndex++);
        wordEl.appendChild(span);
      }
      el.appendChild(wordEl);
    });
  });
  // two frames so the initial (hidden) state is painted before animating in
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { root.classList.add('is-loaded'); });
  });

  // typing line under the name (the full text is already in the HTML for no-JS / reduced motion)
  var typed = $('[data-type]');
  if (typed && !reducedMotion) {
    var fullText = typed.getAttribute('data-type');
    var typedCaret = document.createElement('span');
    typedCaret.className = 't-caret';
    typed.textContent = '';
    typed.appendChild(typedCaret);
    var ti = 0;
    setTimeout(function step() {
      typed.textContent = fullText.slice(0, ++ti);
      typed.appendChild(typedCaret);
      if (ti < fullText.length) setTimeout(step, 28 + Math.random() * 40);
    }, 900);
  }

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

  /* 7. Scroll reveals (GSAP ScrollTrigger) --------------------------------
     Nothing is hidden by CSS, so if GSAP fails to load (or motion is reduced)
     everything simply stays visible. */
  // run once the page has loaded and the browser is idle (keeps startup light on phones)
  var afterLoadIdle = function (fn) {
    var idle = function () {
      if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 2500 });
      else setTimeout(fn, 600);
    };
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle);
  };

  // Elements below the fold are revealed by GSAP; only the hero (not animated by GSAP)
  // is on screen at load, so GSAP can wait until the page is idle.
  if (!reducedMotion && ($('[data-reveal]') || $('[data-device]'))) afterLoadIdle(function () {
    loadScript('vendor/gsap.min.js')
      .then(function () { return loadScript('vendor/ScrollTrigger.min.js'); })
      .then(function () {
        var gsap = window.gsap;
        gsap.registerPlugin(window.ScrollTrigger);

        // single blocks: fade + rise
        $$('[data-reveal]').forEach(function (el) {
          gsap.from(el, {
            autoAlpha: 0, y: 40, duration: 1, ease: 'power3.out',
            clearProps: 'transform,opacity,visibility', // hand transforms back to CSS (tilt, hover)
            scrollTrigger: { trigger: el, start: 'top 88%', once: true }
          });
        });

        // grids (skills, certifications): staggered pop-in
        var items = $$('[data-reveal-item]');
        if (items.length) {
          gsap.set(items, { autoAlpha: 0, y: 28, scale: 0.96 });
          window.ScrollTrigger.batch(items, {
            start: 'top 92%',
            once: true,
            onEnter: function (batch) {
              gsap.to(batch, {
                autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out', stagger: 0.06,
                clearProps: 'transform,opacity,visibility'
              });
            }
          });
        }

        // PrintFlow browser mockup straightens as it scrolls into view
        $$('[data-device]').forEach(function (device) {
          gsap.fromTo(device,
            { '--dev-rx': '12deg', '--dev-ry': '-16deg', '--dev-rz': '2deg' },
            {
              '--dev-rx': '0deg', '--dev-ry': '0deg', '--dev-rz': '0deg', ease: 'none',
              scrollTrigger: { trigger: device, start: 'top 90%', end: 'center 50%', scrub: 0.6 }
            });
        });
      })
      .catch(function () { /* GSAP unavailable: content is already visible */ });
  });

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

  /* 14. PrintFlow screenshot gallery --------------------------------------
     Builds the tab buttons from the slides' data-label, then wires
     tabs, prev/next, arrow keys and swipe. A missing image shows a placeholder. */
  $$('[data-gallery]').forEach(function (gallery, g) {
    var slides = $$('[data-slide]', gallery);
    var tablist = $('[role="tablist"]', gallery);
    if (!slides.length || !tablist) return;
    var current = 0;

    var tabs = slides.map(function (slide, i) {
      var id = 'gallery' + g + '-slide' + i;
      slide.id = id;
      slide.setAttribute('role', 'tabpanel');
      slide.setAttribute('aria-label', slide.getAttribute('data-label'));

      var img = $('img', slide);
      if (img) {
        var markMissing = function () { slide.classList.add('is-missing'); };
        img.addEventListener('error', markMissing);
        if (img.complete && img.naturalWidth === 0 && img.getAttribute('loading') !== 'lazy') markMissing();
      }

      var tab = document.createElement('button');
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', id);
      tab.textContent = slide.getAttribute('data-label');
      tab.addEventListener('click', function () { show(i); });
      tablist.appendChild(tab);
      return tab;
    });

    function show(i, focusTab) {
      current = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) { s.classList.toggle('is-active', n === current); });
      tabs.forEach(function (t, n) {
        var on = n === current;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      tabs[current].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (focusTab) tabs[current].focus();
    }

    var prev = $('[data-prev]', gallery);
    var next = $('[data-next]', gallery);
    if (prev) prev.addEventListener('click', function () { show(current - 1); });
    if (next) next.addEventListener('click', function () { show(current + 1); });

    tablist.addEventListener('keydown', function (e) {
      var map = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: slides.length - 1 };
      if (e.key in map) { e.preventDefault(); show(map[e.key], true); }
    });

    // swipe on touch screens
    var screen = $('.device__screen', gallery);
    var startX = null;
    if (screen) {
      screen.addEventListener('pointerdown', function (e) { startX = e.clientX; });
      screen.addEventListener('pointerup', function (e) {
        if (startX === null) return;
        var dx = e.clientX - startX;
        if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
        startX = null;
      });
    }

    // initial state without scrolling the page
    slides.forEach(function (s, n) { s.classList.toggle('is-active', n === 0); });
    tabs.forEach(function (t, n) { t.setAttribute('aria-selected', String(n === 0)); t.tabIndex = n === 0 ? 0 : -1; });
  });

  /* 15. Hero 3D scene -----------------------------------------------------
     Three.js is ~170 KB gzipped, so it loads only after the page has finished
     loading and the browser is idle. Skipped entirely for reduced motion or no WebGL
     (the CSS orb stays). Phones/tablets get a lighter version, mounted on the first
     touch or scroll so it never competes with the initial page load on slow CPUs. */
  var hero3d = $('#hero-3d');
  var hasWebGL = function () {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  };
  if (hero3d && !reducedMotion) {
    var mobile3d = !finePointer || window.innerWidth < 768;
    var mounted = false;
    var mount3d = function () {
      // the WebGL check creates a GL context, so it runs here, not at startup
      if (mounted || !hasWebGL()) return;
      mounted = true;
      import(new URL('hero3d.js', scriptBase).href)
        .then(function (mod) { mod.init(hero3d, { mobile: mobile3d }); })
        .catch(function () { /* keep the CSS orb */ });
    };
    if (mobile3d) {
      var onFirstInteraction = function () { afterLoadIdle(mount3d); };
      ['touchstart', 'pointerdown', 'scroll', 'keydown'].forEach(function (type) {
        window.addEventListener(type, onFirstInteraction, { once: true, passive: true });
      });
    } else afterLoadIdle(mount3d);
  }
})();
