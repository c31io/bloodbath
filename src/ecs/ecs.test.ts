import { describe, expect, it } from "vitest";
import { World } from "./ecs.js";

describe("World", () => {
  it("creates entities with unique ids", () => {
    const w = new World();
    const a = w.entity();
    const b = w.entity();
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it("adds, reads, and removes components", () => {
    const w = new World();
    const e = w.entity();
    w.add(e, "position", { x: 1, y: 2, z: 3 });
    expect(w.get<{ x: number }>(e, "position")).toEqual({ x: 1, y: 2, z: 3 });
    w.remove(e, "position");
    expect(w.get(e, "position")).toBeUndefined();
  });

  it("destroys entities and drops their components", () => {
    const w = new World();
    const e = w.entity();
    w.add(e, "position", { x: 0, y: 0, z: 0 });
    w.destroy(e);
    expect(w.get(e, "position")).toBeUndefined();
    expect(w.query("position").length).toBe(0);
  });

  it("queries entities that have every requested component", () => {
    const w = new World();
    const a = w.entity();
    const b = w.entity();
    const c = w.entity();
    w.add(a, "position", { x: 0, y: 0, z: 0 });
    w.add(a, "velocity", { x: 0, y: 0, z: 0 });
    w.add(b, "position", { x: 0, y: 0, z: 0 });
    w.add(c, "velocity", { x: 0, y: 0, z: 0 });
    const hit = w.query("position", "velocity");
    expect(hit).toEqual([a]);
  });

  it("reflects component changes immediately in queries", () => {
    const w = new World();
    const e = w.entity();
    w.add(e, "position", { x: 0, y: 0, z: 0 });
    expect(w.query("position")).toEqual([e]);
    w.remove(e, "position");
    expect(w.query("position")).toEqual([]);
  });

  it("stores resources by name, separate from entities", () => {
    const w = new World();
    const time = { elapsed: 0, timeScale: 0.4 };
    w.res.time = time;
    expect(time.elapsed).toBe(0);
    expect(w.query("time").length).toBe(0);
  });

  it("runs systems in order against the world and dt", () => {
    const w = new World();
    const e = w.entity();
    w.add(e, "life", { t: 0 });
    const seen: number[] = [];
    w.system("tick", (world, dt) => {
      for (const id of world.query("life")) {
        world.get<{ t: number }>(id, "life")!.t += dt;
      }
      seen.push(dt);
    });
    w.system("audit", (world) => {
      expect(world.get<{ t: number }>(e, "life")!.t).toBe(0.5);
    });
    w.update(0.5);
    expect(seen).toEqual([0.5]);
    expect(w.get<{ t: number }>(e, "life")!.t).toBe(0.5);
  });

  it("skips systems removed by name", () => {
    const w = new World();
    let calls = 0;
    w.system("s", () => {
      calls++;
    });
    w.update(1);
    w.drop("s");
    w.update(1);
    expect(calls).toBe(1);
  });
});
