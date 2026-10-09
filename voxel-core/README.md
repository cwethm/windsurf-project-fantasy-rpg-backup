# voxel-core

A reusable core toolkit for voxel games: a **deterministic procedural world
generator**, a **persistence layer for the 3D environment** (players, terrain,
movable and stationary objects, and the relationships between them), and a
**multiplayer Node.js server with a Three.js reference client**.

It is deliberately a *core*, not a game. Blocks, items, loot, biomes,
interactions, item actions and input bindings are all **data plus handler
functions registered in tables** — nothing in the engine branches on a block id
or an item id. Adding "a crop that regrows", "a lever", "a torch you can light"
or "a pickaxe that mines faster" is a registry entry, not an edit to the
interaction pipeline.

```
npm install
npm start          # http://localhost:8080
npm test           # 208 tests, node:test, no test framework dependency
```

Open the page, create an account, and you are standing in a procedurally
generated world with movement, block harvesting/placement, an inventory and
other players.

---

## Contents

- [Why it is shaped this way](#why-it-is-shaped-this-way)
- [Layout](#layout)
- [Running it](#running-it)
- [Architecture](#architecture)
  - [1. World core](#1-world-core)
  - [2. Networking and sessions](#2-networking-and-sessions)
  - [3. Inventory and equipment](#3-inventory-and-equipment)
  - [4. Item use and interaction](#4-item-use-and-interaction)
  - [5. Character state](#5-character-state)
  - [6. Persistence](#6-persistence)
  - [7. The reference client](#7-the-reference-client)
- [Extending it](#extending-it)
- [Embedding it in your own server](#embedding-it-in-your-own-server)
- [Testing](#testing)
- [Design rules](#design-rules)

---

## Why it is shaped this way

The single architectural decision everything else follows from:

> **Items, blocks and interactions are data + handler functions, not code
> branches.**

Because of that, "breaking a block", "pressing a button", "harvesting a crop"
and "placing a torch" are the *same* three-step pipeline:

```
resolve target  ->  validate (reach, line of sight, tool, cooldown)  ->  dispatch handler
```

`InteractionSystem.perform(kind, player, params)` is the whole public surface.
`kind` is looked up in a handler registry, so adding a fourth interaction class
later (`ATTACK`, `TILL`, `PAINT`…) does not touch the existing three.

---

## Layout

```
voxel-core/
├── src/
│   ├── core/         event bus, registries, seeded RNG, shared constants
│   ├── content/      blocks, items, loot tables, biomes, entities, spawn rules
│   │                 (all pure data)
│   ├── world/        coords, noise, chunks, generator, world, raycast, physics
│   ├── entity/       form codes, body plans, hitboxes, brains, entity manager,
│   │                 spawner
│   ├── game/         inventory, equipment, character, containers, ground items,
│   │                 interaction + item-use dispatchers, player
│   ├── net/          wire protocol, rate limiting, interest management
│   ├── storage/      schema migrations, pluggable stores, save orchestration
│   ├── server/       auth, session, game server, static file server, entry point
│   └── index.js      browser-safe barrel (no Node built-ins)
├── client/           Three.js reference client (no build step)
└── test/             node:test suites, one per layer
```

**Browser-safety rule:** `core`, `content`, `entity`, `world`, `game` and `net` import no
Node built-ins, so the browser loads them directly from `/src/...`. Only
`storage` and `server` may use `node:` modules. This is what lets the client
run the *same* physics, raycast, harvest-timing and protocol code the server
validates with, instead of a reimplementation that drifts.

---

## Running it

```bash
npm install
npm start
```

Configuration is read from the environment:

| Variable        | Default                | Meaning                                  |
| --------------- | ---------------------- | ---------------------------------------- |
| `PORT`          | `8080`                 | HTTP + WebSocket port                    |
| `HOST`          | `0.0.0.0`              | Bind address                             |
| `WORLD_SEED`    | `voxel-core`           | World seed; same seed = same world        |
| `SAVE_PATH`     | `data/world.json`      | Save file location                       |
| `AUTOSAVE_MS`   | `60000`                | Autosave interval                        |
| `VIEW_DISTANCE` | `4`                    | Chunk radius streamed to each player     |
| `ALLOW_REGISTER`| `true`                 | Set `false` to close registration        |
| `MAX_PLAYERS`   | `32`                   | Connection cap                           |

The server saves on autosave, on player disconnect, and on `SIGINT`/`SIGTERM`.

---

## Architecture

### 1. World core

**Deterministic generation.** `WorldGenerator` turns a seed into terrain
through an ordered list of *layers* (`terrain`, `caves`, `ores`, `flora`),
each implementing `generate(chunk, context)`. The same seed always
produces the same world, so unmodified chunks never need storing.

**Diff-based persistence.** `World` never saves whole chunks. It keeps a map of
*modified blocks* per chunk and replays that diff over freshly generated
terrain on load. A world where players have touched 1 % of the terrain costs
1 % of the storage.

**Tile entities** hold the data a block id cannot: a door's open state, a
torch's lit state, a chest's contents. They are stored alongside the diff and
keyed by block position.

**Queries.** `isSolid`, `getBlockDef`, the DDA `raycast` (returns the hit
block, its face normal, and the `adjacent` cell a placement would occupy), and
`stepPhysics` / `validateMove` for grounded movement with AABB collision.

**Events.** Every terrain change emits `BLOCK_CHANGED` or
`TILE_ENTITY_CHANGED` on the shared `EventBus`, which is how the server knows
what to broadcast without the world knowing networking exists.

**Regrowth.** Harvested blocks with a `regrow` rule are pushed onto a timed
queue and restored on the world tick — the hook that makes farming, ore
respawn and tree regeneration cheap to add later.

### 2. Networking and sessions

- **Protocol** (`src/net/protocol.js`) is the single source of truth for
  message shapes, imported unchanged by both halves. Every client verb has a
  `validate()` clause; nothing the server later trusts skips it.
- **Lifecycle**: connect → `welcome` → `login`/`register` → `login_ok` →
  chunk stream → play → save on disconnect.
- **Interest management**: chunks, entities and ground items are only sent to
  players within view distance, with one chunk of hysteresis so a player
  walking a border does not thrash.
- **Rate limiting**: per-category token buckets (movement, building,
  inventory, chat, auth) plus a global budget.
- **Server authority**: positions are validated against elapsed time, maximum
  speed and terrain (`validateMove`); rejected moves snap the client back.
  Reach and line of sight are re-checked server side for every interaction.
- **Auth**: PBKDF2-HMAC-SHA256, 600 000 iterations, per-account random salt,
  `timingSafeEqual` comparison. Iterations and digest are stored per account so
  they can be raised without invalidating existing logins. Failures always
  report the same reason, so the endpoint is not a username oracle.

### 3. Inventory and equipment

Slot-based inventory with a quickbar subset, stacks of
`{ item, count, meta }`, and `add` / `remove` / `move` / `split` / `merge` /
`sort` respecting per-item `maxStack`. Stack limits, consumability, equip slot
and placement target all come from the item definition.

Equipment has named slots, validates against the item's `equipSlot`,
aggregates stats from everything worn, tracks per-item durability, handles
breakage, and exposes `toVisual()` so other players see what you are wearing.

Dropping produces a **ground item entity** with a despawn timer and a
short pickup-ownership window; picking up validates reach and free space.

### 4. Item use and interaction

One `USE_ITEM` message routes through `ItemUseSystem`, which dispatches on the
item's `use.action` (`consume`, `learn`, `toggle`, `place`, `equip`). Effects
are data: heal amounts, buffs (`stat`, `magnitude`, `duration`), knowledge
unlocks.

`InteractionSystem` covers the three classes worth separating:

| Class     | Meaning                                       |
| --------- | --------------------------------------------- |
| `INTERACT`| State change, no destruction — open a chest, toggle a door or torch |
| `HARVEST` | Break/mine/chop; two-phase and server-timed, yields a loot roll |
| `PLACE`   | Put a block into the world, with placement rules |

Harvesting is two-phase: `beginHarvest` records when mining started and how
long it must take (`hardness × tool penalty ÷ tool tier`); `harvest` refuses
until that time has elapsed. The client runs the *same* `computeHarvestSeconds`
so its progress matches the server's.

Placement rules are data too: `replaceable` targets can be overwritten,
`support: 'below'` blocks need solid ground, and a block is never placed inside
a player.

Loot tables support weighted and independent rolls plus conditional entries
(`requires: { toolClass, toolTier, knowledge }`), which is how "needs a
pickaxe" and "needs the masonry skill" are expressed without code.

### 5. Character state

Health, energy, XP and levels; a buff system with named effects, duration,
magnitude and stacking rules (`replace` / `extend` / `stack`) that expire
cleanly (including across a logout); a per-player knowledge set for learnable
recipes and spells; and derived stats recomputed from base + equipment +
buffs.

### 6. Persistence

- **Player record**: position, inventory, equipment, stats, unlocks and buffs
  with their remaining duration.
- **World record**: chunk diffs, tile-entity states, dropped items, container
  contents and the regrowth queue.
- **Schema versioning from day one**: `src/storage/migrations.js` holds an
  ordered migration list and every save carries its version.
- **Pluggable stores**: `MemoryStore` for tests, `JsonFileStore` with atomic
  writes for single-server use. Anything implementing the same small interface
  (SQLite, Postgres, Redis) drops in.

### 7. The reference client

`client/` is plain ES modules with **no build step** — an import map points
`three` at the copy served from `node_modules`. It demonstrates every feature
the brief asks for:

- login / register screen over the WebSocket protocol;
- chunk meshing with hidden-face culling, transparent and liquid passes, and
  colours taken from the block registry;
- a **voxel avatar** (head, torso, arms, legs) with a procedural walk cycle,
  per-player tint, nameplate and visible held item;
- the **camera mounted on the avatar's head**, so first person and third
  person (`V`) share one rig, with the mount placed at exactly the shared
  `PLAYER_EYE_HEIGHT` so the crosshair and the highlighted block agree;
- movement prediction through the shared `stepPhysics`;
- an **optional crosshair** (`C` toggles) whose focus resolution uses the
  shared voxel raycast first and falls back to a **proximity** search — the
  nearest eligible block inside the forward cone — so "what am I about to
  interact with" stays well defined whether or not a crosshair is drawn.

Controls: `WASD` move, `Space` jump, `Shift` run, `LMB` harvest, `RMB`
place/use, `E` interact, `Q` drop, `R` sort, `1`–`9` quickbar, `C` crosshair,
`V` view, `T` chat, `I`/`Tab` inventory.

The inventory panel shows the 36-slot inventory, the six equipment slots with
derived stats, and an open chest side by side. Drag stacks between slots (or
onto Trash), `Shift`+click to quick-move into the open chest or equip,
right-click to split a stack and `Ctrl`+click to lock a slot. Every gesture is
a protocol verb (`move_item`, `equip`, `unequip`, `transfer_item`, …); the
server re-validates it and replies with fresh state.

Animals are drawn by `client/js/entity-view.js`, which rebuilds each one from
its form code, seed and size, then animates it (diagonal-pair gait, grazing,
tail sway, falling over on death). Left click hits the animal under the
crosshair; `E` or right click on a carcass butchers it.

### 8. Entities (mobs and NPCs)

Non-player entities are content like blocks: an entry in
`src/content/entities.js` names a **form code**, stats, a **brain** and a
**harvest** loot table, and a spawn rule says where it appears.

- **Form codes** describe a procedural body compactly:
  `Q|bd:L14W8H8|lg:L7T3|hd:L5W4H4|hn:2L2C1|ud|pt:patch,F2EEE6,3A2A20`. The
  first token picks a body plan (`Q` = large quadruped); each `op:params`
  feature picks a registered shape and passes it numbers in 1/16 block
  (`L14~2` rolls 14 ± 2 per individual). `src/entity/form-code.js` parses and
  resolves them; the server derives hitboxes and the client builds meshes from
  the same result.
- **Brains** (`src/entity/brains.js`) are registered handlers that set an
  intent (move target, speed, animation). `grazer` idles, grazes, wanders its
  territory and flees whoever hurt it.
- **Spawning** (`src/entity/spawner.js`) tops up wildlife around each player,
  choosing rules that match the column's biome and surface block, weighted by
  rarity (`common` … `very_rare`), up to a local cap. Entities despawn when no
  player is near.
- **Combat** is click-to-hit with a 500 ms cooldown (`attack`); the server
  checks reach and line of sight against the entity box.
- **Corpses** stay for `corpse` seconds. `interact_entity` butchers one by
  rolling its harvest table with your tool and knowledge. Loot entries the
  harvester is not equipped or trained for still drop the real item at
  `unskilled` odds (default 5%) and otherwise may yield their `ruined` item
  (mangled meat, tattered hide); this applies to block loot tables too.

Phase 1 entities are not saved; they respawn from the rules.

---

## Extending it

Every example below is *additive*: no engine file changes.

### Add a block

```js
import { createContent } from 'voxel-core';

const content = createContent({
  blocks: [{
    id: 120, name: 'lantern',
    solid: true, hardness: 0.4, light: 15,
    interactable: true, tileEntity: 'toggle',   // reuses the built-in toggle handler
    drops: 'lantern', support: 'below', color: 0xffe9a8,
  }],
  items: [{ id: 'lantern', name: 'Lantern', placeable: 'lantern', maxStack: 16 }],
  loot: [{ id: 'lantern', mode: 'all', rolls: 1, entries: [{ item: 'lantern' }] }],
}).freeze();
```

`Content` validates every cross-reference at construction, so a typo in
`placeable` or `drops` fails loudly at boot rather than silently at runtime.

### Add a mob

```js
const content = createContent({
  entities: [{
    id: 'aurochs', name: 'Aurochs', brain: 'grazer', harvest: 'cow_carcass',
    form: 'Q|bd:L18W10H10|lg:L8T4|nk:L3A10|hd:L6W5H5|hn:2L6C2|tl:L8|pt:solid,3B2A1E',
    traits: { size: [1, 1.2], territory: 14 },
    stats: { health: 18, speed: 1.8, defense: 1 },
  }],
  spawnRules: [{ id: 'steppe_aurochs', entity: 'aurochs', biomes: ['savanna'], group: [2, 3], rarity: 'rare' }],
}).freeze();
```

New behaviour is `BRAINS.register('name', (entity, { now, rng }) => { ... })`.

### Add an item action

```js
// Handlers receive (player, itemDef, context) and return a result envelope.
server.items.registerAction('teleport', (player, itemDef, { slot }) => {
  player.position = { ...itemDef.use.destination };
  player.inventory.removeFromSlot(slot, 1);
  return { ok: true, action: 'teleport' };
});
// ...then give an item `use: { action: 'teleport', destination: { x, y, z } }`
```

### Add an interaction

```js
// Keyed by block name, or by tile-entity kind to cover a family of blocks.
server.interactions.registerInteraction('anvil', (player, target, system) => {
  // reach, line of sight and interactable have already been validated
  return { ok: true, action: 'open-anvil' };
});
```

### Add an interaction class

```js
server.interactions.registerClass('till', (player, params) => {
  // full control; still goes through resolve -> validate -> dispatch
});
```

### React to world changes

```js
import { EVENTS } from 'voxel-core';

server.bus.on(EVENTS.BLOCK_CHANGED, ({ x, y, z, block, previous, actorId }) => {
  // analytics, quests, claims, structure detection...
});
```

---

## Embedding it in your own server

`src/server/main.js` is a worked example, not a requirement — the game server
takes injected transports, so it runs over any socket implementation (or none,
in tests):

```js
import { createContent } from 'voxel-core';
import { GameServer } from 'voxel-core/server';
import { GameStore, MemoryStore } from 'voxel-core/storage';

const store = new GameStore({ store: new MemoryStore(), seed: 'my-seed' });
await store.init();

const game = await GameServer.create({ content: createContent().freeze(), store, seed: 'my-seed' });

const session = game.addSession({
  send: (text) => mySocket.write(text),
  close: () => mySocket.end(),
});
session.greet();
session.handleRaw(inboundFrame);
```

---

## Testing

```bash
npm test
```

`node:test` only — no framework dependency. One suite per layer
(`core`, `content`, `world`, `storage`, `game`, `net`, `client`), covering
determinism of generation, diff persistence round-trips, inventory edge cases,
harvest timing and reach validation, protocol validation and rate limiting,
the full login → chunk stream → build → save loop, and the client's world
mirror, target resolver, chunk mesher and avatar rig.

The client tests register a small module hook (`test/helpers/src-loader.js`)
that maps the browser's `/src/...` specifiers onto the real files, so client
modules are tested exactly as the browser loads them — and a guard test fails
if any client import points at a missing module, a name that is not exported,
or a bare specifier with no import-map entry.

---

## Design rules

These are the invariants worth preserving when building on this:

1. **Content is data.** If you find yourself writing `if (blockId === …)` in
   engine code, the behaviour belongs in a definition field or a handler.
2. **The server never trusts the client.** Position, reach, line of sight,
   timing, inventory contents and tool requirements are all re-derived server
   side.
3. **`core`, `content`, `world`, `game` and `net` stay free of Node built-ins**
   so the client can share them.
4. **Shared rules live in one place.** If the client needs to predict
   something, it imports the server's implementation rather than copying it.
5. **Saves are versioned.** Any schema change gets a migration.

## License

MIT — see [LICENSE](./LICENSE).
