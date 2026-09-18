import { World } from "../ecs/ecs.js";
import { drawBrood } from "../domain/brood.js";
import {
  gainSkillPoints,
  killMosquito,
  returnToRoster,
  type Colony,
} from "../domain/colony.js";
import type { OffspringCard, SpotQuality, TraitId } from "../domain/types.js";
import { BEDROOM, buildBedroom } from "./bedroom.js";
import { makePlume, type Mosquito, type Mods } from "./components.js";
import { registerLogicSystems } from "./systems.js";
import {
  DAWN_SECONDS,
  type NightInput,
  type NightResources,
  type NightState,
  type NightWorld,
} from "./night.js";


export interface StartNightOpts {
  rng: () => number;
  /** Mosquito Time multiplier override; defaults to the shipped 0.4. */
  worldScale?: number;
  /** Live DOM input; when omitted the Night runs on a private zeroed struct. */
  input?: NightInput;
}

/** Build a fresh Night world: Bedroom, playable mosquito, female NPC for males. */
export function startNight(colony: Colony, character: OffspringCard, opts: StartNightOpts): NightWorld {
  const world = new World<NightResources>();
  buildBedroom(world);

  const mods = computeMods(character, colony);
  const player = world.entity();
  world.add(player, "pos", { x: 0, y: 1.5, z: 0 });
  world.add(player, "vel", { x: 0, y: 0, z: 0 });
  const mosquito: Mosquito = {
    sex: character.sex,
    energy: mods.maxEnergy,
    landedOn: null,
    feeding: false,
    alive: true,
    yaw: 0,
    pitch: 0,
    roll: 0,
    ...mods,
  };
  world.add(player, "mosquito", mosquito);
  world.add(player, "player", {});

  if (character.sex === "male") {
    const female = world.entity();
    world.add(female, "pos", { ...BEDROOM.femaleCenter.anchor });
    world.add(female, "femalePath", { t: 0 });
    world.add(female, "plume", makePlume(BEDROOM.femaleCenter.anchor, 0.8));
  }

  world.res.input = opts.input ?? {
    mouseDX: 0,
    mouseDY: 0,
    forward: false,
    boost: false,
    up: false,
    down: false,
    interactPressed: false,
    interactHeld: false,
    spacePressed: false,
  };
  world.res.night = {
    sex: character.sex,
    blood: 0,
    laidEggs: false,
    voluntaryEnd: false,
    sips: 0,
    spotCeiling: null,
    brood: null,
    courtship: { active: false, resonance: 0, within: false, timeWithin: 0, timeTotal: 0 },
    outcome: "alive",
    dawn: DAWN_SECONDS,
    worldScale: opts.worldScale ?? 0.4,
  } satisfies NightState;
  world.res.colony = colony;
  world.res.rng = opts.rng;
  world.res.character = character;

  registerLogicSystems(world);
  return world;
}


/** Fold the character's trait and the colony's Skills into multipliers. */
export function computeMods(character: OffspringCard, colony: Colony): Mods {
  const trait = (id: TraitId): boolean => character.trait === id;
  const skill = (id: string): boolean => colony.skills.has(id);
  return {
    maxEnergy: 100 * (trait("vital") ? 1.25 : 1),
    speedMod: 1 + (trait("swift") ? 0.2 : 0),
    feedRateMod: (skill("deepDrill") ? 1.3 : 1) * (trait("drinker") ? 1.25 : 1),
    stealthMod: (skill("stealthFlight") ? 0.65 : 1) * (trait("ghost") ? 0.6 : 1),
    windMod: (skill("drugResistance") ? 0.5 : 1) * (trait("tough") ? 0.7 : 1),
    sharpMod: 1 + (trait("sharp") ? 0.3 : 0),
    senseMod: 1 + (skill("keenSense") ? 0.5 : 0),
  };
}

export type NightResult =
  | { kind: "survived"; brood: OffspringCard[]; spotCeiling: SpotQuality }
  | { kind: "swatted"; collapsed: boolean }
  | { kind: "starved"; collapsed: boolean }
  | { kind: "mated"; sp: number; collapsed: boolean }
  | { kind: "maleSurvived" };

/** Close the Night and apply every colony consequence. */
export function finishNight(world: NightWorld, colony: Colony): NightResult {
  const { night, rng, character } = world.res;
  if (night.outcome === "swatted" || night.outcome === "starved") {
    const { collapsed } = killMosquito(colony);
    return { kind: night.outcome, collapsed };
  }
  if (night.outcome === "mated") {
    const precision = night.courtship.timeTotal > 0 ? night.courtship.timeWithin / night.courtship.timeTotal : 0;
    const sp = 2 + Math.floor(precision * 2);
    gainSkillPoints(colony, sp);
    const { collapsed } = killMosquito(colony);
    return { kind: "mated", sp, collapsed };
  }
  if (night.sex === "female") {
    // she survived: she rejoins the colony pool and her Brood is drawn
    returnToRoster(colony, character);
    const ceiling: SpotQuality = night.spotCeiling ?? "plain";
    const brood = drawBrood({ blood: night.blood, ceiling, rng });
    return { kind: "survived", brood, spotCeiling: ceiling };
  }
  // a male who never mated rejoins the roster
  returnToRoster(colony, character);
  return { kind: "maleSurvived" };
}

