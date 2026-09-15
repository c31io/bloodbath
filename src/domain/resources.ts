/** Energy drain/refill and Host blood pools. Pure arithmetic; death rules live in the game flow. */

export const FEED_ENERGY_REGEN = 6; // Energy per second while drinking
export const NECTAR_BASE = 25; // Energy from a plant's first sip
export const NECTAR_DECAY = 0.8; // each further sip from the same plant scales by this

/** Drain Energy by rate*dt, clamped at zero. */
export function drainEnergy(energy: number, p: { dt: number; rate: number }): number {
  return Math.max(0, energy - p.rate * p.dt);
}

/** A Host's finite blood pool. */
export interface BloodPool {
  readonly max: number;
  readonly remaining: number;
  drink(p: { dt: number; rate: number }): { blood: number; energy: number };
}

export function makePool(max: number): BloodPool {
  let remaining = max;
  return {
    get max() {
      return max;
    },
    get remaining() {
      return remaining;
    },
    drink({ dt, rate }) {
      const wanted = rate * dt;
      const blood = Math.min(wanted, remaining);
      remaining -= blood;
      return { blood, energy: FEED_ENERGY_REGEN * (wanted > 0 ? dt : 0) };
    },
  };
}

export interface NectarPlant {
  sips: number;
}

/** A plant sip pays NECTAR_BASE scaled by NECTAR_DECAY per prior sip from that plant. */
export function sipNectar(plant: NectarPlant): number {
  const gain = NECTAR_BASE * NECTAR_DECAY ** plant.sips;
  plant.sips++;
  return gain;
}
