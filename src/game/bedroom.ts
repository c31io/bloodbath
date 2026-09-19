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
  rotY?: number;
  rotZ?: number;
  pos: [number, number, number];
  /** World-space AABB extents [w, h, d] of the placed model, rotations applied
   *  (measured post-placement). When present the model is solid: the box sits on
   *  pos — x/z centered, y from pos.y up — and free flight cannot pass through. */
  solid?: [number, number, number];
}

export interface RoomObject {
  /** gameplay anchor: where entities spawn and interactions attach (Heat origin, sip point) */
  anchor: Pos;
  model?: ModelSpec;
}

const HALF_PI = Math.PI / 2;

/** The one placement vocabulary: one row per object in the Bedroom, gameplay and visuals.
 *  Models are Quaternius (CC0) via poly.pizza. */
export const BEDROOM = {
  // The sleeper is skinned: placement measures his posed bounds after an explicit
  // skeleton settlement (see loadProps) — a plain Box3 would see bind-pose vertices.
  bed: { anchor: { x: 2.2, y: 0.95, z: 0.4 }, model: { file: "bed-double", pos: [2.1, 0, 0.4], size: 2.1, rotY: HALF_PI, solid: [2.1, 0.77, 1.39] } },
  sleeper: { anchor: { x: 2.2, y: 0.95, z: 0.4 }, model: { file: "man-a", pos: [2.15, 0.58, 0.4], size: 1.75, rotY: HALF_PI, rotZ: HALF_PI, solid: [1.75, 0.3, 0.52] } },
  cat: { anchor: { x: -1.5, y: 0.12, z: 1.5 }, model: { file: "cat-a", pos: [-1.5, 0, 1.5], size: 0.55, solid: [0.33, 0.48, 0.55] } },
  nightstand: { anchor: { x: 2.55, y: 0, z: -1.85 }, model: { file: "night-stand", pos: [2.55, 0, -1.85], size: 0.75, solid: [0.75, 0.75, 0.75] } },
  lamp: { anchor: { x: 2.55, y: 1.3, z: -2.0 }, model: { file: "light-desk", pos: [2.55, 0.745, -1.95], size: 0.45, solid: [0.2, 0.45, 0.36] } },
  phone: { anchor: { x: 0.7, y: 0.65, z: 1.0 }, model: { file: "phone", pos: [0.7, 0.75, 1.15], size: 0.16, solid: [0.08, 0.16, 0.01] } },
  desk: { anchor: { x: -2.4, y: 0.78, z: -1.5 }, model: { file: "desk", pos: [-2.4, 0, -1.3], size: 1.25, solid: [1.25, 0.63, 0.58] } },
  laptop: { anchor: { x: -2.4, y: 0.78, z: -1.5 }, model: { file: "computer", pos: [-2.4, 0.72, -1.5], size: 0.5, solid: [0.27, 0.5, 0.15] } },
  vaseSpot: { anchor: { x: 2.55, y: 1.05, z: -1.6 }, model: { file: "chalice", pos: [2.55, 0.745, -1.55], size: 0.26, solid: [0.17, 0.26, 0.17] } },
  bowlSpot: { anchor: { x: -0.8, y: 0.06, z: 1.9 }, model: { file: "bowl", pos: [-0.8, 0, 1.9], size: 0.24, solid: [0.24, 0.11, 0.24] } },
  drainSpot: { anchor: { x: -2.85, y: 0.03, z: 0.6 }, model: undefined },
  pottedPlant: { anchor: { x: -2.6, y: 0.35, z: -2.0 }, model: { file: "plant-big", pos: [-2.6, 0, -2.0], size: 0.95, solid: [0.73, 0.95, 0.79] } },
  windowsillPlant: { anchor: { x: 0, y: 1.4, z: -2.4 }, model: { file: "plant", pos: [0, 1.43, -2.42], size: 0.45, solid: [0.41, 0.33, 0.45] } },
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

/** Every static solid: one AABB per solid model, plus the windowsill shelf
 *  (built by hand in view.buildRoom — keep the two in step). Derived from the
 *  table at module load, so a placement edit moves its collider with it. */
export const SOLIDS: SolidBox[] = [
  ...(Object.values(BEDROOM) as RoomObject[]).flatMap((obj): SolidBox[] => {
    const m = obj.model;
    if (!m?.solid) return [];
    const [w, h, d] = m.solid;
    return [
      {
        minX: m.pos[0] - w / 2,
        maxX: m.pos[0] + w / 2,
        minY: m.pos[1],
        maxY: m.pos[1] + h,
        minZ: m.pos[2] - d / 2,
        maxZ: m.pos[2] + d / 2,
      },
    ];
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
    ["plume", makePlume(BEDROOM.bed.anchor, 1.0)],
  ]);
  spawn(BEDROOM.cat.anchor, [
    ["host", { kind: "cat", pool: makePool(1.2), state: createHostState("cat") }],
    ["hot", { strength: 0.7 }],
    ["plume", makePlume(BEDROOM.cat.anchor, 0.6)],
  ]);
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
