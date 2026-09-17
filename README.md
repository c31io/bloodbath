# Bloodbath

You are a female mosquito hunting in a dark bedroom at 3 AM. The world has no eyes for you — you navigate by what the night gives off: heat, CO₂, nectar. Feed, lay, survive.

**Play:** https://c31io.github.io/bloodbath/

## How it plays

- **Vision is bloom and fog.** The bedroom reads as silhouettes under lamplight and moonlight.
- **Heat is near-field.** Bodies glow warm up close; lamps and a radiator lie to you.
- **CO₂ is far-field.** A breathing human exhales plumes that drift downwind of the fan — follow them to the sleeper.
- **Mosquito Time** — the world slows to 40% while you fly full speed (dial in the instruments panel).

Feed on the human (4 ml of blood, watch their suspicion — get swatted at high suspicion) or the cat (1.2 ml, wary). Sip nectar to stay alive. At an Egg Spot, convert blood into a Brood draw: the more blood carried, the more cards, and the Spot's quality caps their rarity. Pick one — it becomes the mosquito you play next Night.

Play the male instead (from the menu) for a different Night: courtship is a mirror-flight dogfight over a duet that decays if you drift.

Dynasty Collapse ends the run at Population zero — Skills bank, SP persist, generation advances.

## Controls

| Input | Action |
|---|---|
| Mouse | Steer (click the canvas to lock pointer) |
| `W` | Fly forward |
| `Shift` | Boost |
| `Space` | Ascend |
| `C` | Descend |
| Left mouse | Land / sip / bite / lay (hold to feed) |
| `` ` `` | Dev instruments (sense channels, time dial, inspector) |

## Development

```sh
npm install
npm run dev      # vite dev server
npm test         # vitest
npm run build    # typecheck + production build
```

Stack: TypeScript, [Three.js](https://threejs.org/), a small custom ECS (see [docs/adr/0001-threejs-typescript-custom-ecs.md](docs/adr/0001-threejs-typescript-custom-ecs.md)), zero backend. Domain glossary in [CONTEXT.md](CONTEXT.md).
