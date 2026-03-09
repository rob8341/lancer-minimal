/**
 * Lancer Minimal — Pilot Actor Sheet
 * Extends the core ActorSheet for pilot-type actors.
 */
export class LancerPilotSheet extends ActorSheet {

  // Track highlighted trigger index
  _highlightedTriggerIndex = null;

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["lancer-minimal", "sheet", "actor", "pilot-sheet"],
      template: "systems/lancer-minimal/templates/pilot-sheet.hbs",
      width: 740,
      height: 860,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills" }]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    const context = await super.getData();
    const actorData = this.actor.toObject(false);
    const system = foundry.utils.duplicate(this.actor.system);

    // Guarantee array fields exist (handles legacy / first-create)
    if (!Array.isArray(system.triggers)) system.triggers = [];
    if (!Array.isArray(system.licenses)) system.licenses = [];

    context.system = system;
    context.actor = actorData;

    // Resolve mech links
    const mechLinkIds = system.mechLinks ?? [];
    context.mechLinks = mechLinkIds.map(entry => {
      const actor = game.actors?.get(entry.id);
      return { id: entry.id, name: actor ? actor.name : entry.name ?? "Unknown Mech" };
    });

    // Partition owned items by type for the template
    const items = Array.from(this.actor.items).map(i => i.toObject(false));
    context.talents     = items.filter(i => i.type === "talent");
    context.coreBonuses = items.filter(i => i.type === "core_bonus");
    context.armorItems  = items.filter(i => i.type === "armor");
    context.weaponItems = items.filter(i => i.type === "weapon")
      .sort((a, b) => (a.system.mount || "").localeCompare(b.system.mount || ""));
    context.gearItems   = items.filter(i => i.type === "gear");

    // Get active effects for status display on portrait
    context.effects = Array.from(this.actor.effects).map(e => ({
      icon: e.icon,
      label: e.name || e.label,
      id: e.id
    }));

    return context;
  }

  /* -------------------------------------------- */

  /**
   * @override
   * Reconstruct trigger / license arrays from the flat, indexed form data
   * so Foundry replaces the whole array rather than merging by index.
   */
  async _updateObject(event, formData) {
    const triggers = [];
    const licenses = [];
    const updateData = {};

    for (const [key, value] of Object.entries(formData)) {
      const tm = key.match(/^system\.triggers\.(\d+)\.(.+)$/);
      const lm = key.match(/^system\.licenses\.(\d+)\.(.+)$/);

      if (tm) {
        const idx = Number(tm[1]);
        if (!triggers[idx]) triggers[idx] = {};
        triggers[idx][tm[2]] = value;
      } else if (lm) {
        const idx = Number(lm[1]);
        if (!licenses[idx]) licenses[idx] = {};
        licenses[idx][lm[2]] = value;
      } else {
        updateData[key] = value;
      }
    }

    // Always write the full arrays (safe for add / delete round-trips)
    updateData["system.triggers"] = triggers.filter(Boolean);
    updateData["system.licenses"] = licenses.filter(Boolean);

    return this.actor.update(updateData);
  }

  /* -------------------------------------------- */

  /**
   * @override
   * Handle all drops — intercept Actor drops for mech links.
   */
  async _onDrop(event, data) {
    // Check if something was dropped
    let dropData;
    try {
      dropData = JSON.parse(event.dataTransfer?.getData("text/plain") ?? "{}");
    } catch {
      return super._onDrop(event, data);
    }

    // If it's an Actor drop, check if it's a mech
    if (dropData.type === "Actor") {
      const actor = await Actor.implementation.fromDropData(dropData);
      if (actor && actor.type === "mech") {
        return this._onDropMechLink(actor);
      }
    }

    return super._onDrop(event, data);
  }

  /**
   * Handle dropping a mech actor to create a shortcut link.
   * Also links this pilot to the mech (bidirectional).
   */
  async _onDropMechLink(mechActor) {
    const links = foundry.utils.duplicate(this.actor.system.mechLinks ?? []);

    // Check if already linked
    if (links.find(l => l.id === mechActor.id)) {
      ui.notifications.warn(`${mechActor.name} is already linked.`);
      return;
    }

    // Max 3 links
    if (links.length >= 3) {
      ui.notifications.warn("Maximum 3 mech shortcuts allowed.");
      return;
    }

    links.push({ id: mechActor.id, name: mechActor.name });
    await this.actor.update({ "system.mechLinks": links });
    
    // Bidirectional: Also link this pilot to the mech
    if (mechActor.system.pilotLink !== this.actor.id) {
      await mechActor.update({ "system.pilotLink": this.actor.id });
    }
  }

  /**
   * Open a linked mech actor sheet.
   */
  _onOpenMechLink(event) {
    if ($(event.target).closest(".mech-link-delete").length) return;
    const mechId = event.currentTarget.dataset.mechId;
    const actor = game.actors?.get(mechId);
    if (actor) actor.sheet.render(true);
    else ui.notifications.warn("Linked mech not found.");
  }

  /**
   * Delete a mech shortcut link (with confirmation).
   * Also removes the pilot link from the mech (bidirectional).
   */
  async _onDeleteMechLink(event) {
    event.preventDefault();
    event.stopPropagation();
    const index = Number(event.currentTarget.dataset.index);
    const links = foundry.utils.duplicate(this.actor.system.mechLinks ?? []);
    const mechEntry = links[index];
    const mechName = mechEntry?.name ?? "this mech";

    const confirmed = await Dialog.confirm({
      title: "Remove Mech Shortcut",
      content: `<p>Remove the shortcut to <strong>${mechName}</strong>?</p>`,
      defaultYes: false
    });

    if (!confirmed) return;
    
    // Bidirectional: Also remove pilot link from the mech
    if (mechEntry?.id) {
      const mechActor = game.actors?.get(mechEntry.id);
      if (mechActor && mechActor.system.pilotLink === this.actor.id) {
        await mechActor.update({ "system.pilotLink": null });
      }
    }
    
    links.splice(index, 1);
    return this.actor.update({ "system.mechLinks": links });
  }

  /**
   * @override
   * Enforce personal-loadout slot limits when items are dropped.
   */
  async _onDropItem(event, data) {
    let item;
    try {
      item = await Item.implementation.fromDropData(data);
    } catch {
      return super._onDropItem(event, data);
    }

    // Items already on this actor are just being re-sorted — allow freely.
    if (this.actor.items.has(item.id)) {
      return super._onDropItem(event, data);
    }

    // Slot limits: 1 armor, 2 weapons, 3 gear
    const limits = { armor: 1, weapon: 2, gear: 3 };
    if (limits[item.type] !== undefined) {
      const owned = Array.from(this.actor.items).filter(i => i.type === item.type);
      if (owned.length >= limits[item.type]) {
        ui.notifications.warn(
          `Loadout full — max ${limits[item.type]} ${item.type} item(s) allowed.`
        );
        return false;
      }
    }

    return super._onDropItem(event, data);
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    
    // Set up native drag events for macro bar
    const sheet = this;
    html[0].querySelectorAll(".skill-check, .hase-roll-btn, .item-attack").forEach(el => {
      el.setAttribute("draggable", "true");
      el.addEventListener("dragstart", (ev) => {
        ev.stopPropagation();
        const target = ev.currentTarget;
        let dragData = null;
        
        if (target.classList.contains("skill-check")) {
          dragData = {
            type: "lancerMacro",
            macroType: "skillCheck",
            actorId: sheet.actor.id,
            label: `${sheet.actor.name} - Skill Check`,
            img: "icons/svg/dice-target.svg"
          };
        } else if (target.classList.contains("hase-roll-btn")) {
          const skill = target.dataset.skill;
          dragData = {
            type: "lancerMacro",
            macroType: "haseCheck",
            actorId: sheet.actor.id,
            skill: skill,
            label: `${sheet.actor.name} - ${skill.charAt(0).toUpperCase() + skill.slice(1)} Check`,
            img: "icons/svg/dice-target.svg"
          };
        } else if (target.classList.contains("item-attack")) {
          const row = target.closest("[data-item-id]");
          const itemId = row?.dataset.itemId;
          const item = sheet.actor.items.get(itemId);
          if (item) {
            dragData = {
              type: "lancerMacro",
              macroType: "weaponAttack",
              actorId: sheet.actor.id,
              itemId: itemId,
              label: `${sheet.actor.name} - ${item.name}`,
              img: item.img || "icons/svg/sword.svg"
            };
          }
        }
        
        if (dragData) {
          ev.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        }
      }, false);
    });

    if (!this.isEditable) return;

    // Triggers
    html.find(".trigger-add").click(this._onAddTrigger.bind(this));
    html.find(".trigger-delete").click(this._onDeleteEntry.bind(this, "triggers"));

    // Licenses
    html.find(".license-add").click(this._onAddLicense.bind(this));
    html.find(".license-delete").click(this._onDeleteEntry.bind(this, "licenses"));

    // Create new owned items
    html.find(".item-create").click(this._onCreateItem.bind(this));

    // Click on item row to open sheet
    html.find(".item-row").click(this._onOpenItem.bind(this));

    // Toggle lock on items
    html.find(".item-lock").click(this._onToggleLock.bind(this));

    // Delete owned items (with confirmation)
    html.find(".item-delete").click(this._onDeleteItem.bind(this));

    // Send item to chat
    html.find(".item-chat").click(this._onChatItem.bind(this));

    // Skill Check button
    html.find(".skill-check").click(this._onSkillCheck.bind(this));

    // Weapon attack button
    html.find(".item-attack").click(this._onWeaponAttack.bind(this));

    // HASE skill check buttons
    html.find(".hase-roll-btn").click(this._onHASECheck.bind(this));

    // Mech link slots — click to open, X to delete
    html.find(".mech-link-slot.filled").click(this._onOpenMechLink.bind(this));
    html.find(".mech-link-delete").click(this._onDeleteMechLink.bind(this));

    // Trigger highlight
    html.find(".trigger-highlight").click(this._onToggleTriggerHighlight.bind(this));

    // Apply highlight styling to the currently highlighted trigger
    if (this._highlightedTriggerIndex !== null) {
      html.find(`.trigger-entry[data-index="${this._highlightedTriggerIndex}"]`).addClass("highlighted");
    }
  }

  /* -------------------------------------------- */
  /*  Item creation                               */
  /* -------------------------------------------- */

  /**
   * Create a new owned Item on this actor from a "+ Add" button.
   * The button must have data-type set to the item type.
   */
  async _onCreateItem(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type;

    // Friendly labels for each type
    const labels = {
      talent: "New Talent",
      core_bonus: "New Core Bonus",
      armor: "New Armor",
      weapon: "New Weapon",
      gear: "New Gear"
    };

    // Enforce loadout slot limits before creating
    const limits = { armor: 1, weapon: 2, gear: 3 };
    if (limits[type] !== undefined) {
      const owned = Array.from(this.actor.items).filter(i => i.type === type);
      if (owned.length >= limits[type]) {
        ui.notifications.warn(
          `Loadout full — max ${limits[type]} ${type} item(s) allowed.`
        );
        return;
      }
    }

    const itemData = [{
      name: labels[type] || `New ${type}`,
      type: type,
      system: {}
    }];

    await this.actor.createEmbeddedDocuments("Item", itemData);
  }

  /* -------------------------------------------- */
  /*  Array-field helpers                         */
  /* -------------------------------------------- */

  /** Add a blank trigger row. */
  async _onAddTrigger(event) {
    event.preventDefault();
    const arr = foundry.utils.duplicate(this.actor.system.triggers ?? []);
    arr.push({ name: "", level: 2 });
    return this.actor.update({ "system.triggers": arr });
  }

  /** Add a blank license row. */
  async _onAddLicense(event) {
    event.preventDefault();
    const arr = foundry.utils.duplicate(this.actor.system.licenses ?? []);
    arr.push({ name: "", rank: 1 });
    return this.actor.update({ "system.licenses": arr });
  }

  /**
   * Delete a row from an array field by index.
   * Shows a confirmation dialog before deleting.
   */
  async _onDeleteEntry(arrayKey, event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const arr = foundry.utils.duplicate(this.actor.system[arrayKey] ?? []);

    const entry = arr[index];
    const label = arrayKey === "triggers" ? "trigger" : "license";
    const entryName = entry?.name || `Unnamed ${label}`;

    const confirmed = await Dialog.confirm({
      title: `Delete ${label}`,
      content: `<p>Are you sure you want to delete <strong>${entryName}</strong>?</p>`,
      defaultYes: false
    });

    if (!confirmed) return;

    arr.splice(index, 1);
    return this.actor.update({ [`system.${arrayKey}`]: arr });
  }

  /**
   * Delete an owned item.
   * Shows a confirmation dialog before deleting.
   */
  async _onDeleteItem(event) {
    event.preventDefault();
    event.stopPropagation();
    const li = $(event.currentTarget).closest("[data-item-id]");
    const id = li.data("item-id") || li.data("itemId");
    const item = this.actor.items.get(id);
    if (!item) return;

    const confirmed = await Dialog.confirm({
      title: `Delete ${item.name}`,
      content: `<p>Are you sure you want to delete <strong>${item.name}</strong>?</p>`,
      defaultYes: false
    });

    if (!confirmed) return;
    return item.delete();
  }

  /**
   * Open an item sheet when clicking anywhere on the item row.
   */
  _onOpenItem(event) {
    // Don't open if clicking on a control button
    if ($(event.target).closest(".item-controls").length) return;
    
    const li = $(event.currentTarget).closest("[data-item-id]");
    const id = li.data("item-id") || li.data("itemId");
    const item = this.actor.items.get(id);
    if (item) item.sheet.render(true);
  }

  /**
   * Toggle the locked state of an item.
   */
  async _onToggleLock(event) {
    event.preventDefault();
    event.stopPropagation();
    const li = $(event.currentTarget).closest("[data-item-id]");
    const id = li.data("item-id") || li.data("itemId");
    const item = this.actor.items.get(id);
    if (!item) return;

    const locked = !item.system.locked;
    return item.update({ "system.locked": locked });
  }

  /**
   * Send an item's details to chat.
   */
  async _onChatItem(event) {
    event.preventDefault();
    event.stopPropagation();
    const li = $(event.currentTarget).closest("[data-item-id]");
    const id = li.data("item-id") || li.data("itemId");
    const item = this.actor.items.get(id);
    if (!item) return;

    // Type labels for display
    const typeLabels = {
      weapon: "Weapon",
      armor: "Armor",
      gear: "Gear",
      talent: "Talent",
      core_bonus: "Core Bonus",
      system: "System",
      frame_trait: "Frame Trait",
      core_system: "Core System"
    };
    const typeLabel = typeLabels[item.type] || item.type;

    // Build chat content - always include type
    let content = `<h3>${item.name}</h3><p><em>${typeLabel}</em></p>`;

    // Add type-specific details
    if (item.type === "weapon") {
      const details = [];
      if (item.system.mount) details.push(`<strong>Mount:</strong> ${item.system.mount}`);
      if (item.system.type) details.push(`<strong>Type:</strong> ${item.system.type}`);
      if (item.system.damage) details.push(`<strong>Damage:</strong> ${item.system.damage}`);
      if (item.system.range) details.push(`<strong>Range:</strong> ${item.system.range}`);
      if (item.system.tags) details.push(`<strong>Tags:</strong> ${item.system.tags}`);
      if (details.length) content = `<h3>${item.name}</h3><p><em>${typeLabel}</em></p><p>${details.join(" | ")}</p>${item.system.description ? `<p>${item.system.description}</p>` : ""}`;
    } else if (item.type === "armor") {
      const details = [];
      if (item.system.hp_bonus) details.push(`<strong>HP:</strong> +${item.system.hp_bonus}`);
      if (item.system.armor) details.push(`<strong>Armor:</strong> ${item.system.armor}`);
      if (item.system.evasion) details.push(`<strong>Evasion:</strong> ${item.system.evasion}`);
      if (item.system.edef) details.push(`<strong>E-Def:</strong> ${item.system.edef}`);
      if (item.system.speed) details.push(`<strong>Speed:</strong> ${item.system.speed}`);
      if (item.system.tags) details.push(`<strong>Tags:</strong> ${item.system.tags}`);
      if (details.length) content = `<h3>${item.name}</h3><p><em>${typeLabel}</em></p><p>${details.join(" | ")}</p>${item.system.description ? `<p>${item.system.description}</p>` : ""}`;
    } else if (item.type === "gear") {
      const details = [];
      if (item.system.uses) details.push(`<strong>Uses:</strong> ${item.system.uses}`);
      if (item.system.tags) details.push(`<strong>Tags:</strong> ${item.system.tags}`);
      if (details.length) content = `<h3>${item.name}</h3><p><em>${typeLabel}</em></p><p>${details.join(" | ")}</p>${item.system.description ? `<p>${item.system.description}</p>` : ""}`;
    } else if (item.type === "talent") {
      content = `<h3>${item.name}</h3><p><em>${typeLabel}</em></p><p><strong>Rank:</strong> ${item.system.rank}</p>${item.system.description ? `<p>${item.system.description}</p>` : ""}`;
    } else if (item.type === "core_bonus") {
      const source = item.system.source ? `<p><strong>Source:</strong> ${item.system.source}</p>` : "";
      content = `<h3>${item.name}</h3><p><em>${typeLabel}</em></p>${source}${item.system.description ? `<p>${item.system.description}</p>` : ""}`;
    } else {
      // Generic fallback for other types
      if (item.system.description) {
        content += `<p>${item.system.description}</p>`;
      }
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: content
    });
  }

  /**
   * Handle Skill Check button click.
   * Opens a dialog to configure and roll a d20 with accuracy/difficulty.
   */
  /**
   * Toggle trigger highlight for skill checks.
   */
  _onToggleTriggerHighlight(event) {
    event.preventDefault();
    event.stopPropagation();
    const index = Number(event.currentTarget.dataset.index);

    // Toggle highlight
    if (this._highlightedTriggerIndex === index) {
      this._highlightedTriggerIndex = null;
    } else {
      this._highlightedTriggerIndex = index;
    }

    // Re-render to update styling
    this.render(false);
  }

  async _onSkillCheck(event) {
    event.preventDefault();

    // Get trigger info if highlighted (separate from manual bonus)
    let triggerBonus = 0;
    let triggerName = "";
    if (this._highlightedTriggerIndex !== null) {
      const triggers = this.actor.system.triggers || [];
      const highlightedTrigger = triggers[this._highlightedTriggerIndex];
      if (highlightedTrigger) {
        triggerBonus = highlightedTrigger.level || 0;
        triggerName = highlightedTrigger.name || "Trigger";
      }
    }

    // Show trigger info in dialog if one is selected
    const triggerInfo = triggerName ? `<p style="color: var(--lnc-accent, #cc2936); margin-bottom:12px;"><strong>Trigger:</strong> ${triggerName} (+${triggerBonus})</p>` : "";

    const dialogContent = `
      <form class="skill-check-dialog">
        ${triggerInfo}
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
          <label style="font-weight:bold; width:60px;">Bonus:</label>
          <input type="number" name="bonus" value="0" style="width:60px; text-align:center;" />
        </div>
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
          <label style="font-weight:bold; width:60px;">Accuracy:</label>
          <button type="button" class="acc-minus" style="width:28px;">−</button>
          <span class="acc-value" style="width:30px; text-align:center; font-weight:bold;">0</span>
          <button type="button" class="acc-plus" style="width:28px;">+</button>
        </div>
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
          <label style="font-weight:bold; width:60px;">Difficulty:</label>
          <button type="button" class="diff-minus" style="width:28px;">−</button>
          <span class="diff-value" style="width:30px; text-align:center; font-weight:bold;">0</span>
          <button type="button" class="diff-plus" style="width:28px;">+</button>
        </div>
      </form>
    `;

    const dialog = new Dialog({
      title: "Skill Check",
      content: dialogContent,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Roll",
          callback: async (html) => {
            const bonus = parseInt(html.find('[name="bonus"]').val()) || 0;
            const accuracy = parseInt(html.find('.acc-value').text()) || 0;
            const difficulty = parseInt(html.find('.diff-value').text()) || 0;

            // Calculate net accuracy/difficulty
            const net = accuracy - difficulty;

            // Build the roll formula - roll all dice together
            let formula = "1d20";
            if (net !== 0) {
              const d6Count = Math.abs(net);
              formula += ` + ${d6Count}d6`;
            }

            // Roll all dice at once
            const roll = await new Roll(formula).evaluate();
            
            // Show 3D dice if Dice So Nice is available (all dice together)
            if (game.dice3d) {
              await game.dice3d.showForRoll(roll, game.user, true);
            }
            
            // Extract d20 result
            const d20Result = roll.dice[0].results[0].result;

            let d6Text = "";
            let d6Result = 0;

            // If there's net accuracy or difficulty, get d6 results
            if (net !== 0) {
              const d6Count = Math.abs(net);
              const d6Results = roll.dice[1].results.map(r => r.result);
              // Take the highest d6 from the second dice term
              d6Result = Math.max(...d6Results);
              
              // Format all dice, highlighting the chosen (highest) one
              const d6Display = d6Results.map(r => 
                r === d6Result 
                  ? `<strong>${r}</strong>` 
                  : `<span style="opacity: 0.5;">${r}</span>`
              ).join(", ");
              
              if (net > 0) {
                d6Text = ` + ${d6Count}d6 Accuracy [${d6Display}]`;
              } else {
                d6Text = ` - ${d6Count}d6 Difficulty [${d6Display}]`;
                d6Result = -d6Result;
              }
            }

            // Calculate final result - trigger bonus is separate from dialog bonus
            // triggerBonus and triggerName are captured in closure from dialog creation
            let total = d20Result + d6Result + triggerBonus + bonus;
            
            // Build bonus text with labels
            let bonusParts = [];
            if (triggerBonus !== 0) {
              bonusParts.push(`+${triggerBonus} Trigger (${triggerName})`);
            }
            if (bonus !== 0) {
              bonusParts.push(`${bonus > 0 ? "+" : ""}${bonus} Bonus`);
            }
            let bonusText = bonusParts.length > 0 ? " " + bonusParts.join(" ") : "";

            // Build chat message
            const content = `
              <h3>Skill Check</h3>
              <p><strong>1d20</strong> (${d20Result})${d6Text}${bonusText} = <span style="font-size: 1.4em; font-weight: bold; color: var(--lnc-accent, #cc2936);">${total}</span></p>
            `;

            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              content: content
            });

            // Clear trigger highlight after rolling
            this._highlightedTriggerIndex = null;
            this.render(false);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "roll",
      render: (html) => {
        let acc = 0;
        let diff = 0;

        html.find('.acc-plus').click(() => {
          acc++;
          html.find('.acc-value').text(acc);
        });
        html.find('.acc-minus').click(() => {
          acc = Math.max(0, acc - 1);
          html.find('.acc-value').text(acc);
        });
        html.find('.diff-plus').click(() => {
          diff++;
          html.find('.diff-value').text(diff);
        });
        html.find('.diff-minus').click(() => {
          diff = Math.max(0, diff - 1);
          html.find('.diff-value').text(diff);
        });
      }
    });

    dialog.render(true);
  }

  /**
   * Handle weapon attack button click.
   */
  async _onWeaponAttack(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const li = $(event.currentTarget).closest("[data-item-id]");
    const id = li.data("item-id") || li.data("itemId");
    const item = this.actor.items.get(id);
    if (!item) return;

    const grit = this.actor.system.grit || 0;
    const weaponName = item.name;
    const damageRaw = item.system.damage || "";
    const weaponAccuracy = item.system.accuracy || 0;
    const weaponDifficulty = item.system.difficulty || 0;
    const weaponBonus = item.system.attack_bonus || 0;

    // Parse damage formula ahead of time
    const diceMatch = damageRaw.match(/(\d+)d(\d+)/i);
    let baseDiceCount = 0;
    let diceSize = 0;
    let damageBonus = 0;
    let damageType = "";
    
    if (diceMatch) {
      baseDiceCount = parseInt(diceMatch[1]);
      diceSize = parseInt(diceMatch[2]);
      const bonusMatch = damageRaw.match(/[+-]\s*(\d+)(?!\s*d)/);
      damageBonus = bonusMatch ? parseInt(bonusMatch[0].replace(/\s/g, "")) : 0;
      damageType = damageRaw.replace(diceMatch[0], "").replace(/[+-]\s*\d+(?!\s*d)/, "").trim();
    }

    const dialogContent = `
      <form class="attack-dialog">
        <p style="margin-bottom:12px;"><strong>${weaponName}</strong></p>
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
          <label style="font-weight:bold; width:60px;">Bonus:</label>
          <input type="number" name="bonus" value="${weaponBonus}" style="width:60px; text-align:center;" />
        </div>
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
          <label style="font-weight:bold; width:60px;">Accuracy:</label>
          <button type="button" class="acc-minus" style="width:28px;">-</button>
          <span class="acc-value" style="width:30px; text-align:center; font-weight:bold;">${weaponAccuracy}</span>
          <button type="button" class="acc-plus" style="width:28px;">+</button>
        </div>
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
          <label style="font-weight:bold; width:60px;">Difficulty:</label>
          <button type="button" class="diff-minus" style="width:28px;">-</button>
          <span class="diff-value" style="width:30px; text-align:center; font-weight:bold;">${weaponDifficulty}</span>
          <button type="button" class="diff-plus" style="width:28px;">+</button>
        </div>
      </form>
    `;

    const dialog = new Dialog({
      title: `Attack - ${weaponName}`,
      content: dialogContent,
      buttons: {
        attack: {
          icon: '<i class="fas fa-crosshairs"></i>',
          label: "Attack",
          callback: async (html) => {
            const bonus = parseInt(html.find('[name="bonus"]').val()) || 0;
            const accuracy = parseInt(html.find('.acc-value').text()) || 0;
            const difficulty = parseInt(html.find('.diff-value').text()) || 0;
            const net = accuracy - difficulty;

            // Build attack roll formula
            let attackFormula = "1d20";
            if (net !== 0) {
              const d6Count = Math.abs(net);
              attackFormula += ` + ${d6Count}d6`;
            }

            // Roll attack
            const attackRoll = await new Roll(attackFormula).evaluate();
            
            // Show attack dice in Dice So Nice (don't wait for full animation)
            if (game.dice3d) {
              game.dice3d.showForRoll(attackRoll, game.user, true);
            }

            // Parse attack results
            const d20Result = attackRoll.dice[0].results[0].result;

            let d6Text = "";
            let d6Result = 0;

            if (net !== 0) {
              const d6Count = Math.abs(net);
              const d6Results = attackRoll.dice[1].results.map(r => r.result);
              d6Result = Math.max(...d6Results);
              let highlightedOne = false;
              const d6Display = d6Results.map(r => {
                if (r === d6Result && !highlightedOne) {
                  highlightedOne = true;
                  return `<strong>${r}</strong>`;
                }
                return `<span style="opacity: 0.5;">${r}</span>`;
              }).join(", ");
              
              if (net > 0) {
                d6Text = ` + ${d6Count}d6 Accuracy [${d6Display}]`;
              } else {
                d6Text = ` - ${d6Count}d6 Difficulty [${d6Display}]`;
                d6Result = -d6Result;
              }
            }

            const total = d20Result + d6Result + grit + bonus;
            const isCrit = total >= 20;

            let gritText = "";
            if (grit > 0) gritText = ` + ${grit} Grit`;
            else if (grit < 0) gritText = ` - ${Math.abs(grit)} Grit`;

            let bonusText = "";
            if (bonus > 0) bonusText = ` + ${bonus} Bonus`;
            else if (bonus < 0) bonusText = ` - ${Math.abs(bonus)} Bonus`;

            // Build weapon details line
            const weaponDetails = [];
            if (item.system.mount) weaponDetails.push(item.system.mount);
            if (item.system.type) weaponDetails.push(item.system.type);
            if (item.system.range) weaponDetails.push(`Range ${item.system.range}`);
            if (item.system.tags) weaponDetails.push(item.system.tags);
            const weaponDetailsText = weaponDetails.length > 0 ? `<p style="opacity: 0.8; font-size: 0.9em;">${weaponDetails.join(" • ")}</p>` : "";

            // Build attack result
            let content = `<h3>${weaponName} - Attack</h3>`;
            content += weaponDetailsText;
            content += `<p><strong>1d20</strong> (${d20Result})${d6Text}${gritText}${bonusText} = <span style="font-size: 1.4em; font-weight: bold; color: var(--lnc-accent, #cc2936);">${total}</span></p>`;

            if (isCrit) {
              content += `<p style="color: var(--lnc-accent, #cc2936); font-weight: bold; font-size: 1.2em;">CRITICAL HIT!</p>`;
            }

            // Roll damage separately
            if (baseDiceCount > 0) {
              const damageFormula = `${baseDiceCount}d${diceSize}`;
              const damageRoll = await new Roll(damageFormula).evaluate();
              
              // Show damage dice in Dice So Nice
              if (game.dice3d) {
                await game.dice3d.showForRoll(damageRoll, game.user, true);
              }

              const damageResults = damageRoll.dice[0].results.map(r => r.result);
              let damageTotal;
              let damageDisplay;
              let bonusText = damageBonus !== 0 ? (damageBonus > 0 ? ` + ${damageBonus}` : ` - ${Math.abs(damageBonus)}`) : "";

              if (isCrit) {
                // Crit: roll damage twice, take higher total
                const roll1Total = damageResults.reduce((a, b) => a + b, 0);
                const roll1Display = damageResults.join(", ");
                
                // Second damage roll
                const damageRoll2 = await new Roll(damageFormula).evaluate();
                if (game.dice3d) {
                  await game.dice3d.showForRoll(damageRoll2, game.user, true);
                }
                const damageResults2 = damageRoll2.dice[0].results.map(r => r.result);
                const roll2Total = damageResults2.reduce((a, b) => a + b, 0);
                const roll2Display = damageResults2.join(", ");
                
                // Choose higher roll
                const chosenRoll = roll1Total >= roll2Total ? 1 : 2;
                damageTotal = Math.max(roll1Total, roll2Total) + damageBonus;
                
                content += `<p><strong>Damage (Critical):</strong> ${baseDiceCount}d${diceSize}${bonusText} ${damageType}</p>`;
                content += `<p style="margin-left: 12px;">Roll 1: [${roll1Display}] = ${roll1Total}${chosenRoll === 1 ? " <strong>chosen</strong>" : ""}</p>`;
                content += `<p style="margin-left: 12px;">Roll 2: [${roll2Display}] = ${roll2Total}${chosenRoll === 2 ? " <strong>chosen</strong>" : ""}</p>`;
                content += `<p><strong>Total:</strong> <span style="font-size: 1.4em; font-weight: bold; color: var(--lnc-accent, #cc2936);">${damageTotal}</span></p>`;
              } else {
                // Normal: sum all dice
                damageTotal = damageResults.reduce((a, b) => a + b, 0) + damageBonus;
                damageDisplay = damageResults.join(", ");
                content += `<p><strong>Damage:</strong> ${baseDiceCount}d${diceSize}${bonusText} ${damageType} [${damageDisplay}] = <span style="font-size: 1.4em; font-weight: bold; color: var(--lnc-accent, #cc2936);">${damageTotal}</span></p>`;
              }
            } else if (damageRaw) {
              content += `<p><strong>Damage:</strong> ${damageRaw}</p>`;
            }

            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              content: content
            });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "attack",
      render: (html) => {
        let acc = weaponAccuracy;
        let diff = weaponDifficulty;

        html.find('.acc-plus').click(() => {
          acc++;
          html.find('.acc-value').text(acc);
        });
        html.find('.acc-minus').click(() => {
          acc = Math.max(0, acc - 1);
          html.find('.acc-value').text(acc);
        });
        html.find('.diff-plus').click(() => {
          diff++;
          html.find('.diff-value').text(diff);
        });
        html.find('.diff-minus').click(() => {
          diff = Math.max(0, diff - 1);
          html.find('.diff-value').text(diff);
        });
      }
    });

    dialog.render(true);
  }

  /**
   * Handle HASE skill check button click.
   */
  async _onHASECheck(event) {
    event.preventDefault();
    event.stopPropagation();

    const skill = event.currentTarget.dataset.skill;
    const skillValue = this.actor.system[skill] || 0;
    const skillLabel = skill.charAt(0).toUpperCase() + skill.slice(1);

    const dialogContent = `
      <form class="hase-check-dialog">
        <p style="margin-bottom:12px;"><strong>${skillLabel} Check</strong> (Base: +${skillValue})</p>
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
          <label style="font-weight:bold; width:60px;">Bonus:</label>
          <input type="number" name="bonus" value="0" style="width:60px; text-align:center;" />
        </div>
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
          <label style="font-weight:bold; width:60px;">Accuracy:</label>
          <button type="button" class="acc-minus" style="width:28px;">-</button>
          <span class="acc-value" style="width:30px; text-align:center; font-weight:bold;">0</span>
          <button type="button" class="acc-plus" style="width:28px;">+</button>
        </div>
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
          <label style="font-weight:bold; width:60px;">Difficulty:</label>
          <button type="button" class="diff-minus" style="width:28px;">-</button>
          <span class="diff-value" style="width:30px; text-align:center; font-weight:bold;">0</span>
          <button type="button" class="diff-plus" style="width:28px;">+</button>
        </div>
      </form>
    `;

    const dialog = new Dialog({
      title: `${skillLabel} Check`,
      content: dialogContent,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Roll",
          callback: async (html) => {
            const bonus = parseInt(html.find('[name="bonus"]').val()) || 0;
            const accuracy = parseInt(html.find('.acc-value').text()) || 0;
            const difficulty = parseInt(html.find('.diff-value').text()) || 0;
            const net = accuracy - difficulty;

            // Build roll formula
            let formula = "1d20";
            if (net !== 0) {
              const d6Count = Math.abs(net);
              formula += ` + ${d6Count}d6`;
            }

            // Roll all dice at once
            const roll = await new Roll(formula).evaluate();

            // Show dice in Dice So Nice
            if (game.dice3d) {
              await game.dice3d.showForRoll(roll, game.user, true);
            }

            // Extract d20 result
            const d20Result = roll.dice[0].results[0].result;

            let d6Text = "";
            let d6Result = 0;

            if (net !== 0) {
              const d6Count = Math.abs(net);
              const d6Results = roll.dice[1].results.map(r => r.result);
              d6Result = Math.max(...d6Results);

              let highlightedOne = false;
              const d6Display = d6Results.map(r => {
                if (r === d6Result && !highlightedOne) {
                  highlightedOne = true;
                  return `<strong>${r}</strong>`;
                }
                return `<span style="opacity: 0.5;">${r}</span>`;
              }).join(", ");

              if (net > 0) {
                d6Text = ` + ${d6Count}d6 Accuracy [${d6Display}]`;
              } else {
                d6Text = ` - ${d6Count}d6 Difficulty [${d6Display}]`;
                d6Result = -d6Result;
              }
            }

            // Calculate total with HASE skill
            const total = d20Result + d6Result + skillValue + bonus;

            let skillText = "";
            if (skillValue > 0) skillText = ` + ${skillValue} ${skillLabel}`;
            else if (skillValue < 0) skillText = ` - ${Math.abs(skillValue)} ${skillLabel}`;

            let bonusText = "";
            if (bonus > 0) bonusText = ` + ${bonus} Bonus`;
            else if (bonus < 0) bonusText = ` - ${Math.abs(bonus)} Bonus`;

            // Build chat message
            const content = `
              <h3>${skillLabel} Check</h3>
              <p><strong>1d20</strong> (${d20Result})${d6Text}${skillText}${bonusText} = <span style="font-size: 1.4em; font-weight: bold; color: var(--lnc-accent, #cc2936);">${total}</span></p>
            `;

            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              content: content
            });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "roll",
      render: (html) => {
        let acc = 0;
        let diff = 0;

        html.find('.acc-plus').click(() => {
          acc++;
          html.find('.acc-value').text(acc);
        });
        html.find('.acc-minus').click(() => {
          acc = Math.max(0, acc - 1);
          html.find('.acc-value').text(acc);
        });
        html.find('.diff-plus').click(() => {
          diff++;
          html.find('.diff-value').text(diff);
        });
        html.find('.diff-minus').click(() => {
          diff = Math.max(0, diff - 1);
          html.find('.diff-value').text(diff);
        });
      }
    });

    dialog.render(true);
  }
}
