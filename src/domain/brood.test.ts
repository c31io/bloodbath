import { describe, expect, it } from "vitest";
import { BLOOD_PER_CARD, BROOD_MAX, drawBrood } from "./brood.js";

/** Deterministic rng that cycles a fixed sequence. */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

const ONE = () => 0.999999;

describe("drawBrood", () => {
  it("always lays at least one card, even on an empty night", () => {
    const brood = drawBrood({ blood: 0, ceiling: "plain", rng: ONE });
    expect(brood.length).toBe(1);
  });

  it("scales N with blood at BLOOD_PER_CARD per extra card", () => {
    // 0.5 blood -> 2 cards, 1.0 -> 3, 0.4 -> 1
    expect(drawBrood({ blood: 0.5, ceiling: "plain", rng: ONE }).length).toBe(2);
    expect(drawBrood({ blood: 1.0, ceiling: "plain", rng: ONE }).length).toBe(3);
    expect(drawBrood({ blood: 0.4, ceiling: "plain", rng: ONE }).length).toBe(1);
  });

  it(`caps the brood at ${BROOD_MAX}`, () => {
    const brood = drawBrood({ blood: 99, ceiling: "royal", rng: ONE });
    expect(brood.length).toBe(BROOD_MAX);
  });

  it("never exceeds the Egg Spot rarity ceiling", () => {
    // rng always ~1 forces the highest roll allowed; ceiling plain must clamp to plain
    const brood = drawBrood({ blood: 2, ceiling: "plain", rng: ONE });
    for (const card of brood) expect(card.rarity).toBe("plain");
  });

  it("rolls rarity up to the ceiling under a high rng", () => {
    const brood = drawBrood({ blood: 2, ceiling: "royal", rng: ONE });
    expect(brood.every((c) => c.rarity === "royal")).toBe(true);
  });

  it("gives traitless cards no trait and striped+ cards exactly one trait", () => {
    const brood = drawBrood({ blood: 3, ceiling: "royal", rng: ONE });
    for (const card of brood) {
      if (card.rarity === "plain") expect(card.trait).toBeNull();
      else expect(card.trait).not.toBeNull();
    }
  });

  it("never draws an all-male brood when there are two or more cards", () => {
    // rng pattern: below 0.5 = male rolls, above = female rolls; 1-sex rolls stay male
    const maleRng = () => 0.1;
    for (const n of [2, 3, 4, 5, 6]) {
      const brood = drawBrood({ blood: (n - 1) * BLOOD_PER_CARD, ceiling: "plain", rng: maleRng });
      expect(brood.some((c) => c.sex === "female")).toBe(true);
    }
  });

  it("leaves a single-card brood alone (may be male)", () => {
    const brood = drawBrood({ blood: 0, ceiling: "plain", rng: () => 0.1 });
    expect(brood.length).toBe(1);
    expect(brood[0]!.sex).toBe("male");
  });
  it("splits sex roughly evenly under a fair rng", () => {
    // period-2 rng: sex-roll lands on 0.1 for even cards, 0.9 for odd -> 3/3 of 6
    const brood = drawBrood({ blood: 2.5, ceiling: "plain", rng: seqRng([0.1, 0.9]) });
    const females = brood.filter((c) => c.sex === "female").length;
    expect(females).toBeGreaterThanOrEqual(2);
    expect(females).toBeLessThanOrEqual(4);
  });

  it("gives every card a unique id", () => {
    const brood = drawBrood({ blood: 2.5, ceiling: "royal", rng: ONE });
    const ids = new Set(brood.map((c) => c.id));
    expect(ids.size).toBe(brood.length);
  });
});

describe("card naming", () => {
  it("names each card from the species pool", () => {
    const brood = drawBrood({ blood: 2.5, ceiling: "plain", rng: ONE });
    for (const card of brood) expect(typeof card.name).toBe("string");
  });
});

