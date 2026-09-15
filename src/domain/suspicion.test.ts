import { describe, expect, it } from "vitest";
import { HOST_PROFILE, createHostState, tickHost, type HostKind } from "./suspicion.js";

const tickFeeding = (kind: HostKind, dt: number, stealthMod = 1) => {
  const host = createHostState(kind);
  tickHost(host, kind, { feeding: true, inReach: true, dt, stealthMod });
  return host;
};

describe("host stages", () => {
  it("a fresh host is asleep with zero suspicion", () => {
    const host = createHostState("human");
    expect(host.suspicion).toBe(0);
    expect(host.stage).toBe("asleep");
  });

  it("moves asleep -> stirring -> awake at profile thresholds", () => {
    const host = tickFeeding("human", HOST_PROFILE.human.stirringAt / 6);
    expect(host.stage).toBe("stirring");
    const host2 = tickFeeding("human", HOST_PROFILE.human.awakeAt / 6);
    expect(host2.stage).toBe("awake");
  });

  it("reaches hunting at suspicion 100 and swats an in-reach mosquito", () => {
    const host = tickFeeding("human", 100 / 6);
    expect(host.stage).toBe("hunting");
    expect(host.swatLanded).toBe(true);
  });

  it("a hunting host misses a mosquito that is out of reach", () => {
    const host = createHostState("human");
    host.suspicion = 99;
    // feeding pushes suspicion past 100 while the mosquito is already fleeing
    tickHost(host, "human", { feeding: true, inReach: false, dt: 0.5, stealthMod: 1 });
    expect(host.stage).toBe("hunting");
    expect(host.swatLanded).toBe(false);
  });

  it("calms down after a swat, back to stirring", () => {
    const host = tickFeeding("human", 100 / 6);
    tickHost(host, "human", { feeding: false, inReach: false, dt: 0.1, stealthMod: 1 });
    expect(host.stage).toBe("stirring");
    expect(host.suspicion).toBeLessThan(50);
  });
});

describe("suspicion rates", () => {
  it("rises while feeding, faster from the cat than the human", () => {
    const human = tickFeeding("human", 1);
    const cat = tickFeeding("cat", 1);
    expect(human.suspicion).toBeCloseTo(HOST_PROFILE.human.risePerSecond);
    expect(cat.suspicion).toBeCloseTo(HOST_PROFILE.cat.risePerSecond);
    expect(cat.suspicion).toBeGreaterThan(human.suspicion);
  });

  it("stealth slows the rise but never reverses it", () => {
    const host = tickFeeding("human", 1, 0.5);
    expect(host.suspicion).toBeCloseTo(HOST_PROFILE.human.risePerSecond * 0.5);
  });

  it("decays when the mosquito is not feeding", () => {
    const host = createHostState("human");
    host.suspicion = 60;
    tickHost(host, "human", { feeding: false, inReach: false, dt: 1, stealthMod: 1 });
    expect(host.suspicion).toBeCloseTo(60 - HOST_PROFILE.human.decayPerSecond);
  });

  it("never decays below zero", () => {
    const host = createHostState("human");
    tickHost(host, "human", { feeding: false, inReach: false, dt: 100, stealthMod: 1 });
    expect(host.suspicion).toBe(0);
  });

  it("does not decay below the calm floor right after a swat", () => {
    const host = tickFeeding("human", 100 / 6); // hunting, then calmed to floor
    const floor = host.suspicion;
    tickHost(host, "human", { feeding: false, inReach: false, dt: 10, stealthMod: 1 });
    expect(host.suspicion).toBe(floor);
  });
});
