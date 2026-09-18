import { describe, expect, it } from "vitest";
import {
  FOUNDER_CARD,
  newColony,
  nextCharacter,
  promoteOffspring,
  returnToRoster,
  type Colony,
} from "../domain/colony.js";
import { drawBrood } from "../domain/brood.js";
import type { OffspringCard } from "../domain/types.js";
import type { NightResult } from "./flow.js";
import type { NightWorld } from "./night.js";
import { finishNight, startNight } from "./flow.js";
import {
  eggSpotWithQuality,
  findFirst,
  hostOfKind,
  hostStateOf,
  mosquitoOf,
  playerId,
  posOf,
  tickWorld,
} from "./night.js";

const FAIR_RNG = () => 0.5;
function freshFemaleNight(colony: Colony = newColony()): NightWorld {
  return startNight(colony, FOUNDER_CARD, { rng: FAIR_RNG, worldScale: 1 });
}

/** Land on the human and drink for a while. */
function feed(world: NightWorld, seconds: number, held = true): void {
  const player = playerId(world);
  const human = hostOfKind(world, "human");
  Object.assign(posOf(world, player), posOf(world, human));
  world.res.input.interactPressed = true; // land
  tickWorld(world, 0.05);
  world.res.input.interactHeld = held; // drink while held
  tickWorld(world, seconds);
}

function takeOff(world: NightWorld): void {
  world.res.input.interactHeld = false;
  world.res.input.spacePressed = true;
  tickWorld(world, 0.05);
  world.res.input.spacePressed = false;
}

function layAtRoyalSpot(world: NightWorld): void {
  takeOff(world);
  const player = playerId(world);
  Object.assign(posOf(world, player), posOf(world, eggSpotWithQuality(world, "royal")));
  world.res.input.interactPressed = true;
  tickWorld(world, 0.1);
}

describe("input routing", () => {
  it("runs the Night on the caller's live input object", () => {
    const external = {
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
    const world = startNight(newColony(), FOUNDER_CARD, { rng: FAIR_RNG, input: external });
    expect(world.res.input).toBe(external);
    external.interactPressed = true;
    expect(world.res.input.interactPressed).toBe(true);
  });
});

describe("a female Night", () => {
  it("pays blood and Energy while drinking, and the Host stirs", () => {
    const world = freshFemaleNight();
    feed(world, 2);
    expect(world.res.night.blood).toBeCloseTo(0.7);
    expect(mosquitoOf(world, playerId(world)).energy).toBeGreaterThan(96);
    expect(hostStateOf(world, hostOfKind(world, "human")).suspicion).toBeGreaterThan(5);
  });

  it("lets suspicion decay between bursts, so a careful feeder never gets swatted", () => {
    const world = freshFemaleNight();
    for (let i = 0; i < 6; i++) {
      feed(world, 5);
      takeOff(world);
      tickWorld(world, 8);
    }
    expect(hostStateOf(world, hostOfKind(world, "human")).stage).not.toBe("hunting");
  });

  it("ends at an Egg Spot: laying sets the Brood's rarity ceiling", () => {
    const world = freshFemaleNight();
    feed(world, 4);
    layAtRoyalSpot(world);
    expect(world.res.night.voluntaryEnd).toBe(true);
    const result = finishNight(world, world.res.colony);
    expect(result.kind).toBe("survived");
    if (result.kind === "survived") {
      expect(result.brood.length).toBeGreaterThanOrEqual(2);
      expect(result.spotCeiling).toBe("royal");
    }
  });

  it("picking a card grows the colony", () => {
    const world = freshFemaleNight();
    const colony = world.res.colony;
    feed(world, 4);
    layAtRoyalSpot(world);
    const result = finishNight(world, colony);
    if (result.kind !== "survived") throw new Error("expected a survived night");
    const card = result.brood[0]!;
    promoteOffspring(colony, card);
    expect(colony.population).toBe(2);
    // the picked card is now being played: it is not in the roster
    expect(colony.roster).not.toContain(card);
  });
});

describe("a greedy feeder", () => {
  it("gets swatted; with no other colony member the dynasty collapses", () => {
    const world = freshFemaleNight();
    const colony = world.res.colony;
    feed(world, 30); // 6/s rise, never backs off
    const result = finishNight(world, colony);
    expect(result.kind).toBe("swatted");
    if (result.kind === "swatted") expect(result.collapsed).toBe(true);
    expect(colony.population).toBe(1); // fresh colony
    expect(colony.generation).toBe(2);
  });
});

describe("a male Night", () => {
  it("Nectar decays per plant; a won Courtship pays SP and spends the male", () => {
    const colony = newColony();
    // a second colony member, so the male's death doesn't collapse the dynasty
    colony.population = 2; // a second colony member so the male's death doesn't collapse
    returnToRoster(colony, { id: "spare", name: "Aedes", sex: "female", rarity: "plain", trait: null });
    const world = startNight(colony, { ...FOUNDER_CARD, sex: "male" }, { rng: FAIR_RNG, worldScale: 1 });
    const player = playerId(world);
    const input = world.res.input;

    Object.assign(posOf(world, player), posOf(world, findFirst(world, "plant")));
    const gains: number[] = [];
    for (let i = 0; i < 3; i++) {
      mosquitoOf(world, player).energy = 10;
      input.interactPressed = true;
      tickWorld(world, 0.1);
      input.interactPressed = false;
      tickWorld(world, 0.1);
      gains.push(mosquitoOf(world, player).energy - 10);
    }
    // passive drain during each 0.1s tick shaves a hair off each gain
    expect(gains[0]).toBeCloseTo(25, 0);
    expect(gains[1]).toBeCloseTo(20, 0);
    expect(gains[2]).toBeCloseTo(16, 0);

    // courtship: ride the female's path, resonance fills to 100
    mosquitoOf(world, player).energy = 100;
    const female = findFirst(world, "femalePath");
    for (let i = 0; i < 600 && world.res.night.courtship.resonance < 100; i++) {
      Object.assign(posOf(world, player), posOf(world, female));
      tickWorld(world, 0.1);
    }
    expect(world.res.night.courtship.resonance).toBeGreaterThanOrEqual(100);

    const spBefore = colony.sp;
    const result = finishNight(world, colony);
    expect(result.kind).toBe("mated");
    if (result.kind === "mated") expect(result.sp).toBeGreaterThanOrEqual(2);
    expect(colony.sp).toBeGreaterThan(spBefore);
    expect(colony.population).toBe(1); // 2 -> 1: the male is spent
  });
});

describe("starvation", () => {
  it("kills a mosquito whose Energy stays at zero", () => {
    const world = freshFemaleNight();
    const colony = world.res.colony;
    mosquitoOf(world, playerId(world)).energy = 0.01;
    tickWorld(world, 5);
    const result = finishNight(world, colony);
    expect(result.kind).toBe("starved");
    expect(colony.population).toBe(1); // collapsed and re-founded
    expect(colony.generation).toBe(2);
  });
});

describe("dawn", () => {
  it("forces the Night to end, drawing a plain-ceiling Brood", () => {
    const world = freshFemaleNight();
    const colony = world.res.colony;
    for (let i = 0; i < 40 && world.res.night.dawn > 0; i++) tickWorld(world, 10);
    const result = finishNight(world, colony);
    expect(result.kind).toBe("survived");
    if (result.kind === "survived") {
      expect(result.spotCeiling).toBe("plain");
      expect(result.brood.length).toBe(1);
    }
  });
});

describe("colony sequencing", () => {
  it("plays the oldest rostered card next; an empty roster re-founds", () => {
    const colony = newColony();
    const card: OffspringCard = { id: "x", name: "Aedes", sex: "male", rarity: "plain", trait: null };
    returnToRoster(colony, card);
    expect(nextCharacter(colony)).toBe(card);
    expect(nextCharacter(colony)).toEqual(FOUNDER_CARD);
  });

  it("a brood drawn from real blood never runs dry of cards", () => {
    const brood = drawBrood({ blood: 3, ceiling: "royal", rng: FAIR_RNG });
    expect(brood.length).toBeGreaterThan(1);
  });
});

// Exhaustiveness guard: every NightResult kind must stay represented.
const _guard: Record<NightResult["kind"], true> = {
  survived: true,
  swatted: true,
  starved: true,
  mated: true,
  maleSurvived: true,
};
void _guard;
