# Three.js + TypeScript with a custom ECS, no game engine

Bloodbath is built on Three.js and TypeScript with our own ECS and debug tooling, instead of Unity, Godot, or Cocos. The project exists as a game-client-dev portfolio piece where architecture and tooling are the product; a commodity renderer plus a custom ECS maximizes the architecture signal, and client-only static hosting favors a lean web bundle over engine exports.

## Considered Options

- **Cocos Creator** — the industry client-dev tool for web games; rejected here because its editor and runtime architecture dominate the codebase, muting the custom-architecture signal. The right choice if targeting web/mini-game studios.
- **Unity WebGL** — industry-standard engine; rejected for heavy web builds and an architecture that is Unity's, not ours.
- **Babylon.js** — more engine built in (GUI, inspector), less architecture left to author; fallback if Three.js gaps bite.

## Consequences

Everything above the scene graph — physics, AI, audio, serialization, debug tools — is ours to build.
