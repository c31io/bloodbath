export type Sex = "female" | "male";

export type Rarity = "plain" | "striped" | "ember" | "royal";

export type TraitId = "swift" | "ghost" | "drinker" | "vital" | "sharp" | "tough";

export interface Trait {
  id: TraitId;
  name: string;
  description: string;
}

export const TRAITS: Record<TraitId, Trait> = {
  swift: { id: "swift", name: "Swift Wings", description: "+20% flight speed" },
  ghost: { id: "ghost", name: "Ghost Landing", description: "Hosts suspect you 40% slower" },
  drinker: { id: "drinker", name: "Deep Well", description: "+25% blood draw rate" },
  vital: { id: "vital", name: "Vital", description: "+25% max Energy" },
  sharp: { id: "sharp", name: "Sharp antennas", description: "+30% courtship resonance" },
  tough: { id: "tough", name: "Tough wings", description: "Wind pushes you 30% less" },
};

/** One drawn Offspring: the next playable mosquito. */
export interface OffspringCard {
  id: string;
  name: string;
  sex: Sex;
  rarity: Rarity;
  trait: TraitId | null;
}

export type SpotQuality = "plain" | "ember" | "royal";

export interface SkillDef {
  id: string;
  name: string;
  cost: number;
  description: string;
}

export type SkillId = "stealthFlight" | "drugResistance" | "keenSense" | "deepDrill";
