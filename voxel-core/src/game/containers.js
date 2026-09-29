/**
 * Containers.
 *
 * A container is a tile entity holding a slot array. It reuses `Inventory`
 * wholesale, so every stacking/merging rule stays in one place and chests
 * behave exactly like backpacks.
 */

import { Inventory } from './inventory.js';
import { Random } from '../core/rng.js';
import { rollLootTable } from '../content/loot.js';

export const DEFAULT_CONTAINER_SIZE = 27;

/** Tile-entity kind handled here. Blocks opt in via `tileEntity: 'container'`. */
export const CONTAINER_KIND = 'container';

/**
 * Build the tile-entity payload for a new container.
 * @param {{ size?: number, loot?: string|null }} [options]
 */
export function createContainerData({ size = DEFAULT_CONTAINER_SIZE, loot = null } = {}) {
  return { kind: CONTAINER_KIND, size, loot, slots: new Array(size).fill(null) };
}

/**
 * A live view over a container tile entity.
 *
 * Mutations happen on `inventory`; `save()` writes the slots back into the
 * world, which records the diff and emits the tile-entity event.
 */
export class ContainerHandle {
  /**
   * @param {{
   *   world: import('../world/world.js').World,
   *   content: import('../content/index.js').Content,
   *   x: number, y: number, z: number,
   *   data: object,
   * }} config
   */
  constructor({ world, content, x, y, z, data }) {
    this.world = world;
    this.content = content;
    this.x = x;
    this.y = y;
    this.z = z;
    this.data = data;
    this.inventory = new Inventory({
      content,
      size: data.size ?? DEFAULT_CONTAINER_SIZE,
      quickbarSize: 0,
      ownerId: `container:${x},${y},${z}`,
    });
    this.inventory.loadJSON({ slots: data.slots ?? [] });
  }

  get position() {
    return { x: this.x, y: this.y, z: this.z };
  }

  /** Persist the current slots back into the world. */
  save() {
    const next = {
      ...this.data,
      slots: this.inventory.slots.map((slot) => (slot ? { ...slot } : null)),
      loot: null,
    };
    this.world.setTileEntity(this.x, this.y, this.z, next, { source: 'container' });
    this.data = next;
    return this;
  }
}

/**
 * Open (and lazily create) the container at a position.
 *
 * A container whose data still carries a `loot` table is filled on first open,
 * which is how pre-placed chests get contents without storing them up front.
 *
 * @param {{
 *   world: import('../world/world.js').World,
 *   content: import('../content/index.js').Content,
 *   x: number, y: number, z: number,
 * }} params
 * @returns {ContainerHandle|null} null when the block is not a container
 */
export function openContainer({ world, content, x, y, z }) {
  const blockDef = world.getBlockDef(x, y, z);
  if (blockDef?.tileEntity !== CONTAINER_KIND) return null;

  const data = world.ensureTileEntity(x, y, z, () => createContainerData());
  const handle = new ContainerHandle({ world, content, x, y, z, data });

  if (data.loot) {
    const rng = world.randomAt(x, y, z, 0x10c7);
    for (const stack of rollLootTable(content.loot.get(data.loot), rng)) {
      handle.inventory.add(stack.item, stack.count);
    }
    handle.save();
  }
  return handle;
}

/**
 * Move a stack between two inventories (player <-> container, either way).
 * @param {Inventory} from
 * @param {number} fromIndex
 * @param {Inventory} to
 * @param {number|null} [count] null moves the whole stack
 * @returns {{ ok: boolean, reason?: string, moved?: number }}
 */
export function transferStack(from, fromIndex, to, count = null) {
  const source = from.getSlot(fromIndex);
  if (!source) return { ok: false, reason: 'empty slot' };
  if (from.lockedSlots.has(fromIndex)) return { ok: false, reason: 'slot is locked' };

  const amount = count === null ? source.count : Math.min(count, source.count);
  if (amount <= 0) return { ok: false, reason: 'nothing to move' };

  const { added } = to.add(source.item, amount, source.meta ?? null);
  if (added === 0) return { ok: false, reason: 'no room' };
  from.removeFromSlot(fromIndex, added);
  return { ok: true, moved: added };
}

/**
 * Spill a container's contents into the world, used when the block holding it
 * is destroyed.
 * @param {ContainerHandle} handle
 * @param {import('./ground-items.js').GroundItemManager} groundItems
 * @param {{ ownerId?: string|null, now?: number }} [options]
 */
export function spillContainer(handle, groundItems, { ownerId = null, now = Date.now() } = {}) {
  const dropped = [];
  for (const slot of handle.inventory.slots) {
    if (!slot) continue;
    dropped.push(
      groundItems.spawn({
        x: handle.x + 0.5,
        y: handle.y + 0.5,
        z: handle.z + 0.5,
        item: slot.item,
        count: slot.count,
        meta: slot.meta ?? null,
        ownerId,
        now,
      }),
    );
  }
  handle.inventory.slots.fill(null);
  return dropped;
}

/** Deterministic RNG helper so callers can seed their own container rolls. */
export function containerRandom(world, x, y, z) {
  return new Random(world.generator.seed.value ^ (x * 7919) ^ (y * 104729) ^ (z * 1299721));
}
