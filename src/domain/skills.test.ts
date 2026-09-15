import { describe, expect, it } from "vitest";
import { SKILL_CATALOG } from "./skills.js";
import type { SkillId } from "./skills.js";
import { gainSkillPoints, newColony, purchaseSkill } from "./colony.js";

describe("skill catalog", () => {
  it("ships the two named species Skills plus two more", () => {
    expect(SKILL_CATALOG.stealthFlight).toBeDefined();
    expect(SKILL_CATALOG.drugResistance).toBeDefined();
    expect(Object.keys(SKILL_CATALOG).length).toBe(4);
  });

  it("prices every Skill above zero", () => {
    for (const id of Object.keys(SKILL_CATALOG) as SkillId[]) {
      expect(SKILL_CATALOG[id].cost).toBeGreaterThan(0);
    }
  });
});

describe("purchaseSkill via the colony", () => {
  it("records the Skill and deducts SP", () => {
    const c = newColony();
    gainSkillPoints(c, SKILL_CATALOG.stealthFlight.cost);
    expect(purchaseSkill(c, SKILL_CATALOG.stealthFlight)).toBe(true);
    expect(c.skills.has("stealthFlight")).toBe(true);
    expect(c.sp).toBe(0);
  });
});
