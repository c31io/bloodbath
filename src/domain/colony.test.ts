import { describe, expect, it } from "vitest";
import type { OffspringCard } from "./types.js";
import {
  FOUNDER_CARD,
  gainSkillPoints,
  killMosquito,
  newColony,
  nextCharacter,
  promoteOffspring,
  purchaseSkill,
  advanceNight,
  returnToRoster,
} from "./colony.js";

const card = (over: Partial<OffspringCard> = {}): OffspringCard => ({
  id: crypto.randomUUID(),
  name: "Aedes",
  sex: "female",
  rarity: "plain",
  trait: null,
  ...over,
});

describe("newColony", () => {
  it("starts as a single founding mosquito at generation 1, night 1, no SP", () => {
    const c = newColony();
    expect(c.population).toBe(1);
    expect(c.sp).toBe(0);
    expect(c.generation).toBe(1);
    expect(c.night).toBe(1);
    expect(c.roster).toEqual([]);
    expect(c.skills.size).toBe(0);
  });
});

describe("population transitions", () => {
  it("a promoted Offspring adds one to Population without entering the roster", () => {
    const c = newColony();
    promoteOffspring(c, card());
    expect(c.population).toBe(2);
    expect(c.roster).toEqual([]);
  });

  it("a survivor returns to the roster without touching Population", () => {
    const c = newColony();
    returnToRoster(c, card());
    expect(c.population).toBe(1);
    expect(c.roster.length).toBe(1);
  });

  it("nextCharacter plays the oldest rostered Offspring without touching Population", () => {
    const c = newColony();
    const first = card({ name: "Aedes" });
    const second = card({ name: "Culex" });
    returnToRoster(c, first);
    returnToRoster(c, second);
    expect(nextCharacter(c)).toBe(first);
    expect(c.population).toBe(1);
    expect(c.roster).toEqual([second]);
  });

  it("falls back to the Foundress when the roster is empty", () => {
    const c = newColony();
    expect(nextCharacter(c)).toEqual(FOUNDER_CARD);
    expect(c.population).toBe(1);
  });

  it("a death spends one Population", () => {
    const c = newColony();
    promoteOffspring(c, card());
    expect(killMosquito(c).collapsed).toBe(false);
    expect(c.population).toBe(1);
  });

  it("Dynasty Collapse at zero: fresh colony, Skills persist, generation advances", () => {
    const c = newColony();
    gainSkillPoints(c, 5);
    purchaseSkill(c, { id: "stealthFlight", name: "Stealth Flight", cost: 3, description: "" });
    promoteOffspring(c, card());
    killMosquito(c); // pop 2 -> 1
    const result = killMosquito(c); // pop 1 -> 0
    expect(result.collapsed).toBe(true);
    expect(c.population).toBe(1);
    expect(c.generation).toBe(2);
    expect(c.roster).toEqual([]);
    expect(c.sp).toBe(2);
    expect(c.skills.has("stealthFlight")).toBe(true);
  });
});

describe("Skill Points", () => {
  it("accumulate with gains", () => {
    const c = newColony();
    gainSkillPoints(c, 2);
    gainSkillPoints(c, 3);
    expect(c.sp).toBe(5);
  });

  it("purchase succeeds when affordable and deducts cost", () => {
    const c = newColony();
    gainSkillPoints(c, 3);
    expect(purchaseSkill(c, { id: "drugResistance", name: "Drug Resistance", cost: 4, description: "" })).toBe(false);
    gainSkillPoints(c, 2);
    expect(purchaseSkill(c, { id: "drugResistance", name: "Drug Resistance", cost: 4, description: "" })).toBe(true);
    expect(c.sp).toBe(1);
    expect(c.skills.has("drugResistance")).toBe(true);
  });

  it("does not sell the same Skill twice", () => {
    const c = newColony();
    gainSkillPoints(c, 10);
    expect(purchaseSkill(c, { id: "keenSense", name: "Keen Sense", cost: 2, description: "" })).toBe(true);
    expect(purchaseSkill(c, { id: "keenSense", name: "Keen Sense", cost: 2, description: "" })).toBe(false);
    expect(c.sp).toBe(8);
  });
});

describe("night counter", () => {
  it("advances one Night at a time", () => {
    const c = newColony();
    advanceNight(c);
    advanceNight(c);
    expect(c.night).toBe(3);
  });
});
