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
  bed: { file: "bed-double", pos: [2.1, 0, 0.4], size: 2.1, rotY: Math.PI / 2 },
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

/** Load every prop, normalize (grounded, bottom-center origin, uniform scale), place into group. */
export async function loadProps(group: THREE.Group): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const draco = new DRACOLoader().setDecoderPath(`${base}models/draco/`);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  await Promise.all(
    Object.entries(PROPS).map(async ([, spec]) => {
      const gltf = await loader.loadAsync(`${base}models/${spec.file}.glb`);
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const dims = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(dims.x, dims.y, dims.z) || 1;
      const s = spec.size / maxDim;
      // recenter x/z on origin and rest the model on y=0 before scaling
      const center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -box.min.y, -center.z);
      const wrapper = new THREE.Group();
      wrapper.add(model);
      wrapper.scale.setScalar(s);
      wrapper.position.set(...spec.pos);
      wrapper.rotation.y = spec.rotY ?? 0;
      if (spec.rotZ !== undefined) {
        const pivot = new THREE.Group();
        pivot.add(wrapper);
        pivot.rotation.z = spec.rotZ;
        pivot.position.set(...spec.pos);
        wrapper.position.set(0, 0, 0);
        group.add(pivot);
      } else {
        group.add(wrapper);
      }
    }),
  );
}
