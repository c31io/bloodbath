// Builds the hero mosquito as a GLB: public/models/mosquito.glb.
// Hand-built low-poly primitives, stylized after Omabuarts' "Mosquito - Quirky
// Series" (reference only — geometry here is original). Run: bun tools/build-mosquito.ts
// Conventions: as-loaded facing +Z, Y up, bottom-grounded (pos = bottom-center),
// same facing vocabulary as the BEDROOM table in src/game/bedroom.ts.
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { writeFileSync } from "node:fs";


// GLTFExporter's binary path reads its blob through FileReader, which Bun lacks.
class FileReaderShim {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
}
(globalThis as { FileReader?: unknown }).FileReader ??= FileReaderShim;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** Orient +Y (cylinder/capsule axis) along dir. */
const alongY = (dir: THREE.Vector3) =>
  new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());

const BODY = 0x322b4d; // dark indigo
const STRIPE = 0x8d93b4; // pale bands on the abdomen
const DARK = 0x1b1830; // leg tips, antennae, pupils
const EYE = 0xf2f2f6;
const WING = 0xccd4f4;

const mat = (color: number, opts: { transparent?: boolean; opacity?: number } = {}) => {
  const params: THREE.MeshStandardMaterialParameters = { color, roughness: 0.9, metalness: 0 };
  if (opts.transparent) {
    params.transparent = true;
    params.opacity = opts.opacity ?? 1;
    params.side = THREE.DoubleSide;
  }
  return new THREE.MeshStandardMaterial(params);
};

export function buildMosquito(): THREE.Group {
  const g = new THREE.Group();

  const add = (mesh: THREE.Mesh) => (g.add(mesh), mesh);

  // Abdomen: egg tilted up-back, striped toward the tail.
  const abdoDir = V(0, 0.55, -0.84);
  const abdoPos = V(0, 0.4, -0.42);
  const abdoGroup = new THREE.Group();
  abdoGroup.name = "abdomen";
  const abdomen = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.34, 5, 14), mat(BODY));
  abdomen.quaternion.copy(alongY(abdoDir));
  abdomen.position.copy(abdoPos);
  abdoGroup.add(abdomen);
  // stripe bands ring the abdomen axis (torus axis is +Z)
  for (const [t, r] of [
    [-0.05, 0.148],
    [-0.12, 0.147],
    [-0.19, 0.143],
    [-0.25, 0.136],
  ] as const) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 8, 16), mat(STRIPE));
    band.quaternion.copy(
      new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), abdoDir.clone().normalize()),
    );
    band.position.copy(abdoPos.clone().add(abdoDir.clone().normalize().multiplyScalar(t)));
    abdoGroup.add(band);
  }
  g.add(abdoGroup);

  // Thorax between head and abdomen.
  const thorax = add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), mat(BODY)));
  thorax.scale.set(1.05, 0.9, 1.2);
  thorax.position.set(0, 0.3, -0.02);

  // Head: oversized, slightly squashed.
  const head = add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), mat(BODY)));
  head.scale.set(1, 0.95, 1);
  head.position.set(0, 0.3, 0.18);

  // Eyes: big white domes with dark pupils, set toward the front like the reference.
  for (const s of [1, -1]) {
    const eyeDir = V(0.36 * s, 0.12, 0.93).normalize();
    const white = add(new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 10), mat(EYE)));
    white.position.copy(head.position).add(eyeDir.clone().multiplyScalar(0.15));
    const pupil = add(new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 8), mat(DARK)));
    pupil.position.copy(white.position).add(eyeDir.clone().multiplyScalar(0.05));
  }

  // Antennae: thin stalks with club tips, leaning out and back.
  for (const s of [1, -1]) {
    const dir = V(0.22 * s, 0.95, -0.3).normalize();
    const stalk = add(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.013, 0.24, 6), mat(DARK)));
    stalk.quaternion.copy(alongY(dir));
    stalk.position.copy(head.position).add(dir.clone().multiplyScalar(0.26));
    const tip = add(new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), mat(DARK)));
    tip.position.copy(head.position).add(dir.clone().multiplyScalar(0.39));
  }

  // Proboscis: long spike angled down-forward from under the head.
  const beakDir = V(0, -0.55, 0.84).normalize();
  const beakBase = V(0, 0.17, 0.33);
  const beak = add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.017, 0.45, 6), mat(DARK)));
  beak.quaternion.copy(alongY(beakDir));
  beak.position.copy(beakBase).add(beakDir.clone().multiplyScalar(0.225));

  // Wings: two long flat pale blades on named pivot groups at the thorax top
  // ("wingR"/"wingL", +X/-X). Blades are authored near-flat along the body;
  // the view flaps them around the pivots' Z (the body-forward axis), which
  // lifts each blade sideways through the V pose.
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.name = s === 1 ? "wingR" : "wingL";
    pivot.position.set(0.05 * s, 0.44, -0.02);
    const dir = V(0.95 * s, 0.08, -0.3).normalize();
    const wing = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.5, 4, 10), mat(WING, { transparent: true, opacity: 0.8 }));
    wing.scale.z = 0.22;
    wing.quaternion.copy(alongY(dir));
    wing.position.copy(dir.clone().multiplyScalar(0.36));
    pivot.add(wing);
    g.add(pivot);
  }

  // Legs: three two-segment pairs, splayed under the body, dark tips.
  const leg = (attach: THREE.Vector3, up: THREE.Vector3, low: THREE.Vector3) => {
    const hip = add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.025, 0.18, 6), mat(BODY)));
    hip.quaternion.copy(alongY(up));
    hip.position.copy(attach).add(up.clone().multiplyScalar(0.09));
    const knee = add(new THREE.Mesh(new THREE.SphereGeometry(0.027, 8, 6), mat(BODY)));
    knee.position.copy(attach).add(up.clone().multiplyScalar(0.18));
    const shin = add(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.016, 0.28, 6), mat(DARK)));
    shin.quaternion.copy(alongY(low));
    shin.position.copy(knee.position).add(low.clone().multiplyScalar(0.14));
  };
  const pairs = [
    { at: V(0.1, 0.2, 0.08), up: V(0.95, -0.2, 0.6), low: V(0.65, -0.9, 0.45) },
    { at: V(0.12, 0.2, -0.05), up: V(1.1, -0.15, 0), low: V(0.7, -0.85, 0) },
    { at: V(0.11, 0.22, -0.19), up: V(0.95, -0.1, -0.55), low: V(0.6, -0.85, -0.4) },
  ];
  for (const p of pairs) {
    for (const s of [1, -1]) {
      leg(
        p.at.clone().multiply(new THREE.Vector3(s, 1, 1)),
        p.up.clone().multiply(new THREE.Vector3(s, 1, 1)).normalize().multiplyScalar(0.17),
        p.low.clone().multiply(new THREE.Vector3(s, 1, 1)).normalize().multiplyScalar(0.24),
      );
    }
  }

  // Ground it: bottom-center convention (x/z centered, min.y = 0).
  const bbox = new THREE.Box3().setFromObject(g);
  const c = bbox.getCenter(new THREE.Vector3());
  g.position.set(-c.x, -bbox.min.y, -c.z);
  const wrap = new THREE.Group();
  wrap.add(g);
  wrap.name = "mosquito";
  return wrap;
}

export async function exportGlb(group: THREE.Group): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter();
  return (await exporter.parseAsync(group, { binary: true })) as ArrayBuffer;
}

if (import.meta.main) {
  const glb = await exportGlb(buildMosquito());
  writeFileSync("public/models/mosquito.glb", Buffer.from(glb));
  console.log(`public/models/mosquito.glb written (${glb.byteLength} bytes)`);
}
