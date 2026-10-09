/**
 * Inventory, equipment and container panel.
 *
 * The panel never changes state itself: every gesture is turned into a
 * protocol message by `planSlotAction` / `quickSlotAction` and the server
 * answers with a fresh self state. Those two planners are DOM-free so the
 * gesture -> message mapping is unit tested.
 */

import { C2S } from '/src/net/protocol.js';
import { EQUIP_SLOTS } from '/src/game/equipment.js';

/** Panel areas a slot can belong to. */
export const AREAS = Object.freeze({
  INVENTORY: 'inventory',
  EQUIPMENT: 'equipment',
  CONTAINER: 'container',
  TRASH: 'trash',
});

const EQUIP_LABELS = {
  head: 'Head',
  chest: 'Chest',
  legs: 'Legs',
  feet: 'Feet',
  main_hand: 'Main hand',
  off_hand: 'Off hand',
};

/**
 * @typedef {{ area: string, index?: number, slot?: string }} SlotRef
 * @typedef {{ type: string, payload: object }} PlannedMessage
 */

/**
 * Message for dragging the stack at `from` onto `to`, or null when the drop
 * means nothing.
 * @param {SlotRef} from
 * @param {SlotRef} to
 * @returns {PlannedMessage|null}
 */
export function planSlotAction(from, to) {
  if (!from || !to) return null;
  const { INVENTORY, EQUIPMENT, CONTAINER, TRASH } = AREAS;

  if (from.area === INVENTORY) {
    if (to.area === INVENTORY) {
      return from.index === to.index ? null : { type: C2S.MOVE_ITEM, payload: { from: from.index, to: to.index } };
    }
    if (to.area === EQUIPMENT) return { type: C2S.EQUIP, payload: { slot: from.index } };
    if (to.area === CONTAINER) return { type: C2S.TRANSFER_ITEM, payload: { slot: from.index, direction: 'to_container' } };
    if (to.area === TRASH) return { type: C2S.TRASH_ITEM, payload: { slot: from.index } };
    return null;
  }
  if (from.area === EQUIPMENT && to.area === INVENTORY) {
    return { type: C2S.UNEQUIP, payload: { equipSlot: from.slot, to: to.index } };
  }
  if (from.area === CONTAINER && to.area === INVENTORY) {
    return { type: C2S.TRANSFER_ITEM, payload: { slot: from.index, direction: 'to_player' } };
  }
  return null;
}

/**
 * Message for a shift-click / double-click "send it where it obviously goes".
 * @param {SlotRef} ref
 * @param {{ containerOpen: boolean, equipSlotOf: (index: number) => string|null }} context
 * @returns {PlannedMessage|null}
 */
export function quickSlotAction(ref, { containerOpen, equipSlotOf }) {
  if (!ref) return null;
  if (ref.area === AREAS.INVENTORY) {
    if (containerOpen) return planSlotAction(ref, { area: AREAS.CONTAINER });
    return equipSlotOf(ref.index) ? planSlotAction(ref, { area: AREAS.EQUIPMENT }) : null;
  }
  if (ref.area === AREAS.EQUIPMENT) return { type: C2S.UNEQUIP, payload: { equipSlot: ref.slot, to: null } };
  if (ref.area === AREAS.CONTAINER) return planSlotAction(ref, { area: AREAS.INVENTORY });
  return null;
}

/** Can the inventory stack at `index` go into `equipSlot`? Used for drop highlighting only. */
export function fitsEquipSlot(content, stack, equipSlot) {
  if (!stack) return false;
  return content.item(stack.item)?.equipSlot === equipSlot;
}

export class InventoryPanel {
  /**
   * @param {{
   *   content: import('/src/content/index.js').Content,
   *   colorFor: (itemId: string) => string,
   *   send: (type: string, payload: object) => void,
   *   onClose?: (hadContainer: boolean) => void,
   * }} config
   */
  constructor({ content, colorFor, send, onClose = () => {} }) {
    this.content = content;
    this.colorFor = colorFor;
    this.send = send;
    this.onClose = onClose;

    this.root = document.getElementById('inventory-panel');
    this.mainGrid = document.getElementById('inventory-grid');
    this.quickbarGrid = document.getElementById('inventory-quickbar');
    this.equipmentList = document.getElementById('equipment-slots');
    this.statsList = document.getElementById('equipment-stats');
    this.containerSection = document.getElementById('container-section');
    this.containerGrid = document.getElementById('container-grid');
    this.trash = document.getElementById('trash-slot');
    this.message = document.getElementById('inventory-message');

    this.state = null;
    this.container = null;
    /** @type {SlotRef|null} */
    this.dragging = null;
    this._messageTimer = null;

    this._bindDropTarget(this.trash, { area: AREAS.TRASH });
    document.getElementById('inventory-close').addEventListener('click', () => this.close());
  }

  get isOpen() {
    return !this.root.hidden;
  }

  open() {
    this.root.hidden = false;
    document.exitPointerLock?.();
    this.render();
  }

  close() {
    if (!this.isOpen) return;
    this.root.hidden = true;
    const hadContainer = this.container !== null;
    this.container = null;
    this.containerSection.hidden = true;
    this.onClose(hadContainer);
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** @param {object} selfState the server's SELF_STATE payload */
  setState(selfState) {
    this.state = selfState;
    if (this.isOpen) this.render();
  }

  /** @param {{ position: object, slots: Array<object|null> }} container */
  setContainer(container) {
    this.container = container;
    if (!this.isOpen) this.open();
    else this.render();
  }

  /** @param {string} text */
  flash(text) {
    this.message.textContent = text;
    clearTimeout(this._messageTimer);
    this._messageTimer = setTimeout(() => {
      this.message.textContent = '';
    }, 2500);
  }

  // ------------------------------------------------------------- rendering

  render() {
    const inventory = this.state?.inventory;
    if (!inventory) return;
    const quickbarSize = inventory.quickbarSize ?? 0;
    const locked = new Set(inventory.lockedSlots ?? []);
    const slotRefs = inventory.slots.map((_, index) => ({ area: AREAS.INVENTORY, index }));

    this.quickbarGrid.replaceChildren(
      ...slotRefs.slice(0, quickbarSize).map((ref) =>
        this._slotElement(ref, inventory.slots[ref.index], {
          locked: locked.has(ref.index),
          selected: ref.index === inventory.selectedSlot,
        })),
    );
    this.mainGrid.replaceChildren(
      ...slotRefs.slice(quickbarSize).map((ref) =>
        this._slotElement(ref, inventory.slots[ref.index], { locked: locked.has(ref.index) })),
    );

    const equipped = this.state.equipmentSlots ?? {};
    const slotNames = Object.keys(equipped).length > 0 ? Object.keys(equipped) : EQUIP_SLOTS;
    this.equipmentList.replaceChildren(
      ...slotNames.map((slot) => {
        const row = document.createElement('div');
        row.className = 'equip-row';
        const label = document.createElement('span');
        label.className = 'equip-label';
        label.textContent = EQUIP_LABELS[slot] ?? slot;
        const stack = equipped[slot] ? { ...equipped[slot], count: 1 } : null;
        row.append(this._slotElement({ area: AREAS.EQUIPMENT, slot }, stack, {}), label);
        return row;
      }),
    );
    this._renderStats();

    this.containerSection.hidden = this.container === null;
    if (this.container) {
      this.containerGrid.replaceChildren(
        ...this.container.slots.map((stack, index) =>
          this._slotElement({ area: AREAS.CONTAINER, index }, stack, {})),
      );
    }
  }

  _renderStats() {
    const stats = this.state?.stats ?? {};
    const rows = Object.entries(stats)
      .filter(([, value]) => typeof value === 'number' && value !== 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => {
        const row = document.createElement('div');
        const rounded = Number.isInteger(value) ? value : value.toFixed(2);
        row.innerHTML = '<span class="stat-name"></span><span class="stat-value"></span>';
        row.querySelector('.stat-name').textContent = name.replace(/_/g, ' ');
        row.querySelector('.stat-value').textContent = String(rounded);
        return row;
      });
    this.statsList.replaceChildren(...rows);
  }

  /**
   * @param {SlotRef} ref
   * @param {{ item: string, count: number, meta?: object }|null} stack
   * @param {{ locked?: boolean, selected?: boolean }} flags
   */
  _slotElement(ref, stack, { locked = false, selected = false }) {
    const element = document.createElement('div');
    element.className = 'slot';
    element.classList.toggle('locked', locked);
    element.classList.toggle('selected', selected);
    element.innerHTML =
      '<span class="swatch"></span><span class="name"></span><span class="count"></span><span class="durability"></span>';

    if (stack) {
      const def = this.content.item(stack.item);
      element.querySelector('.swatch').style.background = this.colorFor(stack.item);
      element.querySelector('.name').textContent = def?.name ?? stack.item;
      element.querySelector('.count').textContent = stack.count > 1 ? String(stack.count) : '';
      element.title = this._tooltip(def, stack, locked);
      const durability = stack.meta?.durability;
      if (typeof durability === 'number' && def?.durability) {
        const bar = element.querySelector('.durability');
        bar.style.transform = `scaleX(${Math.max(0, Math.min(1, durability / def.durability))})`;
        bar.classList.add('visible');
      }
      element.draggable = !locked;
      element.addEventListener('dragstart', (event) => {
        this.dragging = ref;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify(ref));
      });
      element.addEventListener('dragend', () => {
        this.dragging = null;
      });
    } else if (ref.area === AREAS.EQUIPMENT) {
      element.classList.add('empty-equip');
    }

    element.addEventListener('click', (event) => this._handleClick(ref, stack, event));
    element.addEventListener('dblclick', () => stack && this._sendPlanned(this._quick(ref)));
    element.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      if (stack && ref.area === AREAS.INVENTORY && stack.count > 1) {
        this.send(C2S.SPLIT_ITEM, { slot: ref.index });
      }
    });
    this._bindDropTarget(element, ref);
    return element;
  }

  _tooltip(def, stack, locked) {
    const lines = [def?.name ?? stack.item];
    if (def?.equipSlot) lines.push(`Equips to: ${EQUIP_LABELS[def.equipSlot] ?? def.equipSlot}`);
    for (const [stat, value] of Object.entries(def?.stats ?? {})) lines.push(`${stat} +${value}`);
    if (typeof stack.meta?.durability === 'number' && def?.durability) {
      lines.push(`Durability ${stack.meta.durability} / ${def.durability}`);
    }
    if (locked) lines.push('Locked (Ctrl+click to unlock)');
    return lines.join('\n');
  }

  _handleClick(ref, stack, event) {
    if (ref.area === AREAS.INVENTORY && (event.ctrlKey || event.metaKey)) {
      this.send(C2S.LOCK_SLOT, { slot: ref.index });
      return;
    }
    if (stack && event.shiftKey) this._sendPlanned(this._quick(ref));
  }

  _quick(ref) {
    return quickSlotAction(ref, {
      containerOpen: this.container !== null,
      equipSlotOf: (index) => {
        const stack = this.state?.inventory?.slots?.[index];
        return stack ? this.content.item(stack.item)?.equipSlot ?? null : null;
      },
    });
  }

  /** @param {PlannedMessage|null} planned */
  _sendPlanned(planned) {
    if (planned) this.send(planned.type, planned.payload);
  }

  /** @param {HTMLElement} element @param {SlotRef} ref */
  _bindDropTarget(element, ref) {
    element.addEventListener('dragover', (event) => {
      const planned = planSlotAction(this.dragging, ref);
      if (!planned) return;
      if (ref.area === AREAS.EQUIPMENT && this.dragging?.area === AREAS.INVENTORY) {
        const stack = this.state?.inventory?.slots?.[this.dragging.index];
        if (!fitsEquipSlot(this.content, stack, ref.slot)) return;
      }
      event.preventDefault();
      element.classList.add('drop-target');
    });
    element.addEventListener('dragleave', () => element.classList.remove('drop-target'));
    element.addEventListener('drop', (event) => {
      event.preventDefault();
      element.classList.remove('drop-target');
      let from = this.dragging;
      try {
        from = JSON.parse(event.dataTransfer.getData('text/plain'));
      } catch {
        // fall back to the tracked drag source
      }
      this.dragging = null;
      this._sendPlanned(planSlotAction(from, ref));
    });
  }
}
