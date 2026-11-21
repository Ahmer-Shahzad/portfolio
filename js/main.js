/*
 * main.js: all interactions for the portfolio. Vanilla JS; GSAP and Three.js are
 * self-hosted in js/vendor and loaded on demand (never when reduced motion is on).
 * Every feature checks that its elements exist, so this file also runs on 404.html.
 *
 *  1. Helpers, environment flags, the site-wide easing curve
 *  2. Footer year, theme toggle
 *  3. Intro (skippable), hero name split, typing line
 *  4. Scroll progress, navbar, active section (nav + dots)
 *  5. Mobile menu
 *  6. Cursor (dot, ring, glow) + magnetic elements
 *  7. Card tilt with depth
 *  8. Skills tabs
 *  9. PrintFlow screenshot gallery (placeholder until screenshots exist)
 * 10. Certificate lightbox
 * 11. Contact form (Netlify Forms via fetch)
 * 12. GSAP: text reveals, block reveals, horizontal Work showcase, mockup straighten
 * 13. Persistent 3D scene (Three.js, lazy)
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

  // the one easing curve used site-wide (same as --ease in CSS: cubic-bezier(.16, 1, .3, 1))
  var ease = (function (x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return function (x) {
      var t = x;
      for (var i = 0; i < 6; i++) {
        var d = (3 * ax * t + 2 * bx) * t + cx;
        if (Math.abs(d) < 1e-6) break;
        t -= (((ax * t + bx) * t + cx) * t - x) / d;
      }
      t = Math.min(1, Math.max(0, t));
      return ((ay * t + by) * t + cy) * t;
    };
  })(0.16, 1, 0.3, 1);

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = new URL(src, scriptBase).href;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // run once the page has loaded and the browser is idle (keeps startup light on phones)
  function afterLoadIdle(fn) {
    var idle = function () {
      if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 2500 });
      else setTimeout(fn, 600);
    };
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle);
  }

  /* 2. Footer year + theme toggle ---------------------------------------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  var themeBtn = $('.theme-toggle');
  var themeMeta = $('meta[name="theme-color"]');
  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.setAttribute('content', theme === 'light' ? '#f3f6fa' : '#050912');
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

  /* 3. Intro, hero name split, typing line ------------------------------- */
  var intro = $('.intro');
  var introOn = root.classList.contains('intro-on');
  if (intro && introOn) {
    var skipIntro = function () {
      intro.classList.add('is-skipped');
      root.style.setProperty('--intro-delay', '0ms');
      window.removeEventListener('keydown', skipIntro);
    };
    intro.addEventListener('click', skipIntro);
    window.addEventListener('keydown', skipIntro);
    intro.addEventListener('animationend', function (e) {
      if (e.animationName === 'intro-out') root.classList.remove('intro-on');
    });
  }

  // wraps each word (lines only break between words) and each letter, indexed for the stagger
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
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { root.classList.add('is-loaded'); });
  });

  // typing line under the name (full text is already in the HTML for no-JS / reduced motion)
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
      if (ti < fullText.length) setTimeout(step, 24 + Math.random() * 32);
    }, introOn ? 1400 : 700);
  }

  /* 4. Scroll progress, navbar, active section --------------------------- */
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

  var navLinks = $$('.nav__links a[href^="#"]');
  var dots = $$('[data-dot]');
  var sections = $$('[data-section]');
  if (sections.length && 'IntersectionObserver' in window) {
    var setActive = function (id) {
      navLinks.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + id;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      dots.forEach(function (d) {
        var on = d.getAttribute('data-dot') === id;
        d.classList.toggle('is-active', on);
        if (on) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
    };
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) setActive(entry.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { sectionObserver.observe(s); });
  }

  /* 5. Mobile menu ------------------------------------------------------- */
  var menuBtn = $('.nav__toggle');
  if (menuBtn && nav) {
    var setMenu = function (open) {
      nav.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    navLinks.forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
    });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (e) { if (e.matches) setMenu(false); });
  }

  /* 6. Cursor + magnetic -------------------------------------------------- */
  var cursor = $('.cursor');
  if (cursor && finePointer && !reducedMotion) {
    root.classList.add('has-cursor');
    var dot = $('.cursor__dot', cursor), ring = $('.cursor__ring', cursor), glow = $('.cursor__glow', cursor);
    var mouse = { x: -500, y: -500 }, ringPos = { x: -500, y: -500 }, glowPos = { x: -500, y: -500 };

    window.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX; mouse.y = e.clientY;
      cursor.classList.add('is-visible');
    }, { passive: true });
    document.addEventListener('mouseleave', function () { cursor.classList.remove('is-visible'); });
    window.addEventListener('mousedown', function () { cursor.classList.add('is-down'); });
    window.addEventListener('mouseup', function () { cursor.classList.remove('is-down'); });

    // magnetic pull via the CSS `translate` property, eased here, so it never fights transforms
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

    (function loop() {
      ringPos.x += (mouse.x - ringPos.x) * 0.2;  ringPos.y += (mouse.y - ringPos.y) * 0.2;
      glowPos.x += (mouse.x - glowPos.x) * 0.08; glowPos.y += (mouse.y - glowPos.y) * 0.08;
      dot.style.transform = 'translate3d(' + mouse.x + 'px,' + mouse.y + 'px,0)';
      ring.style.transform = 'translate3d(' + ringPos.x + 'px,' + ringPos.y + 'px,0)';
      glow.style.transform = 'translate3d(' + glowPos.x + 'px,' + glowPos.y + 'px,0)';
      magnets.forEach(function (m) {
        var dx = m.tx - m.x, dy = m.ty - m.y;
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return;
        m.x += dx * 0.15; m.y += dy * 0.15;
        m.el.style.translate = m.x.toFixed(2) + 'px ' + m.y.toFixed(2) + 'px';
      });
      requestAnimationFrame(loop);
    })();

    var hoverSel = 'a, button, [data-magnetic], .project, [role="tab"]';
    document.addEventListener('mouseover', function (e) { if (e.target.closest(hoverSel)) cursor.classList.add('is-hover'); });
    document.addEventListener('mouseout', function (e) { if (e.target.closest(hoverSel)) cursor.classList.remove('is-hover'); });
  }

  /* 7. Card tilt with depth (inner [data-depth] layers lift on hover in CSS) */
  if (finePointer && !reducedMotion) {
    $$('[data-tilt]').forEach(function (card) {
      var max = 3; // degrees
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
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

  /* 8. Skills tabs: arrow keys, Home/End; choosing a tab highlights that category on the 3D sphere */
  $$('[data-tabs]').forEach(function (list) {
    var tabs = $$('[role="tab"]', list);
    var panelOf = function (tab) { return document.getElementById(tab.getAttribute('aria-controls')); };
    list.parentElement.classList.add('js-tabs');
    function select(i, focus, announce) {
      tabs.forEach(function (t, n) {
        var on = n === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panelOf(t).hidden = !on;
      });
      if (focus) tabs[i].focus();
      if (announce) document.dispatchEvent(new CustomEvent('skills:category', { detail: tabs[i].getAttribute('data-cat') }));
    }
    tabs.forEach(function (t, i) { t.addEventListener('click', function () { select(i, false, true); }); });
    list.addEventListener('keydown', function (e) {
      var cur = tabs.indexOf(document.activeElement);
      var map = { ArrowRight: cur + 1, ArrowLeft: cur - 1, Home: 0, End: tabs.length - 1 };
      if (e.key in map) { e.preventDefault(); select((map[e.key] + tabs.length) % tabs.length, true, true); }
    });
    select(0, false, false);
  });

  /* 9. PrintFlow screenshot gallery ----------------------------------------
     data-ready="false": no image is requested; an app skeleton shows instead (no 404s).
     data-ready="true": images load when the gallery nears the viewport, then fade in. */
  $$('[data-gallery]').forEach(function (gallery, g) {
    var slides = $$('[data-slide]', gallery);
    var tablist = $('[role="tablist"]', gallery);
    if (!slides.length || !tablist) return;
    var ready = gallery.getAttribute('data-ready') === 'true';
    var current = 0;

    if (ready) {
      var loadImages = function () {
        slides.forEach(function (slide) {
          var img = $('img[data-src]', slide);
          if (!img || img.getAttribute('src')) return;
          img.addEventListener('load', function () { img.classList.add('is-loaded'); });
          img.addEventListener('error', function () { gallery.setAttribute('data-ready', 'false'); });
          if (img.getAttribute('data-srcset')) img.setAttribute('srcset', img.getAttribute('data-srcset'));
          img.setAttribute('src', img.getAttribute('data-src'));
        });
      };
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries, obs) {
          if (entries[0].isIntersecting) { obs.disconnect(); loadImages(); }
        }, { rootMargin: '600px' }).observe(gallery);
      } else loadImages();
    }

    var tabs = slides.map(function (slide, i) {
      var id = 'gallery' + g + '-slide' + i;
      slide.id = id;
      slide.setAttribute('role', 'tabpanel');
      slide.setAttribute('aria-label', slide.getAttribute('data-label'));
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
      tabs.forEach(function (t, n) { var on = n === current; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      if (focusTab) tabs[current].focus();
      tablist.scrollTo({ left: tabs[current].offsetLeft - tablist.clientWidth / 2 + tabs[current].clientWidth / 2, behavior: 'smooth' });
    }

    var prev = $('[data-prev]', gallery), next = $('[data-next]', gallery);
    if (prev) prev.addEventListener('click', function () { show(current - 1); });
    if (next) next.addEventListener('click', function () { show(current + 1); });
    tablist.addEventListener('keydown', function (e) {
      var map = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: slides.length - 1 };
      if (e.key in map) { e.preventDefault(); show(map[e.key], true); }
    });

    // swipe on touch screens
    var screen = $('.device__screen', gallery), startX = null;
    if (screen) {
      screen.addEventListener('pointerdown', function (e) { startX = e.clientX; });
      screen.addEventListener('pointerup', function (e) {
        if (startX === null) return;
        var dx = e.clientX - startX;
        if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
        startX = null;
      });
    }

    // initial state without moving the page
    slides.forEach(function (s, n) { s.classList.toggle('is-active', n === 0); });
    tabs.forEach(function (t, n) { t.setAttribute('aria-selected', String(n === 0)); t.tabIndex = n === 0 ? 0 : -1; });
  });

  /* 10. Certificate lightbox --------------------------------------------- */
  $$('[data-dialog-open]').forEach(function (btn) {
    var dialog = document.getElementById(btn.getAttribute('data-dialog-open'));
    if (!dialog || typeof dialog.showModal !== 'function') return;
    var img = $('img[data-src]', dialog);
    var fallback = $('.lightbox__fallback', dialog);
    if (img) img.addEventListener('error', function () { img.hidden = true; if (fallback) fallback.hidden = false; });
    btn.addEventListener('click', function () {
      // lazy-load the image the first time the dialog opens
      if (img && !img.getAttribute('src')) img.setAttribute('src', img.getAttribute('data-src'));
      dialog.showModal();
    });
    $$('[data-dialog-close]', dialog).forEach(function (c) { c.addEventListener('click', function () { dialog.close(); }); });
    // click on the backdrop closes it
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  });

  /* 11. Contact form ----------------------------------------------------- */
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

  /* 12. GSAP ----------------------------------------------------------------
     Nothing is hidden by CSS, so if GSAP fails to load (or motion is reduced)
     everything stays visible. Loaded after first load + idle; only the hero
     (animated by CSS) is on screen at that point. */
  if (!reducedMotion && $('[data-section]')) afterLoadIdle(function () {
    loadScript('vendor/gsap.min.js')
      .then(function () { return loadScript('vendor/ScrollTrigger.min.js'); })
      .then(function () {
        var gsap = window.gsap, ST = window.ScrollTrigger;
        gsap.registerPlugin(ST);
        gsap.defaults({ ease: ease, duration: 0.9 });

        // (a) Work: pinned horizontal showcase on large screens (created first so later
        //     triggers measure the pin spacing correctly)
        var work = $('.work');
        var track = work && $('.work__track', work);
        if (work && track) {
          // only where the cards fit at full height; shorter screens keep the vertical stack
          gsap.matchMedia().add('(min-width: 1024px) and (min-height: 780px)', function () {
            work.classList.add('is-horizontal');
            var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
            gsap.to(track, {
              x: function () { return -dist(); },
              ease: 'none',
              // scroll distance is 80% of the horizontal travel: a shorter page, still unhurried
              scrollTrigger: { trigger: work, start: 'top top', end: function () { return '+=' + Math.round(dist() * 0.8); }, pin: true, scrub: 0.8, invalidateOnRefresh: true }
            });
            return function () { work.classList.remove('is-horizontal'); gsap.set(track, { clearProps: 'transform' }); };
          });
        }

        // (b) headings: split-line mask reveal, word by word
        $$('[data-reveal-text]').forEach(function (el) {
          var inners = [];
          (function wrap(node) {
            Array.prototype.slice.call(node.childNodes).forEach(function (child) {
              if (child.nodeType === 3) {
                var parts = child.textContent.split(/(\s+)/);
                var frag = document.createDocumentFragment();
                parts.forEach(function (part) {
                  if (!part) return;
                  if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                  var outer = document.createElement('span');
                  outer.className = 'rw';
                  var inner = document.createElement('span');
                  inner.textContent = part;
                  outer.appendChild(inner);
                  frag.appendChild(outer);
                  inners.push(inner);
                });
                node.replaceChild(frag, child);
              } else if (child.nodeType === 1) wrap(child);
            });
          })(el);
          gsap.from(inners, { yPercent: 110, stagger: 0.05, duration: 1, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
        });

        // (c) blocks: fade + rise
        $$('[data-reveal]').forEach(function (el) {
          gsap.from(el, {
            autoAlpha: 0, y: 32,
            clearProps: 'transform,opacity,visibility',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true }
          });
        });

        // (d) grids: staggered pop-in
        var items = $$('[data-reveal-item]');
        if (items.length) {
          gsap.set(items, { autoAlpha: 0, y: 24 });
          ST.batch(items, {
            start: 'top 92%', once: true,
            onEnter: function (batch) { gsap.to(batch, { autoAlpha: 1, y: 0, stagger: 0.07, clearProps: 'transform,opacity,visibility' }); }
          });
        }

        // (e) PrintFlow mockup straightens as the Work section arrives
        $$('[data-device]').forEach(function (device) {
          gsap.fromTo(device,
            { '--dev-rx': '10deg', '--dev-ry': '-14deg', '--dev-rz': '1.5deg' },
            { '--dev-rx': '0deg', '--dev-ry': '0deg', '--dev-rz': '0deg', ease: 'none',
              scrollTrigger: { trigger: work || device, start: 'top 85%', end: 'top 10%', scrub: 0.6 } });
        });

        ST.refresh();
      })
      .catch(function () { /* GSAP unavailable: content is already visible */ });
  });

  /* 13. Persistent 3D scene ----------------------------------------------------
     Three.js is ~170 KB gzipped, so it loads after first paint, when the browser is idle.
     Phones/tablets and low-power devices get a lighter scene, mounted on the first touch or
     scroll so it never competes with the initial load. Skipped for reduced motion / no WebGL
     (the CSS gradient, orb and icon ring stay). */
  var sceneEl = $('#scene');
  var hasWebGL = function () {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  };
  if (sceneEl && !reducedMotion) {
    var lowPower = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    var lite = !finePointer || window.innerWidth < 900 || lowPower;
    var mounted = false;
    var mountScene = function () {
      // the WebGL check creates a GL context, so it runs here, not at startup
      if (mounted || !hasWebGL()) return;
      mounted = true;
      import(new URL('scene.js', scriptBase).href)
        .then(function (mod) { mod.init(sceneEl, { lite: lite }); })
        .catch(function () { mounted = false; /* keep the CSS fallback */ });
    };
    if (!finePointer) {
      var onFirstInteraction = function () { afterLoadIdle(mountScene); };
      ['touchstart', 'pointerdown', 'scroll', 'keydown'].forEach(function (type) {
        window.addEventListener(type, onFirstInteraction, { once: true, passive: true });
      });
    } else afterLoadIdle(mountScene);
  }
})();
