import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { BEDROOM, type ModelSpec, type RoomObject } from "./bedroom.js";

/** Skinned models measure wrong until their skeleton is settled — the renderer
 *  only settles skeletons it actually draws, so do it explicitly. */
function settle(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) mesh.skeleton.update();
  });
}

/** Normalize a loaded model: uniform-scale its longest dimension to spec.size,
 *  then ground the ROTATED, SCALED bounds so spec.pos is the bottom-center. */
export function placeModel(wrapper: THREE.Object3D, spec: ModelSpec): void {
  settle(wrapper);
  const raw = new THREE.Box3().setFromObject(wrapper, true);
  const dims = raw.getSize(new THREE.Vector3());
  wrapper.scale.setScalar(spec.size / (Math.max(dims.x, dims.y, dims.z) || 1));
  settle(wrapper);
  const box = new THREE.Box3().setFromObject(wrapper, true);
  wrapper.position.set(
    spec.pos[0] - (box.min.x + box.max.x) / 2,
    spec.pos[1] - box.min.y,
    spec.pos[2] - (box.min.z + box.max.z) / 2,
  );
}

/** Load every model named in the BEDROOM table and place it at its spec. */
export async function loadProps(group: THREE.Group): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const draco = new DRACOLoader().setDecoderPath(`${base}models/draco/`);
  const loader = new GLTFLoader().setDRACOLoader(draco);

  const wrappers: Array<{ wrapper: THREE.Group; model: ModelSpec }> = [];

  await Promise.all(
    (Object.values(BEDROOM) as RoomObject[]).map(async (obj) => {
      const model = obj.model;
      if (!model) return;
      const gltf = await loader.loadAsync(`${base}models/${model.file}.glb`);
      const wrapper = new THREE.Group();
      wrapper.add(gltf.scene);
      // ZYX so rotY (pose in plan) applies before rotZ (tip over)
      wrapper.rotation.order = "ZYX";
      wrapper.rotation.set(0, model.rotY ?? 0, model.rotZ ?? 0);
      wrapper.visible = false;
      group.add(wrapper);
      wrappers.push({ wrapper, model });
    }),
  );

  for (const { wrapper, model } of wrappers) {
    placeModel(wrapper, model);
    wrapper.visible = true;
  }
}
