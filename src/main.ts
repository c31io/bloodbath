import {
  newColony,
  nextCharacter,
  promoteOffspring,
  purchaseSkill,
  advanceNight,
  type Colony,
} from "./domain/colony.js";
import { finishNight, resourcesOf, startNight, type NightWorld } from "./game/flow.js";
import { SKILL_CATALOG, type SkillId } from "./domain/skills.js";
import type { OffspringCard } from "./domain/types.js";
import { BuzzAudio } from "./audio/buzz.js";
import { clearSave, loadColony, saveColony } from "./persist.js";
import type { Mosquito, Pos } from "./game/components.js";
import { attachInput } from "./game/input.js";
import { buildHud, Hud, Tutorial } from "./ui/hud.js";
import { hideOverlay, showBrood, showHow, showMenu, showNightEnd, showSkills } from "./ui/overlays.js";
import { Tools } from "./ui/tools.js";
import { GameView } from "./game/view.js";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const hudRoot = document.querySelector<HTMLDivElement>("#hud")!;

const view = new GameView(canvas);
const audio = new BuzzAudio();
const hud = new Hud(buildHud(hudRoot));
const tutorial = new Tutorial(hud);

let colony: Colony = loadColony() ?? newColony();
let world: NightWorld | null = null;
let character: OffspringCard | null = null;
let screen: "menu" | "playing" | "between" = "menu";
let inspectNX: number | null = null;
let inspectNY: number | null = null;

const tools = new Tools(view, () => world);

const input = {
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

attachInput(canvas, input, {
  onToolsToggle: () => tools.toggle(),
  onInspectClick: (nx, ny) => {
    inspectNX = nx;
    inspectNY = ny;
  },
});

const menuActions = {
  onBegin: () => beginNight(nextCharacter(colony)),
  onSkills: () => showSkills(colony, onBuySkill, () => showMenu(colony, menuActions)),
  onHow: () => showHow(() => showMenu(colony, menuActions)),
  onReset: () => {
    clearSave();
    colony = newColony();
    showMenu(colony, menuActions);
  },
};

function onBuySkill(id: SkillId): void {
  if (purchaseSkill(colony, SKILL_CATALOG[id])) {
    saveColony(colony);
    showSkills(colony, onBuySkill, () => showMenu(colony, menuActions));
  }
}

function beginNight(who: OffspringCard): void {
  audio.init();
  audio.resume();
  character = who;
  hideOverlay();
  // the live DOM input object is routed straight into the simulation
  world = startNight(colony, who, { rng: Math.random, input });
  view.bindWorld(world);
  screen = "playing";
}

function endNight(): void {
  if (!world || !character) return;
  const result = finishNight(world, colony);
  advanceNight(colony);
  saveColony(colony);
  screen = "between";
  audio.feeding(false);
  const name = character.name;
  if (result.kind === "survived") {
    audio.chime();
    showBrood(result.brood, colony.night - 1, (card) => {
      promoteOffspring(colony, card);
      beginNight(card);
    });
  } else {
    if (result.kind === "swatted" || result.kind === "starved") audio.swat();
    if (result.kind === "mated") audio.chime();
    showNightEnd(result, colony, name, () => {
      hideOverlay();
      showMenu(colony, menuActions);
      screen = "menu";
    });
  }
  world = null;
  document.exitPointerLock();
}

// ---- main loop ----

let prev = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;

  if (screen === "playing" && world) {
    const locked = document.pointerLockElement === canvas;
    hud.setLockHint(!locked);
    if (locked) {
      world.update(dt);
      const res = resourcesOf(world);
      if (res.night.sipped) {
        audio.sip();
        res.night.sipped = false;
      }
      if (res.night.outcome !== "alive" || res.night.dawn <= 0 || res.night.voluntaryEnd) endNight();
    }
    if (world) {
      view.sync(world, tools.channels);
      hud.showMeta(true);
      hud.update({
        world,
        colony,
        characterName: character?.name ?? "",
        characterSex: character?.sex ?? "female",
        nightOver: false,
      });
      tutorial.update(world, colony, input);
      const player = world.query("player")[0]!;
      const vel = world.get<Pos>(player, "vel")!;
      const m = world.get<Mosquito>(player, "mosquito")!;
      audio.wing(Math.hypot(vel.x, vel.y, vel.z), input.forward ? 1 : 0);
      audio.feeding(m.feeding);
      tools.update(world, inspectNX, inspectNY);
    }
  } else {
    hud.showMeta(false);
    hud.setLockHint(false);
    view.sync(null, tools.channels);
    tools.update(null, null, null);
  }

  inspectNX = null;
  inspectNY = null;
  requestAnimationFrame(frame);
}

showMenu(colony, menuActions);
requestAnimationFrame(frame);
