# Voxel MMO - Development Tutorial

## Table of Contents
1. [Getting Started](#getting-started)
2. [Basic Development Workflow](#basic-development-workflow)
3. [Understanding the Architecture](#understanding-the-architecture)
4. [Adding New Content](#adding-new-content)
5. [Chat Commands Guide](#chat-commands-guide)
6. [World Generation Tutorial](#world-generation-tutorial)
7. [Testing Your Changes](#testing-your-changes)
8. [Common Debugging Techniques](#common-debugging-techniques)
9. [Contributing Guidelines](#contributing-guidelines)

## Getting Started

### Prerequisites
- Python 3.8+ installed
- Modern web browser (Chrome/Firefox recommended)
- Text editor (VS Code recommended)
- Git for version control

### Initial Setup
```bash
# Clone the repository
git clone <repository-url>
cd windsurf-project-fantasy-rpg-backup

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Running the Game

#### 1. Start the Server
```bash
python server.py
```
The server will start on `ws://localhost:3001` and display:
```
Voxel MMO Server started on ws://localhost:3001
WebSocket server started on port 3001
HTTP server for client files on port 3001
```

#### 2. Start the Client (in a new terminal)
```bash
cd client
python3 -m http.server 8080
```

#### 3. Play the Game
Open your browser and go to `http://localhost:8080`
- Enter a username to join
- Press ESC to close the welcome screen
- Use WASD to move, mouse to look around

## Basic Development Workflow

### 1. Make Your Changes
Edit the appropriate files:
- Server logic: `server.py`
- Client logic: `client/js/game.js`
- World generation: `worldgen/` directory
- Assets: `client/assets/` directory

### 2. Test Your Changes
- Refresh the browser (Ctrl+F5 for hard refresh)
- Check the browser console (F12) for errors
- Check the server terminal for error messages

### 3. Debugging
```bash
# For server debugging, run with verbose logging
python server.py 2>&1 | tee server.log

# For client debugging, open browser dev tools (F12)
# Check Console tab for JavaScript errors
# Check Network tab for WebSocket messages
```

## Understanding the Architecture

### Server-Side (Python)
```
server.py                 # Main server class, handles connections
├── VoxelServer          # WebSocket server, message routing
├── Player               # Player state, inventory, position
├── World                # Chunk management, terrain generation
├── Container            # Chest/container logic
└── Database             # SQLite persistence

worldgen/                # World generation system
├── world_generator.py   # Main generator orchestrator
├── layers/             # Generation layers
│   ├── base_height.py  # Terrain elevation
│   ├── biome.py        # Biome assignment
│   ├── climate.py      # Temperature/moisture
│   ├── sites.py        # Ruins/villages/forts
│   └── ...
├── placement/          # Prefab/room placement
└── content/           # Schematics and prefabs
```

### Client-Side (JavaScript)
```
client/js/game.js       # Main game controller
├── VoxelGame          # Game loop, rendering
├── Player             # Local player control
├── World              # Chunk rendering
├── Physics            # Gravity, collisions
├── Controls           # Input handling
├── Inventory          # UI management
└── UI                 # HUD, menus
```

### Communication Flow
```
Client (JavaScript)  <--WebSocket-->  Server (Python)
      JSON Messages                     Message Handlers
```

## Adding New Content

### Adding a New Block Type

1. **Server Side** (`server.py`):
```python
# Add to BLOCK_TYPES
BLOCK_TYPES = {
    # ... existing blocks ...
    'MY_BLOCK': 99,  # Use next available ID
}

# Add to BLOCK_HARDNESS if mineable
BLOCK_HARDNESS = {
    # ... existing blocks ...
    'MY_BLOCK': 2.0,  # Seconds to mine
}

# Add to BLOCK_DROPS if it drops items
BLOCK_DROPS = {
    # ... existing blocks ...
    'MY_BLOCK': [('MY_ITEM', 1.0)],  # 100% chance to drop MY_ITEM
}
```

2. **Client Side** (`client/js/game.js`):
```javascript
// Add to BLOCK_TYPES
const BLOCK_TYPES = {
    // ... existing blocks ...
    99: 'MY_BLOCK',
};

// Add color in getBlockColor()
getBlockColor(blockType) {
    switch(blockType) {
        // ... existing cases ...
        case 99: return new THREE.Color(0x808080); // Gray
    }
}
```

### Adding a New Item Type

1. **Server Side** (`server.py`):
```python
# Add to ITEM_TYPES
ITEM_TYPES = {
    # ... existing items ...
    'MY_ITEM': 999,
}

# Add to ITEM_NAMES
ITEM_NAMES = {
    # ... existing items ...
    999: 'My Item',
}

# Set stack size
ITEM_MAX_STACK = {
    # ... existing items ...
    999: 64,
}
```

2. **Client Side** (`client/js/game.js`):
```javascript
// Add to ITEM_TYPES and ITEM_NAMES
const ITEM_TYPES = { /* ... */ };
const ITEM_NAMES = { /* ... */ };

// Add color for floating items
const ITEM_COLORS = {
    // ... existing items ...
    999: 0x808080,
};
```

### Adding a New Crafting Recipe

In `server.py`, find the `CRAFTING_RECIPES` dictionary:
```python
CRAFTING_RECIPES = {
    # ... existing recipes ...
    'my_recipe': {
        'ingredients': [
            ('WOOD', 2),
            ('STONE', 1),
        ],
        'result': ('MY_ITEM', 1),
        'tier': 'apprentice',  # or 'journeyman' or 'master'
    },
}
```

## Chat Commands Guide

### Built-in Commands

Players can type these in the chat input (press T to open chat):

#### `/help`
Shows available commands

#### `/ruinsloot [radius] [verbose]`
Debug command to inspect ruins loot generation
- `radius`: Search radius in chunks (default: 10)
- `verbose`: Show detailed loot contents (default: false)

Examples:
```
/ruinsloot
/ruinsloot 20
/ruinsloot 20 true
```

#### `/whisper <username> <message>`
Send a private message to another player

#### `/time`
Shows current world time

### Creating New Commands

1. **Server Side** (`server.py`):
```python
# In handle_chat_message method
if message.startswith('/mycommand'):
    args = message[11:].strip().split()
    # Handle command logic
    await self.send_message(client_id, MESSAGE_TYPES['CHAT_MESSAGE'], {
        'type': 'system',
        'message': 'Command executed!'
    })
```

2. **Client Side** (`client/js/game.js`):
```javascript
// In handleChatInput method
if (message.startsWith('/mycommand')) {
    // Send to server for processing
    this.sendMessage('CHAT_MESSAGE', {
        type: 'chat',
        message: message
    });
    return;
}
```

## World Generation Tutorial

### Understanding the Generation Pipeline

World generation happens in layers:
1. **Base Height** - Creates terrain elevation
2. **Climate** - Generates temperature and moisture
3. **Biome** - Assigns biome types based on climate
4. **Surface Material** - Places ground blocks
5. **Flora** - Spawns trees and plants
6. **Resources** - Places ore veins
7. **Roads** - Generates paths between sites
8. **Sites** - Places ruins, villages, forts

### Creating a New Site Type

1. **Add Site Type** (`worldgen/layers/sites.py`):
```python
class SiteType(Enum):
    # ... existing types ...
    MY_SITE = 'my_site'
```

2. **Add to Biome Selection**:
```python
def _get_possible_sites_for_biome(self, biome: BiomeType):
    biome_sites = {
        # ... existing biomes ...
        BiomeType.FOREST: [SiteType.HAMLET, SiteType.RUINS, SiteType.MY_SITE],
    }
```

3. **Create Prefab** (`worldgen/content/schematics/my_site.json`):
```json
{
  "id": "my_site",
  "category": "site",
  "site_types": ["my_site"],
  "size": [5, 3, 5],
  "origin": [2, 0, 2],
  "blocks": [
    { "x": 0, "y": 0, "z": 0, "id": 30 },
    { "x": 1, "y": 0, "z": 0, "id": 30 },
    // ... more blocks ...
  ],
  "tags": ["my_tag"]
}
```

4. **Register Prefab** (`worldgen/content/prefabs/site_prefabs.json`):
```json
{
  "prefabs": [
    // ... existing prefabs ...
    {
      "id": "my_site",
      "file": "schematics/my_site.json",
      "weight": 10,
      "biomes": ["forest"],
      "rarity": "common"
    }
  ]
}
```

### Creating Room Assemblies

For dungeons and interiors:

1. **Create Room Schematics** (`worldgen/content/rooms/`):
```json
{
  "id": "my_room",
  "size": [5, 3, 5],
  "origin": [2, 0, 2],
  "blocks": [
    // Room blocks
  ],
  "connectors": [
    {
      "position": [2, 1, 0],
      "direction": "north",
      "type": "door"
    }
  ]
}
```

2. **Add to Main Schematic**:
```json
{
  "room_assembly": {
    "room_ids": ["my_room", "my_hall", "my_chamber"],
    "start_room_id": "my_room",
    "room_count": 3,
    "connector_types": ["door", "hall"]
  }
}
```

## Testing Your Changes

### Running Tests

```bash
# Run all tests
python -m pytest tests/

# Run specific test file
python -m pytest tests/test_mob.py

# Run with verbose output
python -m pytest -v tests/

# Run coverage report
python -m pytest --cov=server tests/
```

### Acceptance Testing

For world generation features, use the acceptance test framework:

#### Phase 4 Acceptance Test
Validates ruins generation and loot system:
```bash
# Run Phase 4 acceptance test
python phase4_acceptance_test_fixed.py
```

This will:
- Scan 2500 chunks in a spiral pattern
- Locate ruins spawn markers
- Validate loot tier assignment (ancient_common, ancient_guarded, ancient_relic)
- Check chest placement and loot filling
- Report pass/fail status with detailed statistics

#### Creating Custom Acceptance Tests
```python
# Create new acceptance test
def my_acceptance_test():
    generator = WorldGenerator(world_seed="test_seed")
    stats = {"feature_found": 0}
    
    # Scan chunks
    for chunk_x, chunk_z in spiral_scan_chunks(0, 0, 20):
        result = generator.generate_chunk(chunk_x, chunk_z)
        # Check for your feature
        
    # Report results
    print(f"Feature found in {stats['feature_found']} chunks")
```

### Validation Tools

The project includes validation tools for content:

#### Prefab Validation
Ensures all prefabs and room schematics are valid:
```bash
# Validate all prefabs and schematics
python tools/validate_prefabs.py
```

This checks:
- Required fields are present
- Referenced room schematics exist
- Block IDs are valid
- Connectors have correct format

#### JSON Schema Validation
Schemas are provided in `worldgen/content/schemas/`:
- `prefab.schema.json` - For building prefabs
- `room_schematic.schema.json` - For room modules
- `site_prefab.schema.json` - For site definitions

Use VS Code with JSON Schema extension for auto-validation.

### Manual Testing Checklist

When adding new features:
- [ ] Server starts without errors
- [ ] Client connects successfully
- [ ] Feature works in single-player
- [ ] Feature works with multiple players
- [ ] No console errors
- [ ] Performance is acceptable
- [ ] Feature persists on reconnect

## Common Debugging Techniques

### Server Debugging

1. **Enable Verbose Logging**:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

2. **Add Debug Prints**:
```python
print(f"DEBUG: Player {player.username} at {player.position}")
```

3. **Check Database**:
```bash
sqlite3 voxel_mmo.db
.tables
SELECT * FROM players;
```

### Client Debugging

1. **Open Dev Tools** (F12):
   - Console: JavaScript errors
   - Network: WebSocket messages
   - Performance: Frame rate

2. **Add Debug Logs**:
```javascript
console.log('DEBUG:', data);
```

3. **Visual Debugging**:
```javascript
// Show chunk boundaries
if (this.debugMode) {
    this.drawChunkBorders();
}
```

### Common Issues

#### "Player not visible to others"
- Check mesh frustumCulled setting
- Verify position sync format
- Check wrapper group transform

#### "Blocks not saving"
- Check database connection
- Verify chunk save method
- Check for NOT NULL constraints

#### "High latency"
- Check message frequency
- Optimize chunk updates
- Reduce broadcast radius

## Contributing Guidelines

### Code Style

#### Python (Server)
- Follow PEP 8
- Use 4 spaces for indentation
- Maximum line length: 100 characters
- Docstrings for all classes and methods

#### JavaScript (Client)
- Use camelCase for variables
- Use PascalCase for classes
- Maximum line length: 100 characters
- JSDoc comments for functions

### Git Workflow

1. **Create a branch**:
```bash
git checkout -b feature/my-new-feature
```

2. **Make changes**:
```bash
# Make your changes
git add .
git commit -m "feat: Add my new feature"
```

3. **Push and create PR**:
```bash
git push origin feature/my-new-feature
# Create pull request on GitHub
```

### Commit Message Format

```
type(scope): description

feat: Add new feature
fix: Fix bug in player movement
docs: Update tutorial
refactor: Optimize chunk generation
test: Add tests for inventory
```

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No console errors
- [ ] Feature works as expected

### Getting Help

- Check the console for error messages
- Look at existing code for similar patterns
- Ask questions in the project discussions
- Check the DEVELOPMENT.md for technical details

## Quick Reference

### Useful Commands
```bash
# Start server
python server.py

# Start client
cd client && python3 -m http.server 8080

# Run tests
python -m pytest tests/

# Validate prefabs
python tools/validate_prefabs.py

# Run acceptance test
python phase4_acceptance_test_fixed.py
```

### Important Files
- `server.py` - Main server code
- `client/js/game.js` - Main client code
- `DEVELOPMENT.md` - Technical documentation
- `shared/constants.py` - Shared constants
- `worldgen/` - World generation code
- `tests/` - Test suite

### Common Tasks
- Add block: Update BLOCK_TYPES in server and client
- Add item: Update ITEM_TYPES in server and client
- Add recipe: Add to CRAFTING_RECIPES
- Add site: Create schematic and register in site_prefabs.json
- Debug: Check browser console and server terminal

Happy coding! 🎮
