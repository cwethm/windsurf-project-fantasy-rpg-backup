# Player Visibility Debugging Guide

## Issue
Players cannot see each other's models in multiplayer mode.

## Fixes Applied

### 1. Server-Side: Fixed PLAYER_JOIN Message Format
**File**: `server.py` line 1742-1747

**Problem**: Server was sending `playerId` but client expected `id` field.

**Fix**:
```python
await self.broadcast(MESSAGE_TYPES['PLAYER_JOIN'], {
    'id': client_id,
    'playerId': client_id,  # Keep for backwards compatibility
    'username': player.username,
    'position': player.position
}, exclude_client=client_id)
```

### 2. Client-Side: Disabled Frustum Culling
**File**: `client/js/game.js` line 1908-1914

**Problem**: Three.js was culling player avatars when outside camera frustum.

**Fix**:
```javascript
// Disable frustum culling to ensure players are always visible
mesh.frustumCulled = false;
mesh.traverse((child) => {
  if (child.isMesh) {
    child.frustumCulled = false;
  }
});
```

### 3. Client-Side: Added Duplicate Prevention
**File**: `client/js/game.js` line 1869-1873

**Problem**: Players might be created multiple times.

**Fix**:
```javascript
// Check if player already exists
if (this.otherPlayers.has(playerId)) {
  console.log(`Player ${data.username} (${playerId}) already exists, skipping creation`);
  return;
}
```

### 4. Client-Side: Enhanced Debugging Logs
**File**: `client/js/game.js` line 1917-1933

**Added comprehensive logging**:
```javascript
console.log(`✅ Added other player ${data.username} to scene`);
console.log(`   Position: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
console.log(`   Mesh parent: ${!!mesh.parent}, visible: ${mesh.visible}, frustumCulled: ${mesh.frustumCulled}`);
console.log(`   Total other players: ${this.otherPlayers.size + 1}`);
console.log(`   Stored in otherPlayers map with key: ${playerId}`);
```

## How to Test

### Step 1: Restart Server
```bash
# Stop current server (Ctrl+C)
python3 server.py
```

### Step 2: Refresh Client
```bash
# In another terminal
cd client
python3 -m http.server 8080
```

### Step 3: Open Two Browser Windows
1. Window 1: `http://localhost:8080`
2. Window 2: `http://localhost:8080` (new tab/window)

### Step 4: Login with Different Usernames
- Window 1: Login as "Player1"
- Window 2: Login as "Player2"

### Step 5: Check Console Logs

**Expected logs when Player2 joins (in Player1's console)**:
```
Player joined: {id: "...", username: "Player2", position: [...]}
Creating other player: Player2 (...) at position [x, y, z]
Full player data: {id: "...", playerId: "...", username: "Player2", position: [...]}
✅ Added other player Player2 to scene
   Position: (x, y, z)
   Mesh parent: true, visible: true, frustumCulled: false
   Total other players: 1
   Stored in otherPlayers map with key: ...
```

**Expected logs when Player1 joins (in Player2's console)**:
```
Creating other players from game state...
Checking player ... vs local ...
Creating other player from game state: {id: "...", username: "Player1", ...}
Creating other player: Player1 (...) at position [x, y, z]
✅ Added other player Player1 to scene
   Position: (x, y, z)
   Mesh parent: true, visible: true, frustumCulled: false
   Total other players: 1
```

### Step 6: Visual Verification
- Both players should see animated orange avatars for each other
- Avatars should have walking animations when moving
- Avatars should remain visible when camera rotates

## Troubleshooting

### Problem: No console logs about other players
**Cause**: Server not broadcasting PLAYER_JOIN or client not receiving it.

**Check**:
1. Server logs: Look for `Player joined:` messages
2. Network tab: Check WebSocket messages for `player_join` type
3. Client console: Any errors about WebSocket connection?

### Problem: Console shows "Creating other player" but no avatar visible
**Cause**: Mesh not being added to scene or position is wrong.

**Check**:
1. Console log shows `Mesh parent: true`? If false, mesh not in scene
2. Position values reasonable? Should be near spawn (around 0, 35, 0)
3. Check `frustumCulled: false` - if true, fix didn't apply

### Problem: Avatar appears but is invisible/black
**Cause**: PlayerAvatar class not loading or materials issue.

**Check**:
1. Console errors about `PlayerAvatar is not defined`?
2. Check `player-avatar.js` is loaded in network tab
3. Three.js lighting - are there lights in the scene?

### Problem: Players see each other briefly then disappear
**Cause**: Frustum culling re-enabled or mesh removed from scene.

**Check**:
1. Console log `frustumCulled: false` on creation?
2. Any code removing meshes from scene?
3. Check `updateEnemies` or similar functions

## Common Issues

### Issue 1: Database Error on Disconnect
```
ERROR:database:Failed to save player ...: NOT NULL constraint failed: players.user_id
```

**Impact**: Players not persisting to database, but doesn't affect visibility.

**Fix**: Separate issue - need to ensure `user_id` is set when creating player records.

### Issue 2: Position Array vs Object
Server sends position as array `[x, y, z]`, client handles both:

```javascript
// Handle both array and object position formats
let x, y, z;
if (Array.isArray(data.position)) {
  x = data.position[0];
  y = data.position[1];
  z = data.position[2];
} else {
  x = data.position.x;
  y = data.position.y;
  z = data.position.z;
}
```

## Files Modified

1. **`server.py`**
   - Line 1742-1747: Added `id` field to PLAYER_JOIN broadcast

2. **`client/js/game.js`**
   - Line 1866-1876: Added duplicate check and enhanced logging
   - Line 1908-1914: Disabled frustum culling for player meshes
   - Line 1917-1933: Added detailed debug logging

## Related Documentation

- `MOB_VISIBILITY_FIX.md` - Same frustum culling issue for mobs
- `ANIMATED_AVATAR_SYSTEM.md` - PlayerAvatar class documentation

## Next Steps

If players still can't see each other after these fixes:

1. **Check browser console** for the detailed logs
2. **Check server logs** for PLAYER_JOIN broadcasts
3. **Verify WebSocket connection** in Network tab
4. **Check Three.js scene** using browser dev tools (Three.js Inspector extension)
5. **Test with simple cube** instead of PlayerAvatar to isolate issue

## Success Criteria

✅ Console shows "✅ Added other player" message  
✅ Console shows `Mesh parent: true`  
✅ Console shows `frustumCulled: false`  
✅ Orange animated avatar visible in game  
✅ Avatar animates when other player moves  
✅ Avatar stays visible when camera rotates  

---

**Last Updated**: 2026-03-21 5:14 PM  
**Status**: Fixes applied, awaiting user testing
