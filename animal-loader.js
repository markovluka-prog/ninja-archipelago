// animal-loader.js — достаёт готовых животных из animals/*.html (там они лежат внутри страниц-просмотрщиков)
// и превращает их в обычные THREE.Group, которые можно поставить в любую сцену и двигать.
// Приём: берём inline-модуль страницы, подменяем renderer/сцену/UI заглушками, запускаем,
// забираем window.animal.root и «пульс» анимации (rAF/setAnimationLoop) — вызываем его сами каждый кадр.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const srcCache = new Map();
const noop = () => {};
const lazy = o => new Proxy(o, { get: (t, k) => (k in t ? t[k] : (k === 'then' ? undefined : noop)), set: (t, k, v) => (t[k] = v, true) });

async function getSource(url) {
  if (srcCache.has(url)) return srcCache.get(url);
  const html = await (await fetch(url)).text();
  const m = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].pop();
  if (!m) throw new Error('нет module-скрипта в ' + url);
  const code = m[1].replace(/^\s*import\s[^;\n]*;?\s*$/gm, '');
  // falcon.html: Object.assign(mesh,{position:…}) падает на read-only position → заменяем на .position.set
  const code2 = code.replace(/Object\.assign\((ell\([^\n]*?\)),\{position:new THREE\.Vector3\(([^)]*)\)\}\)/g, '((m_)=>{m_.position.set($2);return m_})($1)');
  const fn = new Function('THREE', 'OrbitControls', 'RoomEnvironment', 'mergeGeometries', 'mergeVertices', 'document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame', code2);
  srcCache.set(url, fn);
  return fn;
}

export async function loadAnimal(url) {
  const fn = await getSource(url);
  const T = { ...THREE };
  let loop = null;
  T.WebGLRenderer = class {
    constructor() { this.domElement = document.createElement('canvas'); this.shadowMap = {}; this.info = { render: { triangles: 0 } }; this.capabilities = { getMaxAnisotropy: () => 4 }; return lazy(this); }
    setAnimationLoop(f) { loop = f; }
  };
  T.PMREMGenerator = class { fromScene() { return { texture: null }; } dispose() {} };
  const els = new Map();
  const fakeDoc = new Proxy({}, {
    get(_, k) {
      if (k === 'createElement') return t => document.createElement(t);
      if (k === 'getElementById') return id => els.get(id) || (els.set(id, document.createElement('div')), els.get(id));
      if (k === 'querySelector') return () => document.createElement('div');
      if (k === 'querySelectorAll') return () => [];
      if (k === 'body') return { appendChild: noop, classList: { add: noop, remove: noop, toggle: noop }, style: {} };
      const v = document[k]; return typeof v === 'function' ? v.bind(document) : v;
    },
  });
  const fakeWin = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (typeof window[k] === 'function' ? window[k].bind(window) : window[k])), set: (t, k, v) => (t[k] = v, true) });
  const raf = f => { loop = f; return 1; };
  const Orbit = class { constructor() { this.target = new THREE.Vector3(); return lazy(this); } update() {} };
  fn(T, Orbit, class {}, mergeGeometries, mergeVertices, fakeDoc, fakeWin, raf, noop);
  const a = fakeWin.animal;
  if (!a || !a.root) throw new Error('животное не создалось: ' + url);
  const clips = Array.isArray(a.clips) ? a.clips : Object.keys(a.clips || {});
  const set = a.setClip || a.play || noop;
  const root = a.root;
  if (root.parent) root.parent.remove(root);
  // нормализация: «нос» → +Z, низ → y=0, длина (макс. горизонтальный размер в покое) известна
  const holder = new THREE.Group(); holder.add(root);
  const idle = clips.find(c => /idle|покой/i.test(c)) || clips[0];
  const setC = a.setClip || a.play || noop;
  try { setC(idle, 0, true); } catch (e) { /* ignore */ }
  if (loop) try { loop(performance.now()); } catch (e) { /* ignore */ }
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(root), ctr = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3());
  let facing = 0;
  const head = a.parts && (a.parts.head || a.parts.Head);
  if (head && head.getWorldPosition) { const hp = head.getWorldPosition(new THREE.Vector3()); const dx = hp.x - ctr.x, dz = hp.z - ctr.z; facing = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI); }
  root.rotation.y -= facing; root.updateMatrixWorld(true);
  const bb2 = new THREE.Box3().setFromObject(root); root.position.y -= bb2.min.y;
  const length = Math.max(size.x, size.z);
  return {
    root: holder, inner: root, facing, size, length, clips,
    setClip: (name, ...r) => { try { set(name, ...r); } catch (e) { console.warn('setClip', url, name, e.message); } },
    tick: t => { if (loop) try { loop(t); } catch (e) { /* игнор */ } },
    api: a,
  };
}
