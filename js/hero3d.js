/*
 * hero3d.js: the interactive 3D scene behind the hero (Three.js, self-hosted).
 * Loaded lazily by main.js after the page has finished loading, and never when the
 * visitor prefers reduced motion or WebGL is unavailable (the CSS orb shows instead).
 *
 * Scene: a glowing wireframe icosahedron inside a slow counter-rotating shell,
 * surrounded by a particle field. It leans toward the mouse (subtly) and pauses
 * whenever the hero is off-screen or the tab is hidden.
 * `mobile: true` simplifies it: fewer particles, lower pixel ratio, no antialiasing.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Color,
  IcosahedronGeometry, EdgesGeometry, LineSegments, LineBasicMaterial,
  BufferGeometry, Float32BufferAttribute, Points, PointsMaterial,
  CanvasTexture, LinearFilter, AdditiveBlending, NormalBlending
} from './vendor/three.module.min.js';

// palette per theme: additive glow on navy, solid darker tones on the light theme
const THEMES = {
  dark:  { core: 0x22d3ee, shell: 0x2dd4bf, a: 0x22d3ee, b: 0x2dd4bf, c: 0x38bdf8, blending: AdditiveBlending, opacity: 0.9 },
  light: { core: 0x0e7490, shell: 0x0f766e, a: 0x0891b2, b: 0x0d9488, c: 0x0369a1, blending: NormalBlending, opacity: 0.7 }
};

// soft round sprite for the particles
function dotTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(c);
  // no mipmaps: tiny points would otherwise sample a blurred level and render as squares
  tex.generateMipmaps = false;
  tex.minFilter = LinearFilter;
  return tex;
}

export function init(container, { mobile = false } = {}) {
  const renderer = new WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, mobile ? 9 : 7.5);

  const group = new Group();
  scene.add(group);

  // core: wireframe icosahedron + glowing vertices
  const coreGeo = new IcosahedronGeometry(1.7, 1);
  const coreMat = new LineBasicMaterial({ transparent: true, opacity: 0.6 });
  const core = new LineSegments(new EdgesGeometry(coreGeo), coreMat);
  const sprite = dotTexture();
  const vertMat = new PointsMaterial({ size: 0.12, map: sprite, transparent: true, depthWrite: false });
  // position-only copy: with a `uv` attribute, Points would sample one texel per point (squares)
  const vertGeo = new BufferGeometry();
  vertGeo.setAttribute('position', coreGeo.getAttribute('position'));
  const verts = new Points(vertGeo, vertMat);
  core.add(verts);
  group.add(core);

  // outer shell, counter-rotating
  const shellMat = new LineBasicMaterial({ transparent: true, opacity: 0.18 });
  const shell = new LineSegments(new EdgesGeometry(new IcosahedronGeometry(2.6, 0)), shellMat);
  group.add(shell);

  // particle field in a spherical shell around the core
  const count = mobile ? 550 : 1800;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const fieldGeo = new BufferGeometry();
  for (let i = 0; i < count; i++) {
    const r = 3.2 + Math.random() * 4.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.75;
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  fieldGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  fieldGeo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const fieldMat = new PointsMaterial({ size: mobile ? 0.06 : 0.05, map: sprite, vertexColors: true, transparent: true, depthWrite: false });
  const field = new Points(fieldGeo, fieldMat);
  scene.add(field);

  // apply palette for the current theme (and again whenever it changes)
  const applyTheme = () => {
    const t = THEMES[document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'];
    coreMat.color.setHex(t.core);
    shellMat.color.setHex(t.shell);
    vertMat.color.setHex(t.core);
    const palette = [new Color(t.a), new Color(t.b), new Color(t.c)];
    for (let i = 0; i < count; i++) {
      const col = palette[i % 3];
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    fieldGeo.attributes.color.needsUpdate = true;
    [vertMat, fieldMat].forEach((m) => { m.blending = t.blending; m.opacity = t.opacity; m.needsUpdate = true; });
  };
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // size to the container
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(container);

  // subtle mouse influence (desktop only)
  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  if (!mobile) {
    window.addEventListener('pointermove', (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  // only animate while visible
  let inView = true;
  let raf = 0;
  let last = 0;
  let t = 0; // seconds of animated time (does not advance while paused)
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; if (inView) start(); }).observe(container);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });

  function frame() {
    if (!inView || document.hidden) { raf = 0; return; }
    const now = performance.now();
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    t += dt;

    eased.x += (pointer.x - eased.x) * 0.04;
    eased.y += (pointer.y - eased.y) * 0.04;

    core.rotation.y += dt * 0.22;
    core.rotation.x += dt * 0.08;
    shell.rotation.y -= dt * 0.1;
    shell.rotation.z += dt * 0.05;
    core.scale.setScalar(1 + Math.sin(t * 1.3) * 0.035);

    group.rotation.x = eased.y * 0.35;
    group.rotation.y = eased.x * 0.5;
    field.rotation.y = t * 0.025 + eased.x * 0.15;
    field.rotation.x = eased.y * 0.08;
    camera.position.x = eased.x * 0.35;
    camera.position.y = -eased.y * 0.25;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !inView || document.hidden) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  renderer.render(scene, camera);
  container.classList.add('is-ready');
  start();
}
