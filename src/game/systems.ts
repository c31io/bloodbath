import type { World } from "../ecs/ecs.js";
import { drainEnergy, FEED_ENERGY_REGEN, sipNectar } from "../domain/resources.js";
import { tickHost } from "../domain/suspicion.js";
import type { EggSpotC, FemalePath, Fan, Host, Mosquito, Plant, Pos } from "./components.js";
import { ROOM } from "./bedroom.js";
import { resourcesOf } from "./flow.js";
import type { NightInput, NightState } from "./flow.js";

/** Tuning constants for one Night. */
export const DAWN_SECONDS = 180;
export const PASSIVE_DRAIN_FEMALE = 0.35;
export const PASSIVE_DRAIN_MALE = 0.5;
export const FLIGHT_DRAIN = 2.0;
export const COURTSHIP_DRAIN = 4.0;
export const DRINK_RATE = 0.35; // ml per second
export const LAND_RANGE = 0.6;
export const SIP_RANGE = 0.7;
export const SPOT_RANGE = 0.9;
export const SWAT_RADIUS = 1.8;
export const COURTSHIP_START_RANGE = 1.2;
export const COURTSHIP_TOLERANCE = 0.4;
export const COURTSHIP_RESONANCE_RATE = 14;
export const COURTSHIP_LOSE_RATE = 40;

function frozen(night: NightState): boolean {
  return night.dawn <= 0 || night.outcome !== "alive";
}

function playerState(world: World): { player: number; mosquito: Mosquito; pos: Pos } | null {
  const player = world.query("player")[0];
  if (player === undefined) return null;
  const mosquito = world.get<Mosquito>(player, "mosquito")!;
  if (!mosquito.alive) return null;
  return { player, mosquito, pos: world.get<Pos>(player, "pos")! };
}

/**
 * Shared wind field: the fan's blast inside its arc below the hub, else a
 * faint room drift. Used by flight, CO2 plumes, and view advection.
 */
export function windAt(world: World, pos: Pos, windMod: number): { x: number; y: number; z: number } {
  for (const id of world.query("fan")) {
    const fan = world.get<Fan>(id, "fan")!;
    const fp = world.get<Pos>(id, "pos")!;
    const horiz = Math.hypot(pos.x - fp.x, pos.z - fp.z);
    if (horiz < fan.radius && pos.y < fp.y && pos.y > fp.y - 1.4) {
      // blast from the rotating blades, softened by Drug Resistance / Tough wings
      const s = fan.strength * windMod * 5;
      return { x: Math.cos(fan.angle) * s, y: -0.4 * s, z: Math.sin(fan.angle) * s };
    }
  }
  return { x: 0.06, y: 0, z: 0.02 };
}

/** Drain Energy; starvation kills at zero. */
function drainOrStarve(mosquito: Mosquito, night: NightState, dt: number, rate: number): void {
  mosquito.energy = drainEnergy(mosquito.energy, { dt, rate });
  if (mosquito.energy <= 0) {
    mosquito.alive = false;
    night.outcome = "starved";
  }
}

/** Register the headless-safe logic systems, in tick order. */
export function registerLogicSystems(world: World): void {
  world.system("fan", (w, dt) => {
    const { night } = resourcesOf(w);
    if (frozen(night)) return;
    for (const id of w.query("fan")) {
      const fan = w.get<Fan>(id, "fan")!;
      fan.angle = (fan.angle + fan.angularSpeed * dt * night.worldScale) % (Math.PI * 2);
    }
  });

  world.system("femalePath", (w, dt) => {
    const { night } = resourcesOf(w);
    if (frozen(night)) return;
    for (const id of w.query("femalePath")) {
      const path = w.get<FemalePath>(id, "femalePath")!;
      path.t += dt * 1.2 * night.worldScale;
      const pos = w.get<Pos>(id, "pos")!;
      pos.x = 1.2 * Math.sin(path.t);
      pos.y = 1.7 + 0.25 * Math.sin(2 * path.t);
      pos.z = 1.2 * Math.cos(path.t);
    }
  });

  world.system("flight", (w, dt) => {
    const res = resourcesOf(w);
    const { input, night } = res;
    const p = playerState(w);
    if (!p) return;
    const { mosquito, pos } = p;
    const vel = w.get<Pos>(p.player, "vel")!;

    if (mosquito.landedOn !== null) {
      const hostPos = w.get<Pos>(mosquito.landedOn, "pos")!;
      pos.x = hostPos.x;
      pos.y = hostPos.y + 0.06;
      pos.z = hostPos.z;
      vel.x = 0;
      vel.y = 0;
      vel.z = 0;
      const pool = w.get<Host>(mosquito.landedOn, "host")?.pool;
      mosquito.feeding = input.interactHeld && (pool?.remaining ?? 0) > 0;
      if (input.spacePressed) {
        mosquito.landedOn = null;
        mosquito.feeding = false;
        vel.y = 1.2;
      }
      drainOrStarve(mosquito, night, dt, PASSIVE_DRAIN_FEMALE);
      return;
    }

    // free flight: bank toward the cursor, thrust forward
    mosquito.yaw -= input.mouseDX * 0.0023;
    mosquito.pitch = Math.max(-1.2, Math.min(1.2, mosquito.pitch - input.mouseDY * 0.0023));
    mosquito.roll = Math.max(-0.6, Math.min(0.6, -input.mouseDX * 0.0009));

    const thrust = input.forward ? (input.boost ? 6 : 3.5) : 0;
    const cy = Math.cos(mosquito.yaw);
    const sy = Math.sin(mosquito.yaw);
    const cp = Math.cos(mosquito.pitch);
    vel.x += (-sy * cp) * thrust * dt * mosquito.speedMod;
    vel.y += Math.sin(mosquito.pitch) * thrust * dt * mosquito.speedMod + (input.up ? 1.5 * dt : 0) - (input.down ? 1.5 * dt : 0);
    vel.z += (-cy * cp) * thrust * dt * mosquito.speedMod;

    const wind = windAt(w, pos, mosquito.windMod);
    vel.x += wind.x * dt;
    vel.y += wind.y * dt;
    vel.z += wind.z * dt;

    const drag = Math.max(0, 1 - 3 * dt);
    vel.x *= drag;
    vel.y *= drag;
    vel.z *= drag;
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
    pos.z += vel.z * dt;

    // room shell
    if (pos.x < ROOM.minX + 0.05 || pos.x > ROOM.maxX - 0.05) {
      pos.x = Math.max(ROOM.minX + 0.05, Math.min(ROOM.maxX - 0.05, pos.x));
      vel.x *= -0.2;
    }
    if (pos.z < ROOM.minZ + 0.05 || pos.z > ROOM.maxZ - 0.05) {
      pos.z = Math.max(ROOM.minZ + 0.05, Math.min(ROOM.maxZ - 0.05, pos.z));
      vel.z *= -0.2;
    }
    if (pos.y < 0.03 || pos.y > ROOM.height - 0.05) {
      pos.y = Math.max(0.03, Math.min(ROOM.height - 0.05, pos.y));
      vel.y *= -0.2;
    }

    // landing: interact near a Host
    if (input.interactPressed) {
      for (const id of w.query("host")) {
        const hp = w.get<Pos>(id, "pos")!;
        if (Math.hypot(hp.x - pos.x, hp.y - pos.y, hp.z - pos.z) < LAND_RANGE) {
          mosquito.landedOn = id;
          break;
        }
      }
    }

    const drainRate =
      (mosquito.sex === "male" ? PASSIVE_DRAIN_MALE : PASSIVE_DRAIN_FEMALE) +
      (input.forward ? FLIGHT_DRAIN : 0);
    drainOrStarve(mosquito, night, dt, drainRate);
  });

  world.system("courtship", (w, dt) => {
    const { night } = resourcesOf(w);
    if (frozen(night)) return;
    const p = playerState(w);
    if (!p || p.mosquito.sex !== "male") return;
    const female = w.query("femalePath")[0];
    if (female === undefined) return;
    const fpos = w.get<Pos>(female, "pos")!;
    const dist = Math.hypot(fpos.x - p.pos.x, fpos.y - p.pos.y, fpos.z - p.pos.z);
    const court = night.courtship;
    if (!court.active && dist < COURTSHIP_START_RANGE) court.active = true;
    if (!court.active) return;

    court.timeTotal += dt;
    court.within = dist < COURTSHIP_TOLERANCE;
    if (court.within) {
      court.resonance = Math.min(100, court.resonance + COURTSHIP_RESONANCE_RATE * p.mosquito.sharpMod * dt);
      court.timeWithin += dt;
    } else {
      court.resonance = Math.max(0, court.resonance - COURTSHIP_LOSE_RATE * dt);
    }
    drainOrStarve(p.mosquito, night, dt, COURTSHIP_DRAIN);
    if (!p.mosquito.alive) return;
    if (court.resonance >= 100) {
      p.mosquito.alive = false;
      night.outcome = "mated"; // it fucks to its own demise
    }
  });

  world.system("hosts", (w, dt) => {
    const { night } = resourcesOf(w);
    if (frozen(night)) return;
    const p = playerState(w);
    for (const id of w.query("host")) {
      const host = w.get<Host>(id, "host")!;
      const hp = w.get<Pos>(id, "pos")!;
      const onThis = p?.mosquito.landedOn === id && p.mosquito.feeding;
      const dist = p ? Math.hypot(hp.x - p.pos.x, hp.y - p.pos.y, hp.z - p.pos.z) : Infinity;
      tickHost(host.state, host.kind, {
        feeding: onThis,
        inReach: dist < SWAT_RADIUS,
        dt: dt * night.worldScale,
        stealthMod: p ? p.mosquito.stealthMod : 1,
      });
      if (onThis) {
        const result = host.pool.drink({ dt, rate: DRINK_RATE * p.mosquito.feedRateMod });
        night.blood += result.blood;
        p.mosquito.blood += result.blood;
        p.mosquito.energy = Math.min(p.mosquito.maxEnergy, p.mosquito.energy + FEED_ENERGY_REGEN * dt);
      }
      if (host.state.swatLanded && p && dist < SWAT_RADIUS) {
        p.mosquito.alive = false;
        night.outcome = "swatted";
      }
    }
  });

  world.system("interactions", (w, dt) => {
    const { input, night } = resourcesOf(w);
    if (frozen(night)) return;
    const p = playerState(w);
    if (!p || !input.interactPressed) return;
    if (p.mosquito.landedOn !== null) return; // interact means drink/land contexts already handled

    // sip Nectar
    for (const id of w.query("plant")) {
      const pp = w.get<Pos>(id, "pos")!;
      if (Math.hypot(pp.x - p.pos.x, pp.y - p.pos.y, pp.z - p.pos.z) < SIP_RANGE) {
        const plant = w.get<Plant>(id, "plant")!;
        p.mosquito.energy = Math.min(p.mosquito.maxEnergy, p.mosquito.energy + sipNectar(plant));
        night.sipped = true;
        return;
      }
    }
    // lay eggs at an Egg Spot
    if (p.mosquito.sex === "female" && !night.laidEggs) {
      for (const id of w.query("eggSpot")) {
        const spot = w.get<EggSpotC>(id, "eggSpot")!;
        const sp = w.get<Pos>(id, "pos")!;
        if (!spot.used && Math.hypot(sp.x - p.pos.x, sp.y - p.pos.y, sp.z - p.pos.z) < SPOT_RANGE) {
          spot.used = true;
          night.laidEggs = true;
          night.voluntaryEnd = true;
          night.spotCeiling = spot.quality;
          return;
        }
      }
    }
  });

  world.system("nightTimer", (w, dt) => {
    const { night } = resourcesOf(w);
    if (night.dawn > 0 && night.outcome === "alive") night.dawn -= dt;
  });

  world.system("edgeReset", (w) => {
    const { input } = resourcesOf(w);
    input.interactPressed = false;
    input.spacePressed = false;
    input.mouseDX = 0;
    input.mouseDY = 0;
  });
}

export type { NightInput };
