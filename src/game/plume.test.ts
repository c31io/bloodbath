import { describe, expect, it } from "vitest";
import { FOUNDER_CARD, newColony } from "../domain/colony.js";
import type { Plume } from "./components.js";
import { startNight } from "./flow.js";
import { findFirst, tickWorld, type NightWorld } from "./night.js";

const FAIR_RNG = () => 0.5;

function mean(ps: Float32Array, axis: 0 | 1 | 2): number {
  let sum = 0;
  for (let i = 0; i < ps.length / 3; i++) sum += ps[i * 3 + axis]!;
  return sum / (ps.length / 3);
}

describe("the CO2 plume", () => {
  it("advects with the air and rises, once particles have spawned", () => {
    const world: NightWorld = startNight(newColony(), FOUNDER_CARD, { rng: FAIR_RNG, worldScale: 1 });
    const id = findFirst(world, "plume");
    const plume = world.get<Plume>(id, "plume")!;

    tickWorld(world, 0.05); // first tick respawns every particle at the source
    const x0 = mean(plume.positions, 0);
    const y0 = mean(plume.positions, 1);
    expect(y0).toBeGreaterThan(0); // parked particles (-10) have spawned

    tickWorld(world, 1.0);
    // the room drift pushes +x at 0.06 m/s; buoyancy adds ~0.15 m/s upward
    expect(mean(plume.positions, 0)).toBeGreaterThan(x0 + 0.03);
    expect(mean(plume.positions, 1)).toBeGreaterThan(y0 + 0.1);
    for (let i = 0; i < plume.life.length; i++) {
      expect(plume.life[i]).toBeGreaterThan(0);
    }
  });
});
