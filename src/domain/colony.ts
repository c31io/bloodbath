import type { OffspringCard, SkillDef } from "./types.js";

/**
 * The colony: abstract Population, unplayed Offspring, Skills, Skill Points.
 * Invariant: population == roster.length + 1 while a mosquito is being played.
 */
export interface Colony {
  population: number;
  sp: number;
  skills: Set<string>;
  roster: OffspringCard[];
  generation: number;
  night: number;
}

/** The colony's first female, played on Night 1. */
export const FOUNDER_CARD: OffspringCard = {
  id: "founder",
  name: "Culex the Foundress",
  sex: "female",
  rarity: "plain",
  trait: null,
};

export function newColony(): Colony {
  return { population: 1, sp: 0, skills: new Set(), roster: [], generation: 1, night: 1 };
}

/** A picked Offspring survives to adulthood: +1 Population, queued to play. */
export function pickOffspring(colony: Colony, card: OffspringCard): void {
  colony.population++;
  colony.roster.push(card);
}

/** Who plays next Night: the oldest rostered Offspring, or a fresh Foundress. */
export function nextCharacter(colony: Colony): OffspringCard {
  return colony.roster.shift() ?? FOUNDER_CARD;
}

/**
 * A mosquito died (Swat, starvation, or a male spent on Courtship): -1 Population.
 * At zero the dynasty collapses: fresh colony, Skills and SP persist, generation advances.
 */
export function killMosquito(colony: Colony): { collapsed: boolean } {
  colony.population--;
  if (colony.population > 0) return { collapsed: false };
  colony.population = 1;
  colony.roster = [];
  colony.generation++;
  return { collapsed: true };
}

export function gainSkillPoints(colony: Colony, n: number): void {
  colony.sp += n;
}

/** Buy a Skill: full cost up front, each Skill once. */
export function purchaseSkill(colony: Colony, def: SkillDef): boolean {
  if (colony.skills.has(def.id) || colony.sp < def.cost) return false;
  colony.sp -= def.cost;
  colony.skills.add(def.id);
  return true;
}

export function advanceNight(colony: Colony): void {
  colony.night++;
}
