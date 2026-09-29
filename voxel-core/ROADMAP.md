# Roadmap

How the MVP feature list maps onto what `voxel-core` implements today, what is
hooked but shallow, and what is deliberately deferred.

Legend: **✅ done** · **🔩 hook in place** (extension point exists, depth
deferred) · **⏳ deferred**

---

## 1. World core — procedural, persistent, shared

| Feature | Status | Where |
| --- | --- | --- |
| Chunked voxel terrain from a world seed, deterministic | ✅ | `src/world/generator.js`, `src/world/noise.js` |
| Chunk loading/unloading around players (view distance) | ✅ | `src/net/interest.js`, `Session.syncChunks` |
| Chunk persistence as **diffs**, unmodified chunks regenerated from seed | ✅ | `src/world/world.js` (`exportState`/`importState`) |
| Server-authoritative block state, broadcast to nearby players | ✅ | `GameServer._subscribeToWorld` |
| Solid/blocking query + raycast for targeting | ✅ | `World.isSolid`, `src/world/raycast.js` |
| Gravity/collision for players | ✅ | `src/world/physics.js` (`stepPhysics`, `validateMove`) |
| **Block registry** as data (hardness, tool class, drops, light, interactable…) | ✅ | `src/content/blocks.js` |
| **Tile-entity / block-state map** (door open, torch lit, container contents) | ✅ | `World.setTileEntity`, `src/game/containers.js` |
| **World-edit event bus** — every terrain change emits an event | ✅ | `src/core/event-bus.js`, `EVENTS.BLOCK_CHANGED` |
| Light propagation (block light actually lighting the scene) | ⏳ | `light` is defined per block and sent to the client; only baked shading is rendered |
| Biome-driven structures (villages, dungeons) | 🔩 | generator layers are an ordered, extensible list |

## 2. Networking and session core

| Feature | Status | Where |
| --- | --- | --- |
| Connect / auth / join / leave lifecycle | ✅ | `src/server/session.js`, `src/server/auth.js` |
| Interest management — only nearby entities and chunks | ✅ | `src/net/interest.js`, `GameServer.broadcastNear` |
| Player state sync (position, animation, held item, equipment) | ✅ | `Player.toNetworkState` |
| Save player state + inventory on disconnect | ✅ | `GameServer.removeSession` |
| Interval autosave | ✅ | `GameStore` autosave timer |
| Graceful shutdown save | ✅ | `src/server/main.js` SIGINT/SIGTERM handler |
| Rate limiting on every client action | ✅ | `src/net/rate-limiter.js` |
| Validation of every client action; server never trusts reach or position | ✅ | `protocol.validate`, `validateMove`, `InteractionSystem.validateTarget` |
| Binary/compressed transport | ⏳ | chunks already ship run-length encoded; frames are JSON |
| Horizontal scaling / multiple world shards | ⏳ | single-process today |

## 3. Inventory system

| Feature | Status | Where |
| --- | --- | --- |
| Slot-based inventory + quickbar subset | ✅ | `src/game/inventory.js` |
| Stacks: `item_type + count + optional metadata` | ✅ | `{ item, count, meta }` |
| `add` / `remove` / `move` / `swap` / `split` / `merge` with max stack size | ✅ | `Inventory` |
| Item definitions as data (stackable, consumable, equippable, placeable, use effects) | ✅ | `src/content/items.js` |
| Drop to world / pick up, with despawn timers and ownership windows | ✅ | `src/game/ground-items.js` |
| Sort, lock-slot, trash | ✅ | `Inventory.sort` / `toggleLock` / `trash`, exposed as `sort_inventory`, `lock_slot` and `trash_item` verbs |
| Multi-page / bag containers | 🔩 | containers reuse `Inventory`; sizes are per tile entity |

## 4. Equipment system

| Feature | Status | Where |
| --- | --- | --- |
| Named equip slots | ✅ | `EQUIP_SLOTS` — head, chest, legs, feet, main hand, off hand |
| Equip/unequip with slot-type validation | ✅ | `Equipment.equip` |
| Stat aggregation from all equipped items | ✅ | `Equipment.aggregateStats`, `Character.getStat` |
| Durability, decrement on use, break handling | ✅ | `Equipment.damage`, `EVENTS.ITEM_BROKE` |
| Visual sync — other players see what is equipped | ✅ | `Equipment.toVisual` → `PLAYER_UPDATE` |
| Class/level requirements | 🔩 | `Character.level` and `knowledge` exist; no gate is enforced yet |
| Set bonuses, enchantments | ⏳ | would be additional aggregation passes |

## 5. Item use / utilization framework

A single `USE_ITEM` message routes through `ItemUseSystem`, dispatching on the
item's `use.action`. Adding an action is `registerAction(name, handler)`.

| Action | Status | Notes |
| --- | --- | --- |
| **Consume** — heal, energy, buffs, experience, all as data | ✅ | `use: { heal, energy, buffs: [...], experience }` |
| **Learn** — consume to unlock a recipe/skill, checks "already known" | ✅ | `use: { action: 'learn', knowledge }` |
| **Ignite/toggle** — lit state on light-emitting blocks | ✅ | shared `toggle` tile-entity handler |
| **Delete/trash** | ✅ | `trash_item` verb; `trashable: false` items are refused server side |
| **Move/swap/split/stack** | ✅ | inventory ops above, exposed as protocol verbs |
| **Equip** | ✅ | routes into the equipment system |
| **Place** | ✅ | routes into block placement; item consumed, block spawned |
| **Use on target** | ✅ | `USE_ITEM` carries an optional block target |

## 6. Interaction framework

| Feature | Status | Where |
| --- | --- | --- |
| Target resolution — raycast returns block position, type, adjacent face | ✅ | `InteractionSystem.resolveTarget` |
| Interaction registry — `interactable` flag + per-type handler | ✅ | `registerInteraction(key, handler)` |
| Server-side validation: reach, line of sight, tool requirements, cooldown | ✅ | `validateTarget`, `computeHarvestSeconds` |
| `INTERACT` — toggle door, open container, press button | ✅ | `INTERACTION.INTERACT` |
| `HARVEST` — tool class + hardness → mining time → loot table | ✅ | two-phase `beginHarvest` / `harvest` |
| `PLACE` — placement rules (replaceable, support, not inside a player) | ✅ | `validatePlacement` |
| Loot/drop tables with weights and conditional drops | ✅ | `src/content/loot.js` (`requires: { toolClass, toolTier, knowledge }`) |
| Containers — block state with inventory, open/close, transfer | ✅ | `src/game/containers.js` |
| Respawn/regrow hooks for harvested nodes | ✅ | `block.regrow`, `World` regrowth queue + tick |
| Permissions / land claims on interaction | 🔩 | validation is a single choke point; a claim check is one predicate |
| NPC dialogue targets | 🔩 | target resolution returns blocks today; entity targets are the natural extension |

## 7. Character state

| Feature | Status | Where |
| --- | --- | --- |
| Health, energy, XP/level | ✅ | `src/game/character.js` |
| Buff/debuff system: duration, magnitude, stacking rules, expiry | ✅ | `applyBuff`, `expireBuffs`, `STACKING` |
| Skill/knowledge unlock set per player | ✅ | `Character.learn` / `knows` |
| Derived stats from base + equipment + buffs | ✅ | `Character.getStats` |
| Hunger, thirst, temperature | 🔩 | `energy` is the worked example; more vitals are additional fields |
| Damage sources and death/respawn | ⏳ | health changes exist; no damage or death pipeline yet |

## 8. Persistence

| Feature | Status | Where |
| --- | --- | --- |
| Player record: position, inventory, equipment, stats, unlocks, buffs with remaining duration | ✅ | `Player.toJSON` / `loadJSON` |
| World record: chunk diffs, tile-entity states, dropped items, container contents | ✅ | `World.exportState`, `GroundItemManager.toJSON` |
| Scheduled world tick for regrowth and buff expiry | ✅ | `GameServer.tick` |
| Schema versioning and migrations from day one | ✅ | `src/storage/migrations.js` |
| Pluggable backends | ✅ | `MemoryStore`, `JsonFileStore`; interface is four methods |
| Database backend (SQLite/Postgres) | 🔩 | implement the `Store` interface |
| Per-region save files for large worlds | ⏳ | `regionKey` helpers exist; the JSON store is single-file |

---

## Deliberately deferred

Per the brief, these are all cheap to add *because* the registries above are
data-driven now:

- **Crafting depth** — recipes are data plus a knowledge gate; `learn` and the
  knowledge set already exist.
- **Mobs / AI** — needs an entity system alongside players; interest
  management and state sync already generalise.
- **Combat depth** — damage types, resistances, hit detection.
- **Claims / permissions** — one predicate inside `validateTarget`.
- **Economy / trading** — inventory transfer ops already exist.

## Known gaps worth closing first

1. **Entities beyond players.** Ground items are the only non-player entity.
   Generalising to an entity registry would unlock mobs, projectiles and NPCs
   on the existing sync path.
2. **Light propagation.** Blocks declare a `light` level that nothing
   currently propagates.
3. **Chunk meshing off the main thread.** The reference client meshes
   synchronously with a small per-frame budget; a worker would remove the
   hitch on view-distance changes.
4. **Binary frames.** JSON is fine at this scale but chunk streaming would
   benefit from a binary encoding.
5. **Proximity targets are display-only.** The client crosshair falls back to a
   proximity scan when the view ray misses (`client/js/targeting.js`), but the
   server's `validateTarget` only accepts raycast hits, so a proximity-focused
   block is highlighted yet returns `no line of sight` if acted on. Closing this
   means lifting the proximity scan out of the client into
   `src/world/raycast.js` and having both sides call the same resolver.
