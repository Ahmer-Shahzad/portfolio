/*
 * scene.js: ONE persistent Three.js scene behind the whole site (fixed full-viewport canvas).
 * Loaded lazily by main.js after first paint (on phones: after the first touch/scroll).
 * Never loaded for prefers-reduced-motion or without WebGL (the CSS gradient stays).
 *
 * How it works
 * - Every section has a 3D "state" (0 hero … 5 contact). The scroll position is turned into a
 *   continuous value `s` (section index + progress) and eased every frame (scrubbed with inertia).
 * - Objects are positioned on invisible DOM anchors ([data-anchor]) by projecting the anchor's
 *   screen box onto the z = 0 plane, so the 3D stays aligned with the layout at every size.
 * - States: hero = wireframe/glass shards + particle field following the mouse;
 *   about = shards split apart, particles gather into a calm cluster;
 *   skills = draggable sphere of skill icons (hover shows a label);
 *   projects = floating glass panels the camera drifts past;
 *   education = shards reform, small and quiet; contact = everything converges to a glowing point.
 * - Desktop adds one cheap post pass (soft glow, chromatic fringe on fast scroll, fine grain).
 * - Guards: pixel ratio capped (≤ 2, lower with post / on phones), rendering pauses while the tab
 *   is hidden, `lite` (phones / low-power) uses fewer particles and no post pass.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera, Group, Color, Vector2, Vector3,
  BufferGeometry, Float32BufferAttribute, Points, LineSegments, Mesh, PlaneGeometry,
  IcosahedronGeometry, EdgesGeometry, LineBasicMaterial, ShaderMaterial, Sprite, SpriteMaterial,
  CanvasTexture, LinearFilter, Raycaster, WebGLRenderTarget, AdditiveBlending, NormalBlending,
  ColorManagement, LinearSRGBColorSpace
} from './vendor/three.module.min.js';

ColorManagement.enabled = false; // treat all colours as authored (matches the CSS palette)

/* ---- the site-wide easing curve (same bezier as --ease in CSS) ---------------------- */
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    let t = x;
    for (let i = 0; i < 6; i++) { const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= (sx(t) - x) / d; }
    return sy(Math.min(1, Math.max(0, t)));
  };
}
const ease = bezier(0.16, 1, 0.3, 1);
const easeInOut = (t) => (t < 0.5 ? ease(t * 2) / 2 : 0.5 + ease(t * 2 - 1) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/* ---- palette per theme --------------------------------------------------------------- */
const PALETTE = {
  dark:  { accent: 0x22d3ee, soft: 0x67e8f9, neutral: 0x93a1b5, blending: AdditiveBlending, glow: 1.0, grain: 0.035, faces: 0.35 },
  light: { accent: 0x0e7490, soft: 0x0891b2, neutral: 0x64748b, blending: NormalBlending, glow: 0.0, grain: 0.02, faces: 0.18 }
};

/* ---- section states (index = section order in the page) ------------------------------ */
// coreAt / clusterAt name [data-anchor] elements. Values are blended between neighbours.
const STATES = [
  { name: 'hero',      coreAt: 'hero',      core: 1.0,  coreScale: 0.42, split: 0.0,  clusterAt: 'hero',      morphB: 0.0, morphC: 0, sphere: 0, panels: 0, field: 1.0,  cam: [0, 0, 10],     roll: 0 },
  { name: 'about',     coreAt: 'about',     core: 0.75, coreScale: 0.34, split: 0.75, clusterAt: 'about',     morphB: 1.0, morphC: 0, sphere: 0, panels: 0, field: 0.8,  cam: [0.4, -0.3, 10.6], roll: -0.02 },
  { name: 'skills',    coreAt: 'about',     core: 0.0,  coreScale: 0.3,  split: 1.2,  clusterAt: 'skills',    morphB: 0.35, morphC: 0, sphere: 1, panels: 0, field: 0.6, cam: [-0.3, 0, 10],  roll: 0.015 },
  { name: 'projects',  coreAt: 'education', core: 0.0,  coreScale: 0.3,  split: 0.6,  clusterAt: 'skills',    morphB: 0.0, morphC: 0, sphere: 0, panels: 1, field: 0.9,  cam: [0, 0.2, 9],    roll: 0 },
  { name: 'education', coreAt: 'education', core: 0.5,  coreScale: 0.24, split: 0.12, clusterAt: 'education', morphB: 0.6, morphC: 0, sphere: 0, panels: 0, field: 0.55, cam: [0.3, 0, 10.4], roll: -0.015 },
  { name: 'contact',   coreAt: 'contact',   core: 0.0,  coreScale: 0.12, split: 0.0,  clusterAt: 'contact',   morphB: 0.0, morphC: 1, sphere: 0, panels: 0, field: 0.4,  cam: [0, 0, 9.4],    roll: 0 }
];

/* ---- shaders --------------------------------------------------------------------------- */
const PARTICLE_VS = /* glsl */`
  attribute vec3 aB; attribute vec3 aC; attribute float aRand;
  uniform float uTime, uMorphB, uMorphC, uSize, uPR;
  uniform vec3 uCluster, uFocal; uniform vec2 uMouse;
  varying float vRand; varying float vFade;
  void main() {
    vec3 pA = position;
    pA.xy += uMouse * (0.25 + aRand * 0.6);                    // depth parallax
    pA.x += sin(uTime * 0.12 + aRand * 6.2831) * 0.18;
    pA.y += cos(uTime * 0.10 + aRand * 6.2831) * 0.18;
    vec3 pB = uCluster + aB * (1.0 + 0.05 * sin(uTime * 0.6 + aRand * 6.2831));
    vec3 pC = uFocal + aC * (0.6 + 0.4 * sin(uTime * 1.4 + aRand * 6.2831));
    vec3 p = mix(mix(pA, pB, uMorphB), pC, uMorphC);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPR * (0.55 + aRand) * (1.0 + uMorphC * 0.8) / -mv.z;
    vRand = aRand;
    vFade = smoothstep(18.0, 6.0, -mv.z);
  }`;
const PARTICLE_FS = /* glsl */`
  uniform vec3 uColorA, uColorB; uniform float uOpacity;
  varying float vRand; varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    gl_FragColor = vec4(mix(uColorA, uColorB, vRand), a * uOpacity * (0.35 + 0.65 * vFade));
  }`;

// shards: each triangle of an icosahedron moves out along its own direction when split
const SHARD_VS = /* glsl */`
  attribute vec3 aDir; attribute float aSeed;
  uniform float uSplit, uTime;
  varying vec3 vN; varying vec3 vView;
  void main() {
    vec3 p = position + aDir * uSplit * (0.5 + aSeed * 1.1);
    p += aDir * sin(uTime * 0.9 + aSeed * 6.2831) * 0.035 * (0.3 + uSplit);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * aDir);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const LINE_FS = /* glsl */`
  uniform vec3 uColor; uniform float uOpacity;
  void main() { gl_FragColor = vec4(uColor, uOpacity); }`;
const FACE_FS = /* glsl */`
  uniform vec3 uColor; uniform float uOpacity;
  varying vec3 vN; varying vec3 vView;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.2);
    gl_FragColor = vec4(uColor * (0.35 + f), (0.05 + f * 0.6) * uOpacity);
  }`;

const PANEL_VS = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PANEL_FS = /* glsl */`
  uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
  void main() {
    float edge = max(smoothstep(0.96, 1.0, abs(vUv.x * 2.0 - 1.0)), smoothstep(0.94, 1.0, abs(vUv.y * 2.0 - 1.0)));
    float sheen = smoothstep(0.0, 1.0, 1.0 - vUv.y) * 0.25 + smoothstep(0.6, 0.0, abs(vUv.x - vUv.y)) * 0.12;
    gl_FragColor = vec4(uColor, (0.05 + sheen * 0.4 + edge * 0.55) * uOpacity);
  }`;

const POST_VS = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FS = /* glsl */`
  uniform sampler2D tScene; uniform vec2 uRes; uniform float uTime, uVel, uGlow, uGrain;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 dir = vUv - 0.5;
    float ca = uVel * 0.0035;                      // chromatic fringe grows with scroll speed
    vec3 col = vec3(
      texture2D(tScene, vUv + dir * ca).r,
      texture2D(tScene, vUv).g,
      texture2D(tScene, vUv - dir * ca).b);
    vec2 px = 1.0 / uRes;                          // cheap glow: 2 rings x 8 taps on bright parts
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7853982;
      vec2 o = vec2(cos(a), sin(a));
      glow += max(texture2D(tScene, vUv + o * px * 7.0).rgb - 0.14, 0.0) * 0.6;
      glow += max(texture2D(tScene, vUv + o * px * 16.0).rgb - 0.14, 0.0) * 0.4;
    }
    col += glow * 0.16 * uGlow;
    col += (hash(vUv * uRes + fract(uTime) * 100.0) - 0.5) * uGrain;
    gl_FragColor = vec4(col, 1.0);
  }`;

/* ---- helpers ----------------------------------------------------------------------------- */
function softDotTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new CanvasTexture(c);
  t.generateMipmaps = false;
  t.minFilter = LinearFilter;
  return t;
}

// draws an SVG <symbol> from the page's icon sprite onto a glass disc (for the skill sphere)
function iconTexture(symbolId) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const tex = new CanvasTexture(c);
  tex.generateMipmaps = false;
  tex.minFilter = LinearFilter;
  x.beginPath();
  x.arc(64, 64, 58, 0, Math.PI * 2);
  x.fillStyle = 'rgba(255,255,255,0.08)';
  x.fill();
  x.lineWidth = 3;
  x.strokeStyle = 'rgba(255,255,255,0.55)';
  x.stroke();
  const sym = document.getElementById(symbolId);
  if (sym) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" style="color:#fff">${sym.innerHTML}</svg>`;
    const img = new Image();
    img.onload = () => { x.drawImage(img, 32, 32, 64, 64); tex.needsUpdate = true; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  return tex;
}

/* ======================================================================================== */
export function init(container, { lite = false } = {}) {
  const usePost = !lite;
  const renderer = new WebGLRenderer({ antialias: !lite, powerPreference: lite ? 'low-power' : 'high-performance' });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.25 : usePost ? 1.5 : 2));
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 60);
  camera.position.set(0, 0, 10);

  const mouse = new Vector2(), mouseEased = new Vector2();
  const tmp = new Vector3();
  let theme = 'dark';

  /* -- particles ------------------------------------------------------------------------- */
  const COUNT = lite ? 900 : 2600;
  const pos = new Float32Array(COUNT * 3), aB = new Float32Array(COUNT * 3), aC = new Float32Array(COUNT * 3), aR = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    // A: wide field around the view
    pos[i * 3] = (Math.random() - 0.5) * 26;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 2] = -Math.random() * 12 + 3;
    // B: calm ellipsoid cluster (offsets around a centre)
    const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1), r = Math.cbrt(Math.random());
    aB[i * 3] = Math.sin(v) * Math.cos(u) * r * 2.2;
    aB[i * 3 + 1] = Math.sin(v) * Math.sin(u) * r * 1.3;
    aB[i * 3 + 2] = Math.cos(v) * r * 1.4;
    // C: tight focal point with a faint halo
    const rc = Math.random() < 0.8 ? Math.pow(Math.random(), 2) * 0.35 : 0.35 + Math.random() * 1.4;
    aC[i * 3] = Math.sin(v) * Math.cos(u) * rc;
    aC[i * 3 + 1] = Math.sin(v) * Math.sin(u) * rc;
    aC[i * 3 + 2] = Math.cos(v) * rc;
    aR[i] = Math.random();
  }
  const pGeo = new BufferGeometry();
  pGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  pGeo.setAttribute('aB', new Float32BufferAttribute(aB, 3));
  pGeo.setAttribute('aC', new Float32BufferAttribute(aC, 3));
  pGeo.setAttribute('aRand', new Float32BufferAttribute(aR, 1));
  const pMat = new ShaderMaterial({
    vertexShader: PARTICLE_VS, fragmentShader: PARTICLE_FS, transparent: true, depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uMorphB: { value: 0 }, uMorphC: { value: 0 }, uSize: { value: lite ? 70 : 60 },
      uPR: { value: renderer.getPixelRatio() }, uCluster: { value: new Vector3() }, uFocal: { value: new Vector3() },
      uMouse: { value: new Vector2() }, uColorA: { value: new Color() }, uColorB: { value: new Color() }, uOpacity: { value: 1 }
    }
  });
  const particles = new Points(pGeo, pMat);
  particles.frustumCulled = false;
  scene.add(particles);

  /* -- core: wireframe + glass shards --------------------------------------------------- */
  const ico = new IcosahedronGeometry(1.5, 1);
  const ip = ico.getAttribute('position');
  const triCount = ip.count / 3;
  const lPos = [], lDir = [], lSeed = [], fPos = [], fDir = [], fSeed = [];
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), cen = new Vector3();
  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(ip, t * 3); b.fromBufferAttribute(ip, t * 3 + 1); c.fromBufferAttribute(ip, t * 3 + 2);
    cen.copy(a).add(b).add(c).divideScalar(3).normalize();
    const seed = Math.random();
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      lPos.push(p.x, p.y, p.z, q.x, q.y, q.z);
      for (let k = 0; k < 2; k++) { lDir.push(cen.x, cen.y, cen.z); lSeed.push(seed); }
    }
    for (const p of [a, b, c]) { fPos.push(p.x, p.y, p.z); fDir.push(cen.x, cen.y, cen.z); fSeed.push(seed); }
  }
  const mkGeo = (p, d, s) => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(p, 3));
    g.setAttribute('aDir', new Float32BufferAttribute(d, 3));
    g.setAttribute('aSeed', new Float32BufferAttribute(s, 1));
    return g;
  };
  const shardUniforms = { uSplit: { value: 0 }, uTime: { value: 0 } };
  const lineMat = new ShaderMaterial({ vertexShader: SHARD_VS, fragmentShader: LINE_FS, transparent: true, depthWrite: false,
    uniforms: { ...shardUniforms, uColor: { value: new Color() }, uOpacity: { value: 0.8 } } });
  const faceMat = new ShaderMaterial({ vertexShader: SHARD_VS, fragmentShader: FACE_FS, transparent: true, depthWrite: false,
    uniforms: { ...shardUniforms, uColor: { value: new Color() }, uOpacity: { value: 1 } } });
  const core = new Group();
  core.add(new Mesh(mkGeo(fPos, fDir, fSeed), faceMat));
  core.add(new LineSegments(mkGeo(lPos, lDir, lSeed), lineMat));
  const shell = new LineSegments(new EdgesGeometry(new IcosahedronGeometry(2.4, 0)), new LineBasicMaterial({ transparent: true, opacity: 0.12 }));
  core.add(shell);
  scene.add(core);

  /* -- skill sphere ---------------------------------------------------------------------- */
  const sphere = new Group();
  const sphereInner = new Group();
  sphere.add(sphereInner);
  const R = 1.6;
  const skillEls = Array.from(document.querySelectorAll('[data-skill]'));
  const sprites = skillEls.map((el, i) => {
    const n = skillEls.length;
    const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = i * 2.39996;
    const sp = new Sprite(new SpriteMaterial({ map: iconTexture(el.getAttribute('data-skill')), transparent: true, depthWrite: false }));
    sp.position.set(Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R);
    sp.scale.setScalar(0.5);
    sp.userData = { label: el.textContent.trim(), cat: el.getAttribute('data-cat'), hover: 0, dim: 0 };
    sphereInner.add(sp);
    return sp;
  });
  const sphereWire = new LineSegments(new EdgesGeometry(new IcosahedronGeometry(R * 0.98, 2)), new LineBasicMaterial({ transparent: true, opacity: 0.07 }));
  sphereInner.add(sphereWire);
  scene.add(sphere);

  /* -- floating panels for the projects section ---------------------------------------- */
  const panels = new Group();
  const panelMat = new ShaderMaterial({ vertexShader: PANEL_VS, fragmentShader: PANEL_FS, transparent: true, depthWrite: false,
    uniforms: { uColor: { value: new Color() }, uOpacity: { value: 0 } } });
  // kept well behind the z = 0 plane so they read as depth around the cards, not on top of them
  const PANEL_SPOTS = [[-8, 2.2, -7], [-4.5, -2.6, -5.5], [-1, 3, -8.5], [2.5, -2.2, -6], [5.5, 2.6, -7.5], [8.5, -2.8, -5.8], [11, 1.4, -8]];
  PANEL_SPOTS.forEach(([x, y, z], i) => {
    const m = new Mesh(new PlaneGeometry(2.6 + (i % 3) * 0.6, 1.6 + (i % 2) * 0.5), panelMat);
    m.position.set(x, y, z);
    m.rotation.set((i % 2 ? -1 : 1) * 0.12, (i % 3 - 1) * 0.35, (i % 2 ? 1 : -1) * 0.04);
    m.userData.baseY = y;
    panels.add(m);
  });
  scene.add(panels);

  /* -- focal glow for contact ------------------------------------------------------------ */
  const focal = new Sprite(new SpriteMaterial({ map: softDotTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }));
  focal.scale.setScalar(2.6);
  scene.add(focal);

  /* -- post pass (desktop) ---------------------------------------------------------------- */
  let rt = null, postScene = null, postCam = null, postMat = null;
  if (usePost) {
    rt = new WebGLRenderTarget(1, 1);
    postMat = new ShaderMaterial({
      vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
      uniforms: { tScene: { value: rt.texture }, uRes: { value: new Vector2(1, 1) }, uTime: { value: 0 }, uVel: { value: 0 }, uGlow: { value: 1 }, uGrain: { value: 0.035 } }
    });
    postScene = new Scene();
    postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postScene.add(new Mesh(new PlaneGeometry(2, 2), postMat));
  }

  /* -- theme ---------------------------------------------------------------------------------- */
  const bg = new Color();
  function applyTheme() {
    theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const p = PALETTE[theme];
    bg.set(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#050912');
    renderer.setClearColor(bg, 1);
    pMat.uniforms.uColorA.value.setHex(p.accent);
    pMat.uniforms.uColorB.value.setHex(p.neutral);
    pMat.blending = p.blending;
    lineMat.uniforms.uColor.value.setHex(p.accent);
    faceMat.uniforms.uColor.value.setHex(p.soft);
    faceMat.blending = p.blending;
    shell.material.color.setHex(p.neutral);
    sphereWire.material.color.setHex(p.neutral);
    panelMat.uniforms.uColor.value.setHex(p.soft);
    panelMat.blending = p.blending;
    focal.material.color.setHex(p.accent);
    focal.material.blending = p.blending;
    sprites.forEach((s) => s.material.color.setHex(p.accent));
    [pMat, lineMat, faceMat, panelMat, focal.material].forEach((m) => { m.needsUpdate = true; });
    if (postMat) { postMat.uniforms.uGlow.value = p.glow; postMat.uniforms.uGrain.value = p.grain; }
  }
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* -- layout: size, anchors, section progress --------------------------------------- */
  let W = 1, H = 1;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    if (rt) {
      const v = renderer.getDrawingBufferSize(new Vector2());
      rt.setSize(v.x, v.y);
      postMat.uniforms.uRes.value.copy(v);
    }
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const anchors = {};
  document.querySelectorAll('[data-anchor]').forEach((el) => { anchors[el.getAttribute('data-anchor')] = el; });
  const worldHeightAtZ0 = () => 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
  // project an element's screen box onto the z = 0 plane: centre + world-space height
  function anchorWorld(name, out) {
    const el = anchors[name];
    if (!el) { out.set(0, 0, 0); return 1; }
    const r = el.getBoundingClientRect();
    const nx = ((r.left + r.width / 2) / W) * 2 - 1;
    const ny = -(((r.top + r.height / 2) / H) * 2 - 1);
    tmp.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
    const k = -camera.position.z / tmp.z;
    out.copy(camera.position).addScaledVector(tmp, k);
    return (Math.min(r.height, r.width * 1.1) / H) * worldHeightAtZ0();
  }

  const sections = Array.from(document.querySelectorAll('[data-section]'));
  // section index + progress (0 = section centred); pinned sections are measured via their spacer
  let projProgress = 0;
  function scrollState() {
    const mid = H * 0.5;
    let s = 0;
    for (let i = 0; i < sections.length; i++) {
      const el = sections[i].parentElement && sections[i].parentElement.classList.contains('pin-spacer') ? sections[i].parentElement : sections[i];
      const r = el.getBoundingClientRect();
      if (i === 3) projProgress = clamp01((H - r.top) / (r.height + H * 0.2));
      if (mid < r.top) { s = i - 0.5; break; }
      if (mid < r.bottom || i === sections.length - 1) { s = i - 0.5 + clamp01((mid - r.top) / r.height); break; }
    }
    return Math.max(0, Math.min(sections.length - 1, s));
  }

  /* -- interaction: mouse inertia, sphere drag, hover label ------------------------------ */
  window.addEventListener('pointermove', (e) => {
    mouse.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1);
  }, { passive: true });

  const orbit = document.querySelector('[data-orbit]');
  // velocities in radians per second; released drags keep spinning and ease back to auto-rotate
  const AUTO_SPIN = 0.25;
  const drag = { on: false, x: 0, y: 0, t: 0, vx: 0, vy: AUTO_SPIN };
  const tiltX = (v) => Math.max(-1, Math.min(1, v));
  if (orbit) {
    orbit.addEventListener('pointerdown', (e) => {
      drag.on = true; drag.x = e.clientX; drag.y = e.clientY; drag.t = performance.now();
      orbit.setPointerCapture(e.pointerId);
    });
    orbit.addEventListener('pointermove', (e) => {
      if (!drag.on) return;
      const now = performance.now(), dtE = Math.max((now - drag.t) / 1000, 0.008);
      const ry = (e.clientX - drag.x) * 0.006, rx = (e.clientY - drag.y) * 0.006;
      sphereInner.rotation.y += ry;
      sphereInner.rotation.x = tiltX(sphereInner.rotation.x + rx);
      drag.vy = ry / dtE; drag.vx = rx / dtE;
      drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
    });
    const end = () => { drag.on = false; };
    orbit.addEventListener('pointerup', end);
    orbit.addEventListener('pointercancel', end);
  }
  let activeCat = null;
  document.addEventListener('skills:category', (e) => { activeCat = e.detail; });

  const label = document.querySelector('.scene__label');
  const raycaster = new Raycaster();
  let hovered = null;

  let scrollVel = 0, lastScroll = window.scrollY;
  let sEased = scrollState();

  /* -- render loop ------------------------------------------------------------------------ */
  const target = { core: new Vector3(), coreNext: new Vector3(), cl: new Vector3(), clNext: new Vector3(), sp: new Vector3(), foc: new Vector3() };
  let raf = 0, last = 0, time = 0;

  function frame(now) {
    if (document.hidden) { raf = 0; return; }
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    time += dt;

    // scroll -> eased section state (scrub with inertia)
    const sTarget = scrollState();
    sEased += (sTarget - sEased) * (1 - Math.exp(-dt * 5));
    const y = window.scrollY;
    scrollVel += (Math.min(Math.abs(y - lastScroll) / Math.max(dt, 0.001) / 1800, 1) - scrollVel) * 0.15;
    lastScroll = y;

    const i0 = Math.min(Math.floor(sEased), STATES.length - 1), i1 = Math.min(i0 + 1, STATES.length - 1);
    const t = easeInOut(sEased - i0);
    const A = STATES[i0], B = STATES[i1];
    const mix = (k) => lerp(A[k], B[k], t);

    mouseEased.lerp(mouse, 1 - Math.exp(-dt * 3));

    // camera path
    camera.position.set(lerp(A.cam[0], B.cam[0], t) + mouseEased.x * 0.25 + (B.panels * t + A.panels * (1 - t)) * (projProgress - 0.5) * 2.4,
                        lerp(A.cam[1], B.cam[1], t) + mouseEased.y * 0.18,
                        lerp(A.cam[2], B.cam[2], t));
    camera.rotation.set(0, 0, mix('roll'));
    camera.updateMatrixWorld();

    // core (shards): position between this state's anchor and the next one's
    const hA = anchorWorld(A.coreAt, target.core), hB = anchorWorld(B.coreAt, target.coreNext);
    core.position.lerpVectors(target.core, target.coreNext, t);
    const coreOpacity = mix('core');
    core.visible = coreOpacity > 0.01;
    core.scale.setScalar(Math.max(0.001, lerp(hA * A.coreScale, hB * B.coreScale, t) / 1.5));
    core.rotation.y += dt * (0.18 + (1 - mix('split')) * 0.1);
    core.rotation.x = lerp(core.rotation.x, mouseEased.y * 0.4, 1 - Math.exp(-dt * 2));
    core.rotation.z = lerp(core.rotation.z, -mouseEased.x * 0.25, 1 - Math.exp(-dt * 2));
    shardUniforms.uSplit.value = mix('split');
    shardUniforms.uTime.value = time;
    lineMat.uniforms.uOpacity.value = 0.75 * coreOpacity;
    faceMat.uniforms.uOpacity.value = PALETTE[theme].faces * 2 * coreOpacity;
    shell.material.opacity = 0.12 * coreOpacity;

    // particles
    anchorWorld(A.clusterAt, target.cl); anchorWorld(B.clusterAt, target.clNext);
    pMat.uniforms.uCluster.value.lerpVectors(target.cl, target.clNext, t);
    anchorWorld('contact', target.foc);
    pMat.uniforms.uFocal.value.copy(target.foc);
    pMat.uniforms.uMorphB.value = mix('morphB');
    pMat.uniforms.uMorphC.value = mix('morphC');
    pMat.uniforms.uOpacity.value = mix('field') * (theme === 'light' ? 0.7 : 1);
    pMat.uniforms.uMouse.value.copy(mouseEased);
    pMat.uniforms.uTime.value = time;

    // skill sphere
    const sphereW = mix('sphere');
    sphere.visible = sphereW > 0.01;
    if (sphere.visible) {
      const hs = anchorWorld('skills', target.sp);
      sphere.position.copy(target.sp);
      sphere.scale.setScalar((hs * 0.4) / (R + 0.3) * (0.85 + 0.15 * sphereW));
      if (!drag.on) {
        drag.vy += (AUTO_SPIN - drag.vy) * (1 - Math.exp(-dt * 1.2));
        drag.vx *= Math.exp(-dt * 3);
        sphereInner.rotation.y += drag.vy * dt;
        sphereInner.rotation.x = tiltX(sphereInner.rotation.x + drag.vx * dt);
      }
      sphereWire.material.opacity = 0.07 * sphereW;

      // hover
      hovered = null;
      if (sphereW > 0.6) {
        raycaster.setFromCamera(mouse, camera);
        const hit = raycaster.intersectObjects(sprites, false)[0];
        if (hit) hovered = hit.object;
      }
      sprites.forEach((sp) => {
        const u = sp.userData;
        u.hover += ((sp === hovered ? 1 : 0) - u.hover) * (1 - Math.exp(-dt * 10));
        u.dim += (((activeCat && u.cat !== activeCat) ? 1 : 0) - u.dim) * (1 - Math.exp(-dt * 6));
        sp.scale.setScalar(0.5 + u.hover * 0.2 + (activeCat && u.cat === activeCat ? 0.06 : 0));
        sp.material.opacity = sphereW * (1 - u.dim * 0.7);
      });
      if (label) {
        if (hovered) {
          hovered.getWorldPosition(tmp).project(camera);
          label.textContent = hovered.userData.label;
          label.style.transform = `translate(${((tmp.x + 1) / 2) * W + 18}px, ${((1 - tmp.y) / 2) * H - 14}px)`;
          label.classList.add('is-on');
        } else label.classList.remove('is-on');
      }
      if (orbit) orbit.style.cursor = hovered ? 'pointer' : '';
    } else if (label) label.classList.remove('is-on');

    // panels
    const panelW = mix('panels');
    panels.visible = panelW > 0.01;
    if (panels.visible) {
      panelMat.uniforms.uOpacity.value = panelW * 0.6;
      panels.position.x = lerp(3, -6, projProgress);
      panels.children.forEach((m, k) => { m.position.y = m.userData.baseY + Math.sin(time * 0.5 + k) * 0.12; m.rotation.y += Math.sin(time * 0.3 + k) * 0.0008; });
    }

    // focal glow
    const focW = mix('morphC');
    focal.visible = focW > 0.01;
    focal.position.copy(target.foc);
    focal.material.opacity = focW * (0.8 + 0.2 * Math.sin(time * 2));

    // draw
    if (rt) {
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      postMat.uniforms.uTime.value = time;
      postMat.uniforms.uVel.value = scrollVel;
      renderer.render(postScene, postCam);
    } else {
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
  document.addEventListener('visibilitychange', start);
  start();
  requestAnimationFrame(() => document.documentElement.classList.add('has-3d'));
}
