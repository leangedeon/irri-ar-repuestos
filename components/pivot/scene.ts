// Escena 3D del visor: pivot, suelo, luces, resaltado y cámara que vuela a cada zona.
// Se carga bajo demanda (import dinámico) para no sumar three.js al resto de la tienda.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { isZone, ZONES, type Zone } from '@/lib/zones';
import { buildPivot, REACH } from './model.js';

// Vista de cada zona: dirección (en el marco de su grupo) y distancia.
const VIEW: Record<Zone, { dir: [number, number, number]; dist: number }> = {
  punto: { dir: [-0.6, 0.5, -1], dist: 9 },
  colector: { dir: [1, 0.7, -1], dist: 7 },
  tablero: { dir: [0.3, 0.3, -1], dist: 6 },
  tramo: { dir: [0.35, 0.5, -1], dist: 13 },
  cercha: { dir: [0.15, 0.2, -1], dist: 14 },
  cable: { dir: [0.25, 0.3, -1], dist: 8 },
  torre: { dir: [0.9, 0.35, -1], dist: 8 },
  cajaTorre: { dir: [-0.7, 0.35, -1], dist: 6 },
  motor: { dir: [-0.9, 0.55, -0.8], dist: 5.5 },
  reductor: { dir: [-0.8, 0.5, 0.9], dist: 5.5 },
  rueda: { dir: [1, 0.3, -0.85], dist: 7 },
  bajante: { dir: [0.4, 0.15, -1], dist: 7.5 },
  aspersor: { dir: [0.6, 0.3, -1], dist: 4.2 },
  canon: { dir: [1.1, 0.55, -0.8], dist: 8 },
};

export type Spot = { zone: Zone; x: number; y: number; show: boolean };

export type SceneApi = {
  /** Zonas resaltadas; la cámara va a la primera (o al plano general si no hay). */
  setActive(zones: Zone[]): void;
  dispose(): void;
};

type Opts = {
  onHover(zone: Zone | null, x: number, y: number): void;
  onPick(zone: Zone): void;
  onSpots(list: Spot[]): void;
  isEnabled(zone: Zone): boolean;
};

function groundTexture() {
  const s = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  // círculo regado: verde con surcos concéntricos; afuera, rastrojo
  g.fillStyle = '#b9b08a';
  g.fillRect(0, 0, s, s);
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, '#7f9a52');
  grd.addColorStop(0.9, '#748f4a');
  grd.addColorStop(0.985, '#6f8746');
  grd.addColorStop(1, 'rgba(111,135,70,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(52,70,30,0.22)';
  g.lineWidth = 2;
  for (let r = 14; r < s / 2 - 4; r += 9) {
    g.beginPath();
    g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createScene(host: HTMLElement, canvas: HTMLCanvasElement, opts: Opts): SceneApi {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe4ecee, 170, 420);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.2, 800);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xdcecff, 0x6b5a3a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-40, 70, -30);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -REACH - 4;
  sc.right = sc.top = REACH + 4;
  sc.near = 10;
  sc.far = 200;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const tex = groundTexture();
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(REACH + 60, 72).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 })
  );
  // la textura cubre el círculo regado (radio REACH + 4) dentro de un disco mayor
  const R = REACH + 60;
  const k = (REACH + 4) / R;
  tex.repeat.set(1 / k, 1 / k);
  tex.offset.set(0.5 - 0.5 / k, 0.5 - 0.5 / k);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  ground.receiveShadow = true;
  scene.add(ground);

  const pivot = buildPivot();
  const anchors = pivot.anchors as Record<Zone, { parent: THREE.Object3D; local: THREE.Vector3 }>;
  pivot.arm.rotation.y = 0;
  scene.add(pivot.root);
  pivot.root.updateMatrixWorld(true);
  // Caja del equipo completo, para encuadrarlo entero en la vista general.
  const bounds = new THREE.Box3().setFromObject(pivot.root);
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
    (i) => new THREE.Vector3(i & 1 ? bounds.max.x : bounds.min.x, i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z)
  );
  const probe = new THREE.PerspectiveCamera();

  const meshes: THREE.Object3D[] = [...pivot.centerMeshes, ...pivot.armMeshes];
  const byZone = new Map<Zone, THREE.Object3D[]>();
  for (const m of meshes) {
    const z = m.userData.partId as string | undefined;
    if (z && isZone(z)) byZone.set(z, [...(byZone.get(z) ?? []), m]);
  }

  // ---------- resaltado ----------
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
  outline.visibleEdgeColor.set(0xe0182b);
  outline.hiddenEdgeColor.set(0xff8a8a);
  outline.edgeStrength = 5;
  outline.edgeThickness = 1.2;
  outline.edgeGlow = 0.5;
  composer.addPass(outline);
  composer.addPass(new OutputPass());

  let active: Zone[] = [];
  let hovered: Zone | null = null;
  const refreshOutline = () => {
    const set = new Set<Zone>([...active, ...(hovered ? [hovered] : [])]);
    outline.selectedObjects = [...set].flatMap((z) => byZone.get(z) ?? []);
    outline.pulsePeriod = active.length && !reduceMotion ? 2.6 : 0;
  };

  // ---------- cámara ----------
  const base = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  let tween: { start: number; dur: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; pose: typeof base } | null = null;
  const aspect = () => host.clientWidth / Math.max(host.clientHeight, 1);

  const anchorWorld = (z: Zone) => {
    const a = anchors[z];
    return a.local.clone().applyMatrix4(a.parent.matrixWorld);
  };
  // Vista general: desde arriba y de costado, a la distancia justa para que entre todo el pivot.
  const HOME_DIR = new THREE.Vector3(-1, 0.62, -0.72).normalize();
  const homePose = () => {
    const target = bounds.getCenter(new THREE.Vector3());
    target.y = 1.6;
    probe.fov = camera.fov;
    probe.aspect = camera.aspect;
    probe.near = camera.near;
    probe.far = camera.far;
    probe.updateProjectionMatrix();
    const fits = (d: number) => {
      probe.position.copy(target).addScaledVector(HOME_DIR, d);
      probe.lookAt(target);
      probe.updateMatrixWorld();
      return corners.every((c) => {
        const p = c.clone().project(probe);
        return Math.abs(p.x) < 0.99 && Math.abs(p.y) < 0.92;
      });
    };
    let lo = 5;
    let hi = 400;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    return { target, pos: target.clone().addScaledVector(HOME_DIR, hi) };
  };
  const zonePose = (z: Zone) => {
    const v = VIEW[z];
    const target = anchorWorld(z);
    const q = anchors[z].parent.getWorldQuaternion(new THREE.Quaternion());
    const kk = THREE.MathUtils.clamp(1.3 / aspect(), 1, 1.6);
    const off = new THREE.Vector3(...v.dir).normalize().applyQuaternion(q).multiplyScalar(v.dist * kk);
    const pos = target.clone().add(off);
    pos.y = Math.max(pos.y, 0.8);
    return { pos, target };
  };
  const poseNow = () => (active[0] ? zonePose(active[0]) : homePose());
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  const moveTo = (pose: typeof base, dur = 1.1) => {
    tween = { start: performance.now(), dur: reduceMotion ? 1 : dur * 1000, fromPos: base.pos.clone(), fromTarget: base.target.clone(), pose };
  };

  // ---------- puntero ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (e: PointerEvent | MouseEvent): Zone | null => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(meshes, false).find((h) => isZone(h.object.userData.partId ?? ''));
    const z = hit ? (hit.object.userData.partId as Zone) : null;
    return z && opts.isEnabled(z) ? z : null;
  };
  const setHover = (z: Zone | null) => {
    if (hovered === z) return;
    hovered = z;
    refreshOutline();
    wake();
  };
  let pending: PointerEvent | null = null;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      pending = e;
      wake();
    }
  };
  const onLeave = () => {
    pending = null;
    setHover(null);
    opts.onHover(null, 0, 0);
    canvas.style.cursor = '';
  };
  let downAt: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY });
  const onClick = (e: MouseEvent) => {
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    const z = pick(e);
    if (z) opts.onPick(z);
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('click', onClick);

  const processHover = () => {
    if (!pending) return;
    const e = pending;
    pending = null;
    const z = pick(e);
    setHover(z);
    canvas.style.cursor = z ? 'pointer' : '';
    const r = host.getBoundingClientRect();
    opts.onHover(z, e.clientX - r.left, e.clientY - r.top);
  };

  // ---------- estado del bucle ----------
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  const swayed = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  let t = 0;
  let raf = 0;
  let inView = true;
  let idleFrames = 0;

  // ---------- tamaño ----------
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    if (!tween) Object.assign(base, poseNow());
    wake();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // intro: acercamiento suave
  {
    const home = poseNow();
    base.target.copy(home.target);
    base.pos.copy(home.pos).sub(home.target).multiplyScalar(1.3).add(home.target).add(new THREE.Vector3(0, 5, 0));
    moveTo(home, 2);
  }

  // ---------- bucle (solo mientras se ve) ----------

  function frame() {
    raf = 0;
    const dt = Math.min(clock.getDelta(), 1 / 20);
    if (!reduceMotion) t += dt;
    processHover();
    if (tween) {
      const kk = ease(Math.min(1, (performance.now() - tween.start) / tween.dur));
      base.pos.lerpVectors(tween.fromPos, tween.pose.pos, kk);
      base.target.lerpVectors(tween.fromTarget, tween.pose.target, kk);
      if (kk >= 1) tween = null;
    }
    // balanceo sutil alrededor del objetivo
    swayed.copy(base.pos).sub(base.target);
    swayed.applyAxisAngle(Y, Math.sin(t * 0.18) * 0.035);
    swayed.y += Math.sin(t * 0.27) * 0.15;
    camera.position.copy(base.target).add(swayed);
    camera.lookAt(base.target);

    const w = host.clientWidth;
    const h = host.clientHeight;
    opts.onSpots(
      ZONES.map((zone) => {
        tmp.copy(anchorWorld(zone));
        tmp.project(camera);
        const show = tmp.z < 1 && Math.abs(tmp.x) < 0.94 && Math.abs(tmp.y) < 0.9;
        return { zone, x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, show };
      })
    );
    composer.render();

    // Con movimiento reducido, se deja de dibujar cuando la cámara llega.
    if (reduceMotion && !tween && !pending) idleFrames++;
    else idleFrames = 0;
    if (inView && !document.hidden && idleFrames < 3) raf = requestAnimationFrame(frame);
  }
  function wake() {
    idleFrames = 0;
    if (!raf && inView && !document.hidden) {
      clock.getDelta();
      raf = requestAnimationFrame(frame);
    }
  }
  const io = new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView) wake();
  });
  io.observe(host);
  const onVis = () => wake();
  document.addEventListener('visibilitychange', onVis);
  wake();

  return {
    setActive(zones) {
      const next = zones.filter(isZone);
      if (next.join() === active.join()) return;
      active = next;
      refreshOutline();
      moveTo(poseNow());
      wake();
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('click', onClick);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      Object.values(pivot.materials as Record<string, THREE.Material>).forEach((m) => m.dispose());
      tex.dispose();
      envTex.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}

