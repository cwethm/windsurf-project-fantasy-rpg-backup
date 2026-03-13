# 3D Voxel MMO

A server-authoritative multiplayer voxel-based 3D MMO game built with Three.js (client) and Node.js (server).

## Features

### Core Architecture
- **Server-authoritative multiplayer** with client-server architecture
- **Real-time WebSocket communication** for player synchronization
- **Scalable chunk-based world system**

### World System
- **Voxel terrain** with 16x16x64 chunks
- **Procedural terrain generation** using noise functions
- **Infinite world** with chunk loading/unloading
- **Block placement and destruction** with real-time updates

### Player System
- **3D first-person perspective** with smooth controls
- **Physics integration** (gravity, collision detection)
- **Ambulatory movement** (walking, running, jumping)
- **Player state management** (position, health, inventory)

### Interaction System
- **Raycasting system** for block targeting
- **Proximity detection** (5-block interaction range)
- **Visual crosshair** with block highlighting
- **Left-click to break, right-click to place blocks**

### Inventory & Items
- **36-slot inventory** with hotbar display
- **Stackable items** (up to 64 per slot)
- **Multiple block types** (grass, dirt, stone, wood, leaves, water, sand)
- **Item selection** via number keys or clicking

### User Interface
- **HUD display** showing health, position, and player count
- **Crosshair targeting** system
- **Inventory hotbar** with visual feedback
- **Console messages** for game events
- **Login screen** with username entry

## Technology Stack

### Server
- **Python 3** with asyncio for WebSocket server
- **websockets** library for real-time communication
- **numpy** for efficient data handling
- **Custom voxel engine** with chunk management
- **Simple physics engine** for collision detection

### Client
- **Three.js** for 3D rendering and WebGL
- **WebSocket client** for server communication
- **Custom controls system** with pointer lock
- **Buffer geometry** for efficient voxel rendering

## Installation & Setup

### Prerequisites
- Python 3.8 or higher
- Modern web browser with WebGL support

### Installation

1. **Clone or setup the project:**
   ```bash
   # If starting from this template
   cd voxel-mmo
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the game servers:**
   ```bash
   # Start server
   python3 server.py
   
   # In another terminal, start client
   cd client && python3 -m http.server 8080
   ```

4. **Open your browser:**
   - Navigate to `http://localhost:8080`
   - Enter a username and join the game

## Game Controls

### Movement
- **W** - Move forward
- **S** - Move backward  
- **A** - Move left
- **D** - Move right
- **Space** - Jump (only when on ground)
- **Mouse** - Look around (click to lock pointer)

### Building & Interaction
- **Left Click** - Break targeted block
- **Right Click** - Place selected block
- **Number Keys (1-9)** - Select inventory slot
- **Click inventory slots** - Select items

### Camera
- **Click game window** - Lock mouse pointer for camera control
- **ESC** - Unlock mouse pointer

## Architecture Overview

### Server Structure
```
├── server.py          # Main server entry point
├── requirements.txt   # Python dependencies
└── (server classes)
    ├── VoxelServer   # Main server class
    ├── Player        # Player data and state
    ├── Inventory     # Player inventory management
    └── World         # Voxel world and chunk management
```

### Client Structure
```
client/
├── index.html        # Main game interface
├── js/
│   └── game.js       # Complete client game engine
└── (client classes)
    ├── VoxelGame     # Main game controller
    ├── Player        # Local player representation
    ├── World         # Client-side world rendering
    ├── Physics       # Physics simulation
    ├── Controls      # Input handling
    ├── Raycaster     # Block targeting system
    ├── Inventory     # Inventory UI and management
    └── UI            # User interface components
```

### Shared Types
```
shared/
└── types.py          # Shared constants and message types
```

## Network Protocol

### Message Types
- **JOIN** - Player joins the game
- **MOVE** - Player position/velocity update
- **JUMP** - Player jump action
- **PLACE_BLOCK** - Block placement
- **BREAK_BLOCK** - Block destruction
- **INTERACT** - Entity interaction
- **CHUNK_DATA** - World chunk data
- **WORLD_UPDATE** - Real-time world changes
- **PLAYER_JOIN/LEAVE** - Player connection events

## World Generation

The world uses **procedural generation** with sine wave-based height maps:
- **Base height**: 32 blocks
- **Terrain variation**: ±14 blocks using combined sine waves
- **Block layers**: Stone → Dirt → Grass (top layer)
- **Chunk size**: 16x16x64 blocks
- **Infinite generation**: Chunks generated on-demand

## Performance Features

### Client Optimizations
- **Frustum culling** - Only render visible chunks
- **Face culling** - Only render exposed block faces
- **Buffer geometry** - Efficient mesh rendering
- **Level of detail** - Simplified rendering at distance

### Server Optimizations
- **Chunk-based loading** - Only send nearby chunks
- **Delta updates** - Only send changed blocks
- **Rate limiting** - Position updates at 20 FPS
- **Efficient storage** - Flat array chunk format

## Development Roadmap

### MVP (Current)
- ✅ Basic voxel terrain
- ✅ Player movement and physics
- ✅ Block placement/destruction
- ✅ Multiplayer synchronization
- ✅ Inventory system
- ✅ Basic UI

### Future Features
- 🔄 Combat system
- 🔄 Crafting mechanics
- 🔄 Advanced biomes
- 🔄 Mobs and entities
- 🔄 Building tools
- 🔄 Persistence and saving
- 🔄 Authentication system
- 🔄 Server clusters
- 🔄 Advanced physics
- 🔄 Particle effects
- 🔄 Sound system

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for your own voxel game development!

## Troubleshooting

### Common Issues

**WebSocket connection failed:**
- Ensure server is running on port 3001
- Check for firewall blocking WebSocket connections
- Try refreshing the browser page

**Chunk not loading:**
- Check browser console for errors
- Verify server is sending chunk data
- Check network connection

**Performance issues:**
- Reduce render distance in client settings
- Close other browser tabs
- Check GPU acceleration is enabled

**Controls not working:**
- Click the game window to lock mouse pointer
- Check browser focus
- Verify JavaScript is enabled

For more help, check the browser console (F12) for error messages.
