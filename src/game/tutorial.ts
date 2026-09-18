import type { Colony } from "../domain/colony.js";
import { hostOfKind, playerState, posOf, type NightWorld } from "./night.js";

/** Diegetic Night-1 tutorial: one line at a time, staged by what the player does. */
export class Tutorial {
  private moved = 0;
  private stage = 0;

  constructor(private hint: (text: string) => void) {}

  update(world: NightWorld, colony: Colony, input: { mouseDX: number; mouseDY: number }): void {
    if (colony.night !== 1 || colony.generation !== 1) {
      this.hint("");
      return;
    }
    const p = playerState(world);
    if (!p) return;
    const night = world.res.night;
    if (night.sex !== "female") {
      this.hint("Males don't bite. Sip nectar to live, and find her.");
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
      const hp = posOf(world, hostOfKind(world, "human"));
      if (Math.hypot(hp.x - p.pos.x, hp.y - p.pos.y, hp.z - p.pos.z) < 2.6) s = 2;
    }
    if (s === 2 && p.mosquito.landedOn !== null) s = 3;
    if (s === 3 && night.blood >= 0.5) s = 4;
    if (s === 4 && night.laidEggs) s = 5;
    this.stage = s;
    this.hint(s < lines.length ? lines[s]! : "");
  }
}
