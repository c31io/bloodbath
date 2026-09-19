import type { World } from "../ecs/ecs.js";
import { makePool } from "../domain/resources.js";
import { createHostState } from "../domain/suspicion.js";
import { makePlume, type Pos } from "./components.js";

/** Bedroom shell: x in [-3,3], z in [-2.5,2.5], y in [0,3]. */
export const ROOM = { minX: -3, maxX: 3, minZ: -2.5, maxZ: 2.5, height: 3 };

/** A glTF model standing in for the object, normalized by loadProps.
 *  pos is the model's grounded bottom-center; the longest dimension is scaled to `size`. */
export interface ModelSpec {
  file: string;
  size: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  pos: [number, number, number];
  /** Solid colliders, one or more AABBs as corners [x1, y1, z1, x2, y2, z2]
   *  relative to pos (x/z from the bottom-center, y from the ground up).
   *  Voxel-derived from the placed GLB at 15cm resolution — hollow furniture
   *  (under-bed, under-desk, nightstand legs) stays flyable. */
  solid?: Array<[number, number, number, number, number, number]>;
}

export interface RoomObject {
  /** gameplay anchor: where entities spawn and interactions attach (Heat origin, sip point) */
  anchor: Pos;
  /** where the creature's CO2 emits — the nose. Breath is not the body: the
   *  landing anchor sits mid-body, so the plume spawns as its own entity. */
  breath?: Pos;
  /** model file whose meshes carry this row's Heat glow (view binds the fresnel
   *  to them). The human host spawns at the bed row, but HIS body glows. */
  body?: string;
  model?: ModelSpec;
}

const HALF_PI = Math.PI / 2;

/** The one placement vocabulary: one row per object in the Bedroom, gameplay and visuals.
 *  Models are Quaternius (CC0) via poly.pizza. */
export const BEDROOM = {
  // The sleeper is skinned: placement measures his posed bounds after an explicit
  // skeleton settlement (see loadProps) — a plain Box3 would see bind-pose vertices.
  bed: { anchor: { x: 2.2, y: 0.54, z: 0.4 }, breath: { x: 1.4, y: 0.6, z: 0.4 }, body: "man-a", model: { file: "bed-double", pos: [2.1, 0, 0.4], size: 2.1, rotY: HALF_PI, solid: [
    [-1.05, 0, -0.7, -0.93, 0.77, -0.5],
    [-1.05, 0, 0.5, -0.93, 0.77, 0.7],
    [0.93, 0, -0.7, 1.05, 0.58, -0.5],
    [0.93, 0, 0.5, 1.05, 0.58, 0.7],
    [-1.05, 0.1, -0.5, 1.05, 0.19, 0.5],
    [-0.93, 0.1, -0.7, 0.93, 0.38, -0.5],
    [-0.93, 0.1, 0.5, 0.93, 0.38, 0.7],
    [-1.05, 0.19, -0.5, -0.93, 0.67, 0.5],
    [0.93, 0.19, -0.5, 1.05, 0.48, 0.5],
    [-0.93, 0.29, -0.5, 0.93, 0.38, 0.5],
    [-0.93, 0.38, -0.6, -0.58, 0.48, 0.7],
    [-0.58, 0.38, -0.5, -0.23, 0.48, -0.1],
    [-0.58, 0.38, -0.1, -0.35, 0.48, 0.5],
    [-0.47, 0.38, -0.6, -0.35, 0.48, -0.5],
    [-0.47, 0.38, 0.5, -0.35, 0.48, 0.6],
    [-0.35, 0.38, 0.1, -0.23, 0.48, 0.5],
    [0.12, 0.38, -0.4, 0.35, 0.48, 0.4],
    [0.58, 0.38, -0.3, 0.7, 0.48, 0.3],
    [0.7, 0.38, -0.1, 0.82, 0.48, 0.1],
    [0.82, 0.48, -0.7, 0.93, 0.58, -0.5],
    [0.82, 0.48, 0.5, 0.93, 0.58, 0.7],
    [0.93, 0.58, -0.7, 1.05, 0.67, -0.6],
    [0.93, 0.58, 0.6, 1.05, 0.67, 0.7],
    [-0.93, 0.67, -0.7, -0.82, 0.77, -0.5],
    [-0.93, 0.67, 0.5, -0.82, 0.77, 0.7],
  ] } },
  sleeper: { anchor: { x: 2.2, y: 0.6, z: 0.4 }, model: { file: "man-a", pos: [2.15, 0.3, 0.4], size: 1.75, rotY: HALF_PI, rotZ: HALF_PI, solid: [
    [-0.88, 0, -0.17, 0.88, 0.2, -0.09],
    [-0.88, 0, -0.09, 0.68, 0.1, 0.17],
    [-0.58, 0, -0.26, -0.39, 0.2, -0.17],
    [-0.58, 0, 0.17, -0.39, 0.2, 0.26],
    [0.68, 0, 0.09, 0.88, 0.2, 0.17],
    [-0.88, 0.1, -0.09, -0.1, 0.2, 0.17],
    [-0.1, 0.1, 0.09, 0.68, 0.2, 0.17],
    [0, 0.1, -0.09, 0.88, 0.2, 0.09],
    [-0.88, 0.2, -0.09, -0.58, 0.3, 0.09],
    [-0.49, 0.2, -0.09, 0.29, 0.3, 0.09],
    [-0.19, 0.2, -0.17, 0.29, 0.3, -0.09],
    [-0.19, 0.2, 0.09, 0.29, 0.3, 0.17],
    [0.39, 0.2, -0.17, 0.49, 0.3, -0.09],
    [0.39, 0.2, 0.09, 0.49, 0.3, 0.17],
    [0.78, 0.2, -0.17, 0.88, 0.3, 0.17],
  ] } },
  cat: { anchor: { x: -1.5, y: 0.12, z: 1.5 }, breath: { x: -1.5, y: 0.35, z: 1.82 }, body: "cat-a", model: { file: "cat-a", pos: [-1.5, 0, 1.5], size: 0.55, solid: [
    [-0.17, 0, -0.27, 0.17, 0.29, 0.09],
    [-0.17, 0.1, 0.09, 0.17, 0.38, 0.27],
    [-0.17, 0.29, 0, 0.17, 0.38, 0.09],
    [-0.08, 0.29, -0.27, 0.08, 0.48, -0.18],
  ] } },
  nightstand: { anchor: { x: 2.55, y: 0, z: -1.85 }, model: { file: "night-stand", pos: [2.55, 0, -1.85], size: 0.75, solid: [
    [-0.38, 0, -0.37, -0.19, 0.74, -0.28],
    [-0.38, 0, 0.28, -0.19, 0.74, 0.37],
    [0.19, 0, -0.37, 0.38, 0.74, -0.28],
    [0.19, 0, 0.28, 0.38, 0.74, 0.37],
    [-0.38, 0.19, -0.28, 0.38, 0.28, 0.28],
    [-0.19, 0.19, -0.37, 0.19, 0.28, -0.28],
    [-0.19, 0.19, 0.28, 0.19, 0.28, 0.37],
    [-0.38, 0.47, -0.28, 0.38, 0.56, 0.28],
    [-0.19, 0.47, -0.37, 0.19, 0.74, -0.28],
    [-0.19, 0.47, 0.28, 0.19, 0.74, 0.37],
    [-0.38, 0.56, -0.28, -0.19, 0.74, -0.19],
    [-0.38, 0.56, -0.19, -0.28, 0.74, 0.28],
    [-0.28, 0.56, 0.19, -0.19, 0.74, 0.28],
    [0.19, 0.56, -0.28, 0.38, 0.74, -0.19],
    [0.19, 0.56, 0.19, 0.38, 0.74, 0.28],
    [0.28, 0.56, -0.19, 0.38, 0.74, 0.19],
    [-0.28, 0.65, -0.19, 0.28, 0.74, 0.19],
    [-0.19, 0.65, -0.28, 0.19, 0.74, -0.19],
    [-0.19, 0.65, 0.19, 0.19, 0.74, 0.28],
  ] } },
  lamp: { anchor: { x: 2.55, y: 1.3, z: -2 }, body: "light-desk", model: { file: "light-desk", pos: [2.55, 0.745, -1.95], size: 0.45, solid: [
    [-0.1, 0, -0.18, 0.1, 0.09, 0.09],
    [-0.1, 0.09, -0.18, 0.1, 0.36, -0.09],
    [-0.1, 0.18, 0, 0.1, 0.45, 0.18],
    [-0.1, 0.27, -0.09, 0.1, 0.45, 0],
  ] } },
  phone: { anchor: { x: 2.74, y: 0.76, z: -1.62 }, body: "phone", model: { file: "phone", pos: [2.78, 0.74, -1.62], size: 0.16, rotX: -HALF_PI, rotY: 0.35, solid: [[-0.07, 0, -0.09, 0.07, 0.02, 0.09]] } },
  desk: { anchor: { x: -2.4, y: 0.78, z: -1.5 }, model: { file: "desk", pos: [-2.4, 0, -1.3], size: 1.25, solid: [
    [-0.63, 0, -0.29, -0.53, 0.63, -0.19],
    [-0.63, 0, 0.19, -0.53, 0.63, 0.29],
    [0.53, 0, -0.29, 0.62, 0.63, -0.19],
    [0.53, 0, 0.19, 0.62, 0.63, 0.29],
    [-0.63, 0.27, -0.19, -0.14, 0.45, 0.19],
    [-0.53, 0.27, -0.29, 0.53, 0.63, -0.19],
    [-0.53, 0.27, 0.19, -0.14, 0.63, 0.29],
    [0.14, 0.27, -0.19, 0.62, 0.45, 0.19],
    [0.14, 0.27, 0.19, 0.53, 0.63, 0.29],
    [-0.63, 0.45, -0.19, -0.24, 0.63, 0.19],
    [0.24, 0.45, -0.19, 0.62, 0.63, 0.19],
    [-0.24, 0.54, -0.19, 0.24, 0.63, 0.19],
    [-0.14, 0.54, 0.19, 0.14, 0.63, 0.29],
  ] } },
  laptop: { anchor: { x: -2.4, y: 0.78, z: -1.5 }, body: "computer", model: { file: "computer", pos: [-2.4, 0.63, -1.5], size: 0.5, solid: [[-0.14, 0, -0.07, 0.14, 0.5, 0.07]] } },
  vaseSpot: { anchor: { x: 2.55, y: 1.05, z: -1.6 }, model: { file: "chalice", pos: [2.55, 0.745, -1.55], size: 0.26, solid: [[-0.08, 0, -0.08, 0.08, 0.26, 0.08]] } },
  bowlSpot: { anchor: { x: -0.8, y: 0.06, z: 1.9 }, model: { file: "bowl", pos: [-0.8, 0, 1.9], size: 0.24, solid: [
    [-0.12, 0, -0.12, 0.12, 0.06, 0.12],
    [-0.12, 0.06, -0.12, 0.12, 0.11, -0.04],
    [-0.12, 0.06, -0.04, -0.04, 0.11, 0.12],
    [-0.04, 0.06, 0.04, 0.12, 0.11, 0.12],
    [0.04, 0.06, -0.04, 0.12, 0.11, 0.04],
  ] } },
  drainSpot: { anchor: { x: -2.85, y: 0.03, z: 0.6 }, model: undefined },
  pottedPlant: { anchor: { x: -2.6, y: 0.35, z: -2 }, model: { file: "plant-big", pos: [-2.6, 0, -2], size: 0.95, solid: [
    [-0.09, 0, -0.1, 0.09, 0.57, 0.1],
    [-0.18, 0.1, -0.1, -0.09, 0.67, 0.1],
    [-0.09, 0.1, -0.2, 0.09, 0.67, -0.1],
    [-0.09, 0.1, 0.1, 0.09, 0.67, 0.2],
    [-0.27, 0.19, 0, -0.18, 0.47, 0.1],
    [-0.18, 0.19, -0.2, -0.09, 0.76, -0.1],
    [-0.18, 0.19, 0.1, -0.09, 0.76, 0.2],
    [-0.09, 0.19, -0.3, 0.09, 0.38, -0.2],
    [0.09, 0.19, -0.1, 0.18, 0.76, 0.2],
    [-0.27, 0.29, -0.2, -0.18, 0.38, 0],
    [-0.18, 0.29, 0.2, 0, 0.38, 0.3],
    [0.09, 0.29, -0.2, 0.18, 0.85, -0.1],
    [0.09, 0.29, 0.2, 0.18, 0.38, 0.3],
    [0.18, 0.29, -0.1, 0.27, 0.47, 0.1],
    [-0.37, 0.38, 0, -0.27, 0.47, 0.1],
    [-0.18, 0.38, 0.2, -0.09, 0.47, 0.3],
    [0, 0.38, 0.2, 0.09, 0.76, 0.3],
    [-0.18, 0.47, -0.3, -0.09, 0.76, -0.2],
    [-0.09, 0.47, 0.2, 0, 0.76, 0.3],
    [-0.27, 0.57, -0.3, -0.18, 0.76, 0.2],
    [-0.09, 0.57, -0.3, 0, 0.76, -0.2],
    [-0.09, 0.57, 0.3, 0.09, 0.76, 0.4],
    [0.18, 0.57, 0, 0.27, 0.85, 0.2],
    [-0.37, 0.67, -0.2, -0.27, 0.85, 0],
    [-0.27, 0.67, -0.4, -0.09, 0.85, -0.3],
    [-0.27, 0.67, 0.2, -0.09, 0.76, 0.3],
    [0, 0.67, -0.3, 0.18, 0.85, -0.2],
    [0, 0.67, -0.2, 0.09, 0.76, -0.1],
    [0.18, 0.67, -0.2, 0.27, 0.76, 0],
    [0.27, 0.67, 0, 0.37, 0.85, 0.2],
    [-0.37, 0.76, 0.1, -0.18, 0.85, 0.3],
    [0.18, 0.76, -0.3, 0.27, 0.95, -0.1],
    [0.09, 0.85, -0.3, 0.18, 0.95, -0.2],
    [0.18, 0.85, -0.4, 0.27, 0.95, -0.3],
  ] } },
  windowsillPlant: { anchor: { x: 0, y: 1.4, z: -2.4 }, model: { file: "plant", pos: [0, 1.43, -2.42], size: 0.45, solid: [
    [-0.12, 0, -0.05, 0.12, 0.25, 0.04],
    [-0.04, 0, 0.04, 0.12, 0.25, 0.13],
    [-0.12, 0.08, 0.04, -0.04, 0.25, 0.13],
    [-0.04, 0.08, -0.14, 0.12, 0.33, -0.05],
    [-0.21, 0.16, -0.05, -0.12, 0.25, 0.22],
    [-0.12, 0.16, 0.13, 0.21, 0.33, 0.22],
    [-0.04, 0.16, -0.23, 0.04, 0.33, -0.14],
    [0.12, 0.16, -0.14, 0.21, 0.33, 0.13],
    [-0.21, 0.25, 0.04, -0.12, 0.33, 0.22],
  ] } },
  fan: { anchor: { x: 0, y: 2.7, z: 0 }, model: undefined },
  femaleCenter: { anchor: { x: 0, y: 1.7, z: 0 }, model: undefined },
} satisfies Record<string, RoomObject>;

/** A static box free flight cannot pass through, in room coordinates. */
export interface SolidBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/** Every static solid: the collider boxes of every solid model, plus the
 *  windowsill shelf (built by hand in view.buildRoom — keep the two in step).
 *  Derived from the table at module load, so a placement edit moves its
 *  colliders with it. */
export const SOLIDS: SolidBox[] = [
  ...(Object.values(BEDROOM) as RoomObject[]).flatMap((obj): SolidBox[] => {
    const m = obj.model;
    if (!m?.solid) return [];
    return m.solid.map(([x1, y1, z1, x2, y2, z2]) => ({
      minX: m.pos[0] + x1,
      maxX: m.pos[0] + x2,
      minY: m.pos[1] + y1,
      maxY: m.pos[1] + y2,
      minZ: m.pos[2] + z1,
      maxZ: m.pos[2] + z2,
    }));
  }),
  { minX: -0.55, maxX: 0.55, minY: 1.35, maxY: 1.41, minZ: -2.52, maxZ: -2.2 },
];

/** Spawn every static Bedroom entity: Hosts, hot decoys, Egg Spots, Nectar plants, the fan. */
export function buildBedroom<R>(world: World<R>): void {
  const spawn = (pos: Pos, comps: Array<[string, object]>): number => {
    const id = world.entity();
    world.add(id, "pos", { ...pos });
    for (const [name, data] of comps) world.add(id, name, data);
    return id;
  };

  spawn(BEDROOM.bed.anchor, [
    ["host", { kind: "human", pool: makePool(4.0), state: createHostState("human") }],
    ["hot", { strength: 0.9 }],
  ]);
  spawn(BEDROOM.bed.breath, [["plume", makePlume(BEDROOM.bed.breath, 1.0)]]);
  spawn(BEDROOM.cat.anchor, [
    ["host", { kind: "cat", pool: makePool(1.2), state: createHostState("cat") }],
    ["hot", { strength: 0.7 }],
  ]);
  spawn(BEDROOM.cat.breath, [["plume", makePlume(BEDROOM.cat.breath, 0.6)]]);
  spawn(BEDROOM.lamp.anchor, [["hot", { strength: 1.0 }]]);
  spawn(BEDROOM.phone.anchor, [["hot", { strength: 0.5 }]]);
  spawn(BEDROOM.laptop.anchor, [["hot", { strength: 0.8 }]]);

  spawn(BEDROOM.vaseSpot.anchor, [["eggSpot", { quality: "ember", used: false }]]);
  spawn(BEDROOM.bowlSpot.anchor, [["eggSpot", { quality: "royal", used: false }]]);
  spawn(BEDROOM.drainSpot.anchor, [["eggSpot", { quality: "plain", used: false }]]);

  spawn(BEDROOM.pottedPlant.anchor, [["plant", { sips: 0 }]]);
  spawn(BEDROOM.windowsillPlant.anchor, [["plant", { sips: 0 }]]);

  spawn(BEDROOM.fan.anchor, [["fan", { radius: 0.9, strength: 1.0, angle: 0, angularSpeed: Math.PI }]]);
}
