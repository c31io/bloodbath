import { DAWN_SECONDS, playerState, type NightWorld } from "../game/night.js";
import type { Colony } from "../domain/colony.js";
import type { HostState } from "../domain/suspicion.js";
import type { Host, Mosquito } from "../game/components.js";

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
  takeoff: HTMLDivElement;
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
    <div id="hud-suspicion"><span id="hud-suspicion-label"></span><div class="bar"><div id="hud-suspicion-fill"></div></div></div>
    <div id="hud-courtship"><span>mirror her flight</span><div class="bar"><div id="hud-courtship"></div></div></div>
    <div id="hud-name"></div>
    <div id="hud-hint"></div>
    <div id="hud-takeoff"><b>space</b> — take off</div>
    <div id="hud-lock">click to fly</div>
  `;
  return {
    root,
    meta: root.querySelector("#hud-meta")!,
    dawnFill: root.querySelector("#hud-dawn-fill")!,
    energyFill: root.querySelector("#hud-energy")!,
    bloodRow: root.querySelector("#hud-blood-row")!,
    bloodFill: root.querySelector("#hud-blood")!,
    suspicionFill: root.querySelector("#hud-suspicion-fill")!,
    suspicionRow: root.querySelector("#hud-suspicion")!,
    suspicionLabel: root.querySelector("#hud-suspicion-label")!,
    courtshipRow: root.querySelector("#hud-courtship")!,
    courtshipFill: root.querySelector("#hud-courtship")!,
    name: root.querySelector("#hud-name")!,
    hint: root.querySelector("#hud-hint")!,
    takeoff: root.querySelector("#hud-takeoff")!,
    lockHint: root.querySelector("#hud-lock")!
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

  setLanded(visible: boolean): void {
    this.refs.takeoff.style.display = visible ? "block" : "none";
  }

  hint(text: string): void {
    this.refs.hint.textContent = text;
  }

  update(state: HudState): void {
    const { world, colony } = state;
    const p = playerState(world);
    if (!p) return;
    const m = p.mosquito;
    const night = world.res.night;

    this.refs.meta.textContent = `Night ${colony.night} · Gen ${colony.generation} · Colony ${colony.population} · SP ${colony.sp}`;
    this.refs.dawnFill.style.width = `${Math.max(0, Math.min(100, (night.dawn / DAWN_SECONDS) * 100))}%`;
    this.refs.energyFill.style.width = `${(m.energy / m.maxEnergy) * 100}%`;
    this.refs.bloodRow.style.display = m.sex === "female" ? "block" : "none";
    this.refs.bloodFill.style.width = `${Math.min(100, (night.blood / 2.5) * 100)}%`;

    // worst host awareness drives the suspicion vignette
    let worst = 0;
    let label = "";
    for (const id of world.query("host")) {
      const host = world.get<Host>(id, "host")!;
      const s = host.state.suspicion;
      // the human is the host that matters; he wins ties so the resting
      // label never defaults to the decoy cat
      if (s > worst || (s === worst && host.kind === "human")) {
        worst = host.state.suspicion;
        label = `${host.kind} ${STAGE_LABEL[host.state.stage]}`;
      }
    }
    this.refs.suspicionFill.style.width = `${Math.min(100, worst)}%`;
    this.refs.suspicionLabel.textContent = label;

    this.refs.courtshipRow.style.display = night.courtship.active ? "block" : "none";
    this.refs.courtshipFill.style.width = `${night.courtship.resonance}%`;

    this.refs.name.textContent = `${state.characterName} ${state.characterSex === "female" ? "♀" : "♂"}`;
  }
}

