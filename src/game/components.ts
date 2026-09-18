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
