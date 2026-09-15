import { describe, expect, it } from "vitest";
import { drainEnergy, FEED_ENERGY_REGEN, makePool, sipNectar, NECTAR_BASE, NECTAR_DECAY } from "./resources.js";

describe("drainEnergy", () => {
  it("drains by rate*dt and clamps at zero", () => {
    expect(drainEnergy(100, { dt: 1, rate: 2 })).toBe(98);
    expect(drainEnergy(1, { dt: 5, rate: 2 })).toBe(0);
  });
});

describe("feeding", () => {
  it("draws blood at rate*dt and pays back Energy while landed", () => {
    const pool = makePool(4.0);
    const result = pool.drink({ dt: 2, rate: 0.35 });
    expect(result.blood).toBeCloseTo(0.7);
    expect(result.energy).toBeCloseTo(FEED_ENERGY_REGEN * 2);
    expect(pool.remaining).toBeCloseTo(3.3);
  });

  it("stops paying out once the Host is drained dry", () => {
    const pool = makePool(0.5);
    pool.drink({ dt: 1, rate: 0.35 });
    const result = pool.drink({ dt: 10, rate: 0.35 });
    expect(result.blood).toBeCloseTo(0.15);
    expect(pool.remaining).toBe(0);
  });
});

describe("Nectar", () => {
  it("gives NECTAR_BASE on the first sip", () => {
    const plant = { sips: 0 };
    expect(sipNectar(plant)).toBe(NECTAR_BASE);
    expect(plant.sips).toBe(1);
  });

  it("decays each further sip from the same plant by NECTAR_DECAY", () => {
    const plant = { sips: 0 };
    const gains = [0, 1, 2, 3, 4].map(() => sipNectar(plant));
    expect(gains[0]!).toBeCloseTo(NECTAR_BASE);
    expect(gains[1]!).toBeCloseTo(NECTAR_BASE * NECTAR_DECAY);
    expect(gains[2]!).toBeCloseTo(NECTAR_BASE * NECTAR_DECAY ** 2);
    expect(gains[3]!).toBeCloseTo(NECTAR_BASE * NECTAR_DECAY ** 3);
    expect(gains[4]!).toBeCloseTo(NECTAR_BASE * NECTAR_DECAY ** 4);
  });

  it("decays independently per plant", () => {
    const a = { sips: 0 };
    const b = { sips: 0 };
    sipNectar(a);
    expect(sipNectar(a)).toBeCloseTo(NECTAR_BASE * NECTAR_DECAY);
    expect(sipNectar(b)).toBe(NECTAR_BASE);
  });
});
