/**
 * Item use dispatcher.
 *
 * One `USE_ITEM` entry point, routed by the item's declared `use.action` to a
 * handler with the signature `(player, item, context) => result`. Adding a new
 * kind of item means adding a data descriptor and, at most, one handler — not
 * touching a growing switch.
 */

import { EVENTS } from '../core/event-bus.js';
import { HandlerRegistry } from '../core/registry.js';
import { USE_ACTIONS } from '../content/items.js';
import { INTERACTION } from './interaction.js';

export class ItemUseSystem {
  /**
   * @param {{
   *   content: import('../content/index.js').Content,
   *   interactions: import('./interaction.js').InteractionSystem,
   *   bus?: import('../core/event-bus.js').EventBus,
   * }} config
   */
  constructor({ content, interactions, bus = null }) {
    this.content = content;
    this.interactions = interactions;
    this.bus = bus ?? interactions?.bus ?? null;

    this.handlers = new HandlerRegistry('item use', () => ({ ok: false, reason: 'nothing happens' }));
    this._registerDefaults();
  }

  _registerDefaults() {
    this.handlers.register(USE_ACTIONS.NONE, () => ({ ok: false, reason: 'nothing happens' }));
    this.handlers.register(USE_ACTIONS.CONSUME, (player, itemDef, ctx) => this._consume(player, itemDef, ctx));
    this.handlers.register(USE_ACTIONS.LEARN, (player, itemDef, ctx) => this._learn(player, itemDef, ctx));
    this.handlers.register(USE_ACTIONS.EQUIP, (player, itemDef, ctx) => this._equip(player, itemDef, ctx));
    this.handlers.register(USE_ACTIONS.PLACE, (player, itemDef, ctx) => this._place(player, itemDef, ctx));
    this.handlers.register(USE_ACTIONS.TOGGLE, (player, itemDef, ctx) => this._toggle(player, itemDef, ctx));
  }

  /**
   * Register or override a use action handler.
   * @param {string} action
   * @param {(player: object, itemDef: object, context: object) => object} handler
   */
  registerAction(action, handler) {
    this.handlers.register(action, handler);
    return this;
  }

  /**
   * The unified entry point: use the item in a slot, optionally on a target.
   *
   * @param {import('./player.js').Player} player
   * @param {{
   *   slot?: number|null,
   *   target?: { x: number, y: number, z: number }|null,
   *   occupants?: object[],
   *   now?: number,
   * }} [params]
   */
  use(player, { slot = null, target = null, occupants = [], now = Date.now() } = {}) {
    const index = slot ?? player.inventory.selectedSlot;
    const stack = player.inventory.getSlot(index);
    if (!stack) return { ok: false, reason: 'empty hand' };

    const itemDef = this.content.items.get(stack.item);
    if (!itemDef) return { ok: false, reason: 'unknown item' };

    const context = { slot: index, stack, target, occupants, now, system: this };
    const result = this.handlers.dispatch(itemDef.use.action, player, itemDef, context);

    if (result?.ok) {
      this.bus?.emit(EVENTS.ITEM_USED, {
        playerId: player.id,
        item: itemDef.id,
        action: itemDef.use.action,
        target: target ? { ...target } : null,
      });
    }
    return result;
  }

  // -------------------------------------------------------------- handlers

  _consume(player, itemDef, { slot, now }) {
    const use = itemDef.use;
    const effects = [];

    if (use.heal) {
      player.character.changeHealth(use.heal);
      effects.push({ type: 'heal', amount: use.heal });
    }
    if (use.energy) {
      player.character.changeEnergy(use.energy);
      effects.push({ type: 'energy', amount: use.energy });
    }
    for (const buff of use.buffs ?? []) {
      player.character.applyBuff(buff, now);
      effects.push({ type: 'buff', id: buff.id });
    }
    if (use.experience) {
      player.character.addExperience(use.experience);
      effects.push({ type: 'experience', amount: use.experience });
    }
    if (effects.length === 0) return { ok: false, reason: 'nothing happens' };

    player.inventory.removeFromSlot(slot, 1);
    return { ok: true, action: USE_ACTIONS.CONSUME, effects };
  }

  _learn(player, itemDef, { slot }) {
    const knowledge = itemDef.use.knowledge;
    if (!knowledge) return { ok: false, reason: 'nothing to learn' };
    if (player.character.knows(knowledge)) {
      return { ok: false, reason: 'already known' };
    }
    player.character.learn(knowledge);
    player.inventory.removeFromSlot(slot, 1);
    return { ok: true, action: USE_ACTIONS.LEARN, knowledge };
  }

  _equip(player, itemDef, { slot, stack }) {
    const result = player.equipment.equip(stack, itemDef.equipSlot);
    if (!result.ok) return result;

    // The slot the item came from now holds whatever it replaced.
    player.inventory.setSlot(slot, result.replaced ? { ...result.replaced, count: 1 } : null);
    return { ok: true, action: USE_ACTIONS.EQUIP, slot: itemDef.equipSlot, replaced: result.replaced ?? null };
  }

  _place(player, itemDef, { slot, target, occupants }) {
    if (!target) return { ok: false, reason: 'no target' };
    return this.interactions.perform(INTERACTION.PLACE, player, { slot, target, occupants });
  }

  _toggle(player, itemDef, { target }) {
    if (!target) return { ok: false, reason: 'no target' };
    return this.interactions.perform(INTERACTION.INTERACT, player, { target });
  }
}

export { USE_ACTIONS };
