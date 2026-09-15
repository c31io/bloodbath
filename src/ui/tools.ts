import type { GameView, SenseChannels } from "../game/view.js";
import type { NightWorld } from "../game/flow.js";

const COMPONENT_NAMES = ["pos", "vel", "mosquito", "host", "hot", "eggSpot", "plant", "fan", "femalePath", "plume"];

/** Developer instruments: sense channel isolation, Mosquito Time dial, entity inspector. */
export class Tools {
  visible = false;
  channels: SenseChannels = { world: true, heat: true, co2: true };
  private panel: HTMLDivElement;
  private inspector: HTMLDivElement;
  private fps: HTMLDivElement;
  private frames = 0;
  private lastFpsAt = performance.now();

  constructor(private view: GameView, private getWorld: () => NightWorld | null) {
    this.panel = document.createElement("div");
    this.panel.id = "tools";
    this.panel.innerHTML = `
      <b>instrument panel</b>
      <label><input type="checkbox" data-ch="world" checked> vision + world</label>
      <label><input type="checkbox" data-ch="heat" checked> heat (near)</label>
      <label><input type="checkbox" data-ch="co2" checked> CO2 (far)</label>
      <label>mosquito time <input type="range" id="tools-time" min="0.1" max="2" step="0.05" value="0.4"> <span id="tools-time-val">0.40×</span></label>
      <label class="insp"><input type="checkbox" id="tools-inspect"> inspector (click an entity)</label>
      <pre id="tools-inspector" style="display:none"></pre>
      <div id="tools-fps"></div>
      <small>\` toggles</small>
    `;
    document.body.appendChild(this.panel);
    this.inspector = this.panel.querySelector("#tools-inspector")!;
    this.fps = this.panel.querySelector("#tools-fps")!;

    for (const box of this.panel.querySelectorAll<HTMLInputElement>("input[data-ch]")) {
      box.addEventListener("change", () => {
        this.channels[box.dataset.ch as keyof SenseChannels] = box.checked;
      });
    }
    const time = this.panel.querySelector<HTMLInputElement>("#tools-time")!;
    time.addEventListener("input", () => {
      const world = this.getWorld();
      const scale = Number(time.value);
      if (world) (world.res.night as { worldScale: number }).worldScale = scale;
      this.panel.querySelector("#tools-time-val")!.textContent = `${scale.toFixed(2)}×`;
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    this.panel.style.display = this.visible ? "flex" : "none";
  }

  isInspecting(): boolean {
    return this.visible && this.panel.querySelector<HTMLInputElement>("#tools-inspect")!.checked;
  }

  inspect(world: NightWorld, entityId: number): void {
    const parts: string[] = [`entity ${entityId}`];
    for (const name of COMPONENT_NAMES) {
      const data = world.get(entityId, name);
      if (data !== undefined) parts.push(`${name}: ${JSON.stringify(data)}`);
    }
    this.inspector.textContent = parts.join("\n");
    this.inspector.style.display = "block";
  }

  /** Called every frame while visible. */
  update(world: NightWorld | null, nx: number | null, ny: number | null): void {
    this.frames++;
    const now = performance.now();
    if (now - this.lastFpsAt > 500) {
      this.fps.textContent = `${Math.round((this.frames * 1000) / (now - this.lastFpsAt))} fps`;
      this.frames = 0;
      this.lastFpsAt = now;
    }
    if (!world || nx === null || ny === null || !this.isInspecting()) return;
    const hit = this.view.raycastEntity(nx, ny);
    if (hit !== undefined) this.inspect(world, hit);
  }

}
