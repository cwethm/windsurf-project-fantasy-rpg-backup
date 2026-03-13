const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const { MESSAGE_TYPES, BLOCK_TYPES, BIOME_TYPES, CHUNK_SIZE, CHUNK_HEIGHT } = require('../shared/types');

class VoxelServer {
  constructor() {
    this.port = 3000;
    this.clients = new Map();
    this.players = new Map();
    this.world = new World();
    this.setupExpress();
    this.setupWebSocket();
  }

  setupExpress() {
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    
    // Serve static files from client directory
    this.app.use(express.static(path.join(__dirname, '../client')));
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({ port: this.port + 1 });
    
    this.wss.on('connection', (ws) => {
      const clientId = uuidv4();
      console.log(`Client connected: ${clientId}`);
      
      this.clients.set(clientId, {
        ws,
        id: clientId,
        player: null
      });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(clientId, data);
        } catch (error) {
          console.error('Invalid message format:', error);
        }
      });

      ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        this.handleDisconnect(clientId);
      });
    });
  }

  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case MESSAGE_TYPES.JOIN:
        this.handleJoin(clientId, message.data);
        break;
      case MESSAGE_TYPES.MOVE:
        this.handleMove(clientId, message.data);
        break;
      case MESSAGE_TYPES.JUMP:
        this.handleJump(clientId);
        break;
      case MESSAGE_TYPES.PLACE_BLOCK:
        this.handlePlaceBlock(clientId, message.data);
        break;
      case MESSAGE_TYPES.BREAK_BLOCK:
        this.handleBreakBlock(clientId, message.data);
        break;
      case MESSAGE_TYPES.INTERACT:
        this.handleInteract(clientId, message.data);
        break;
    }
  }

  handleJoin(clientId, data) {
    const client = this.clients.get(clientId);
    const player = new Player(data.username, clientId);
    
    this.players.set(clientId, player);
    client.player = player;

    // Send initial chunks around player
    this.sendInitialChunks(clientId);

    // Notify other players
    this.broadcast(MESSAGE_TYPES.PLAYER_JOIN, {
      playerId: clientId,
      username: player.username,
      position: player.position
    }, clientId);

    // Send current game state
    this.sendToClient(clientId, MESSAGE_TYPES.GAME_STATE, {
      playerId: clientId,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        position: p.position
      }))
    });
  }

  handleMove(clientId, data) {
    const player = this.players.get(clientId);
    if (!player) return;

    player.position = data.position;
    player.velocity = data.velocity;

    this.broadcast(MESSAGE_TYPES.PLAYER_MOVE, {
      playerId: clientId,
      position: player.position,
      velocity: player.velocity
    }, clientId);
  }

  handleJump(clientId) {
    const player = this.players.get(clientId);
    if (!player) return;

    if (player.onGround) {
      player.velocity.y = 15; // Jump force
      player.onGround = false;
    }
  }

  handlePlaceBlock(clientId, data) {
    const { position, blockType } = data;
    const success = this.world.setBlock(position.x, position.y, position.z, blockType);
    
    if (success) {
      this.broadcast(MESSAGE_TYPES.WORLD_UPDATE, {
        action: 'place',
        position,
        blockType
      });
    }
  }

  handleBreakBlock(clientId, data) {
    const { position } = data;
    const blockType = this.world.getBlock(position.x, position.y, position.z);
    const success = this.world.setBlock(position.x, position.y, position.z, BLOCK_TYPES.AIR);
    
    if (success && blockType !== BLOCK_TYPES.AIR) {
      this.broadcast(MESSAGE_TYPES.WORLD_UPDATE, {
        action: 'break',
        position,
        blockType
      });
    }
  }

  handleInteract(clientId, data) {
    // Handle entity interaction, pickup items, etc.
    console.log(`Player ${clientId} interacting with:`, data);
  }

  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (client && client.player) {
      this.players.delete(clientId);
      this.broadcast(MESSAGE_TYPES.PLAYER_LEAVE, {
        playerId: clientId
      });
    }
    this.clients.delete(clientId);
  }

  sendInitialChunks(clientId) {
    const player = this.players.get(clientId);
    const chunkX = Math.floor(player.position.x / CHUNK_SIZE);
    const chunkZ = Math.floor(player.position.z / CHUNK_SIZE);
    
    // Send 3x3 chunk area around player
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        const chunk = this.world.getChunk(chunkX + x, chunkZ + z);
        this.sendToClient(clientId, MESSAGE_TYPES.CHUNK_DATA, {
          chunkX: chunkX + x,
          chunkZ: chunkZ + z,
          data: chunk
        });
      }
    }
  }

  sendToClient(clientId, type, data) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ type, data }));
    }
  }

  broadcast(type, data, excludeClientId = null) {
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({ type, data }));
      }
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`HTTP Server running on port ${this.port}`);
      console.log(`WebSocket Server running on port ${this.port + 1}`);
    });
  }
}

class Player {
  constructor(username, id) {
    this.id = id;
    this.username = username;
    this.position = { x: 0, y: 80, z: 0 }; // Start above ground
    this.velocity = { x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0 };
    this.onGround = false;
    this.health = 100;
    this.inventory = new Inventory();
  }
}

class Inventory {
  constructor() {
    this.slots = Array(36).fill(null);
    this.selectedSlot = 0;
  }

  addItem(item) {
    // Find first empty slot or stack with existing items
    for (let i = 0; i < this.slots.length; i++) {
      if (!this.slots[i]) {
        this.slots[i] = { ...item, count: 1 };
        return true;
      } else if (this.slots[i].type === item.type && this.slots[i].count < 64) {
        this.slots[i].count++;
        return true;
      }
    }
    return false;
  }

  removeItem(slot, count = 1) {
    if (this.slots[slot]) {
      this.slots[slot].count -= count;
      if (this.slots[slot].count <= 0) {
        this.slots[slot] = null;
      }
      return true;
    }
    return false;
  }
}

class World {
  constructor() {
    this.chunks = new Map();
    this.generateInitialWorld();
  }

  generateInitialWorld() {
    // Generate some initial chunks around spawn
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        this.generateChunk(x, z);
      }
    }
  }

  generateChunk(chunkX, chunkZ) {
    const chunkKey = `${chunkX},${chunkZ}`;
    const chunk = new Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    
    // Simple terrain generation
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;
        
        // Simple height map using sine waves
        const height = Math.floor(
          32 + 
          8 * Math.sin(worldX * 0.1) + 
          4 * Math.cos(worldZ * 0.15) +
          2 * Math.sin((worldX + worldZ) * 0.05)
        );
        
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const index = this.getBlockIndex(x, y, z);
          
          if (y < height - 3) {
            chunk[index] = BLOCK_TYPES.STONE;
          } else if (y < height) {
            chunk[index] = BLOCK_TYPES.DIRT;
          } else if (y === height) {
            chunk[index] = BLOCK_TYPES.GRASS;
          } else {
            chunk[index] = BLOCK_TYPES.AIR;
          }
        }
      }
    }
    
    this.chunks.set(chunkKey, chunk);
    return chunk;
  }

  getChunk(chunkX, chunkZ) {
    const chunkKey = `${chunkX},${chunkZ}`;
    if (!this.chunks.has(chunkKey)) {
      return this.generateChunk(chunkX, chunkZ);
    }
    return this.chunks.get(chunkKey);
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK_TYPES.AIR;
    
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    const chunk = this.getChunk(chunkX, chunkZ);
    const index = this.getBlockIndex(localX, y, localZ);
    
    return chunk[index];
  }

  setBlock(x, y, z, blockType) {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    const chunk = this.getChunk(chunkX, chunkZ);
    const index = this.getBlockIndex(localX, y, localZ);
    
    chunk[index] = blockType;
    return true;
  }

  getBlockIndex(x, y, z) {
    return y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
  }
}

// Start the server
const server = new VoxelServer();
server.start();
