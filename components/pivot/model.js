// Modelo 3D del pivot (portado de la plataforma anterior). Cada malla lleva `userData.partId` = zona (lib/zones.ts).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Dimensiones (1 unidad ≈ 0,9 m)
export const H = 4.6; // altura del caño
export const SPANS = 3;
export const L = 13; // largo de tramo
export const OVERHANG = 6;
export const WHEEL_R = 0.87;
export const TOWER_W = 1.9; // media trocha (ruedas adelante / atrás)
export const REACH = SPANS * L + OVERHANG;
export const TOWER_X = Array.from({ length: SPANS }, (_, i) => (i + 1) * L);

const PIPE_R = 0.14;
const DROP_Z = 0.24;
const DROP_BOTTOM = 1.4;

const mat = {
  galv: new THREE.MeshStandardMaterial({ color: 0xc4cad0, metalness: 0.8, roughness: 0.36 }),
  galvDark: new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 0.75, roughness: 0.45 }),
  red: new THREE.MeshStandardMaterial({ color: 0xd2352b, metalness: 0.1, roughness: 0.42 }),
  hose: new THREE.MeshStandardMaterial({ color: 0xcc2f26, metalness: 0.05, roughness: 0.55 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x1c1c1c, metalness: 0, roughness: 0.92 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xdfe3e6, metalness: 0.65, roughness: 0.3 }),
  cable: new THREE.MeshStandardMaterial({ color: 0x1f2326, metalness: 0.2, roughness: 0.6 }),
  gear: new THREE.MeshStandardMaterial({ color: 0x3a4047, metalness: 0.5, roughness: 0.5 }),
  motor: new THREE.MeshStandardMaterial({ color: 0x55606b, metalness: 0.55, roughness: 0.42 }),
  box: new THREE.MeshStandardMaterial({ color: 0xa9b0b6, metalness: 0.4, roughness: 0.5 }),
  screen: new THREE.MeshStandardMaterial({ color: 0x0d1512, metalness: 0.2, roughness: 0.25, emissive: 0x1d6b3e, emissiveIntensity: 0.6 }),
  plate: new THREE.MeshStandardMaterial({ color: 0x2b7bd8, metalness: 0.1, roughness: 0.4 }),
  regulator: new THREE.MeshStandardMaterial({ color: 0xe9ebe6, metalness: 0.05, roughness: 0.5 }),
};

// ---------- helpers de geometría ----------

const UP = new THREE.Vector3(0, 1, 0);

function rod(a, b, r, seg = 6) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
  g.applyQuaternion(q);
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

const v = (x, y, z) => new THREE.Vector3(x, y, z);

function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function cylX(r, len, x, y, z, seg = 14) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

function cylY(r, len, x, y, z, seg = 14) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.translate(x, y, z);
  return g;
}

function cylZ(r, len, x, y, z, seg = 14) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

// Acumula geometrías por (parte, material) y luego crea una malla por combinación.
class Bucket {
  constructor() {
    this.map = new Map();
  }
  add(partId, material, geo) {
    const key = `${partId}|${material.uuid}`;
    if (!this.map.has(key)) this.map.set(key, { partId, material, geos: [] });
    this.map.get(key).geos.push(geo);
  }
  build(parent) {
    const meshes = [];
    for (const { partId, material, geos } of this.map.values()) {
      const mesh = new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g : g))), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (partId) mesh.userData.partId = partId;
      parent.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }
}

// ---------- rueda ----------

function wheelGeometries() {
  const tire = new THREE.TorusGeometry(WHEEL_R - 0.22, 0.22, 10, 32);
  tire.rotateY(Math.PI / 2);
  const lugs = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const g = new THREE.BoxGeometry(0.36, 0.07, 0.12);
    g.rotateY(i % 2 ? 0.45 : -0.45);
    g.translate(0, WHEEL_R - 0.01, 0);
    g.rotateX(a);
    lugs.push(g);
  }
  const tread = mergeGeometries([tire, ...lugs]);
  const rimDisc = cylX(0.5, 0.32, 0, 0, 0, 20);
  const hub = cylX(0.16, 0.42, 0, 0, 0, 10);
  const bolts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    bolts.push(cylX(0.03, 0.46, 0, Math.cos(a) * 0.24, Math.sin(a) * 0.24, 6));
  }
  return { tread, rim: mergeGeometries([rimDisc, hub, ...bolts]) };
}

// ---------- pivot ----------

export function buildPivot() {
  const root = new THREE.Group();
  const center = new THREE.Group(); // estructura fija
  const arm = new THREE.Group(); // todo lo que gira
  root.add(center, arm);

  const anchors = {}; // partId -> { parent, local }
  const anchor = (id, parent, x, y, z) => (anchors[id] = { parent, local: v(x, y, z) });

  // ===== punto pivote (fijo) =====
  const cb = new Bucket();
  const B = 1.9;
  const legTop = H - 1.15;
  const corners = [
    [B, B],
    [B, -B],
    [-B, -B],
    [-B, B],
  ];
  for (const [x, z] of corners) {
    cb.add('punto', mat.galv, rod(v(x, 0.35, z), v(x * 0.12, legTop, z * 0.12), 0.07));
  }
  for (let i = 0; i < 4; i++) {
    const [x1, z1] = corners[i];
    const [x2, z2] = corners[(i + 1) % 4];
    cb.add('punto', mat.galv, rod(v(x1, 0.35, z1), v(x2, 0.35, z2), 0.09));
    for (const t of [0.33, 0.62]) {
      const s = 1 - t * 0.88;
      const y = 0.35 + (legTop - 0.35) * t;
      cb.add('punto', mat.galv, rod(v(x1 * s, y, z1 * s), v(x2 * s, y, z2 * s), 0.045));
    }
    // diagonal
    cb.add('punto', mat.galv, rod(v(x1, 0.35, z1), v(x2 * 0.7, 0.35 + (legTop - 0.35) * 0.33, z2 * 0.7), 0.035));
  }
  // caño de entrada y riser
  cb.add('punto', mat.galv, cylY(0.21, H - 0.75, 0, (H - 0.75) / 2, 0, 18));
  cb.add('punto', mat.galv, cylX(0.16, B * 1.6, -B * 0.8, 0.55, 0.0, 14));
  cb.add('punto', mat.galvDark, cylY(0.3, 0.12, 0, 0.75, 0, 18)); // brida
  // ruedas de remolque
  const { tread, rim } = wheelGeometries();
  for (const [x, z] of corners) {
    const t = tread.clone().scale(0.62, 0.62, 0.62).translate(x * 1.05, 0.5, z * 1.05);
    const r = rim.clone().scale(0.62, 0.62, 0.62).translate(x * 1.05, 0.5, z * 1.05);
    cb.add('punto', mat.rubber, t);
    cb.add('punto', mat.rim, r);
  }
  anchor('punto', center, -1.45, 0.9, -1.45);

  // anillo colector
  cb.add('colector', mat.galvDark, cylY(0.34, 0.42, 0, H - 0.98, 0, 20));
  cb.add('colector', mat.galvDark, cylY(0.38, 0.06, 0, H - 0.75, 0, 20));
  cb.add('colector', mat.cable, rod(v(0.3, H - 1.0, 0.1), v(0.6, 2.3, 0.95), 0.03));
  anchor('colector', center, 0, H - 0.9, 0);

  // tablero de control
  const pz = -1.05;
  cb.add('tablero', mat.red, box(0.82, 1.0, 0.36, 0, 2.15, pz));
  cb.add('tablero', mat.red, box(0.9, 0.08, 0.44, 0, 2.69, pz));
  cb.add('tablero', mat.screen, box(0.34, 0.22, 0.02, 0, 2.3, pz - 0.19));
  cb.add('tablero', mat.box, box(0.12, 0.12, 0.04, -0.2, 1.95, pz - 0.19));
  cb.add('tablero', mat.box, box(0.12, 0.12, 0.04, 0.0, 1.95, pz - 0.19));
  cb.add('tablero', mat.red, cylZ(0.05, 0.06, 0.2, 1.95, pz - 0.2, 10));
  cb.add(null, mat.galv, rod(v(-0.9, 1.9, -0.92), v(0.9, 1.9, -0.92), 0.04));
  anchor('tablero', center, 0, 2.2, pz - 0.2);

  const centerMeshes = cb.build(center);

  // ===== brazo (gira) =====
  const ab = new Bucket();

  // codo giratorio
  const elbow = new THREE.TorusGeometry(0.5, 0.17, 10, 16, Math.PI / 2);
  elbow.rotateZ(Math.PI / 2);
  elbow.translate(0.5, H - 0.5, 0);
  ab.add('colector', mat.galv, elbow);
  ab.add('colector', mat.galvDark, cylY(0.26, 0.14, 0, H - 0.56, 0, 18));

  const { tread: wTread, rim: wRim } = wheelGeometries();
  const wheels = [];
  const dropXs = [];

  for (let i = 0; i < SPANS; i++) {
    const xs = i === 0 ? 0.5 : i * L;
    const xe = (i + 1) * L;

    // caño
    ab.add('tramo', mat.galv, rod(v(xs, H, 0), v(xe, H, 0), PIPE_R, 14));
    // bridas
    ab.add('tramo', mat.galvDark, cylX(0.22, 0.12, xs + 0.08, H, 0, 16));
    ab.add('tramo', mat.galvDark, cylX(0.22, 0.12, xe - 0.08, H, 0, 16));
    // rótula en la torre
    ab.add('tramo', mat.rubber, cylX(0.2, 0.28, xe + 0.12, H, 0, 16));

    // cercha
    const K = 10;
    const depth = 1.55;
    const zc = 0.62;
    const pts = [];
    for (let k = 0; k <= K; k++) {
      const u = k / K;
      const x = xs + (xe - xs) * u;
      const s = Math.sin(Math.PI * u);
      pts.push({ x, y: H - 0.12 - depth * s, z: zc * Math.pow(s, 0.55) });
    }
    for (let k = 0; k < K; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      for (const sg of [1, -1]) {
        ab.add('cercha', mat.galv, rod(v(a.x, a.y, a.z * sg), v(b.x, b.y, b.z * sg), 0.045, 5));
      }
    }
    for (let k = 1; k < K; k++) {
      const p = pts[k];
      for (const sg of [1, -1]) {
        ab.add('cercha', mat.galv, rod(v(p.x, H - 0.1, 0), v(p.x, p.y, p.z * sg), 0.032, 5));
        const q = pts[k + (k % 2 ? 1 : -1)];
        ab.add('cercha', mat.galv, rod(v(p.x, H - 0.1, 0), v(q.x, q.y, q.z * sg), 0.026, 5));
      }
      ab.add('cercha', mat.galv, rod(v(p.x, p.y, -p.z), v(p.x, p.y, p.z), 0.026, 5));
    }
    if (i === 1) anchor('cercha', arm, xs + (xe - xs) * 0.5, H - 1.55, 0);

    // cable de tramo (con leve catenaria)
    const CK = 12;
    let prev = null;
    for (let k = 0; k <= CK; k++) {
      const u = k / CK;
      const p = v(xs + (xe - xs) * u, H - 0.24 - 0.22 * Math.sin(Math.PI * u), -0.2);
      if (prev) ab.add('cable', mat.cable, rod(prev, p, 0.034, 6));
      prev = p;
    }
    if (i === 2) anchor('cable', arm, xs + (xe - xs) * 0.5, H - 0.46, -0.2);
    if (i === 0) anchor('tramo', arm, xs + (xe - xs) * 0.3, H + 0.15, 0);

    // posiciones de bajantes
    const n = 7;
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n;
      dropXs.push(xs + 0.4 + (xe - xs - 0.8) * u);
    }

    // ===== torre =====
    const x = xe;
    const hubY = WHEEL_R;
    // viga base
    ab.add('torre', mat.galv, rod(v(x, hubY + 0.12, -TOWER_W + 0.15), v(x, hubY + 0.12, TOWER_W - 0.15), 0.1, 10));
    // patas en A
    for (const sz of [1, -1]) {
      for (const sx of [1, -1]) {
        ab.add('torre', mat.galv, rod(v(x + 0.42 * sx, H - 0.12, 0), v(x, hubY + 0.2, (TOWER_W - 0.35) * sz), 0.065, 6));
      }
      // travesaños
      const yb = hubY + 0.2 + (H - hubY - 0.32) * 0.45;
      const zb = (TOWER_W - 0.35) * 0.55 * sz;
      ab.add('torre', mat.galv, rod(v(x - 0.23, yb, zb), v(x + 0.23, yb, zb), 0.035, 5));
    }
    ab.add('torre', mat.galv, rod(v(x, hubY + 0.2 + 1.2, -0.95), v(x, hubY + 0.2 + 1.2, 0.95), 0.035, 5));

    // motor central
    ab.add('motor', mat.motor, cylX(0.2, 0.5, x - 0.18, hubY + 0.42, 0, 16));
    ab.add('motor', mat.motor, box(0.32, 0.36, 0.38, x + 0.18, hubY + 0.4, 0));
    ab.add('motor', mat.gear, cylX(0.21, 0.04, x - 0.44, hubY + 0.42, 0, 16));
    for (let f = 0; f < 6; f++) {
      ab.add('motor', mat.motor, box(0.44, 0.02, 0.03, x - 0.18, hubY + 0.42 + 0.21 * Math.cos(f), 0.21 * Math.sin(f)));
    }
    // cardanes y reductores
    for (const sz of [1, -1]) {
      const zEnd = (TOWER_W - 0.2) * sz;
      ab.add('reductor', mat.galv, rod(v(x + 0.18, hubY + 0.38, 0.2 * sz), v(x + 0.16, hubY + 0.06, zEnd - 0.25 * sz), 0.035, 8));
      ab.add('reductor', mat.gear, box(0.12, 0.12, 0.12, x + 0.18, hubY + 0.38, 0.24 * sz));
      ab.add('reductor', mat.gear, box(0.12, 0.12, 0.12, x + 0.16, hubY + 0.06, zEnd - 0.28 * sz));
      // caja reductora
      ab.add('reductor', mat.gear, box(0.34, 0.48, 0.4, x + 0.12, hubY, zEnd));
      ab.add('reductor', mat.gear, cylX(0.17, 0.12, x + 0.32, hubY, zEnd, 14));
      ab.add('reductor', mat.galvDark, cylY(0.03, 0.08, x + 0.12, hubY + 0.27, zEnd, 6));

      const wg = new THREE.Group();
      wg.position.set(x + 0.55, hubY, TOWER_W * sz);
      const t = new THREE.Mesh(wTread, mat.rubber);
      const r = new THREE.Mesh(wRim, mat.rim);
      for (const m of [t, r]) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.partId = 'rueda';
        wg.add(m);
      }
      arm.add(wg);
      wheels.push({ group: wg, radius: x });
    }
    if (i === 2) anchor('torre', arm, x, hubY + 1.9, -0.78);
    if (i === 0) anchor('motor', arm, x - 0.1, hubY + 0.45, 0);
    if (i === 1) anchor('reductor', arm, x + 0.12, hubY + 0.1, -(TOWER_W - 0.2));
    if (i === 2) anchor('rueda', arm, x + 0.55, hubY + 0.2, -TOWER_W);

    // caja de torre
    ab.add('cajaTorre', mat.box, box(0.42, 0.52, 0.26, x - 0.62, H - 0.72, 0.0));
    ab.add('cajaTorre', mat.galvDark, box(0.44, 0.04, 0.3, x - 0.62, H - 0.44, 0.0));
    ab.add('cajaTorre', mat.galv, rod(v(x - 0.62, H - 0.45, 0), v(x - 0.62, H - 0.1, 0), 0.03, 6));
    ab.add('cajaTorre', mat.galv, rod(v(x - 0.4, H - 0.6, 0), v(x + 0.6, H - 0.25, 0), 0.02, 5));
    if (i === 0) anchor('cajaTorre', arm, x - 0.62, H - 0.72, 0);
  }

  // ===== voladizo =====
  const xo = SPANS * L;
  const xEnd = xo + OVERHANG;
  const yEnd = H - 0.25;
  ab.add('tramo', mat.galv, rod(v(xo + 0.25, H, 0), v(xEnd, yEnd, 0), 0.1, 12));
  ab.add('cercha', mat.galv, rod(v(xo + 0.1, H, 0), v(xo + 0.1, H + 1.7, 0), 0.06, 8));
  ab.add('cercha', mat.galv, rod(v(xo + 0.1, H + 1.7, 0), v(xo + OVERHANG * 0.5, H - 0.12, 0), 0.022, 5));
  ab.add('cercha', mat.galv, rod(v(xo + 0.1, H + 1.7, 0), v(xEnd - 0.1, yEnd, 0), 0.022, 5));
  ab.add('cercha', mat.galv, rod(v(xo + 0.1, H + 1.7, 0), v(xo - 3, H + 0.02, 0), 0.022, 5));
  for (let k = 0; k < 3; k++) dropXs.push(xo + 1.2 + k * 1.7);

  // ===== cañón final =====
  const gx = xEnd + 0.05;
  ab.add('canon', mat.galv, cylY(0.09, 0.7, gx, yEnd + 0.3, 0, 12));
  ab.add('canon', mat.galvDark, cylY(0.13, 0.14, gx, yEnd + 0.62, 0, 12));
  const nozzle = new THREE.CylinderGeometry(0.05, 0.09, 0.95, 12);
  nozzle.rotateZ(-Math.PI / 2 + 0.42);
  nozzle.translate(gx + 0.4, yEnd + 0.86, 0);
  ab.add('canon', mat.galv, nozzle);
  ab.add('canon', mat.red, box(0.12, 0.3, 0.1, gx - 0.08, yEnd + 0.95, 0));
  ab.add('canon', mat.galvDark, cylX(0.14, 0.22, gx - 0.12, yEnd + 0.3, 0, 12));
  // bomba booster en la última torre
  ab.add('canon', mat.motor, cylX(0.17, 0.42, xo - 0.55, WHEEL_R + 0.42, 0.75, 14));
  ab.add('canon', mat.plate, cylZ(0.2, 0.18, xo - 0.24, WHEEL_R + 0.42, 0.75, 14));
  anchor('canon', arm, gx + 0.2, yEnd + 0.7, 0);

  // ===== bajantes y aspersores (instanciados) =====
  const count = dropXs.length;
  const hoseLen = H + PIPE_R - DROP_BOTTOM;
  const hoseGeo = new THREE.CylinderGeometry(0.028, 0.028, hoseLen, 6);
  hoseGeo.translate(0, DROP_BOTTOM + hoseLen / 2, DROP_Z);
  const neckGeo = new THREE.TorusGeometry(DROP_Z / 2, 0.03, 6, 10, Math.PI);
  neckGeo.rotateY(-Math.PI / 2);
  neckGeo.translate(0, H + PIPE_R, DROP_Z / 2);
  const dropGeo = mergeGeometries([hoseGeo, neckGeo]);
  const regGeo = mergeGeometries([cylY(0.062, 0.2, 0, DROP_BOTTOM - 0.06, DROP_Z, 10), cylY(0.045, 0.1, 0, DROP_BOTTOM - 0.22, DROP_Z, 8)]);
  const plateGeo = mergeGeometries([cylY(0.13, 0.03, 0, DROP_BOTTOM - 0.32, DROP_Z, 14), cylY(0.025, 0.1, 0, DROP_BOTTOM - 0.29, DROP_Z, 6)]);

  const instanced = [
    ['bajante', dropGeo, mat.hose],
    ['aspersor', regGeo, mat.regulator],
    ['aspersor', plateGeo, mat.plate],
  ].map(([partId, geo, m]) => {
    const im = new THREE.InstancedMesh(geo, m, count);
    const mtx = new THREE.Matrix4();
    dropXs.forEach((x, idx) => im.setMatrixAt(idx, mtx.makeTranslation(x, 0, 0)));
    im.castShadow = true;
    im.userData.partId = partId;
    arm.add(im);
    return im;
  });
  anchor('bajante', arm, dropXs[16], 2.6, DROP_Z);
  anchor('aspersor', arm, dropXs[9], DROP_BOTTOM - 0.25, DROP_Z);

  const armMeshes = [...ab.build(arm), ...instanced, ...wheels.flatMap((w) => w.group.children)];

  const sprinklers = dropXs.map((x) => v(x, DROP_BOTTOM - 0.33, DROP_Z));
  const gunNozzle = v(gx + 0.85, yEnd + 1.05, 0);

  return { root, center, arm, anchors, wheels, centerMeshes, armMeshes, sprinklers, gunNozzle, materials: mat };
}
