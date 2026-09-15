import type { Colony } from "./domain/colony.js";

const KEY = "bloodbath.save.v1";

interface SaveShape {
  population: number;
  sp: number;
  skills: string[];
  roster: Colony["roster"];
  generation: number;
  night: number;
}

export function saveColony(colony: Colony): void {
  const data: SaveShape = {
    population: colony.population,
    sp: colony.sp,
    skills: [...colony.skills],
    roster: colony.roster,
    generation: colony.generation,
    night: colony.night,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // private mode / storage full: play without persistence
  }
}

export function loadColony(): Colony | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveShape;
    if (typeof data.population !== "number" || typeof data.night !== "number") return null;
    return {
      population: data.population,
      sp: data.sp ?? 0,
      skills: new Set(data.skills ?? []),
      roster: data.roster ?? [],
      generation: data.generation ?? 1,
      night: data.night ?? 1,
    };
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clean up
  }
}

