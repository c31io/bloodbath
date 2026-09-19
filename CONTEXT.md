# Bloodbath

A 3D, client-only web game where you play a mosquito. Two sexed loops — female feeding, male courtship — sustain a colony measured by an abstract Population, and the world is perceived through mosquito senses rather than human sight.

## Language

### Loops

**Night**:
One run of the game: a single mosquito, dusk to dawn.
_Avoid_: round, run, level

**Feeding Run**:
The female-mosquito loop, played as one Night: draw blood from a Host, find a good spot, lay eggs, draw a Brood.
_Avoid_: female mode, main quest, blood run

**Courtship**:
The male-mosquito loop: survive on Nectar, locate a female, mirror her flight to win the dance — and die in the act. Rewards Skill Points; always shrinks the Population.
_Avoid_: male mode, mating minigame

**Host**:
A blood source. Anything hot emits Heat; only animals emit CO2 — only animals are Hosts.
_Avoid_: victim, target, human

**Swat**:
The host's kill attempt against a feeding or landed mosquito.
_Avoid_: death, hit, attack

### Senses

**Mosquito Sense**:
The perception model: the world is perceived through Vision, Heat, and CO2 instead of human sight.
_Avoid_: radar, minimap, HUD

**Vision**:
Mid-field mosquito sight: the world renders dreamy and soft; near and far are lost to it.
_Avoid_: seeing, camera

**Heat**:
Near-field sense of anything hot — lamps, laptops, kettles, Hosts.
_Avoid_: thermal vision, infrared

**CO2**:
Far-field sense of animals only: the trail that finds a Host.
_Avoid_: smell, breath, scent

**Mosquito Time**:
The player's slower perception of time: the world moves in slow motion and human actions are readable, telegraphed.
_Avoid_: bullet time, slow-mo, difficulty setting

### Colony & Rewards

**Population**:
An abstract colony count. Picking an Offspring adds one; a death or a played male spends one; at zero, Dynasty Collapse.
_Avoid_: lives, HP, resources

**Offspring**:
A playable mosquito produced by egg-laying; drawn pre-sexed as one of the Brood.
_Avoid_: character card, card, child, baby

**Dynasty Collapse**:
The fail state at Population zero: the colony dies, Skills persist, a fresh colony begins.
_Avoid_: game over, extinction

**Brood**:
The draw after a Night: N pre-sexed Offspring choices, N set by blood collected, rarity ceiling set by the Egg Spot; never all male.
_Avoid_: gacha, card pool, egg batch

**Nectar**:
The male's food: plant sips that give energy with diminishing returns.
_Avoid_: flower, juice, food

**Energy**:
The resource of staying alive, shared by both sexes: living drains it; females refill by feeding, males by Nectar. Courtship costs the male dearly.
_Avoid_: stamina, hunger

**Skill**:
A species-level ability bought with Skill Points (e.g. stealth flight, drug resistance); persists across generations.
_Avoid_: perk, upgrade, talent

**Skill Point**:
Currency earned by surviving a Courtship; spent on Skills.
_Avoid_: SP, XP, coins

### World

**Scene**:
A playable environment with its own Conditions.
_Avoid_: level, map, stage

**Bedroom**:
The one Scene bloodbath ships: a moonlit bedroom whose sleeping human and cat are the Hosts. Its fan and its Egg Spots define the Night's terrain.
_Avoid_: room, house, man, sleeper

**Condition**:
An environmental modifier that changes how a Scene plays (wind, fan, repellent, darkness).
_Avoid_: modifier, hazard, weather

**Egg Spot**:
A place where a female lays eggs; its quality sets the Brood's rarity ceiling.
_Avoid_: nest, spawn point
