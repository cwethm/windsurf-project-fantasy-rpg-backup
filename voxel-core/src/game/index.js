/**
 * Gameplay systems: inventory, equipment, character state, containers,
 * ground items and the interaction / item-use frameworks.
 *
 * Nothing in here imports `node:` built-ins, so the browser client can reuse
 * the same code for prediction that the server uses for authority.
 */

export { Inventory, metaEquals } from './inventory.js';
export { Equipment, EQUIP_SLOTS } from './equipment.js';
export { Character, BASE_STATS, STACKING } from './character.js';
export { Player } from './player.js';
export { GroundItemManager } from './ground-items.js';
export {
  ContainerHandle,
  CONTAINER_KIND,
  DEFAULT_CONTAINER_SIZE,
  createContainerData,
  openContainer,
  transferStack,
  spillContainer,
} from './containers.js';
export {
  InteractionSystem,
  INTERACTION,
  TOGGLE_KIND,
  computeHarvestSeconds,
  playerOccupies,
} from './interaction.js';
export { ItemUseSystem, USE_ACTIONS } from './item-use.js';
