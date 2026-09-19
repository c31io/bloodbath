# Bloodbath

A 3D client-only web game (Three.js + TypeScript + a custom ECS — see ADR-0001): you are a mosquito; the Night is the game loop.

## Domain language

The ubiquitous language lives in @CONTEXT.md — use those terms exactly in code, comments, and conversation; the avoid-lists there are binding.

## Commands

- `npm run dev` — vite dev server
- `npm run build` — typecheck + production build
- `npm test` — vitest suite; keep it green

## Architecture

- `docs/adr/` — recorded decisions; do not re-litigate them without new evidence.
- `src/game/night.ts` — the Night contract: state types, the typed resource bag, and the world accessors (`playerState`, `hostOfKind`, …). The seam every consumer of a live Night crosses.
- `src/game/bedroom.ts` — the one placement vocabulary (`BEDROOM` table): gameplay anchors and model specs per object, consumed by entity spawning, collision (the derived `SOLIDS`), and model loading.
- The headless seam: `startNight` accepts injected input and rng; all logic lives in `src/game/systems.ts` systems; the renderer (`view.ts`) never simulates — it only uploads.
