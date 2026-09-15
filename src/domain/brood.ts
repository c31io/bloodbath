import { TRAITS, type OffspringCard, type Rarity, type SpotQuality, type TraitId } from "./types.js";

export const BLOOD_PER_CARD = 0.5;
export const BROOD_MAX = 6;

/** Rarity ceiling each Egg Spot quality allows. */
export const SPOT_CEILING: Record<SpotQuality, Rarity> = {
  plain: "plain",
  ember: "ember",
  royal: "royal",
};

const RARITY_ORDER: Rarity[] = ["plain", "striped", "ember", "royal"];

/** Cumulative weights per ceiling; a roll lands in the first bucket it exceeds. */
const RARITY_WEIGHTS: Record<Rarity, number[]> = {
  plain: [1, 1, 1, 1],
  striped: [0.55, 1, 1, 1],
  ember: [0.55, 0.88, 1, 1],
  royal: [0.4, 0.73, 0.93, 1],
};

const SPECIES = [
  "Aedes",
  "Culex",
  "Anopheles",
  "Sabethes",
  "Mansonia",
  "Psorophora",
  "Ochlerotatus",
  "Toxorhynchites",
  "Coquillettidia",
  "Culiseta",
  "Wyeomyia",
  "Uranotaenia",
];

const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

export interface BroodParams {
  blood: number;
  ceiling: Rarity;
  rng: () => number;
}

/**
 * Draw the Brood: N pre-sexed Offspring choices.
 * N = 1 + blood/BLOOD_PER_CARD, capped at BROOD_MAX. Never all-male when N >= 2.
 * Rarity never exceeds the Egg Spot ceiling; non-plain cards carry one trait.
 */
export function drawBrood({ blood, ceiling, rng }: BroodParams): OffspringCard[] {
  const n = Math.min(BROOD_MAX, Math.max(1, 1 + Math.floor(blood / BLOOD_PER_CARD)));
  const cards: OffspringCard[] = [];
  for (let i = 0; i < n; i++) {
    const roll = rng();
    let rarity: Rarity = ceiling;
    for (let r = 0; r < RARITY_ORDER.length; r++) {
      if (roll < RARITY_WEIGHTS[ceiling]![r]!) {
        rarity = RARITY_ORDER[r]!;
        break;
      }
    }
    cards.push({
      id: crypto.randomUUID(),
      name: SPECIES[Math.floor(rng() * SPECIES.length)]!,
      sex: rng() < 0.5 ? "male" : "female",
      rarity,
      trait: rarity === "plain" ? null : TRAIT_IDS[Math.floor(rng() * TRAIT_IDS.length)]!,
    });
  }
  if (n >= 2 && cards.every((c) => c.sex === "male")) {
    cards[Math.floor(rng() * n)]!.sex = "female";
  }
  return cards;
}
