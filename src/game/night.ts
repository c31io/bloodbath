import type { World } from "../ecs/ecs.js";
import type { Colony } from "../domain/colony.js";
import type { OffspringCard, Sex, SpotQuality } from "../domain/types.js";
import type { HostKind, HostState } from "../domain/suspicion.js";
import type { Host, Mosquito, Pos } from "./components.js";

/** One run of the game: a single mosquito, dusk to dawn. */
export const DAWN_SECONDS = 180;

/** Raw per-frame player intent. Edge fields are cleared at end of frame. */
export interface NightInput {
  mouseDX: number;
  mouseDY: number;
  forward: boolean;
  boost: boolean;
  up: boolean;
  down: boolean;
  interactPressed: boolean;
  interactHeld: boolean;
  spacePressed: boolean;
}

export interface CourtshipState {
  active: boolean;
  resonance: number;
  within: boolean;
  timeWithin: number;
  timeTotal: number;
}

export interface NightState {
  sex: Sex;
  blood: number;
  laidEggs: boolean;
  /** set when the female lays: she may end the Night voluntarily */
  voluntaryEnd: boolean;
  /** count of Nectar sips so far this Night (audio hooks compare against their own cursor) */
  sips: number;
  spotCeiling: SpotQuality | null;
  brood: OffspringCard[] | null;
  courtship: CourtshipState;
  /** alive | killed by Swat | starved | spent on a won Courtship */
  outcome: "alive" | "swatted" | "starved" | "mated";
  dawn: number;
  /** Mosquito Time: how slow the world moves relative to the player. */
  worldScale: number;
}

/** The Night's singletons, typed on World.res — no casts. */
export interface NightResources {
  input: NightInput;
  night: NightState;
  colony: Colony;
  rng: () => number;
  character: OffspringCard;
}

export type NightWorld = World<NightResources>;

/** The player, if alive this tick: entity, mosquito, position, velocity. */
export interface PlayerRef {
  player: number;
  mosquito: Mosquito;
  pos: Pos;
  vel: Pos;
}

/** The canonical "find the player" read — every consumer of a live Night starts here. */
export function playerState(world: NightWorld): PlayerRef | null {
  const player = world.query("player")[0];
  if (player === undefined) return null;
  const mosquito = world.get<Mosquito>(player, "mosquito")!;
  if (!mosquito.alive) return null;
  return {
    player,
    mosquito,
    pos: world.get<Pos>(player, "pos")!,
    vel: world.get<Pos>(player, "vel")!,
  };
}

export function playerId(world: NightWorld): number {
  return world.query("player")[0]!;
}

export function posOf(world: NightWorld, id: number): Pos {
  return world.get<Pos>(id, "pos")!;
}

export function mosquitoOf(world: NightWorld, id: number): Mosquito {
  return world.get<Mosquito>(id, "mosquito")!;
}

export function hostOfKind(world: NightWorld, kind: HostKind): number {
  for (const id of world.query("host")) {
    if (world.get<Host>(id, "host")!.kind === kind) return id;
  }
  throw new Error(`no ${kind} in this world`);
}

export function hostStateOf(world: NightWorld, hostId: number): HostState {
  return world.get<Host>(hostId, "host")!.state;
}

export function findFirst(world: NightWorld, component: string): number {
  return world.query(component)[0]!;
}

export function eggSpotWithQuality(world: NightWorld, quality: SpotQuality): number {
  for (const id of world.query("eggSpot")) {
    if (world.get<{ quality: SpotQuality }>(id, "eggSpot")!.quality === quality) return id;
  }
  throw new Error(`no ${quality} egg spot`);
}

/** Advance the headless simulation by dt seconds. */
export function tickWorld(world: NightWorld, dt: number): void {
  world.update(dt);
}

/** Declared writer for Mosquito Time (the debug dial). */
export function setWorldScale(world: NightWorld, scale: number): void {
  world.res.night.worldScale = scale;
}
