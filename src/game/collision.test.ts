import { describe, expect, it } from "vitest";
import { FOUNDER_CARD, newColony } from "../domain/colony.js";
import { startNight } from "./flow.js";
import { hostOfKind, playerState, tickWorld, type NightInput, type NightWorld } from "./night.js";
import { SOLIDS } from "./bedroom.js";
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
    // held at the desk's east face (-1.775), never tunneled through to the wall
    expect(p.pos.x).toBeGreaterThanOrEqual(-1.775);
    expect(p.pos.x).toBeLessThan(-1.5);
  });

  it("pushes a player out through the least-penetrated face, so surfaces hold", () => {
    const world: NightWorld = startNight(newColony(), FOUNDER_CARD, { rng: FAIR_RNG, worldScale: 1 });
    const p = playerState(world)!;
    Object.assign(p.pos, { x: 2.55, y: 0.74, z: -1.5 }); // just inside the nightstand's top, clear of the lamp
    tickWorld(world, 1 / 60);
    expect(p.pos.y).toBeCloseTo(0.745, 6);
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

  it("frees a player who ends up inside a floor-standing box", () => {
    const world: NightWorld = startNight(newColony(), FOUNDER_CARD, { rng: FAIR_RNG, worldScale: 1 });
    const p = playerState(world)!;
    // inside the potted plant's box near the floor: the bottom face is no exit
    // (the floor clamp keeps y above it), so the push-out must go sideways
    Object.assign(p.pos, { x: -2.6, y: 0.1, z: -1.86 });
    tickWorld(world, 1 / 60);
    const inside = SOLIDS.some(
      (s) => p.pos.x > s.minX && p.pos.x < s.maxX && p.pos.y > s.minY && p.pos.y < s.maxY && p.pos.z > s.minZ && p.pos.z < s.maxZ,
    );
    expect(inside).toBe(false);
  });
});
