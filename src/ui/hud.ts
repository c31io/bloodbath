import type { Colony } from "../domain/colony.js";
import type { HostState } from "../domain/suspicion.js";
import type { World } from "../ecs/ecs.js";
import type { Host, Mosquito, Pos } from "../game/components.js";
import type { NightWorld } from "../game/flow.js";

export interface HudRefs {
  root: HTMLDivElement;
  meta: HTMLDivElement;
  dawnFill: HTMLDivElement;
  energyFill: HTMLDivElement;
  bloodRow: HTMLDivElement;
  bloodFill: HTMLDivElement;
  suspicionRow: HTMLDivElement;
  suspicionFill: HTMLDivElement;
  suspicionLabel: HTMLDivElement;
  courtshipRow: HTMLDivElement;
  courtshipFill: HTMLDivElement;
  name: HTMLDivElement;
  hint: HTMLDivElement;
  lockHint: HTMLDivElement;
}

export function buildHud(root: HTMLDivElement): HudRefs {
  root.innerHTML = `
    <div id="hud-meta"></div>
    <div id="hud-dawn"><div id="hud-dawn-fill"></div></div>
    <div id="hud-vitals">
      <div class="bar"><div id="hud-energy"></div></div>
      <div class="bar blood" id="hud-blood-row"><div id="hud-blood"></div></div>
    </div>
    <div id="hud-suspicion"><span id="hud-suspicion-label"></span><div class="bar"><div id="hud-suspicion"></div></div></div>
    <div id="hud-courtship"><span>mirror her flight</span><div class="bar"><div id="hud-courtship"></div></div></div>
    <div id="hud-name"></div>
    <div id="hud-hint"></div>
    <div id="hud-lock">click to fly</div>
  `;
  return {
    root,
    meta: root.querySelector("#hud-meta")!,
    dawnFill: root.querySelector("#hud-dawn-fill")!,
    energyFill: root.querySelector("#hud-energy")!,
    bloodRow: root.querySelector("#hud-blood-row")!,
    bloodFill: root.querySelector("#hud-blood")!,
    suspicionRow: root.querySelector("#hud-suspicion")!,
    suspicionFill: root.querySelector("#hud-suspicion")!,
    suspicionLabel: root.querySelector("#hud-suspicion-label")!,
    courtshipRow: root.querySelector("#hud-courtship")!,
    courtshipFill: root.querySelector("#hud-courtship")!,
    name: root.querySelector("#hud-name")!,
    hint: root.querySelector("#hud-hint")!,
    lockHint: root.querySelector("#hud-lock")!,
  };
}

export interface HudState {
  world: NightWorld;
  colony: Colony;
  characterName: string;
  characterSex: string;
  nightOver: boolean;
}

const STAGE_LABEL: Record<HostState["stage"], string> = {
  asleep: "asleep",
  stirring: "stirring",
  awake: "awake",
  hunting: "HUNTING",
};

export class Hud {
  constructor(private refs: HudRefs) {}

  showMeta(visible: boolean): void {
    this.refs.root.dataset.playing = visible ? "true" : "false";
  }

  setLockHint(visible: boolean): void {
    this.refs.lockHint.style.display = visible ? "block" : "none";
  }

  hint(text: string): void {
    this.refs.hint.textContent = text;
  }

  update(state: HudState): void {
    const { world, colony } = state;
    const player = world.query("player")[0]!;
    const m = world.get<Mosquito>(player, "mosquito")!;
    const night = world.res.night as { dawn: number; blood: number; courtship: { active: boolean; resonance: number } };

    this.refs.meta.textContent = `Night ${colony.night} · Gen ${colony.generation} · Colony ${colony.population} · SP ${colony.sp}`;
    this.refs.dawnFill.style.width = `${Math.max(0, Math.min(100, (night.dawn / 180) * 100))}%`;
    this.refs.energyFill.style.width = `${(m.energy / m.maxEnergy) * 100}%`;
    this.refs.bloodRow.style.display = m.sex === "female" ? "block" : "none";
    this.refs.bloodFill.style.width = `${Math.min(100, (night.blood / 2.5) * 100)}%`;

    // worst host awareness drives the suspicion vignette
    let worst = 0;
    let label = "";
    for (const id of world.query("host")) {
      const host = world.get<Host>(id, "host")!;
      if (host.state.suspicion > worst) {
        worst = host.state.suspicion;
        label = `${host.kind} ${STAGE_LABEL[host.state.stage]}`;
      }
    }
    this.refs.suspicionRow.style.opacity = worst > 5 ? "1" : "0";
    this.refs.suspicionFill.style.width = `${Math.min(100, worst)}%`;
    this.refs.suspicionLabel.textContent = label;

    this.refs.courtshipRow.style.display = night.courtship.active ? "block" : "none";
    this.refs.courtshipFill.style.width = `${night.courtship.resonance}%`;

    this.refs.name.textContent = `${state.characterName} ${state.characterSex === "female" ? "♀" : "♂"}`;
  }
}

/** Diegetic Night-1 tutorial: one line at a time, staged by what the player does. */
export class Tutorial {
  private moved = 0;
  private stage = 0;

  constructor(private hud: Hud) {}

  update(world: NightWorld, colony: Colony, input: { mouseDX: number; mouseDY: number }): void {
    if (colony.night !== 1 || colony.generation !== 1) {
      this.hud.hint("");
      return;
    }
    const player = world.query("player")[0]!;
    const m = world.get<Mosquito>(player, "mosquito")!;
    const p = world.get<Pos>(player, "pos")!;
    const night = world.res.night as { sex: string; blood: number; laidEggs: boolean };
    if (night.sex !== "female") {
      this.hud.hint("Males don't bite. Sip nectar to live, and find her.");
      return;
    }
    this.moved += Math.abs(input.mouseDX) + Math.abs(input.mouseDY);
    const lines = [
      "Drift on the night air. Move the mouse.",
      "A plume of breath threads the dark — follow it.",
      "Warmth pools near skin. Click to land, soft.",
      "Hold to drink. Watch the eye — back off before it wakes.",
      "Enough. Find still water and click to lay your brood.",
    ];
    let s = this.stage;
    if (s === 0 && this.moved > 400) s = 1;
    if (s === 1) {
      const human = world.query("host")[0]!;
      const hp = world.get<Pos>(human, "pos")!;
      if (Math.hypot(hp.x - p.x, hp.y - p.y, hp.z - p.z) < 2.6) s = 2;
    }
    if (s === 2 && m.landedOn !== null) s = 3;
    if (s === 3 && night.blood >= 0.5) s = 4;
    if (s === 4 && night.laidEggs) s = 5;
    this.stage = s;
    this.hud.hint(s < lines.length ? lines[s]! : "");
  }
}
