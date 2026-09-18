import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BEDROOM } from "./bedroom.js";
import { placeModel } from "./props.js";

describe("model placement", () => {
  it("grounds a rotated model: pos is the scaled footprint's bottom-center", () => {
    const wrapper = new THREE.Group();
    wrapper.add(new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1))); // 4 m long, origin-centered
    placeModel(wrapper, { file: "test", pos: [1, 0, 2], size: 2, rotY: Math.PI / 2 });
    const box = new THREE.Box3().setFromObject(wrapper, true);
    expect(box.min.y).toBeCloseTo(0); // grounded on the floor plane
    expect(box.max.y).toBeCloseTo(0.5); // longest dim (4) scaled to size (2)
    const center = box.getCenter(new THREE.Vector3());
    expect(center.x).toBeCloseTo(1);
    expect(center.z).toBeCloseTo(2);
  });

  it("lays a tipped-over model on its side without sinking", () => {
    const wrapper = new THREE.Group();
    wrapper.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 0.5)));
    placeModel(wrapper, { file: "test", pos: [0, 0.58, 0], size: 1.75, rotZ: Math.PI / 2 });
    const box = new THREE.Box3().setFromObject(wrapper, true);
    expect(box.min.y).toBeCloseTo(0.58); // rests on the given plane, not below
  });
});

describe("the room table", () => {
  const shipped = import.meta.glob("/public/models/*.glb");

  it("references only models that ship in public/models", () => {
    for (const [name, obj] of Object.entries(BEDROOM)) {
      if (obj.model) {
        expect(shipped[`/public/models/${obj.model.file}.glb`], `${name}: ${obj.model.file}`).toBeDefined();
      }
    }
  });
});
