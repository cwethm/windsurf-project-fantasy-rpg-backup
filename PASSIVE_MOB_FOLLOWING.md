# Passive Mob Following System

## Overview

Passive mobs (deer, sheep, cow, rabbit, chicken) can now follow players when interacted with via right-click. This feature allows players to lead animals around the world.

## Features

### Passive Mobs
The following mobs can be made to follow:
- 🦌 **Deer** - Fast, skittish
- 🐑 **Sheep** - Provides wool
- 🐄 **Cow** - Provides milk and leather
- 🐰 **Rabbit** - Small and quick
- 🐔 **Chicken** - Provides eggs and feathers

### Hostile Mobs
These mobs **cannot** be made to follow (they will attack instead):
- Zombie, Skeleton, Goblin, Slime, Spider
- Troll, Wolf, Bear, Boar

## How to Use

### Making a Mob Follow
1. Get close to a passive mob (within 6 blocks)
2. **Right-click** on the mob
3. The mob will display a message: "Sheep is now following you"
4. The mob will follow you, staying about 3 blocks away

### Stopping a Mob from Following
1. **Right-click** the same mob again
2. The mob will display: "Sheep stopped following you"
3. The mob returns to idle wandering

## Technical Details

### Server-Side Implementation

**Mob Class Methods:**
```python
def follow(self, player_id: str)
    """Set mob to follow a specific player"""
    
def unfollow(self)
    """Stop following player"""
    
def is_passive(self) -> bool
    """Check if mob is passive (0 damage)"""
```

**AI Behavior:**
- Passive mobs with `follow_target_id` enter "following" state
- Mobs move toward player when distance > 3 blocks
- Mobs stop moving when within follow distance
- Following stops if player dies or disconnects
- Mob-to-mob collision avoidance still applies

**Message Types:**
- `MOB_INTERACT` - Client → Server (right-click on mob)
- `MOB_MOVE` - Server → Clients (includes `followTargetId`)

### Client-Side Implementation

**Right-Click Detection:**
```javascript
handleRightClickDown(event) {
  // Check for mob interaction first
  const enemyTarget = this.raycaster.getTargetEnemy(this.camera, this);
  if (enemyTarget && enemyTarget.enemy) {
    this.socket.send(JSON.stringify({
      type: MESSAGE_TYPES.MOB_INTERACT,
      data: { mobId: enemyTarget.enemy.id }
    }));
    return;
  }
  // ... rest of right-click handling
}
```

### Mob States
- `idle` - Default state, no target
- `following` - Following a player
- `chasing` - Hostile mob pursuing player (hostile only)
- `attacking` - Hostile mob in combat (hostile only)
- `dead` - Mob corpse

## Configuration

### Follow Distance
Default: **3.0 blocks**
```python
self.follow_distance = 3.0  # Distance to maintain when following
```

### Interaction Range
Maximum distance to interact: **6.0 blocks** (MAX_REACH_DISTANCE)

### Movement Speed
Each mob type has its own speed:
- Deer: 6.0 blocks/second (fastest)
- Rabbit: 4.0 blocks/second
- Sheep: 2.0 blocks/second
- Chicken: 2.5 blocks/second
- Cow: 2.0 blocks/second

## Testing

### Unit Tests
Run the follow system tests:
```bash
./run_tests.sh tests.test_mob_follow
```

**Test Coverage (18 tests):**
- ✅ Follow/unfollow methods
- ✅ Passive mob identification
- ✅ Following movement behavior
- ✅ Stop when within distance
- ✅ Unfollow on player death/disconnect
- ✅ Hostile mobs ignore follow
- ✅ Right-click interaction
- ✅ Distance validation

### Manual Testing Checklist
- [ ] Right-click passive mob to make it follow
- [ ] Mob follows player movement
- [ ] Mob stops when close enough
- [ ] Right-click again to stop following
- [ ] Multiple mobs can follow same player
- [ ] Mob stops following when player dies
- [ ] Hostile mobs cannot be made to follow
- [ ] Interaction respects 6-block range

## Known Limitations

1. **No Y-axis pathfinding** - Mobs only follow on X/Z plane
2. **No obstacle avoidance** - Mobs move in straight line
3. **No stuck detection** - Following mobs can get stuck behind walls
4. **Single target** - Each mob can only follow one player at a time
5. **No persistence** - Follow state resets on server restart

## Future Enhancements

### Planned Features
- [ ] Leash/rope item to tether mobs
- [ ] Mob breeding when multiple followers are close
- [ ] Feed mobs to increase follow duration
- [ ] Mob homes/pens that mobs return to
- [ ] Pathfinding around obstacles
- [ ] Y-axis following (climbing/descending)

### Possible Additions
- [ ] Mob loyalty system (follow time increases bond)
- [ ] Mob commands (sit, stay, come)
- [ ] Mob inventory (carry items)
- [ ] Mob naming system
- [ ] Visual indicator for following state (particle effect)

## Code Structure

### Files Modified
1. **`shared/constants.py`**
   - Added `MOB_INTERACT` message type

2. **`server.py`**
   - `Mob` class: Added `follow()`, `unfollow()`, `is_passive()` methods
   - `Mob.__init__`: Added `follow_target_id`, `follow_distance` attributes
   - `MobManager._tick_mob()`: Added following behavior logic
   - `MobManager._apply_mob_collision()`: Extracted collision code
   - `VoxelServer.handle_mob_interact()`: New handler for mob interactions

3. **`client/js/game.js`**
   - Added `MOB_INTERACT` to MESSAGE_TYPES
   - `handleRightClickDown()`: Added mob interaction check

4. **`tests/test_mob_follow.py`**
   - New test file with 18 comprehensive tests

## API Reference

### Server Message: MOB_INTERACT
**Direction:** Client → Server

**Payload:**
```json
{
  "type": "mob_interact",
  "data": {
    "mobId": "mob_123"
  }
}
```

**Response:** 
- `CHAT_SYSTEM` message with follow status
- `MOB_MOVE` broadcast with updated state

### Server Message: MOB_MOVE (Enhanced)
**Direction:** Server → Clients

**Payload:**
```json
{
  "type": "mob_move",
  "data": {
    "mobId": "mob_123",
    "position": [x, y, z],
    "state": "following",
    "followTargetId": "player_456"
  }
}
```

## Troubleshooting

### Mob Won't Follow
- **Check distance:** Must be within 6 blocks
- **Check mob type:** Only passive mobs can follow
- **Check mob state:** Dead mobs cannot follow

### Mob Stops Following
- **Player died:** Following stops on player death
- **Player disconnected:** Following stops on disconnect
- **Too far away:** Mob may have been left behind

### Multiple Mobs Following
- Each mob tracks its own follow target
- Multiple mobs can follow the same player
- No limit on number of followers per player

## Performance Considerations

- Following mobs update every 0.35 seconds (tick_dt)
- Broadcasts throttled to 0.3 second intervals
- Collision detection runs for all nearby mobs
- No significant performance impact with <60 mobs

## Version History

- **v1.0** (2026-03-21) - Initial implementation
  - Basic follow/unfollow functionality
  - Right-click interaction
  - Passive mob detection
  - 18 unit tests

---

**Status:** ✅ Implemented and Tested  
**Last Updated:** 2026-03-21  
**Test Coverage:** 18/18 tests passing
