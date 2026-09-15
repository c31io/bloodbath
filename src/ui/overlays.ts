import { SKILL_CATALOG, type SkillId } from "../domain/skills.js";
import { TRAITS, type OffspringCard, type Rarity } from "../domain/types.js";
import type { Colony } from "../domain/colony.js";
import type { NightResult } from "../game/flow.js";

const RARITY_LABEL: Record<Rarity, string> = {
  plain: "plain",
  striped: "striped",
  ember: "ember",
  royal: "royal",
};

export interface MenuActions {
  onBegin: () => void;
  onSkills: () => void;
  onHow: () => void;
  onReset: () => void;
}

function overlay(): HTMLDivElement {
  const el = document.querySelector<HTMLDivElement>("#overlay")!;
  el.innerHTML = "";
  el.style.display = "flex";
  return el;
}

export function hideOverlay(): void {
  const el = document.querySelector<HTMLDivElement>("#overlay")!;
  el.innerHTML = "";
  el.style.display = "none";
}

function button(label: string, onClick: () => void, cls = ""): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.className = `btn ${cls}`;
  b.addEventListener("click", onClick);
  return b;
}

export function showMenu(colony: Colony, actions: MenuActions): void {
  const el = overlay();
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <h1>BLOODBATH</h1>
    <p class="sub">a mosquito simulator</p>
    <p class="stats">Night ${colony.night} · Generation ${colony.generation} · Colony ${colony.population} · SP ${colony.sp}</p>
  `;
  panel.appendChild(button("Begin the Night", actions.onBegin, "primary"));
  panel.appendChild(button("Skills", actions.onSkills));
  panel.appendChild(button("How to play", actions.onHow));
  panel.appendChild(button("Forget this bloodline", actions.onReset, "danger"));
  el.appendChild(panel);
}

export function showHow(onClose: () => void): void {
  const el = overlay();
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>How to play</h2>
    <p><b>Click</b> the room to take control. <b>Mouse</b> steers your flight; <b>W</b> thrusts, <b>Shift</b> bursts, <b>Space</b> rises (and releases a perch), <b>C</b> sinks.</p>
    <p>You smell the world like a mosquito: mid-field is a <i>dreamy blur</i>, <b>heat</b> glows near (warm things, not all of them blood), and <b>breath — CO2 —</b> trails from the living across the room.</p>
    <p><b>♀ Female:</b> land on a sleeper, hold to drink, back off before the eye opens. Lay eggs in still water: blood sets how many hatch, the water sets how fine they are.</p>
    <p><b>♂ Male:</b> sip nectar to live, find the glowing female, and mirror her flight. A won courtship pays Skill Points — and costs the colony, because he spends himself.</p>
    <p><b>\`</b> opens the developer instruments.</p>
  `;
  panel.appendChild(button("Back", onClose));
  el.appendChild(panel);
}

export function showSkills(colony: Colony, onBuy: (id: SkillId) => void, onClose: () => void): void {
  const el = overlay();
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `<h2>Species Skills</h2><p class="stats">${colony.sp} Skill Points · survive Dynasty Collapse</p>`;
  for (const def of Object.values(SKILL_CATALOG)) {
    const row = document.createElement("div");
    row.className = "skill-row";
    const owned = colony.skills.has(def.id);
    row.innerHTML = `<div><b>${def.name}</b><span class="desc">${def.description}</span></div>`;
    const afford = colony.sp >= def.cost && !owned;
    row.appendChild(button(owned ? "known" : `${def.cost} SP`, () => onBuy(def.id), afford ? "primary" : "ghost"));
    if (owned) row.querySelector("button")!.disabled = true;
    panel.appendChild(row);
  }
  panel.appendChild(button("Back", onClose));
  el.appendChild(panel);
}

export function showBrood(brood: OffspringCard[], nightNumber: number, onPick: (card: OffspringCard) => void): void {
  const el = overlay();
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `<h2>The Brood</h2><p class="stats">dawn of night ${nightNumber} · choose who hatches into night ${nightNumber + 1}</p>`;
  const row = document.createElement("div");
  row.className = "cards";
  brood.forEach((card, i) => {
    const cardEl = document.createElement("button");
    cardEl.className = `card ${card.rarity}`;
    cardEl.style.animationDelay = `${i * 0.12}s`;
    cardEl.innerHTML = `
      <span class="sex">${card.sex === "female" ? "♀" : "♂"}</span>
      <span class="cname">${card.name}</span>
      <span class="rarity">${RARITY_LABEL[card.rarity]}</span>
      <span class="trait">${card.trait ? TRAITS[card.trait].name : "—"}${
        card.trait ? `<small>${TRAITS[card.trait].description}</small>` : ""
      }</span>
    `;
    cardEl.addEventListener("click", () => onPick(card));
    row.appendChild(cardEl);
  });
  panel.appendChild(row);
  el.appendChild(panel);
}

export function showNightEnd(result: NightResult, colony: Colony, characterName: string, onContinue: () => void): void {
  const el = overlay();
  const panel = document.createElement("div");
  panel.className = "panel";
  let title = "";
  let body = "";
  switch (result.kind) {
    case "survived":
      title = "Dawn breaks";
      body = `${characterName} sees the morning.`;
      break;
    case "swatted":
      title = "Swatted.";
      body = result.collapsed ? "The dynasty falls. The species endures." : "The colony carries on.";
      break;
    case "starved":
      title = "Spent.";
      body = result.collapsed ? "The dynasty falls. The species endures." : "The colony carries on.";
      break;
    case "mated":
      title = "A dance, then dust";
      body = `${characterName} pays the colony ${result.sp} Skill Points with his life.`;
      break;
    case "maleSurvived":
      title = "He sees another dawn";
      body = "No courtship tonight. The colony holds its breath.";
      break;
  }
  panel.innerHTML = `
    <h2>${title}</h2>
    <p class="stats">Night ${colony.night} · Generation ${colony.generation} · Colony ${colony.population} · SP ${colony.sp}</p>
    <p>${body}</p>
  `;
  panel.appendChild(button("Continue", onContinue, "primary"));
  el.appendChild(panel);
}
