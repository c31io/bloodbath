export type HostKind = "human" | "cat";

export type HostStage = "asleep" | "stirring" | "awake" | "hunting";

export interface HostProfile {
  risePerSecond: number;
  decayPerSecond: number;
  stirringAt: number;
  awakeAt: number;
  calmFloor: number;
}

export const HOST_PROFILE: Record<HostKind, HostProfile> = {
  human: { risePerSecond: 6, decayPerSecond: 10, stirringAt: 50, awakeAt: 80, calmFloor: 40 },
  cat: { risePerSecond: 14, decayPerSecond: 12, stirringAt: 40, awakeAt: 70, calmFloor: 45 },
};

export interface HostState {
  suspicion: number;
  stage: HostStage;
  swatLanded: boolean;
  hasSwatted: boolean;
}

export function createHostState(_kind: HostKind): HostState {
  return { suspicion: 0, stage: "asleep", swatLanded: false, hasSwatted: false };
}

export interface HostTick {
  feeding: boolean;
  inReach: boolean;
  dt: number;
  stealthMod: number;
}

/**
 * One tick of host awareness. Feeding raises suspicion (scaled by stealthMod);
 * absence decays it (never below the calm floor once the host has swatted).
 * Crossing 100 is a Swat: it lands only if the mosquito is still in reach,
 * then the host calms to its floor.
 */
export function tickHost(state: HostState, kind: HostKind, p: HostTick): void {
  const profile = HOST_PROFILE[kind];
  state.swatLanded = false;
  if (p.feeding) {
    state.suspicion += profile.risePerSecond * p.stealthMod * p.dt;
  } else {
    const floor = state.hasSwatted ? profile.calmFloor : 0;
    state.suspicion = Math.max(floor, state.suspicion - profile.decayPerSecond * p.dt);
  }

  if (state.suspicion >= 100) {
    state.stage = "hunting";
    state.swatLanded = p.inReach;
    state.hasSwatted = true;
    state.suspicion = profile.calmFloor;
    return;
  }
  let stage: HostStage =
    state.suspicion >= profile.awakeAt ? "awake" : state.suspicion >= profile.stirringAt ? "stirring" : "asleep";
  // once swatted, a host never sleeps deep again this night
  if (state.hasSwatted && stage === "asleep") stage = "stirring";
  state.stage = stage;
 }
