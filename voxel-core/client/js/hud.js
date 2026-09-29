/**
 * HUD binding.
 *
 * Pure DOM: vitals, quickbar, chat log and the focused-block label. Kept apart
 * from the renderer so the 3D layer stays free of layout concerns.
 */

const MAX_CHAT_LINES = 8;

export class Hud {
  /** @param {import('/src/content/index.js').Content} content */
  constructor(content) {
    this.content = content;
    this.root = document.getElementById('hud');
    this.crosshair = document.getElementById('crosshair');
    this.quickbar = document.getElementById('quickbar');
    this.chatLog = document.getElementById('chat-log');
    this.chatInput = document.getElementById('chat-input');
    this.focusLabel = document.getElementById('focus-label');
    this.healthFill = document.getElementById('health-fill');
    this.healthLabel = document.getElementById('health-label');
    this.energyFill = document.getElementById('energy-fill');
    this.energyLabel = document.getElementById('energy-label');
    this.slots = [];
    this._focusText = '';
  }

  show() {
    this.root.hidden = false;
  }

  /** @param {boolean} visible */
  setCrosshair(visible) {
    this.crosshair.hidden = !visible;
  }

  /** @param {{ health: number, maxHealth: number, energy: number }} state */
  setVitals({ health, maxHealth, energy }) {
    const healthRatio = maxHealth > 0 ? Math.max(0, Math.min(1, health / maxHealth)) : 0;
    this.healthFill.style.transform = `scaleX(${healthRatio})`;
    this.healthLabel.textContent = `${Math.round(health)} / ${Math.round(maxHealth)}`;

    const energyRatio = Math.max(0, Math.min(1, (energy ?? 100) / 100));
    this.energyFill.style.transform = `scaleX(${energyRatio})`;
    this.energyLabel.textContent = `${Math.round(energy ?? 100)} / 100`;
  }

  /**
   * Rebuild the quickbar from an inventory snapshot.
   * @param {{ slots: Array<object|null>, quickbarSize: number, selectedSlot: number }} inventory
   */
  setInventory(inventory) {
    if (!inventory) return;
    const count = inventory.quickbarSize ?? 9;
    if (this.slots.length !== count) {
      this.quickbar.replaceChildren();
      this.slots = Array.from({ length: count }, () => {
        const element = document.createElement('div');
        element.className = 'slot';
        element.innerHTML = '<span class="swatch"></span><span class="name"></span><span class="count"></span>';
        this.quickbar.append(element);
        return element;
      });
    }

    for (let i = 0; i < count; i++) {
      const element = this.slots[i];
      const stack = inventory.slots?.[i] ?? null;
      const def = stack ? this.content.item(stack.item) : null;
      element.classList.toggle('selected', i === inventory.selectedSlot);
      element.querySelector('.name').textContent = def?.name ?? (stack?.item ?? '');
      element.querySelector('.count').textContent = stack && stack.count > 1 ? stack.count : '';
      element.querySelector('.swatch').style.background = stack ? this.colorForItem(stack.item) : 'transparent';
    }
  }

  /**
   * Colour used for quickbar swatches and held-item cubes. Placeable items
   * borrow the block colour; everything else falls back to a neutral tone.
   * @param {string} itemId
   */
  colorForItem(itemId) {
    const def = this.content.item(itemId);
    if (def?.color) return def.color;
    if (def?.placeable) {
      const block = this.content.blockByName(def.placeable);
      if (block?.color) return block.color;
    }
    return '#8a8f98';
  }

  /** @param {{ blockName: string, distance: number }|null} focus */
  setFocus(focus) {
    const text = focus ? `${focus.blockName} · ${focus.distance.toFixed(1)}m` : '';
    if (text === this._focusText) return;
    this._focusText = text;
    this.focusLabel.textContent = text;
    this.focusLabel.classList.toggle('visible', text !== '');
  }

  /**
   * @param {string} text
   * @param {string|null} [from] null renders as a system line
   */
  addChat(text, from = null) {
    const line = document.createElement('div');
    if (from) {
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = `${from}: `;
      line.append(who, document.createTextNode(text));
    } else {
      line.className = 'system';
      line.textContent = text;
    }
    this.chatLog.append(line);
    while (this.chatLog.childElementCount > MAX_CHAT_LINES) {
      this.chatLog.firstElementChild.remove();
    }
  }

  /** @param {(text: string) => void} onSubmit */
  bindChat(onSubmit) {
    this.chatInput.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        const text = this.chatInput.value.trim();
        this.chatInput.value = '';
        this.closeChat();
        if (text) onSubmit(text);
      } else if (event.key === 'Escape') {
        this.chatInput.value = '';
        this.closeChat();
      }
    });
  }

  openChat() {
    this.chatInput.hidden = false;
    this.chatInput.focus();
  }

  closeChat() {
    this.chatInput.hidden = true;
    this.chatInput.blur();
  }

  isTyping() {
    return !this.chatInput.hidden;
  }
}
