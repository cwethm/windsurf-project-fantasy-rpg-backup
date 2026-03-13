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

## Known Issues & TODOs

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
