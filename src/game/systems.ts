import type { World } from "../ecs/ecs.js";
import { drainEnergy, FEED_ENERGY_REGEN, sipNectar } from "../domain/resources.js";
import { tickHost, type HostKind } from "../domain/suspicion.js";
import { HERO_BODY, PLUME_COUNT, type EggSpotC, type FemalePath, type Fan, type Host, type Mosquito, type Plant, type Plume, type Pos } from "./components.js";
import { HOST_SOLIDS, ROOM, SOLIDS } from "./bedroom.js";
import {
  DAWN_SECONDS,
  playerState,
  type NightInput,
  type NightState,
  type NightWorld,
} from "./night.js";

/** Tuning constants for one Night. */
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

/** Nearest point on a host's body boxes to p, pushed 6cm out along the local
 *  surface normal: the landing perch. Attaching here keeps the touchdown
 *  spot (the old anchor snap teleported the player up to LAND_RANGE away,
 *  and for the cat the anchor sat inside the mesh). */
function perchPoint(kind: HostKind, px: number, py: number, pz: number): Pos {
  let bx = px, by = py, bz = pz, nx = 0, ny = 1, nz = 0, bd = Infinity;
  for (const b of HOST_SOLIDS[kind]) {
    const cx = Math.min(Math.max(px, b.minX), b.maxX);
    const cy = Math.min(Math.max(py, b.minY), b.maxY);
    const cz = Math.min(Math.max(pz, b.minZ), b.maxZ);
    const gx = px - cx, gy = py - cy, gz = pz - cz;
    const d = Math.hypot(gx, gy, gz);
    if (d >= bd) continue;
    bd = d;
    bx = cx; by = cy; bz = cz;
    if (d > 0) {
      nx = gx / d; ny = gy / d; nz = gz / d;
    } else {
      // inside: exit along the least-penetrated face, same rule as the resolver
      const face = Math.min(px - b.minX, b.maxX - px, py - b.minY, b.maxY - py, pz - b.minZ, b.maxZ - pz);
      if (face === px - b.minX) { nx = 1; ny = 0; nz = 0; }
      else if (face === b.maxX - px) { nx = -1; ny = 0; nz = 0; }
      else if (face === py - b.minY) { nx = 0; ny = 1; nz = 0; }
      else if (face === b.maxY - py) { nx = 0; ny = -1; nz = 0; }
      else if (face === pz - b.minZ) { nx = 0; ny = 0; nz = 1; }
      else { nx = 0; ny = 0; nz = -1; }
    }
  }
  return { x: bx + nx * 0.06, y: by + ny * 0.06, z: bz + nz * 0.06 };
}
/** Camera-space offset of the body tip (nose and wings) for a view
 *  orientation: the point the sim keeps out of the room shell so nose-first
 *  flight rests the body ON the wall with the eye holding back. Matches the
 *  fp hero mount in view.ts (YXZ yaw-pitch, roll is cosmetic only). */
export function bodyOffset(yaw: number, pitch: number): Pos {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const oy = -HERO_BODY.down, oz = -(HERO_BODY.fwd + HERO_BODY.reach);
  const y1 = oy * cp - oz * sp;
  const z1 = oy * sp + oz * cp;
  return { x: sy * z1, y: y1, z: cy * z1 };
}

function frozen(night: NightState): boolean {
  return night.dawn <= 0 || night.outcome !== "alive";
}


/**
 * Shared wind field: the fan's blast inside its arc below the hub, else a
 * faint room drift. Used by flight, CO2 plumes, and view advection.
 */
export function windAt(world: NightWorld, pos: Pos, windMod: number): { x: number; y: number; z: number } {
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
export function registerLogicSystems(world: NightWorld): void {
  world.system("fan", (w, dt) => {
    const { night } = w.res;
    if (frozen(night)) return;
    for (const id of w.query("fan")) {
      const fan = w.get<Fan>(id, "fan")!;
      fan.angle = (fan.angle + fan.angularSpeed * dt * night.worldScale) % (Math.PI * 2);
    }
  });


  // CO2 trails advect with the air: buoyancy plus the shared wind field.
  world.system("plumes", (w, dt) => {
    const night = w.res.night;
    if (frozen(night)) return;
    for (const id of w.query("plume")) {
      const plume = w.get<Plume>(id, "plume")!;
      const src = w.get<Pos>(id, "pos")!;
      for (let i = 0; i < PLUME_COUNT; i++) {
        plume.life[i]! -= dt;
        if (plume.life[i]! <= 0) {
          plume.positions[i * 3] = src.x + (Math.random() - 0.5) * 0.06;
          plume.positions[i * 3 + 1] = src.y + 0.05;
          plume.positions[i * 3 + 2] = src.z + (Math.random() - 0.5) * 0.06;
          plume.vel[i * 3] = (Math.random() - 0.5) * 0.05;
          plume.vel[i * 3 + 1] = 0.12 + Math.random() * 0.06;
          plume.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
          plume.life[i] = 2.5 + Math.random() * 2;
        }
        const at = { x: plume.positions[i * 3]!, y: plume.positions[i * 3 + 1]!, z: plume.positions[i * 3 + 2]! };
        const wind = windAt(w, at, 0.24);
        plume.positions[i * 3] = at.x + (plume.vel[i * 3]! + wind.x) * dt;
        plume.positions[i * 3 + 1] = at.y + plume.vel[i * 3 + 1]! * dt;
        plume.positions[i * 3 + 2] = at.z + (plume.vel[i * 3 + 2]! + wind.z) * dt;
      }
    }
  });
  world.system("femalePath", (w, dt) => {
    const { night } = w.res;
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
    const res = w.res;
    const { input, night } = res;
    const p = playerState(w);
    if (!p) return;
    const { mosquito, pos } = p;
    const vel = w.get<Pos>(p.player, "vel")!;

    if (mosquito.landedOn !== null) {
      const hostPos = w.get<Pos>(mosquito.landedOn, "pos")!;
      pos.x = hostPos.x + mosquito.perch.x;
      pos.y = hostPos.y + mosquito.perch.y;
      pos.z = hostPos.z + mosquito.perch.z;
      // perches can reach past the shell (the sleeper lies against the east
      // wall): hold the eye a near-plane-clearing distance inside the room
      pos.x = Math.max(ROOM.minX + 0.06, Math.min(ROOM.maxX - 0.06, pos.x));
      pos.y = Math.max(0.04, Math.min(ROOM.height - 0.06, pos.y));
      pos.z = Math.max(ROOM.minZ + 0.06, Math.min(ROOM.maxZ - 0.06, pos.z));
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
    // static furniture: push out of the least-penetrated face that the room
    // shell would not immediately undo (a box face behind a wall clamp or the
    // floor is not an exit), then damped bounce on that axis. Placement sits
    // a near-plane-clearing 2.5cm off the face so pressing against furniture
    // never renders from inside its mesh.
    for (const s of SOLIDS) {
      if (pos.x <= s.minX || pos.x >= s.maxX || pos.y <= s.minY || pos.y >= s.maxY || pos.z <= s.minZ || pos.z >= s.maxZ) continue;
      const exits: Array<[number, "x" | "y" | "z", number, number]> = [];
      if (ROOM.minX + 0.05 <= s.minX) exits.push([pos.x - s.minX, "x", Math.max(ROOM.minX + 0.05, s.minX - 0.025), s.minX]);
      if (s.maxX <= ROOM.maxX - 0.05) exits.push([s.maxX - pos.x, "x", Math.min(ROOM.maxX - 0.05, s.maxX + 0.025), s.maxX]);
      if (0.03 <= s.minY) exits.push([pos.y - s.minY, "y", Math.max(0.03, s.minY - 0.025), s.minY]);
      if (s.maxY <= ROOM.height - 0.05) exits.push([s.maxY - pos.y, "y", Math.min(ROOM.height - 0.05, s.maxY + 0.025), s.maxY]);
      if (ROOM.minZ + 0.05 <= s.minZ) exits.push([pos.z - s.minZ, "z", Math.max(ROOM.minZ + 0.05, s.minZ - 0.025), s.minZ]);
      if (s.maxZ <= ROOM.maxZ - 0.05) exits.push([s.maxZ - pos.z, "z", Math.min(ROOM.maxZ - 0.05, s.maxZ + 0.025), s.maxZ]);
      if (exits.length === 0) continue;
      const [, axis, place, raw] = exits.reduce((a, b) => (b[0] < a[0] ? b : a));
      const c = { x: pos.x, y: pos.y, z: pos.z };
      if (axis === "x") c.x = place;
      else if (axis === "y") c.y = place;
      else c.z = place;
      // the standoff can land inside a neighbor (the vase on the nightstand
      // top): fall back to the bare face, which bounds both boxes exactly
      if (SOLIDS.some((s) => c.x > s.minX && c.x < s.maxX && c.y > s.minY && c.y < s.maxY && c.z > s.minZ && c.z < s.maxZ)) {
        if (axis === "x") c.x = raw;
        else if (axis === "y") c.y = raw;
        else c.z = raw;
      }
      pos.x = c.x;
      pos.y = c.y;
      pos.z = c.z;
      if (axis === "x") vel.x *= -0.2;
      else if (axis === "y") vel.y *= -0.2;
      else vel.z *= -0.2;
    }
    // the hero body rides ahead of the eye: nose-first flight rests the body
    // ON the wall with the camera holding back. Walls + ceiling only — floor
    // skimming and narrow furniture gaps stay flyable; skipped when the push
    // would shove the eye into furniture the resolver just cleared.
    const o = bodyOffset(mosquito.yaw, mosquito.pitch);
    const bx = pos.x + o.x, bz = pos.z + o.z;
    const m = HERO_BODY.margin;
    if (bx < ROOM.minX + m || bx > ROOM.maxX - m || bz < ROOM.minZ + m || bz > ROOM.maxZ - m || pos.y + o.y > ROOM.height - m) {
      const nx = bx < ROOM.minX + m ? ROOM.minX + m - bx : bx > ROOM.maxX - m ? ROOM.maxX - m - bx : 0;
      const nz = bz < ROOM.minZ + m ? ROOM.minZ + m - bz : bz > ROOM.maxZ - m ? ROOM.maxZ - m - bz : 0;
      const ny = pos.y + o.y > ROOM.height - m ? ROOM.height - m - (pos.y + o.y) : 0;
      if (!SOLIDS.some((s) => pos.x + nx > s.minX && pos.x + nx < s.maxX && pos.y + ny > s.minY && pos.y + ny < s.maxY && pos.z + nz > s.minZ && pos.z + nz < s.maxZ)) {
        pos.x += nx;
        pos.y += ny;
        pos.z += nz;
        if (nx !== 0) vel.x *= -0.2;
        if (ny !== 0) vel.y *= -0.2;
        if (nz !== 0) vel.z *= -0.2;
      }
    }

    // landing: interact near a Host — perch on the body where you touched down
    if (input.interactPressed) {
      for (const id of w.query("host")) {
        const hp = w.get<Pos>(id, "pos")!;
        if (Math.hypot(hp.x - pos.x, hp.y - pos.y, hp.z - pos.z) < LAND_RANGE) {
          const perch = perchPoint(w.get<Host>(id, "host")!.kind, pos.x, pos.y, pos.z);
          mosquito.perch.x = perch.x - hp.x;
          mosquito.perch.y = perch.y - hp.y;
          mosquito.perch.z = perch.z - hp.z;
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
    const { night } = w.res;
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
    const { night } = w.res;
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
        p.mosquito.energy = Math.min(p.mosquito.maxEnergy, p.mosquito.energy + FEED_ENERGY_REGEN * dt);
      }
      if (host.state.swatLanded && p && dist < SWAT_RADIUS) {
        p.mosquito.alive = false;
        night.outcome = "swatted";
      }
    }
  });

  world.system("interactions", (w, dt) => {
    const { input, night } = w.res;
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
        night.sips += 1;
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
    const { night } = w.res;
    if (night.dawn > 0 && night.outcome === "alive") night.dawn -= dt;
  });

  world.system("edgeReset", (w) => {
    const { input } = w.res;
    input.interactPressed = false;
    input.spacePressed = false;
    input.mouseDX = 0;
    input.mouseDY = 0;
  });
}

