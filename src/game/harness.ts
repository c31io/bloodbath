import type { World } from "../ecs/ecs.js";
import type { Colony } from "../domain/colony.js";
import type { HostKind, HostState } from "../domain/suspicion.js";
import type { OffspringCard, SpotQuality } from "../domain/types.js";
import type { Host, Mosquito, Pos } from "./components.js";
import type { NightInput, NightState, NightWorld } from "./flow.js";
import { resourcesOf } from "./flow.js";

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

export function inputOf(world: NightWorld): NightInput {
  return resourcesOf(world).input;
}

export function nightOf(world: NightWorld): NightState {
  return resourcesOf(world).night;
}

export function colonyOf(world: NightWorld): Colony {
  return resourcesOf(world).colony;
}

export function characterOf(world: NightWorld): OffspringCard {
  return resourcesOf(world).character;
}

/** Advance the headless simulation by dt seconds. */
export function tickWorld(world: NightWorld, dt: number): void {
  world.update(dt);
}
