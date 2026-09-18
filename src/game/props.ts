import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

/** Placement spec: position is the model's bottom-center after normalization. */
interface PropSpec {
  file: string;
  pos: [number, number, number];
  /** Uniform scale so the model's longest dimension equals this many meters. */
  size: number;
  rotY?: number;
  rotZ?: number;
}

/** Quaternius (CC0) props via poly.pizza, standing in for the primitive boxes. */
export const PROPS: Record<string, PropSpec> = {
  // The man is skinned: placement measures his posed bounds after an explicit
  // skeleton settlement (see loadProps) — a plain Box3 would see bind-pose vertices.
  bed: { file: "bed-double", pos: [2.1, 0, 0.4], size: 2.1, rotY: Math.PI / 2 },
  man: { file: "man-a", pos: [2.15, 0.58, 0.4], size: 1.75, rotY: Math.PI / 2, rotZ: Math.PI / 2 },
  cat: { file: "cat-a", pos: [-1.5, 0, 1.5], size: 0.55 },
  nightstandLamp: { file: "night-stand", pos: [2.55, 0, -1.85], size: 0.75 },
  lamp: { file: "light-desk", pos: [2.55, 0.74, -1.95], size: 0.45 },
  phone: { file: "phone", pos: [0.7, 0.75, 1.15], size: 0.16 },
  desk: { file: "desk", pos: [-2.4, 0, -1.3], size: 1.25 },
  computer: { file: "computer", pos: [-2.4, 0.72, -1.5], size: 0.5 },
  plantBig: { file: "plant-big", pos: [-2.6, 0, -2.0], size: 0.95 },
  plant: { file: "plant", pos: [0, 1.43, -2.42], size: 0.45 },
  bowl: { file: "bowl", pos: [-0.8, 0, 1.9], size: 0.24 },
  chalice: { file: "chalice", pos: [2.55, 0.74, -1.55], size: 0.26 },
};
/** Load every prop, normalize (grounded, bottom-center origin, uniform scale), place into group.
 *  Skinned models measure wrong until their skeleton is settled, so every wrapper is
 *  settled explicitly before measuring. */
export async function loadProps(group: THREE.Group): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const draco = new DRACOLoader().setDecoderPath(`${base}models/draco/`);
  const loader = new GLTFLoader().setDRACOLoader(draco);

  const settle = (root: THREE.Object3D): void => {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) mesh.skeleton.update();
    });
  };
  const wrappers: Array<{ wrapper: THREE.Group; spec: PropSpec }> = [];


  await Promise.all(
    Object.entries(PROPS).map(async ([, spec]) => {
      const gltf = await loader.loadAsync(`${base}models/${spec.file}.glb`);
      const wrapper = new THREE.Group();
      wrapper.add(gltf.scene);
      // ZYX so rotY (pose in plan) applies before rotZ (tip over)
      wrapper.rotation.order = "ZYX";
      wrapper.rotation.set(0, spec.rotY ?? 0, spec.rotZ ?? 0);
      wrapper.visible = false;
      group.add(wrapper);
      wrappers.push({ wrapper, spec });
    }),
  );

  for (const { wrapper, spec } of wrappers) {
    settle(wrapper);
    const raw = new THREE.Box3().setFromObject(wrapper, true);
    const dims = raw.getSize(new THREE.Vector3());
    const scale = spec.size / (Math.max(dims.x, dims.y, dims.z) || 1);
    wrapper.scale.setScalar(scale);
    settle(wrapper);
    // ground the ROTATED, SCALED bounds: spec.pos is the footprint's bottom-center
    const box = new THREE.Box3().setFromObject(wrapper, true);
    wrapper.position.set(
      spec.pos[0] - (box.min.x + box.max.x) / 2,
      spec.pos[1] - box.min.y,
      spec.pos[2] - (box.min.z + box.max.z) / 2,
    );
    wrapper.visible = true;
  }
}
