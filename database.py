import sqlite3
import json
import threading
import time
import uuid
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)

class Database:
    def __init__(self, db_path: str = 'voxel_mmo.db'):
        self.db_path = db_path
        self.lock = threading.Lock()
        self._init_database()
    
    def _init_database(self):
        """Initialize database tables"""
        with sqlite3.connect(self.db_path) as conn:
            # Users table for authentication
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1,
                    is_banned BOOLEAN DEFAULT 0,
                    ban_reason TEXT
                )
            """)
            
            # Sessions table for active sessions
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    ip_address TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS players (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    username TEXT NOT NULL,
                    position_x REAL DEFAULT 0,
                    position_y REAL DEFAULT 0,
                    position_z REAL DEFAULT 0,
                    inventory TEXT DEFAULT '[]',
                    health INTEGER DEFAULT 100,
                    level INTEGER DEFAULT 1,
                    experience INTEGER DEFAULT 0,
                    last_login TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS world_chunks (
                    chunk_x INTEGER,
                    chunk_z INTEGER,
                    data BLOB,
                    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (chunk_x, chunk_z)
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS item_entities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    position_x REAL,
                    position_y REAL,
                    position_z REAL,
                    item_type INTEGER,
                    harvester_id TEXT,
                    spawn_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS player_stats (
                    player_id TEXT PRIMARY KEY,
                    blocks_placed INTEGER DEFAULT 0,
                    blocks_broken INTEGER DEFAULT 0,
                    items_collected INTEGER DEFAULT 0,
                    distance_traveled REAL DEFAULT 0,
                    play_time INTEGER DEFAULT 0
                )
            """)
            
            # Migrate existing players table: make user_id nullable
            try:
                cursor = conn.execute("PRAGMA table_info(players)")
                columns = {row[1]: row for row in cursor.fetchall()}
                if 'user_id' in columns and columns['user_id'][3] == 1:  # notnull=1
                    conn.execute("""
                        CREATE TABLE IF NOT EXISTS players_new (
                            id TEXT PRIMARY KEY,
                            user_id TEXT,
                            username TEXT NOT NULL,
                            position_x REAL DEFAULT 0,
                            position_y REAL DEFAULT 0,
                            position_z REAL DEFAULT 0,
                            inventory TEXT DEFAULT '[]',
                            health INTEGER DEFAULT 100,
                            level INTEGER DEFAULT 1,
                            experience INTEGER DEFAULT 0,
                            last_login TIMESTAMP,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES users (id)
                        )
                    """)
                    conn.execute("INSERT OR IGNORE INTO players_new SELECT * FROM players")
                    conn.execute("DROP TABLE players")
                    conn.execute("ALTER TABLE players_new RENAME TO players")
                    logger.info("Migrated players table: user_id is now nullable")
            except Exception as e:
                logger.warning(f"Players table migration check: {e}")

            conn.commit()
    
    def save_player(self, player_id: str, username: str, position: Dict, inventory: List, health: int = 100, user_id: str = None):
        """Save player data to database"""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute("""
                        INSERT OR REPLACE INTO players 
                        (id, user_id, username, position_x, position_y, position_z, inventory, health, last_login)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (player_id, user_id or player_id, username, position['x'], position['y'], position['z'], 
                          json.dumps(inventory), health, time.time()))
                    conn.commit()
            except Exception as e:
                logger.error(f"Failed to save player {player_id}: {e}")
    
    def load_player(self, player_id: str) -> Optional[Dict]:
        """Load player data from database"""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.row_factory = sqlite3.Row
                    cursor = conn.execute(
                        "SELECT * FROM players WHERE id = ?", (player_id,)
                    )
                    row = cursor.fetchone()
                    
                    if row:
                        return {
                            'id': row['id'],
                            'username': row['username'],
                            'position': {'x': row['position_x'], 'y': row['position_y'], 'z': row['position_z']},
                            'inventory': json.loads(row['inventory']),
                            'health': row['health'],
                            'level': row['level'],
                            'experience': row['experience']
                        }
            except Exception as e:
                logger.error(f"Failed to load player {player_id}: {e}")
        return None
    
    def save_chunk(self, chunk_x: int, chunk_z: int, chunk_data: List[int]):
        """Save chunk data to database"""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    # Convert chunk data to bytes for efficient storage
                    data_bytes = bytes(chunk_data)
                    conn.execute("""
                        INSERT OR REPLACE INTO world_chunks (chunk_x, chunk_z, data, last_modified)
                        VALUES (?, ?, ?, ?)
                    """, (chunk_x, chunk_z, data_bytes, time.time()))
                    conn.commit()
            except Exception as e:
                logger.error(f"Failed to save chunk ({chunk_x}, {chunk_z}): {e}")
    
    def load_chunk(self, chunk_x: int, chunk_z: int) -> Optional[List[int]]:
        """Load chunk data from database"""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute(
                        "SELECT data FROM world_chunks WHERE chunk_x = ? AND chunk_z = ?",
                        (chunk_x, chunk_z)
                    )
                    row = cursor.fetchone()
                    
                    if row and row[0]:
                        # Convert bytes back to list of integers
                        return list(row[0])
            except Exception as e:
                logger.error(f"Failed to load chunk ({chunk_x}, {chunk_z}): {e}")
        return None
    
    def save_item_entities(self, entities: List[Dict]):
        """Save all item entities to database"""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    # Clear existing entities
                    conn.execute("DELETE FROM item_entities")
                    
                    # Insert all entities
                    for entity in entities:
                        conn.execute("""
                            INSERT INTO item_entities 
                            (position_x, position_y, position_z, item_type, harvester_id, spawn_time)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (
                            entity['position']['x'],
                            entity['position']['y'],
                            entity['position']['z'],
                            entity['type'],
                            entity.get('harvester_id'),
                            entity.get('spawn_time', time.time())
                        ))
                    
                    conn.commit()
            except Exception as e:
                logger.error(f"Failed to save item entities: {e}")
    
    def load_item_entities(self) -> List[Dict]:
        """Load all item entities from database"""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.row_factory = sqlite3.Row
                    cursor = conn.execute("SELECT * FROM item_entities")
                    
                    entities = []
                    for row in cursor.fetchall():
                        entities.append({
                            'position': {
                                'x': row['position_x'],
                                'y': row['position_y'],
                                'z': row['position_z']
                            },
                            'type': row['item_type'],
                            'harvester_id': row['harvester_id'],
                            'spawn_time': row['spawn_time']
                        })
                    
                    return entities
            except Exception as e:
                logger.error(f"Failed to load item entities: {e}")
        return []
    
    def update_player_stats(self, player_id: str, stats: Dict):
        """Update player statistics"""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute("""
                        INSERT OR REPLACE INTO player_stats
                        (player_id, blocks_placed, blocks_broken, items_collected, distance_traveled, play_time)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        player_id,
                        stats.get('blocks_placed', 0),
                        stats.get('blocks_broken', 0),
                        stats.get('items_collected', 0),
                        stats.get('distance_traveled', 0),
                        stats.get('play_time', 0)
                    ))
                    conn.commit()
            except Exception as e:
                logger.error(f"Failed to update player stats for {player_id}: {e}")
    
    def get_player_stats(self, player_id: str) -> Dict:
        """Get player statistics"""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.row_factory = sqlite3.Row
                    cursor = conn.execute(
                        "SELECT * FROM player_stats WHERE player_id = ?",
                        (player_id,)
                    )
                    row = cursor.fetchone()
                    
                    if row:
                        return {
                            'blocks_placed': row['blocks_placed'],
                            'blocks_broken': row['blocks_broken'],
                            'items_collected': row['items_collected'],
                            'distance_traveled': row['distance_traveled'],
                            'play_time': row['play_time']
                        }
            except Exception as e:
                logger.error(f"Failed to get player stats for {player_id}: {e}")
        
        return {
            'blocks_placed': 0,
            'blocks_broken': 0,
            'items_collected': 0,
            'distance_traveled': 0,
            'play_time': 0
        }
    
    # Authentication methods
    def create_user(self, username: str, password: str, email: str = None) -> Optional[str]:
        """Create a new user account"""
        import secrets
        import hashlib
        
        user_id = str(uuid.uuid4())
        salt = secrets.token_hex(32)
        
        # Hash password with salt
        password_hash = hashlib.pbkdf2_hmac('sha256', 
                                          password.encode('utf-8'), 
                                          salt.encode('utf-8'), 
                                          100000).hex()
        
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute("""
                        INSERT INTO users (id, username, email, password_hash, salt)
                        VALUES (?, ?, ?, ?, ?)
                    """, (user_id, username, email, password_hash, salt))
                    conn.commit()
                    return user_id
            except sqlite3.IntegrityError as e:
                logger.error(f"Failed to create user {username}: {e}")
                return None
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict]:
        """Authenticate user with username and password"""
        import hashlib
        
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.row_factory = sqlite3.Row
                    cursor = conn.execute(
                        "SELECT * FROM users WHERE username = ? AND is_active = 1",
                        (username,)
                    )
                    user = cursor.fetchone()
                    
                    if not user:
                        return None
                    
                    # Verify password
                    password_hash = hashlib.pbkdf2_hmac('sha256',
                                                      password.encode('utf-8'),
                                                      user['salt'].encode('utf-8'),
                                                      100000).hex()
                    
                    if password_hash != user['password_hash']:
                        return None
                    
                    # Update last login
                    conn.execute(
                        "UPDATE users SET last_login = ? WHERE id = ?",
                        (time.time(), user['id'])
                    )
                    conn.commit()
                    
                    return {
                        'id': user['id'],
                        'username': user['username'],
                        'email': user['email'],
                        'is_banned': bool(user['is_banned']),
                        'ban_reason': user['ban_reason']
                    }
            except Exception as e:
                logger.error(f"Authentication error for {username}: {e}")
                return None
    
    def create_session(self, user_id: str, ip_address: str = None, duration_hours: int = 24) -> str:
        """Create a new session for authenticated user"""
        import secrets
        
        session_id = secrets.token_urlsafe(32)
        expires_at = time.time() + (duration_hours * 3600)
        
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute("""
                        INSERT INTO sessions (session_id, user_id, expires_at, ip_address)
                        VALUES (?, ?, ?, ?)
                    """, (session_id, user_id, expires_at, ip_address))
                    conn.commit()
                    return session_id
            except Exception as e:
                logger.error(f"Failed to create session for user {user_id}: {e}")
                return None
    
    def validate_session(self, session_id: str) -> Optional[Dict]:
        """Validate session and return user info"""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.row_factory = sqlite3.Row
                    cursor = conn.execute("""
                        SELECT s.*, u.username, u.email, u.is_banned, u.ban_reason
                        FROM sessions s
                        JOIN users u ON s.user_id = u.id
                        WHERE s.session_id = ? AND s.expires_at > ? AND u.is_active = 1
                    """, (session_id, time.time()))
                    
                    session = cursor.fetchone()
                    if session:
                        return {
                            'user_id': session['user_id'],
                            'username': session['username'],
                            'email': session['email'],
                            'is_banned': bool(session['is_banned']),
                            'ban_reason': session['ban_reason']
                        }
                    return None
            except Exception as e:
                logger.error(f"Session validation error: {e}")
                return None
    
    def revoke_session(self, session_id: str) -> bool:
        """Revoke a session"""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute(
                        "DELETE FROM sessions WHERE session_id = ?",
                        (session_id,)
                    )
                    conn.commit()
                    return cursor.rowcount > 0
            except Exception as e:
                logger.error(f"Failed to revoke session: {e}")
                return False
    
    def cleanup_expired_sessions(self):
        """Remove expired sessions"""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute(
                        "DELETE FROM sessions WHERE expires_at < ?",
                        (time.time(),)
                    )
                    conn.commit()
                    if cursor.rowcount > 0:
                        logger.info(f"Cleaned up {cursor.rowcount} expired sessions")
            except Exception as e:
                logger.error(f"Failed to cleanup expired sessions: {e}")
    
    def cleanup_old_item_entities(self, max_age_seconds: int = 300):
        """Remove item entities older than specified age (default 5 minutes)"""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    cutoff_time = time.time() - max_age_seconds
                    cursor = conn.execute(
                        "DELETE FROM item_entities WHERE spawn_time < ?",
                        (cutoff_time,)
                    )
                    conn.commit()
                    if cursor.rowcount > 0:
                        logger.info(f"Cleaned up {cursor.rowcount} old item entities")
                    return cursor.rowcount
            except Exception as e:
                logger.error(f"Failed to cleanup old item entities: {e}")
                return 0
    
    def get_item_entity_count(self) -> int:
        """Get total count of item entities in database"""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute("SELECT COUNT(*) FROM item_entities")
                    return cursor.fetchone()[0]
            except Exception as e:
                logger.error(f"Failed to get item entity count: {e}")
                return 0
