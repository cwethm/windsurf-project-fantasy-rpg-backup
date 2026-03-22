# Voxel MMO - Development Documentation

## Overview
A 3D voxel-based MMO game with real-time multiplayer, inventory system, container mechanics, and item collection features.

## Architecture
- **Server**: Python with WebSockets (asyncio)
- **Client**: JavaScript with Three.js for 3D rendering
- **Protocol**: JSON message-based WebSocket communication

## Quick Start

### Server
```bash
cd /home/cweth/CascadeProjects/windsurf-project-2
source venv/bin/activate
python3 server.py
```
Server runs on `ws://localhost:3001`

### Client
```bash
cd client
python3 -m http.server 8080
```
Client runs on `http://localhost:8080`

## Key Features

### 1. World System
- **Procedural terrain generation** using sine wave height maps
- **Chunk-based loading** (16x16x64 blocks per chunk)
- **Infinite world** with on-demand chunk generation
- **Block types**: Air, Grass, Dirt, Stone, Wood, Leaves, Sand, Chest

### 2. Player Systems
- **Real-time movement** with physics (gravity, jumping)
- **First-person camera** with mouse look
- **Orbit camera mode** for debugging (V key)
- **Multiplayer synchronization** of positions

### 3. Inventory & Items
- **36-slot inventory**: 9 quickbar slots + 27 main slots
- **Item stacking** with configurable max stack sizes
- **Quickbar selection** with number keys (1-9)
- **Item entities**: Floating collectible items with physics

### 4. Container System
- **Chests** randomly spawn in world (30% chance per chunk)
- **Loot generation**: Random items in chests
- **Container UI**: Split view with chest and inventory
- **Item movement**: Click to move between inventory and containers

### 5. Mining & Harvesting
- **Two modes**: Edit mode (instant break) and Explore mode (hold to mine)
- **Block hardness**: Different mining times per block type
- **Audio feedback**: Mining sound while holding click
- **Item drops**: Blocks drop as collectible items

### 6. Item Lock System
- **7-minute timeout**: Item locks expire after 7 minutes
- **Toggle lock**: L key to enable/disable item lock
- **Cooperative mode**: Disable lock for shared resources
- **Visual feedback**: Other players' items appear semi-transparent

## Controls

### Movement
- **WASD**: Move forward/left/backward/right
- **Space**: Jump
- **Mouse**: Look around (when pointer is locked)

### Inventory
- **E**: Toggle inventory panel
- **1-9**: Select quickbar slot
- **Left click**: Pick up item / Place item
- **Right click**: Place block / Open chest

### Modes
- **F**: Toggle Edit/Explore mode
- **L**: Toggle item lock on/off
- **V**: Toggle orbit camera (debug)
- **Esc**: Close all panels

## Network Protocol

### Message Types
```javascript
// Client → Server
JOIN: Player joins game
MOVE: Position/velocity update
JUMP: Jump action
PLACE_BLOCK: Block placement
BREAK_BLOCK: Block destruction
INTERACT: Entity interaction
OPEN_CONTAINER: Open chest
CLOSE_CONTAINER: Close chest
MOVE_ITEM: Move item between slots
SELECT_QUICKBAR: Select quickbar slot
TOGGLE_ITEM_LOCK: Toggle item lock
COLLECT_ITEM: Collect item entity

// Server → Client
GAME_STATE: Initial game state
PLAYER_JOIN: Player joined
PLAYER_LEAVE: Player left
PLAYER_MOVE: Player movement
CHUNK_DATA: World chunk data
WORLD_UPDATE: Block changes
INVENTORY_UPDATE: Inventory sync
CONTAINER_DATA: Container contents
SPAWN_ITEM_ENTITY: Spawn floating item
ITEM_LOCK_STATUS: Lock status update
```

## Code Structure

### Server Classes
- **VoxelServer**: Main server class, handles connections and message routing
- **Player**: Player data, position, inventory
- **Inventory**: 36-slot inventory with stacking logic
- **World**: Chunk management, block storage, terrain generation
- **Container**: Chest container with item storage

### Client Classes
- **VoxelGame**: Main game controller
- **Player**: Local player representation
- **World**: Client-side world rendering
- **Physics**: Gravity and collision detection
- **Controls**: Input handling
- **Raycaster**: Block targeting
- **Inventory**: UI and management
- **UI**: Console and status displays

## Configuration

### Server Constants
```python
CHUNK_SIZE = 16
CHUNK_HEIGHT = 64
GRAVITY = -9.81
PLAYER_SPEED = 5
JUMP_FORCE = 8
INTERACTION_RANGE = 5
ITEM_LOCK_TIMEOUT = 420  # 7 minutes
```

### Block Hardness (seconds to mine)
```python
GRASS: 0.6s
DIRT: 0.5s
STONE: 3.0s
WOOD: 1.5s
LEAVES: 0.3s
SAND: 0.5s
CHEST: 2.5s
```

## Development Tips

### Adding New Blocks
1. Add to `BLOCK_TYPES` in server.py
2. Add to client-side `BLOCK_TYPES` in game.js
3. Update `getBlockColor()` in Renderer class
4. Add to `BLOCK_HARDNESS` and `BLOCK_DROPS` if needed

### Adding New Items
1. Add to `ITEM_TYPES` in server.py
2. Add to client-side `ITEM_TYPES` and `ITEM_NAMES`
3. Add to `ITEM_COLORS` for visual representation
4. Configure `ITEM_MAX_STACK` if needed

### Adding New Messages
1. Add to `MESSAGE_TYPES` in both server.py and game.js
2. Add handler in VoxelServer.handle_message()
3. Add handler in VoxelGame.handleServerMessage()

## Debug Features

### Server Logs
- Player connections/disconnections
- Block break/place actions
- Container interactions
- Item collection attempts

### Client Console
- Chunk loading status
- Player creation/movement
- Mining progress
- Item entity spawning

### Orbit Camera
Press V to enable orbit camera for debugging world generation and player positions.

## Implemented Features

### Core Engine
- **Chunk-based voxel world**: 16×16×64 block chunks with on-demand generation
- **Advanced world generation**: Multi-layer pipeline (base height, biome, climate, surface material, flora, resources, roads, sites)
- **Physics**: Gravity, jumping, collision detection, ground finding, depenetration
- **First-person camera** with mouse look + orbit camera debug mode (V key)
- **WebSocket networking**: Server-authoritative with JSON protocol

### Player Systems
- **Animated player avatars**: Procedural voxel characters with idle, walk, run, jump, mine, and attack animations
- **Player model**: Scaled to ~1.9 blocks tall, with wrapper group for correct ground alignment
- **Head rotation**: Synced with camera view (yaw/pitch), broadcast to other players
- **Multiplayer**: Real-time position/velocity/rotation sync with smooth interpolation
- **Health/damage/death**: HP system, death state, respawn
- **Stamina**: Regeneration, sprint drain, dodge mechanic (double-tap)
- **Leveling/XP**: Experience gain from mob kills, level-up system
- **Equipment**: Weapon equip/unequip, armor slots (leather/iron/diamond tiers)

### Inventory & Items
- **36-slot inventory**: 9 quickbar + 27 main slots
- **Item stacking**: Per-item max stack sizes (tools=1, materials=64)
- **Item entities**: Floating collectible items with spin animation
- **Item lock system**: 7-minute timeout, toggle with L key, cooperative sharing
- **Extensive item catalog**: 150+ item types (raw materials, processed, tools, food, weapons, armor)

### Crafting
- **60+ crafting recipes** spanning:
  - Basic tools (knife, hatchet, shovel, sickle, hammer, fishing rod, shears)
  - Weapons (wooden/stone/iron/gold/diamond swords, pickaxes, axes)
  - Plant processing (fiber→thread→twine→rope→cloth, paper, herbal paste)
  - Animal processing (hide→cured hide→leather, bone needle, glue, tallow, parchment)
  - Stone processing (cut stone, stone brick, ceramic, pottery, mortar)
  - Metal processing (ingots, wire, bands, nails, rivets, chain links, bronze alloy)
  - Food (roasted meat, jerky, soup, porridge, stew, bread, berry mash, herb tea)
  - Workstations (campfire, tanning rack, carpentry bench, loom, spinning wheel, mason table, forge, anvil, smelter, alchemy table, enchanting altar, tailor/leatherworker/fletching benches)

### Container System
- **Chests**: Random spawn in world (30% per chunk), loot generation
- **Container UI**: Split view with drag/click item transfer

### Mining & Harvesting
- **Edit mode** (instant break) and **Explore mode** (hold to mine with progress)
- **Block hardness**: Per-block mining times
- **Block drops**: Blocks and material sources drop appropriate items
- **New material sources**: Oak/pine/birch logs, berry/thorn/herb bushes, mushrooms, reeds, flint, clay, salt, copper/tin/silver veins, gem seams

### Mobs & Combat
- **14 mob types**: zombie, skeleton, goblin, slime, spider, troll (hostile); deer, boar, sheep, cow, rabbit, wolf, bear, chicken (passive/defensive)
- **Mob AI**: Idle wandering, player detection, chasing, attacking, target switching, aggro loss on player death
- **Mob spawning**: Auto-spawn near players, max cap, despawn when far, corpse persistence (60s)
- **Loot drops**: Per-mob weighted loot tables with variable counts
- **Vox model rendering**: 13 .vox models loaded (bear, chicken, deer, dog, goblin, green_slime, lion, panther, rabbit, sheep, skeleton, villager, wolf, zombie)

### NPCs & Quests
- **NPC class**: Position, type, dialogue trees, quest giving
- **Quest class**: Gather/craft/deliver task structure
- **Message types**: NPC_SPAWN, NPC_INTERACT, NPC_DIALOGUE, QUEST_ACCEPT, QUEST_COMPLETE

### World Generation Layers
- **base_height.py**: Terrain elevation with noise
- **biome.py**: Biome assignment and blending
- **climate.py**: Temperature/moisture simulation
- **surface_material.py**: Block type selection per biome
- **flora.py**: Tree/bush/plant placement
- **resources.py**: Ore and material node generation
- **roads.py**: Path/road network generation
- **sites.py**: Point-of-interest placement

### Chat & Social
- **Chat system**: Public messages, whispers, system messages
- **Chat commands**: Server-side command processing

### Database & Persistence
- **SQLite database**: Users, sessions, players, world_chunks, item_entities tables
- **Authentication**: Register/login with password hashing and salt
- **Session management**: Token-based with expiry

### Anti-Cheat
- **Server-side validation**: Max move speed, mining/placing cooldowns, max reach distance

---

## Known Bugs & Issues

### Critical
1. **Database NOT NULL constraint on player save**: `players.user_id` fails when saving players who joined without auth — disconnect triggers `Failed to save player: NOT NULL constraint failed: players.user_id`
2. **Missing mob models**: `slime.vox`, `troll.vox`, `boar.vox`, `cow.vox` return 404 — these mobs render as fallback cubes

### Medium
3. **Block type ID conflicts**: `PLANKS` exists as both block type 21 and item type 361; `SAND` as block 7 and item 348; `LEAVES` as block 5 and item 310 — potential lookup bugs
4. **No server-side physics**: Server trusts client positions; movement validation is basic
5. **Chunk persistence incomplete**: World chunks may not save/load reliably across restarts
6. **Local player mesh not added to scene** (commented out for first-person) — other players can't see the local player if the mesh isn't synced

### Low
7. **BrokenPipeError** in HTTP static server when browser tabs close rapidly (cosmetic, Python http.server limitation)
8. **Excessive debug logging**: `DEBUG:websockets.server` floods console during normal play

---

## Needed Tests

### Unit Tests (Server)
1. **Player class**: Health/damage/death, leveling/XP thresholds, stamina regen, equipment slots
2. **Inventory class**: Add/remove/stack items, slot overflow, max stack enforcement, move between slots
3. **Container class**: Loot generation, item transfer to/from inventory
4. **World class**: Chunk generation, block get/set, container placement, chunk persistence round-trip
5. **Crafting system**: Recipe validation, ingredient consumption, tool-as-ingredient (not consumed?), output placement
6. **Anti-cheat**: Speed validation, reach distance, cooldown enforcement

### Unit Tests (Client)
7. **PlayerAvatar**: Model dimensions, wrapper/group hierarchy, foot alignment at y=0, animation state transitions
8. **Physics**: Ground finding, collision detection, depenetration, gravity
9. **Position sync**: Array vs object format handling, lerp interpolation, rotation broadcast

### Integration Tests (Existing — extend)
10. **Mob combat**: ✅ Already has 10 tests — add armor damage reduction, weapon durability
11. **Crafting flow**: Gather materials → craft tool → use tool (end-to-end)
12. **Multiplayer sync**: Two-player position visibility, item lock sharing, chat delivery
13. **World persistence**: Save chunks → restart server → reload and verify blocks

### Missing Test Files
14. **test_inventory.py**: Stacking, overflow, quickbar selection
15. **test_crafting.py**: All recipe paths, edge cases (missing ingredients, full inventory)
16. **test_world.py**: Chunk generation determinism, block read/write, container lifecycle
17. **test_player.py**: Leveling, equipment, death/respawn state
18. **test_auth.py**: Register, login, session expiry, duplicate username

---

## Recommendations

### Phase 1 — Stability (Immediate)
1. **Fix database save error**: Make `user_id` nullable or assign a guest user_id for unauthenticated players
2. **Generate missing mob models**: Run vox generator for slime, troll, boar, cow — or add fallback handling
3. **Reduce debug logging**: Set websockets logger to INFO level instead of DEBUG
4. **Resolve item ID conflicts**: Deduplicate PLANKS/SAND/LEAVES between block and item namespaces
5. **Add mesh position sync test**: Verify wrapper group pattern works for all player creation paths

### Phase 2 — Robustness
6. **Server-side movement validation**: Verify player positions against expected physics (teleport detection)
7. **Chunk save/load**: Ensure world state persists across server restarts
8. **Error handling**: Graceful handling of malformed client messages, disconnection during operations
9. **Add test suite runner**: `pytest` configuration with CI-friendly output
10. **Rate limiting**: Prevent WebSocket message flooding

### Phase 3 — Gameplay Polish
11. **Workstation crafting**: Require proximity to workstation blocks for advanced recipes
12. **Tool durability**: Implement wear/break mechanics for tools and weapons
13. **Food consumption**: Hunger system with food healing/buffs
14. **NPC dialogue**: Implement actual dialogue trees and quest progression
15. **Mob behavior refinement**: Passive animals flee, pack behavior for wolves, territorial bears
16. **Day/night cycle**: Lighting changes, mob spawn rate variation

### Phase 4 — Design Document Systems (per mmo_game_systems_design_document.md)
17. **MaterialDefinition/MaterialInstance**: Replace static item IDs with property-based materials
18. **FormDefinition/FormInstance**: Separate substance from shape
19. **Assembly system**: Multi-part structures with joints, repair, degradation
20. **Bond/Fellowship system**: Social contracts, mutual aid, offices
21. **Sovereignty system**: Territorial claims, recognition, communal response

---

## Known Issues & TODOs (Legacy)

1. **Performance**: Optimize chunk rendering for large worlds
2. **Security**: Add validation for all client messages
3. **Persistence**: Save world state to database
4. **Creatures**: Add mob/NPC system with combat
5. **Crafting**: Implement crafting system
6. **Building**: More block types and building mechanics

## Testing Multiplayer
1. Start server
2. Open multiple browser tabs to http://localhost:8080
3. Join with different usernames
4. Test block breaking, item collection, and chest interaction
5. Verify item lock system with L key toggle

## Contributing
When adding features:
1. Update both server and client message types
2. Add appropriate error handling
3. Include debug logging
4. Test with multiple clients
5. Update this documentation
