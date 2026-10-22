// Rosie's demo hand: a cream "instruction drawing" hand with a plum outline. The part that moves turns pink.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

export const CREAM = new THREE.MeshToonMaterial({color:0xfbf6f2});
export const PINK = new THREE.MeshToonMaterial({color:0xe2559b});
const OUT = new THREE.MeshBasicMaterial({color:0x2b1f2a, side:THREE.BackSide});
const FINGERS = [[.78, 1.02, -.13, .3, [.72, .62]], [.27, 1.12, -.03, .31, [.82, .66]], [-.25, 1.07, .07, .3, [.74, .6]], [-.74, .9, .2, .26, [.56, .5]]];

export function buildHand(){
  const hand = new THREE.Group(), fingers = [];
  const add = (parent, geo, k = 1.06) => {
    const m = new THREE.Mesh(geo, CREAM); m.castShadow = true; parent.add(m);
    const o = new THREE.Mesh(geo, OUT); o.scale.setScalar(k); m.add(o); return m;
  };
  const palm = add(hand, new RoundedBoxGeometry(2.25, 2.15, 1.05, 8, .7), 1.04); palm.position.set(0, .1, 0);
  const prof = [];
  for (let i = 0; i <= 24; i++){ const t = i / 24, y = -2.05 + t * 1.55; const r = t < .12 ? .8 * Math.sin(t / .12 * Math.PI / 2) : .8 + .16 * Math.pow(Math.max(0, (t - .5) / .5), 2); prof.push(new THREE.Vector2(Math.max(.001, r), y)); }
  const wrist = add(hand, new THREE.LatheGeometry(prof, 48), 1.04); wrist.scale.z = .56;
  function digit(x, y, z, rotZ, rotX, r, lens){
    const root = new THREE.Group(); root.position.set(x, y, z); root.rotation.z = rotZ; root.rotation.x = rotX; hand.add(root);
    let cur = root; const segs = [], meshes = [];
    lens.forEach((len, k) => {
      const seg = new THREE.Group(); seg.rotation.x = k ? .1 : 0; cur.add(seg); segs.push(seg);
      meshes.push(add(seg, new THREE.SphereGeometry(r, 28, 20)));
      const b = add(seg, new THREE.CapsuleGeometry(r, len, 8, 28)); b.position.y = len / 2; meshes.push(b);
      const nx = new THREE.Group(); nx.position.y = len; seg.add(nx); cur = nx;
    });
    const f = {root, segs, rotZ, rotX, paint(on){ meshes.forEach(m => m.material = on ? PINK : CREAM); }};
    fingers.push(f); return f;
  }
  FINGERS.forEach(([x, y, s, r, l]) => digit(x, y, 0, s, 0, r, l));
  digit(.98, -.2, .1, -.95, 0, .33, [.56, .5]);       // thumb = fingers[4]
  hand.scale.setScalar(.86);
  return {hand, fingers};
}

export function makeStage(canvas){
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4ec, 0xd9c2b4, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(1.5, 8, 3.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {left:-5, right:5, top:5, bottom:-5}); scene.add(key);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({opacity:.16}));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  let rig = null, anim = null, t0 = 0, raf = 0;
  const size = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const loop = now => { raf = requestAnimationFrame(loop); size(); if (anim) anim((now - t0) / 1000); renderer.render(scene, camera); };

  function clear(){ if (rig){ scene.remove(rig.hand); rig = null; } anim = null; }
  // FINGER WALK: palm down, seen from her side (thumb on the left); each finger in turn lifts and slides toward the thumb
  function fingerWalk(onFinger){
    clear(); rig = buildHand(); scene.add(rig.hand);
    rig.hand.rotation.set(Math.PI / 2, 0, 0); rig.hand.position.set(0, .45, 0); table.position.y = 0;
    camera.position.set(-.5, 11.2, -5.6); camera.lookAt(.15, 0, .9);
    rig.fingers[4].root.rotation.z = -1.55;                     // thumb moved out to the side
    const STEP = 1.5, PAUSE = 1.2, CYCLE = 4 * STEP + PAUSE; let last = -1;
    t0 = performance.now();
    anim = t => {
      const c = t % CYCLE, i = Math.min(4, Math.floor(c / STEP));
      rig.fingers.slice(0, 4).forEach((f, k) => {
        const local = c - k * STEP, p = k < i ? 1 : k === i ? Math.min(1, Math.max(0, local / (STEP * .8))) : 0, e = p * p * (3 - 2 * p);
        const done = c >= 4 * STEP + PAUSE * .7;                  // everyone slides home before the next cycle
        f.root.rotation.z = f.rotZ - (done ? 0 : .5 * e);
        f.root.rotation.x = -(k === i ? Math.sin(Math.PI * e) * .45 : 0);
        f.paint(k === i);
      });
      const cur = i < 4 ? i : -1; if (cur !== last){ last = cur; onFinger && onFinger(cur, Math.floor(t / CYCLE)); }
    };
    return CYCLE;
  }
  // FIST STRETCH: handshake position; fingers curl, thumb wraps outside, hold, open
  function fist(mode = 'loop'){
    clear(); rig = buildHand(); scene.add(rig.hand);
    rig.hand.rotation.set(0, -.5, -Math.PI / 2); rig.hand.position.set(-.3, .25, 0); table.position.y = -1.0;
    camera.position.set(5.6, 2.6, 7.6); camera.lookAt(0, .1, 0);
    const pose = k => {
      rig.fingers.slice(0, 4).forEach(f => { f.segs[0].rotation.x = k * 1.5; f.segs[1].rotation.x = .1 + k * 1.6; });
      const th = rig.fingers[4], t = Math.max(0, (k - .5) / .5);
      th.root.rotation.z = -.95 + t * 1.35; th.root.rotation.x = t * .95; th.segs[1].rotation.x = .1 + t * .5;
      rig.fingers.forEach(f => f.paint(k > .02));
    };
    t0 = performance.now();
    if (mode === 'hold'){ pose(1); anim = null; return 0; }
    if (mode === 'flat'){ pose(0); anim = null; return 0; }
    const CYCLE = 6;   // 0-2 s curl, 2-4 hold, 4-6 open
    anim = t => { const c = t % CYCLE, k = c < 2 ? c / 2 : c < 4 ? 1 : 1 - (c - 4) / 2; pose(k * k * (3 - 2 * k)); };
    return CYCLE;
  }
  raf = requestAnimationFrame(loop);
  return {fingerWalk, fist, clear, stop(){ cancelAnimationFrame(raf); }};
}
