import type { World } from "../ecs/ecs.js";
import { makePool } from "../domain/resources.js";
import { createHostState } from "../domain/suspicion.js";
import type { Pos } from "./components.js";

/** Bedroom shell: x in [-3,3], z in [-2.5,2.5], y in [0,3]. */
export const ROOM = { minX: -3, maxX: 3, minZ: -2.5, maxZ: 2.5, height: 3 };

export const LAYOUT = {
  human: { x: 2.2, y: 0.95, z: 0.4 },
  cat: { x: -1.5, y: 0.12, z: 1.5 },
  lamp: { x: 2.55, y: 1.3, z: -2.0 },
  phone: { x: 0.7, y: 0.65, z: 1.0 },
  laptop: { x: -2.4, y: 0.78, z: -1.5 },
  vaseSpot: { x: 2.55, y: 1.05, z: -1.6 },
  bowlSpot: { x: -0.8, y: 0.06, z: 1.9 },
  drainSpot: { x: -2.85, y: 0.03, z: 0.6 },
  pottedPlant: { x: -2.6, y: 0.35, z: -2.0 },
  windowsillPlant: { x: 0, y: 1.4, z: -2.4 },
  fan: { x: 0, y: 2.7, z: 0 },
  femaleCenter: { x: 0, y: 1.7, z: 0 },
} satisfies Record<string, Pos>;

/** Spawn every static Bedroom entity: Hosts, hot decoys, Egg Spots, Nectar plants, the fan. */
export function buildBedroom(world: World): void {
  const spawn = (pos: Pos, comps: Array<[string, object]>): number => {
    const id = world.entity();
    world.add(id, "pos", { ...pos });
    for (const [name, data] of comps) world.add(id, name, data);
    return id;
  };

  spawn(LAYOUT.human, [
    ["host", { kind: "human", pool: makePool(4.0), state: createHostState("human") }],
    ["hot", { strength: 0.9 }],
    ["plume", { strength: 1.0 }],
  ]);
  spawn(LAYOUT.cat, [
    ["host", { kind: "cat", pool: makePool(1.2), state: createHostState("cat") }],
    ["hot", { strength: 0.7 }],
    ["plume", { strength: 0.6 }],
  ]);
  spawn(LAYOUT.lamp, [["hot", { strength: 1.0 }]]);
  spawn(LAYOUT.phone, [["hot", { strength: 0.5 }]]);
  spawn(LAYOUT.laptop, [["hot", { strength: 0.8 }]]);

  spawn(LAYOUT.vaseSpot, [["eggSpot", { quality: "ember", used: false }]]);
  spawn(LAYOUT.bowlSpot, [["eggSpot", { quality: "royal", used: false }]]);
  spawn(LAYOUT.drainSpot, [["eggSpot", { quality: "plain", used: false }]]);

  spawn(LAYOUT.pottedPlant, [["plant", { sips: 0 }]]);
  spawn(LAYOUT.windowsillPlant, [["plant", { sips: 0 }]]);

  spawn(LAYOUT.fan, [["fan", { radius: 0.9, strength: 1.0, angle: 0, angularSpeed: Math.PI }]]);
}
