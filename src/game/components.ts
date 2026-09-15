import type { BloodPool } from "../domain/resources.js";
import type { HostKind, HostState } from "../domain/suspicion.js";
import type { Sex, SpotQuality } from "../domain/types.js";

export interface Pos {
  x: number;
  y: number;
  z: number;
}

export interface Vel {
  x: number;
  y: number;
  z: number;
}

/** The played mosquito. Mods fold Skill + trait effects into plain multipliers. */
export interface Mosquito {
  sex: Sex;
  energy: number;
  maxEnergy: number;
  blood: number;
  landedOn: number | null;
  feeding: boolean;
  alive: boolean;
  yaw: number;
  pitch: number;
  roll: number;
  speedMod: number;
  feedRateMod: number;
  stealthMod: number;
  windMod: number;
  sharpMod: number;
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
