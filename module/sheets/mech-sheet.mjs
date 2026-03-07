/**
 * Lancer Minimal — Mech Actor Sheet
 * Extends the core ActorSheet for mech-type actors.
 */
export class LancerMechSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["lancer-minimal", "sheet", "actor", "mech-sheet"],
      template: "systems/lancer-minimal/templates/mech-sheet.hbs",
      width: 700,
      height: 780,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "loadout" }]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    const context = await super.getData();
    const actorData = this.actor.toObject(false);
    const system = foundry.utils.duplicate(this.actor.system);

    context.system = system;
    context.actor = actorData;

    // Partition owned items by type for the template
    const items = Array.from(this.actor.items).map(i => i.toObject(false));
    context.weapons = items.filter(i => i.type === "weapon")
      .sort((a, b) => (a.system.mount || "").localeCompare(b.system.mount || ""));
    context.systems = items.filter(i => i.type === "system");
    context.frameTraits = items.filter(i => i.type === "frame_trait");
    context.coreSystems = items.filter(i => i.type === "core_system");
    context.coreBonuses = items.filter(i => i.type === "core_bonus");

    // Resolve pilot link
    const pilotId = system.pilotLink;
    if (pilotId) {
      const pilot = game.actors?.get(pilotId);
      context.pilotLink = pilot ? { id: pilotId, name: pilot.name } : null;
    } else {
      context.pilotLink = null;
    }

    // Get active effects for status display on portrait
    context.effects = Array.from(this.actor.effects).map(e => ({
      icon: e.icon,
      label: e.name || e.label,
      id: e.id
    }));

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    
    // Set up native drag events for macro bar
    const sheet = this;
    html[0].querySelectorAll(".hase-roll-btn, .tech-attack-btn, .structure-roll-btn, .stress-roll-btn, .item-attack").forEach(el => {
      el.setAttribute("draggable", "true");
      el.addEventListener("dragstart", (ev) => {
        ev.stopPropagation();
        const target = ev.currentTarget;
        let dragData = null;
        
        if (target.classList.contains("hase-roll-btn")) {
          const skill = target.dataset.skill;
          dragData = {
            type: "lancerMacro",
            macroType: "haseCheck",
            actorId: sheet.actor.id,
            skill: skill,
            label: `${sheet.actor.name} - ${skill.charAt(0).toUpperCase() + skill.slice(1)} Check`,
            img: "icons/svg/dice-target.svg"
          };
        } else if (target.classList.contains("tech-attack-btn")) {
          dragData = {
            type: "lancerMacro",
            macroType: "techAttack",
            actorId: sheet.actor.id,
            label: `${sheet.actor.name} - Tech Attack`,
            img: "icons/svg/lightning.svg"
          };
        } else if (target.classList.contains("structure-roll-btn")) {
          dragData = {
            type: "lancerMacro",
            macroType: "structureRoll",
            actorId: sheet.actor.id,
            label: `${sheet.actor.name} - Structure Roll`,
            img: "icons/svg/explosion.svg"
          };
        } else if (target.classList.contains("stress-roll-btn")) {
          dragData = {
            type: "lancerMacro",
            macroType: "stressRoll",
            actorId: sheet.actor.id,
            label: `${sheet.actor.name} - Overheat Roll`,
            img: "icons/svg/fire.svg"
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

    // Weapon attack button
    html.find(".item-attack").click(this._onWeaponAttack.bind(this));

    // Tech attack button
    html.find(".tech-attack-btn").click(this._onTechAttack.bind(this));

    // HASE skill check buttons
    html.find(".hase-roll-btn").click(this._onHASECheck.bind(this));

    // Structure damage roll
    html.find(".structure-roll-btn").click(this._onStructureRoll.bind(this));

    // Overheat roll
    html.find(".stress-roll-btn").click(this._onStressRoll.bind(this));

    // Pilot link
    html.find(".pilot-link-slot.filled").click(this._onOpenPilotLink.bind(this));
    html.find(".pilot-link-clear").click(this._onClearPilotLink.bind(this));
  }

  /**
   * Handle drops on the mech sheet - intercept pilot actor drops.
   */
  async _onDrop(event) {
    let dropData;
    try {
      dropData = JSON.parse(event.dataTransfer?.getData("text/plain") ?? "{}");
    } catch {
      return super._onDrop(event);
    }

    if (dropData.type === "Actor") {
      const actor = await Actor.implementation.fromDropData(dropData);
      if (actor && actor.type === "pilot") {
        return this._onDropPilotLink(actor);
      }
    }

    return super._onDrop(event);
  }

  /**
   * Handle dropping a pilot actor to create a link.
   */
  async _onDropPilotLink(pilotActor) {
    return this.actor.update({ "system.pilotLink": pilotActor.id });
  }

  /**
   * Open the linked pilot's sheet.
   */
  _onOpenPilotLink(event) {
    if ($(event.target).closest(".pilot-link-clear").length) return;
    const pilotId = event.currentTarget.dataset.pilotId;
    const actor = game.actors?.get(pilotId);
    if (actor) actor.sheet.render(true);
    else ui.notifications.warn("Linked pilot not found.");
  }

  /**
   * Clear the pilot link (with confirmation).
   */
  async _onClearPilotLink(event) {
    event.preventDefault();
    event.stopPropagation();

    const confirmed = await Dialog.confirm({
      title: "Remove Pilot Link",
      content: "<p>Remove the link to this pilot?</p>",
      defaultYes: false
    });

    if (!confirmed) return;
    return this.actor.update({ "system.pilotLink": null });
  }

  /* -------------------------------------------- */
  /*  Item creation                               */
  /* -------------------------------------------- */

  /**
   * Create a new owned Item on this actor from a "+ Add" button.
   */
  async _onCreateItem(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type;

    const labels = {
      weapon: "New Weapon",
      system: "New System",
      frame_trait: "New Frame Trait",
      core_system: "New Core System",
      core_bonus: "New Core Bonus"
    };

    const itemData = [{
      name: labels[type] || `New ${type}`,
      type: type,
      system: {}
    }];

    await this.actor.createEmbeddedDocuments("Item", itemData);
  }

  /* -------------------------------------------- */

  /**
   * Delete an owned item with confirmation.
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
    } else if (item.type === "system") {
      const details = [];
      if (item.system.sp) details.push(`<strong>SP:</strong> ${item.system.sp}`);
      if (item.system.tags) details.push(`<strong>Tags:</strong> ${item.system.tags}`);
      if (details.length) content = `<h3>${item.name}</h3><p><em>${typeLabel}</em></p><p>${details.join(" | ")}</p>${item.system.description ? `<p>${item.system.description}</p>` : ""}`;
    } else if (item.type === "frame_trait") {
      content = `<h3>${item.name}</h3><p><em>${typeLabel}</em></p>${item.system.description ? `<p>${item.system.description}</p>` : ""}`;
    } else if (item.type === "core_system") {
      const tags = item.system.tags ? `<p><strong>Tags:</strong> ${item.system.tags}</p>` : "";
      content = `<h3>${item.name}</h3><p><em>${typeLabel}</em></p>${tags}${item.system.description ? `<p>${item.system.description}</p>` : ""}`;
    } else {
      // Generic fallback
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
   * Handle weapon attack button click.
   */
  async _onWeaponAttack(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const li = $(event.currentTarget).closest("[data-item-id]");
    const id = li.data("item-id") || li.data("itemId");
    const item = this.actor.items.get(id);
    if (!item) return;

    const grit = this.actor.system.pilot_grit || 0;
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
   * Handle tech attack button click.
   */
  async _onTechAttack(event) {
    event.preventDefault();
    event.stopPropagation();

    const techAttack = this.actor.system.tech_attack || 0;

    const dialogContent = `
      <form class="tech-attack-dialog">
        <p style="margin-bottom:12px;"><strong>Tech Attack</strong></p>
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
      title: "Tech Attack",
      content: dialogContent,
      buttons: {
        roll: {
          icon: '<i class="fas fa-bolt"></i>',
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

            // Calculate total with tech attack bonus
            let total = d20Result + d6Result + techAttack + bonus;

            let techText = "";
            if (techAttack > 0) techText = ` + ${techAttack} Tech Atk`;
            else if (techAttack < 0) techText = ` - ${Math.abs(techAttack)} Tech Atk`;

            let bonusText = "";
            if (bonus > 0) bonusText = ` + ${bonus} Bonus`;
            else if (bonus < 0) bonusText = ` - ${Math.abs(bonus)} Bonus`;

            // Build chat message
            const content = `
              <h3>Tech Attack</h3>
              <p><strong>1d20</strong> (${d20Result})${d6Text}${techText}${bonusText} = <span style="font-size: 1.4em; font-weight: bold; color: var(--lnc-accent, #cc2936);">${total}</span></p>
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

  /**
   * Handle overheat/stress roll button click.
   */
  async _onStressRoll(event) {
    event.preventDefault();
    event.stopPropagation();

    const dialogContent = `
      <form class="stress-roll-dialog">
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
          <label style="font-weight:bold;">Stress Damage Taken:</label>
          <input type="number" name="damage" value="1" min="1" style="width:60px; text-align:center;" />
        </div>
      </form>
    `;

    const dialog = new Dialog({
      title: "Overheat Roll",
      content: dialogContent,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d6"></i>',
          label: "Roll",
          callback: async (html) => {
            const damage = parseInt(html.find('[name="damage"]').val()) || 1;

            const formula = `${damage}d6`;
            const roll = await new Roll(formula).evaluate();

            if (game.dice3d) {
              await game.dice3d.showForRoll(roll, game.user, true);
            }

            const results = roll.dice[0].results.map(r => r.result);
            const lowest = Math.min(...results);
            const onesCount = results.filter(r => r === 1).length;

            let resultText = "";
            let resultDescription = "";

            if (onesCount >= 2) {
              resultText = "IRREVERSIBLE MELTDOWN";
              resultDescription = "Reactor meltdown at the end of next turn.";
            } else if (lowest === 1) {
              resultText = "MELTDOWN";
              resultDescription = "Roll on the MELTDOWN table.";
            } else if (lowest >= 2 && lowest <= 4) {
              resultText = "DESTABILIZED POWER PLANT";
              resultDescription = "Your mech is EXPOSED.";
            } else {
              resultText = "EMERGENCY SHUNT";
              resultDescription = "Your mech is IMPAIRED.";
            }

            let highlightedOne = false;
            const diceDisplay = results.map(r => {
              if (r === lowest && !highlightedOne) {
                highlightedOne = true;
                return `<strong>${r}</strong>`;
              }
              return `<span style="opacity: 0.5;">${r}</span>`;
            }).join(", ");

            const content = `
              <h3>Overheat</h3>
              <p><strong>${damage}d6:</strong> [${diceDisplay}] → Lowest: <span style="font-size: 1.4em; font-weight: bold; color: var(--lnc-accent, #cc2936);">${lowest}</span></p>
              <p style="font-size: 1.3em; font-weight: bold; color: var(--lnc-accent, #cc2936);">${resultText}</p>
              <p>${resultDescription}</p>
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
      default: "roll"
    });

    dialog.render(true);
  }

  /**
   * Handle structure damage roll button click.
   */
  async _onStructureRoll(event) {
    event.preventDefault();
    event.stopPropagation();

    const dialogContent = `
      <form class="structure-roll-dialog">
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
          <label style="font-weight:bold;">Structure Damage Taken:</label>
          <input type="number" name="damage" value="1" min="1" style="width:60px; text-align:center;" />
        </div>
      </form>
    `;

    const dialog = new Dialog({
      title: "Structure Damage Roll",
      content: dialogContent,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d6"></i>',
          label: "Roll",
          callback: async (html) => {
            const damage = parseInt(html.find('[name="damage"]').val()) || 1;

            // Roll Xd6, take the lowest
            const formula = `${damage}d6`;
            const roll = await new Roll(formula).evaluate();

            // Show dice in Dice So Nice
            if (game.dice3d) {
              await game.dice3d.showForRoll(roll, game.user, true);
            }

            const results = roll.dice[0].results.map(r => r.result);
            const lowest = Math.min(...results);
            const onesCount = results.filter(r => r === 1).length;

            // Determine result
            let resultText = "";
            let resultDescription = "";

            if (onesCount >= 2) {
              resultText = "CRUSHING HIT";
              resultDescription = "The mech is destroyed.";
            } else if (lowest === 1) {
              resultText = "DIRECT HIT";
              resultDescription = "Roll on the DIRECT HIT table.";
            } else if (lowest >= 2 && lowest <= 4) {
              resultText = "SYSTEM TRAUMA";
              resultDescription = "Roll on the SYSTEM TRAUMA table.";
            } else {
              resultText = "GLANCING BLOW";
              resultDescription = "Your mech is IMPAIRED. No additional damage.";
            }

            // Highlight the lowest die
            let highlightedOne = false;
            const diceDisplay = results.map(r => {
              if (r === lowest && !highlightedOne) {
                highlightedOne = true;
                return `<strong>${r}</strong>`;
              }
              return `<span style="opacity: 0.5;">${r}</span>`;
            }).join(", ");

            const content = `
              <h3>Structure Damage</h3>
              <p><strong>${damage}d6:</strong> [${diceDisplay}] → Lowest: <span style="font-size: 1.4em; font-weight: bold; color: var(--lnc-accent, #cc2936);">${lowest}</span></p>
              <p style="font-size: 1.3em; font-weight: bold; color: var(--lnc-accent, #cc2936);">${resultText}</p>
              <p>${resultDescription}</p>
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
      default: "roll"
    });

    dialog.render(true);
  }
}
