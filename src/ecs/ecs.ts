export type SystemFn = (world: World, dt: number) => void;

interface System {
  name: string;
  fn: SystemFn;
}

/**
 * Minimal entity-component-system world. Components are named data bags;
 * queries return entities holding every requested component. Resources are
 * singletons (time, input, wind) kept out of the entity space.
 */
export class World {
  private nextId = 1;
  private entities = new Map<number, Set<string>>();
  private stores = new Map<string, Map<number, object>>();
  private systems: System[] = [];
  readonly res: Record<string, unknown> = {};

  entity(): number {
    const id = this.nextId++;
    this.entities.set(id, new Set());
    return id;
  }

  destroy(id: number): void {
    const comps = this.entities.get(id);
    if (!comps) return;
    for (const name of comps) this.stores.get(name)!.delete(id);
    this.entities.delete(id);
  }

  add<C extends object>(id: number, name: string, data: C): C {
    let store = this.stores.get(name);
    if (!store) {
      store = new Map();
      this.stores.set(name, store);
    }
    store.set(id, data);
    this.entities.get(id)!.add(name);
    return data;
  }

  get<C extends object>(id: number, name: string): C | undefined {
    return this.stores.get(name)?.get(id) as C | undefined;
  }

  remove(id: number, name: string): void {
    this.stores.get(name)?.delete(id);
    this.entities.get(id)?.delete(name);
  }

  has(id: number, name: string): boolean {
    return this.entities.get(id)?.has(name) ?? false;
  }

  /** Ids of entities holding every named component. */
  query(...names: string[]): number[] {
    if (names.length === 0) return [...this.entities.keys()];
    let smallest = this.stores.get(names[0]!);
    if (!smallest) return [];
    for (const n of names) {
      const store = this.stores.get(n);
      if (!store) return [];
      if (store.size < smallest.size) smallest = store;
    }
    const out: number[] = [];
    outer: for (const id of smallest.keys()) {
      for (const n of names) {
        if (!this.stores.get(n)!.has(id)) continue outer;
      }
      out.push(id);
    }
    return out;
  }

  system(name: string, fn: SystemFn): void {
    this.drop(name);
    this.systems.push({ name, fn });
  }

  drop(name: string): void {
    this.systems = this.systems.filter((s) => s.name !== name);
  }

  update(dt: number): void {
    for (const s of this.systems) s.fn(this, dt);
  }
}
