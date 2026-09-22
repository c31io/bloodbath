import { describe, expect, it } from "vitest";
import { FOUNDER_CARD, newColony } from "../domain/colony.js";
import { startNight } from "./flow.js";
import { hostOfKind, playerState, tickWorld, type NightInput, type NightWorld } from "./night.js";
import { bodyOffset } from "./systems.js";
import { HERO_BODY } from "./components.js";
import { ROOM, SOLIDS } from "./bedroom.js";

const FAIR_RNG = () => 0.5;

function input(overrides: Partial<NightInput> = {}): NightInput {
  return {
    mouseDX: 0,
    mouseDY: 0,
    forward: false,
    boost: false,
    up: false,
    down: false,
    interactPressed: false,
    interactHeld: false,
    spacePressed: false,
    ...overrides,
  };
}

const insideAnySolid = (p: { x: number; y: number; z: number }): boolean =>
  SOLIDS.some((s) => p.x > s.minX && p.x < s.maxX && p.y > s.minY && p.y < s.maxY && p.z > s.minZ && p.z < s.maxZ);

describe("solid furniture", () => {
  it("stops free flight at the desk's east face", () => {
    const world: NightWorld = startNight(newColony(), FOUNDER_CARD, {
      rng: FAIR_RNG,
      worldScale: 1,
      input: input({ forward: true }),
    });
    const p = playerState(world)!;
    Object.assign(p.pos, { x: -1.0, y: 0.5, z: -1.3 }); // aligned with the desk, east of it
    p.mosquito.yaw = Math.PI / 2; // forward = (-1, 0, 0): straight at the desk
    p.mosquito.pitch = 0;
    for (let i = 0; i < 60; i++) tickWorld(world, 1 / 30); // two seconds of thrust
    // held at the desk face (its colliders end near x -1.78), never through to the wall
    expect(p.pos.x).toBeGreaterThanOrEqual(-1.9);
    expect(p.pos.x).toBeLessThan(-1.5);
  });

  it("pushes a player out through the least-penetrated face, so surfaces hold", () => {
    const world: NightWorld = startNight(newColony(), FOUNDER_CARD, { rng: FAIR_RNG, worldScale: 1 });
    const p = playerState(world)!;
    Object.assign(p.pos, { x: 2.55, y: 0.73, z: -1.5 }); // just inside the nightstand's top, clear of the lamp
    tickWorld(world, 1 / 60);
    expect(insideAnySolid(p.pos)).toBe(false); // freed
    expect(p.pos.y).toBeGreaterThan(0.73); // upward, through the top — not sideways
  });

  it("keeps the sleeper landable: a player hovering above him still lands", () => {
    const world: NightWorld = startNight(newColony(), FOUNDER_CARD, {
      rng: FAIR_RNG,
      worldScale: 1,
      input: input({ interactPressed: true }),
    });
    const p = playerState(world)!;
    Object.assign(p.pos, { x: 2.2, y: 1.05, z: 0.4 }); // above the sleeper's box, in land range
    tickWorld(world, 1 / 60);
    expect(p.mosquito.landedOn).toBe(hostOfKind(world, "human"));
  });

  it("clamps a wall-adjacent perch back inside the room shell", () => {
    const world: NightWorld = startNight(newColony(), FOUNDER_CARD, { rng: FAIR_RNG, worldScale: 1 });
    const p = playerState(world)!;
    p.mosquito.landedOn = hostOfKind(world, "human");
    p.mosquito.perch.x = 0.9; // host x 2.09 + 0.9 = 2.99: past the shell standoff
    p.mosquito.perch.y = 0.1;
    p.mosquito.perch.z = 0;
    tickWorld(world, 1 / 60); // landed tick applies the perch, then clamps
    expect(p.pos.x).toBeCloseTo(ROOM.maxX - 0.06, 5); // eye held off the east wall
    expect(insideAnySolid(p.pos)).toBe(false);
  });
  it("perches where you touch down — on the body surface, not at the anchor", () => {
    const world: NightWorld = startNight(newColony(), FOUNDER_CARD, {
      rng: FAIR_RNG,
      worldScale: 1,
      input: input({ interactPressed: true }),
    });
    const p = playerState(world)!;
    Object.assign(p.pos, { x: -1.5, y: 0.3, z: 1.9 }); // off the cat's north flank, in land range
    tickWorld(world, 1 / 60); // land: perch recorded from the touch point
    tickWorld(world, 1 / 60); // landed tick: pos moves onto the perch
    expect(p.mosquito.landedOn).toBe(hostOfKind(world, "cat"));
    expect(p.pos.z).toBeCloseTo(1.83, 5); // body face 1.77 + 0.06 standoff — never the anchor z 1.5
    expect(p.pos.y).toBeCloseTo(0.3, 5); // stayed at the touched-down height
    expect(insideAnySolid(p.pos)).toBe(false); // and never inside the mesh
  });

  it("frees a player who ends up inside a floor-standing box", () => {
    const world: NightWorld = startNight(newColony(), FOUNDER_CARD, { rng: FAIR_RNG, worldScale: 1 });
    const p = playerState(world)!;
    // inside the plant pot near the floor: the bottom face is no exit (the floor
    // clamp keeps y above it), so the push-out must go sideways
    Object.assign(p.pos, { x: -2.6, y: 0.1, z: -2.0 });
    tickWorld(world, 1 / 60);
    expect(insideAnySolid(p.pos)).toBe(false);
  });

  it("lets a player fly under the desk, through where its bounding box lies", () => {
    const world: NightWorld = startNight(newColony(), FOUNDER_CARD, {
      rng: FAIR_RNG,
      worldScale: 1,
      input: input({ forward: true }),
    });
    const p = playerState(world)!;
    Object.assign(p.pos, { x: -1.2, y: 0.15, z: -1.3 }); // under the desktop, between the legs
    p.mosquito.yaw = Math.PI / 2; // forward = (-1, 0, 0): straight through
    p.mosquito.pitch = 0;
    for (let i = 0; i < 60; i++) tickWorld(world, 1 / 30);
    expect(p.pos.x).toBeLessThan(-2.2); // through the desk: only the body at the west wall ends it
    const tip = bodyOffset(Math.PI / 2, 0); // the body rides 0.55 west of the eye
    expect(p.pos.x + tip.x).toBeGreaterThanOrEqual(ROOM.minX + HERO_BODY.margin - 1e-6); // nose rests on the wall
  });

  it("lets a player fly under the bed frame, through where its bounding box lies", () => {
    const world: NightWorld = startNight(newColony(), FOUNDER_CARD, {
      rng: FAIR_RNG,
      worldScale: 1,
      input: input({ forward: true }),
    });
    const p = playerState(world)!;
    Object.assign(p.pos, { x: 0.6, y: 0.05, z: 0.4 }); // under the frame rail, between the posts
    p.mosquito.yaw = -Math.PI / 2; // forward = (1, 0, 0): straight through
    p.mosquito.pitch = 0;
    for (let i = 0; i < 75; i++) tickWorld(world, 1 / 30);
    expect(p.pos.x).toBeGreaterThan(2.2); // through the frame: only the body at the east wall ends it
    const tip = bodyOffset(-Math.PI / 2, 0); // the body rides 0.55 east of the eye
    expect(p.pos.x + tip.x).toBeLessThanOrEqual(ROOM.maxX - HERO_BODY.margin + 1e-6); // nose rests on the wall
  });

  it("rests the body on a wall nose-first, with the camera holding back", () => {
    const world: NightWorld = startNight(newColony(), FOUNDER_CARD, { rng: FAIR_RNG, worldScale: 1, input: input({ forward: true }) });
    const p = playerState(world)!;
    p.mosquito.yaw = 0; // forward = (0, 0, -1): straight at the south wall
    p.mosquito.pitch = 0;
    for (let i = 0; i < 90; i++) tickWorld(world, 1 / 30);
    const tip = bodyOffset(0, 0);
    expect(p.pos.z + tip.z).toBeCloseTo(ROOM.minZ + HERO_BODY.margin, 5); // nose rests on the wall surface
    expect(p.pos.z).toBeGreaterThan(ROOM.minZ + 0.05); // the eye never crosses the shell
    expect(insideAnySolid(p.pos)).toBe(false);
  });
});
