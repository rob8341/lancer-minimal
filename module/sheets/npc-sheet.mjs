/**
 * Lancer Minimal — NPC Actor Sheet
 * Extends the core ActorSheet for NPC-type actors.
 */
export class LancerNpcSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["lancer-minimal", "sheet", "actor", "npc-sheet"],
      template: "systems/lancer-minimal/templates/npc-sheet.hbs",
      width: 650,
      height: 700,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "combat" }]
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

    // Partition owned items by type
    const items = Array.from(this.actor.items).map(i => i.toObject(false));
    context.weapons = items.filter(i => i.type === "weapon")
      .sort((a, b) => (a.system.mount || "").localeCompare(b.system.mount || ""));
    
    // Split systems into base and optional
    const allSystems = items.filter(i => i.type === "system");
    context.baseSystems = allSystems.filter(i => i.flags?.["lancer-minimal"]?.category === "base");
    context.optionalSystems = allSystems.filter(i => i.flags?.["lancer-minimal"]?.category !== "base");

    // Get active effects for status display
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
    if (!this.isEditable) return;
    
    // Make buttons draggable for macro bar using native events
    const draggables = html[0].querySelectorAll(".hase-roll-btn, .structure-roll-btn, .stress-roll-btn, .item-attack, .scan-to-chat");
    draggables.forEach(el => {
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
            actorId: this.actor.id,
            skill: skill,
            label: `${this.actor.name} - ${skill.charAt(0).toUpperCase() + skill.slice(1)} Check`,
            img: "icons/svg/dice-target.svg"
          };
        } else if (target.classList.contains("structure-roll-btn")) {
          dragData = {
            type: "lancerMacro",
            macroType: "structureRoll",
            actorId: this.actor.id,
            label: `${this.actor.name} - Structure Roll`,
            img: "icons/svg/explosion.svg"
          };
        } else if (target.classList.contains("stress-roll-btn")) {
          dragData = {
            type: "lancerMacro",
            macroType: "stressRoll",
            actorId: this.actor.id,
            label: `${this.actor.name} - Overheat Roll`,
            img: "icons/svg/fire.svg"
          };
        } else if (target.classList.contains("item-attack")) {
          const row = target.closest("[data-item-id]");
          const itemId = row?.dataset.itemId;
          const item = this.actor.items.get(itemId);
          if (item) {
            dragData = {
              type: "lancerMacro",
              macroType: "weaponAttack",
              actorId: this.actor.id,
              itemId: itemId,
              label: `${this.actor.name} - ${item.name}`,
              img: item.img || "icons/svg/sword.svg"
            };
          }
        } else if (target.classList.contains("scan-to-chat")) {
          dragData = {
            type: "lancerMacro",
            macroType: "scanToChat",
            actorId: this.actor.id,
            label: `${this.actor.name} - Scan to Chat`,
            img: "icons/svg/eye.svg"
          };
        }
        
        if (dragData) {
          ev.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        }
      }, false);
    });

    // Create new owned items
    html.find(".item-create").click(this._onCreateItem.bind(this));

    // Click on item row to open sheet
    html.find(".item-row").click(this._onOpenItem.bind(this));

    // Toggle lock on items
    html.find(".item-lock").click(this._onToggleLock.bind(this));

    // Delete owned items
    html.find(".item-delete").click(this._onDeleteItem.bind(this));

    // Send item to chat
    html.find(".item-chat").click(this._onChatItem.bind(this));

    // Weapon attack button
    html.find(".item-attack").click(this._onWeaponAttack.bind(this));

    // HASE skill check buttons
    html.find(".hase-roll-btn").click(this._onHASECheck.bind(this));

    // Structure damage roll
    html.find(".structure-roll-btn").click(this._onStructureRoll.bind(this));

    // Stress/overheat roll
    html.find(".stress-roll-btn").click(this._onStressRoll.bind(this));

    // Scan to chat
    html.find(".scan-to-chat").click(this._onScanToChat.bind(this));

    // Recharge roll
    html.find(".recharge-roll-btn").click(this._onRechargeRoll.bind(this));
  }

  /* -------------------------------------------- */

  async _onCreateItem(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type;
    const category = event.currentTarget.dataset.category;

    const labels = {
      weapon: "New Weapon",
      system: "New System"
    };

    const itemData = [{
      name: labels[type] || `New ${type}`,
      type: type,
      system: {},
      flags: { "lancer-minimal": { category: category || "optional" } }
    }];

    await this.actor.createEmbeddedDocuments("Item", itemData);
  }

  /* -------------------------------------------- */

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

  _onOpenItem(event) {
    if ($(event.target).closest(".item-controls").length) return;
    
    const li = $(event.currentTarget).closest("[data-item-id]");
    const id = li.data("item-id") || li.data("itemId");
    const item = this.actor.items.get(id);
    if (item) item.sheet.render(true);
  }

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

  async _onChatItem(event) {
    event.preventDefault();
    event.stopPropagation();
    const li = $(event.currentTarget).closest("[data-item-id]");
    const id = li.data("item-id") || li.data("itemId");
    const item = this.actor.items.get(id);
    if (!item) return;

    const typeLabels = {
      weapon: "Weapon",
      system: "System"
    };
    const typeLabel = typeLabels[item.type] || item.type;

    let content = `<h3>${item.name}</h3><p><em>${typeLabel}</em></p>`;

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
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: content
    });
  }

  /* -------------------------------------------- */

  async _onWeaponAttack(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const li = $(event.currentTarget).closest("[data-item-id]");
    const id = li.data("item-id") || li.data("itemId");
    const item = this.actor.items.get(id);
    if (!item) return;

    const weaponName = item.name;
    const damageRaw = item.system.damage || "";
    const weaponAccuracy = item.system.accuracy || 0;
    const weaponDifficulty = item.system.difficulty || 0;
    const weaponBonus = item.system.attack_bonus || 0;

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

            let attackFormula = "1d20";
            if (net !== 0) {
              const d6Count = Math.abs(net);
              attackFormula += ` + ${d6Count}d6`;
            }

            const attackRoll = await new Roll(attackFormula).evaluate();
            
            if (game.dice3d) {
              game.dice3d.showForRoll(attackRoll, game.user, true);
            }

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

            const total = d20Result + d6Result + bonus;
            const isCrit = total >= 20;

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

            let content = `<h3>${weaponName} - Attack</h3>`;
            content += weaponDetailsText;
            content += `<p><strong>1d20</strong> (${d20Result})${d6Text}${bonusText} = <span style="font-size: 1.4em; font-weight: bold; color: var(--lnc-accent, #cc2936);">${total}</span></p>`;

            if (isCrit) {
              content += `<p style="color: var(--lnc-accent, #cc2936); font-weight: bold; font-size: 1.2em;">CRITICAL HIT!</p>`;
            }

            if (baseDiceCount > 0) {
              const damageFormula = `${baseDiceCount}d${diceSize}`;
              const damageRoll = await new Roll(damageFormula).evaluate();
              
              if (game.dice3d) {
                await game.dice3d.showForRoll(damageRoll, game.user, true);
              }

              const damageResults = damageRoll.dice[0].results.map(r => r.result);
              let damageTotal;
              let bonusText = damageBonus !== 0 ? (damageBonus > 0 ? ` + ${damageBonus}` : ` - ${Math.abs(damageBonus)}`) : "";

              if (isCrit) {
                const roll1Total = damageResults.reduce((a, b) => a + b, 0);
                const roll1Display = damageResults.join(", ");
                
                const damageRoll2 = await new Roll(damageFormula).evaluate();
                if (game.dice3d) {
                  await game.dice3d.showForRoll(damageRoll2, game.user, true);
                }
                const damageResults2 = damageRoll2.dice[0].results.map(r => r.result);
                const roll2Total = damageResults2.reduce((a, b) => a + b, 0);
                const roll2Display = damageResults2.join(", ");
                
                const chosenRoll = roll1Total >= roll2Total ? 1 : 2;
                damageTotal = Math.max(roll1Total, roll2Total) + damageBonus;
                
                content += `<p><strong>Damage (Critical):</strong> ${baseDiceCount}d${diceSize}${bonusText} ${damageType}</p>`;
                content += `<p style="margin-left: 12px;">Roll 1: [${roll1Display}] = ${roll1Total}${chosenRoll === 1 ? " <strong>chosen</strong>" : ""}</p>`;
                content += `<p style="margin-left: 12px;">Roll 2: [${roll2Display}] = ${roll2Total}${chosenRoll === 2 ? " <strong>chosen</strong>" : ""}</p>`;
                content += `<p><strong>Total:</strong> <span style="font-size: 1.4em; font-weight: bold; color: var(--lnc-accent, #cc2936);">${damageTotal}</span></p>`;
              } else {
                damageTotal = damageResults.reduce((a, b) => a + b, 0) + damageBonus;
                const damageDisplay = damageResults.join(", ");
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

  /* -------------------------------------------- */

  async _onHASECheck(event) {
    event.preventDefault();
    event.stopPropagation();

    const skill = event.currentTarget.dataset.skill;
    const skillValue = this.actor.system[skill] || 0;
    const skillLabel = skill.charAt(0).toUpperCase() + skill.slice(1);

    const dialogContent = `
      <form class="hase-check-dialog">
        <p style="margin-bottom:12px;"><strong>${skillLabel} Check</strong> (Base: ${skillValue >= 0 ? '+' : ''}${skillValue})</p>
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

            let formula = "1d20";
            if (net !== 0) {
              const d6Count = Math.abs(net);
              formula += ` + ${d6Count}d6`;
            }

            const roll = await new Roll(formula).evaluate();

            if (game.dice3d) {
              await game.dice3d.showForRoll(roll, game.user, true);
            }

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

            const total = d20Result + d6Result + skillValue + bonus;

            let skillText = "";
            if (skillValue > 0) skillText = ` + ${skillValue} ${skillLabel}`;
            else if (skillValue < 0) skillText = ` - ${Math.abs(skillValue)} ${skillLabel}`;

            let bonusText = "";
            if (bonus > 0) bonusText = ` + ${bonus} Bonus`;
            else if (bonus < 0) bonusText = ` - ${Math.abs(bonus)} Bonus`;

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
   * Handle scan to chat button click.
   * Outputs all NPC stats in a compact format to chat.
   */
  async _onScanToChat(event) {
    event.preventDefault();

    const confirmed = await Dialog.confirm({
      title: "Scan to Chat",
      content: `<p>Send <strong>${this.actor.name}</strong>'s stats to chat?</p>`,
      defaultYes: true
    });

    if (!confirmed) return;

    const sys = this.actor.system;
    const name = this.actor.name;
    const tier = sys.tier || 1;

    // Get weapons and systems
    const items = Array.from(this.actor.items).map(i => i.toObject(false));
    const weapons = items.filter(i => i.type === "weapon");
    const systems = items.filter(i => i.type === "system");

    // Build weapon list with tooltips
    let weaponsList = "";
    if (weapons.length > 0) {
      weaponsList = `<p><strong>WEAPONS</strong></p><ul style="margin: 0; padding-left: 20px;">`;
      for (const w of weapons) {
        const details = [];
        if (w.system.mount) details.push(`Mount: ${w.system.mount}`);
        if (w.system.type) details.push(`Type: ${w.system.type}`);
        if (w.system.damage) details.push(`Damage: ${w.system.damage}`);
        if (w.system.range) details.push(`Range: ${w.system.range}`);
        if (w.system.tags) details.push(`Tags: ${w.system.tags}`);
        if (w.system.description) details.push(`${w.system.description}`);
        const tooltip = details.join(" | ");
        weaponsList += `<li style="cursor: help; border-bottom: 1px dotted #666;" title="${tooltip}">${w.name}</li>`;
      }
      weaponsList += `</ul>`;
    }

    // Build systems list with tooltips
    let systemsList = "";
    if (systems.length > 0) {
      systemsList = `<p><strong>SYSTEMS</strong></p><ul style="margin: 0; padding-left: 20px;">`;
      for (const s of systems) {
        const details = [];
        if (s.system.sp) details.push(`SP: ${s.system.sp}`);
        if (s.system.tags) details.push(`Tags: ${s.system.tags}`);
        if (s.system.description) details.push(`${s.system.description}`);
        const tooltip = details.join(" | ");
        systemsList += `<li style="cursor: help; border-bottom: 1px dotted #666;" title="${tooltip}">${s.name}</li>`;
      }
      systemsList += `</ul>`;
    }

    // Build HASE line
    const hull = sys.hull >= 0 ? `+${sys.hull}` : `${sys.hull}`;
    const agi = sys.agility >= 0 ? `+${sys.agility}` : `${sys.agility}`;
    const sysSkill = sys.systems >= 0 ? `+${sys.systems}` : `${sys.systems}`;
    const eng = sys.engineering >= 0 ? `+${sys.engineering}` : `${sys.engineering}`;

    // Highlight stats in red when damaged/heated
    const hpStyle = sys.hp.value < sys.hp.max ? 'color: #cc2936; font-weight: bold;' : '';
    const structStyle = sys.structure.value < sys.structure.max ? 'color: #cc2936; font-weight: bold;' : '';
    const stressStyle = sys.stress.value < sys.stress.max ? 'color: #cc2936; font-weight: bold;' : '';
    const heatStyle = sys.heat.value > 0 ? 'color: #cc2936; font-weight: bold;' : '';

    const content = `
      <div style="border: 2px solid var(--lnc-accent, #cc2936); border-radius: 4px; padding: 8px; background: var(--lnc-bg-mid, #f0f4f8);">
        <h2 style="margin: 0 0 8px 0; color: var(--lnc-accent, #cc2936); border-bottom: 2px solid var(--lnc-accent, #cc2936); padding-bottom: 4px;">${name}</h2>
        <p style="margin: 4px 0;"><strong>Tier ${tier}</strong></p>
        <p style="margin: 4px 0;"><span style="${hpStyle}">HP: ${sys.hp.value}/${sys.hp.max}</span> | <span style="${structStyle}">Structure: ${sys.structure.value}/${sys.structure.max}</span> | <span style="${stressStyle}">Stress: ${sys.stress.value}/${sys.stress.max}</span></p>
        <p style="margin: 4px 0;">Armor: ${sys.armor} | Evasion: ${sys.evasion} | E-Def: ${sys.edef}</p>
        <p style="margin: 4px 0;">Speed: ${sys.speed} | Size: ${sys.size} | Sensors: ${sys.sensors}</p>
        <p style="margin: 4px 0;">Save: ${sys.save} | <span style="${heatStyle}">Heat: ${sys.heat.value}/${sys.heat.max}</span></p>
        <p style="margin: 8px 0 4px 0; font-weight: bold;">HULL ${hull} | AGI ${agi} | SYS ${sysSkill} | ENG ${eng}</p>
        ${weaponsList}
        ${systemsList}
      </div>
    `;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: content
    });
  }

  /**
   * Handle recharge roll button click.
   * Rolls 1d6 and if result >= target, sets recharge_ready to true.
   */
  async _onRechargeRoll(event) {
    event.preventDefault();
    event.stopPropagation();

    const target = this.actor.system.recharge_target || 5;

    const roll = await new Roll("1d6").evaluate();

    if (game.dice3d) {
      await game.dice3d.showForRoll(roll, game.user, true);
    }

    const result = roll.dice[0].results[0].result;
    const success = result >= target;

    // If successful, tick the recharge ready checkbox
    if (success) {
      await this.actor.update({ "system.recharge_ready": true });
    }

    const resultStyle = success 
      ? "color: #2a9d2a; font-weight: bold;" 
      : "color: #cc2936; font-weight: bold;";
    const resultText = success ? "RECHARGED!" : "Not yet...";

    const content = `
      <h3>Recharge Roll</h3>
      <p><strong>Target:</strong> ${target}+</p>
      <p><strong>1d6:</strong> <span style="font-size: 1.4em; font-weight: bold;">${result}</span></p>
      <p style="font-size: 1.2em; ${resultStyle}">${resultText}</p>
    `;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: content
    });
  }
}
