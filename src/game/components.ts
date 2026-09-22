import type { BloodPool } from "../domain/resources.js";
import type { HostKind, HostState } from "../domain/suspicion.js";
import type { Sex, SpotQuality } from "../domain/types.js";

export interface Pos {
  x: number;
  y: number;
  z: number;
}

/** Mods fold Skill + trait effects into plain multipliers on the played mosquito. */
export interface Mods {
  maxEnergy: number;
  speedMod: number;
  feedRateMod: number;
  stealthMod: number;
  windMod: number;
  sharpMod: number;
  /** how strongly the CO2 plume channel reads (keenSense) */
  senseMod: number;
}

/** The played mosquito. */
export interface Mosquito extends Mods {
  sex: Sex;
  energy: number;
  landedOn: number | null;
  /** attach offset from the host's pos while landed: where on the body you touched down */
  perch: Pos;
  feeding: boolean;
  alive: boolean;
  yaw: number;
  pitch: number;
  roll: number;
}

export interface Host {
  kind: HostKind;
  pool: BloodPool;
  state: HostState;
}

export interface Hot {
  strength: number;
}

export interface EggSpotC {
  quality: SpotQuality;
  used: boolean;
}

export interface Plant {
  sips: number;
}

export interface Fan {
  radius: number;
  strength: number;
  angle: number;
  angularSpeed: number;
}

export interface FemalePath {
  t: number;
}

export const PLUME_COUNT = 90;

/** A Host's CO2 trail: particle state integrated by the plume system,
 *  uploaded to the view by the renderer. Cosmetic entropy only (Math.random) —
 *  the game's rng stream stays untouched for reproducible Brood draws. */
export interface Plume {
  strength: number;
  positions: Float32Array;
  vel: Float32Array;
  life: Float32Array;
}

export function makePlume(origin: Pos, strength: number): Plume {
  const positions = new Float32Array(PLUME_COUNT * 3);
  for (let i = 0; i < PLUME_COUNT; i++) {
    positions[i * 3] = origin.x;
    positions[i * 3 + 1] = -10; // parked below the floor until the first respawn
    positions[i * 3 + 2] = origin.z;
  }
  return { strength, positions, vel: new Float32Array(PLUME_COUNT * 3), life: new Float32Array(PLUME_COUNT) };
}

/** Every named data bag the Bedroom and Night spawn, for debug inspection. */
export const COMPONENT_NAMES = [
  "pos",
  "vel",
  "mosquito",
  "host",
  "hot",
  "eggSpot",
  "plant",
  "fan",
  "femalePath",
  "plume",
] as const;

/** The visible hero body rides ahead of and below the eye (the fp camera):
 *  pivot at down/fwd, nose and wings reaching `reach` further. The sim keeps
 *  the tip out of the room shell (walls + ceiling) so nose-first flight rests
 *  the body ON the surface with the camera holding back; the view retracts
 *  the pivot by the same measure so the graphic never enters geometry. */
export const HERO_BODY = { down: 0.165, fwd: 0.3, reach: 0.25, margin: 0.05 };
