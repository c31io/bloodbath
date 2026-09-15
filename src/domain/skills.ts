import type { SkillDef, SkillId } from "./types.js";

export type { SkillId };

/** Species-level Skills, bought once with Skill Points; survive Dynasty Collapse. */
export const SKILL_CATALOG: Record<SkillId, SkillDef & { id: SkillId }> = {
  stealthFlight: {
    id: "stealthFlight",
    name: "Stealth Flight",
    cost: 3,
    description: "Hosts suspect you 35% slower",
  },
  drugResistance: {
    id: "drugResistance",
    name: "Drug Resistance",
    cost: 4,
    description: "Conditions affect you 50% less",
  },
  keenSense: {
    id: "keenSense",
    name: "Keen Sense",
    cost: 2,
    description: "CO2 plumes read brighter and farther",
  },
  deepDrill: {
    id: "deepDrill",
    name: "Deep Drill",
    cost: 3,
    description: "+30% blood draw rate",
  },
};
