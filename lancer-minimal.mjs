/**
 * Lancer Minimal — Foundry VTT v13 System
 * Main entry point.
 */

import { LancerPilotSheet } from "./module/sheets/pilot-sheet.mjs";
import { LancerMechSheet } from "./module/sheets/mech-sheet.mjs";
import { LancerNpcSheet } from "./module/sheets/npc-sheet.mjs";
import { LancerItemSheet } from "./module/sheets/item-sheet.mjs";

Hooks.once("init", () => {
  console.log("lancer-minimal | Initializing Lancer (Minimal) system");

  // ── Register Handlebars helpers (safety net) ───────────
  if (!Handlebars.helpers.eq) {
    Handlebars.registerHelper("eq", (a, b) => a === b);
  }

  // ── Configure Lancer Status Effects ────────────────────
  CONFIG.statusEffects = [
    {
      id: "danger-zone",
      name: "Danger Zone (Mechs Only)",
      icon: "icons/svg/fire.svg"
    },
    {
      id: "down-and-out",
      name: "Down and Out (Pilots Only)",
      icon: "icons/svg/unconscious.svg"
    },
    {
      id: "engaged",
      name: "Engaged",
      icon: "icons/svg/sword.svg"
    },
    {
      id: "exposed",
      name: "Exposed (Mechs Only)",
      icon: "icons/svg/radiation.svg"
    },
    {
      id: "hidden",
      name: "Hidden",
      icon: "icons/svg/cowled.svg"
    },
    {
      id: "invisible",
      name: "Invisible",
      icon: "icons/svg/invisible.svg"
    },
    {
      id: "prone",
      name: "Prone",
      icon: "icons/svg/falling.svg"
    },
    {
      id: "shut-down",
      name: "Shut Down (Mechs Only)",
      icon: "icons/svg/sleep.svg"
    },
    {
      id: "immobilized",
      name: "Immobilized",
      icon: "icons/svg/net.svg"
    },
    {
      id: "impaired",
      name: "Impaired",
      icon: "icons/svg/daze.svg"
    },
    {
      id: "jammed",
      name: "Jammed",
      icon: "icons/svg/silenced.svg"
    },
    {
      id: "lock-on",
      name: "Lock On",
      icon: "icons/svg/target.svg"
    },
    {
      id: "shredded",
      name: "Shredded",
      icon: "icons/svg/blood.svg"
    },
    {
      id: "slowed",
      name: "Slowed",
      icon: "icons/svg/anchor.svg"
    },
    {
      id: "stunned",
      name: "Stunned",
      icon: "icons/svg/lightning.svg"
    }
  ];

  // ── Register Actor Sheets ──────────────────────────────
  Actors.registerSheet("lancer-minimal", LancerPilotSheet, {
    types: ["pilot"],
    makeDefault: true,
    label: "Lancer Pilot Sheet"
  });

  Actors.registerSheet("lancer-minimal", LancerMechSheet, {
    types: ["mech"],
    makeDefault: true,
    label: "Lancer Mech Sheet"
  });

  Actors.registerSheet("lancer-minimal", LancerNpcSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "Lancer NPC Sheet"
  });

  // ── Register Item Sheets ───────────────────────────────
  Items.registerSheet("lancer-minimal", LancerItemSheet, {
    makeDefault: true,
    label: "Lancer Item Sheet"
  });
});

Hooks.once("ready", () => {
  console.log("lancer-minimal | System ready");
});

// ── Global Roll Functions for Macros ──────────────────────
globalThis.LancerRolls = {
  async skillCheck(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) { ui.notifications.warn("Actor not found"); return; }

    const dialogContent = `
      <form><div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
        <label style="font-weight:bold;width:60px;">Bonus:</label>
        <input type="number" name="bonus" value="0" style="width:60px;text-align:center;"/>
      </div>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
        <label style="font-weight:bold;width:60px;">Accuracy:</label>
        <button type="button" class="acc-minus" style="width:28px;">-</button>
        <span class="acc-value" style="width:30px;text-align:center;font-weight:bold;">0</span>
        <button type="button" class="acc-plus" style="width:28px;">+</button>
      </div>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
        <label style="font-weight:bold;width:60px;">Difficulty:</label>
        <button type="button" class="diff-minus" style="width:28px;">-</button>
        <span class="diff-value" style="width:30px;text-align:center;font-weight:bold;">0</span>
        <button type="button" class="diff-plus" style="width:28px;">+</button>
      </div></form>`;

    new Dialog({
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
            const net = accuracy - difficulty;

            let formula = "1d20";
            if (net !== 0) formula += ` + ${Math.abs(net)}d6`;
            const roll = await new Roll(formula).evaluate();
            if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);

            const d20 = roll.dice[0].results[0].result;
            let d6Text = "", d6Result = 0;
            if (net !== 0) {
              const d6s = roll.dice[1].results.map(r => r.result);
              d6Result = Math.max(...d6s);
              let h = false;
              const d6Disp = d6s.map(r => { if (r === d6Result && !h) { h = true; return `<strong>${r}</strong>`; } return `<span style="opacity:0.5">${r}</span>`; }).join(", ");
              d6Text = net > 0 ? ` + ${Math.abs(net)}d6 Acc [${d6Disp}]` : ` - ${Math.abs(net)}d6 Diff [${d6Disp}]`;
              if (net < 0) d6Result = -d6Result;
            }
            const total = d20 + d6Result + bonus;
            const bonusTxt = bonus ? (bonus > 0 ? ` + ${bonus} Bonus` : ` - ${Math.abs(bonus)} Bonus`) : "";
            const content = `<h3>Skill Check</h3><p><strong>1d20</strong> (${d20})${d6Text}${bonusTxt} = <span style="font-size:1.4em;font-weight:bold;color:#cc2936;">${total}</span></p>`;
            await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
          }
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
      },
      default: "roll",
      render: (html) => {
        let acc = 0, diff = 0;
        html.find('.acc-plus').click(() => { acc++; html.find('.acc-value').text(acc); });
        html.find('.acc-minus').click(() => { acc = Math.max(0, acc-1); html.find('.acc-value').text(acc); });
        html.find('.diff-plus').click(() => { diff++; html.find('.diff-value').text(diff); });
        html.find('.diff-minus').click(() => { diff = Math.max(0, diff-1); html.find('.diff-value').text(diff); });
      }
    }).render(true);
  },
  
  async haseCheck(actorId, skill) {
    const actor = game.actors.get(actorId);
    if (!actor) { ui.notifications.warn("Actor not found"); return; }
    const skillValue = actor.system[skill] || 0;
    const skillLabel = skill.charAt(0).toUpperCase() + skill.slice(1);

    const dialogContent = `
      <form><p style="margin-bottom:12px;"><strong>${skillLabel} Check</strong> (Base: +${skillValue})</p>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
        <label style="font-weight:bold;width:60px;">Bonus:</label>
        <input type="number" name="bonus" value="0" style="width:60px;text-align:center;"/>
      </div>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
        <label style="font-weight:bold;width:60px;">Accuracy:</label>
        <button type="button" class="acc-minus" style="width:28px;">-</button>
        <span class="acc-value" style="width:30px;text-align:center;font-weight:bold;">0</span>
        <button type="button" class="acc-plus" style="width:28px;">+</button>
      </div>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
        <label style="font-weight:bold;width:60px;">Difficulty:</label>
        <button type="button" class="diff-minus" style="width:28px;">-</button>
        <span class="diff-value" style="width:30px;text-align:center;font-weight:bold;">0</span>
        <button type="button" class="diff-plus" style="width:28px;">+</button>
      </div></form>`;

    new Dialog({
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
            if (net !== 0) formula += ` + ${Math.abs(net)}d6`;
            const roll = await new Roll(formula).evaluate();
            if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);

            const d20 = roll.dice[0].results[0].result;
            let d6Text = "", d6Result = 0;
            if (net !== 0) {
              const d6s = roll.dice[1].results.map(r => r.result);
              d6Result = Math.max(...d6s);
              let h = false;
              const d6Disp = d6s.map(r => { if (r === d6Result && !h) { h = true; return `<strong>${r}</strong>`; } return `<span style="opacity:0.5">${r}</span>`; }).join(", ");
              d6Text = net > 0 ? ` + ${Math.abs(net)}d6 Acc [${d6Disp}]` : ` - ${Math.abs(net)}d6 Diff [${d6Disp}]`;
              if (net < 0) d6Result = -d6Result;
            }
            const total = d20 + d6Result + skillValue + bonus;
            const skillTxt = skillValue ? (skillValue > 0 ? ` + ${skillValue} ${skillLabel}` : ` - ${Math.abs(skillValue)} ${skillLabel}`) : "";
            const bonusTxt = bonus ? (bonus > 0 ? ` + ${bonus} Bonus` : ` - ${Math.abs(bonus)} Bonus`) : "";
            const content = `<h3>${skillLabel} Check</h3><p><strong>1d20</strong> (${d20})${d6Text}${skillTxt}${bonusTxt} = <span style="font-size:1.4em;font-weight:bold;color:#cc2936;">${total}</span></p>`;
            await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
          }
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
      },
      default: "roll",
      render: (html) => {
        let acc = 0, diff = 0;
        html.find('.acc-plus').click(() => { acc++; html.find('.acc-value').text(acc); });
        html.find('.acc-minus').click(() => { acc = Math.max(0, acc-1); html.find('.acc-value').text(acc); });
        html.find('.diff-plus').click(() => { diff++; html.find('.diff-value').text(diff); });
        html.find('.diff-minus').click(() => { diff = Math.max(0, diff-1); html.find('.diff-value').text(diff); });
      }
    }).render(true);
  },
  
  async techAttack(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) { ui.notifications.warn("Actor not found"); return; }
    await actor.sheet.render(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    if (typeof actor.sheet._onTechAttack === "function") {
      actor.sheet._onTechAttack({ preventDefault: () => {}, stopPropagation: () => {} });
    }
  },
  
  async structureRoll(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) { ui.notifications.warn("Actor not found"); return; }
    await actor.sheet.render(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    if (typeof actor.sheet._onStructureRoll === "function") {
      actor.sheet._onStructureRoll({ preventDefault: () => {}, stopPropagation: () => {} });
    }
  },
  
  async stressRoll(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) { ui.notifications.warn("Actor not found"); return; }
    await actor.sheet.render(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    if (typeof actor.sheet._onStressRoll === "function") {
      actor.sheet._onStressRoll({ preventDefault: () => {}, stopPropagation: () => {} });
    }
  },
  
  async weaponAttack(actorId, itemId) {
    const actor = game.actors.get(actorId);
    if (!actor) { ui.notifications.warn("Actor not found"); return; }
    const item = actor.items.get(itemId);
    if (!item) { ui.notifications.warn("Weapon not found"); return; }
    
    // Perform attack directly without needing sheet
    const grit = actor.system.grit || actor.system.pilot_grit || 0;
    const weaponName = item.name;
    const damageRaw = item.system.damage || "";
    const weaponAccuracy = item.system.accuracy || 0;
    const weaponDifficulty = item.system.difficulty || 0;
    const weaponBonus = item.system.attack_bonus || 0;

    const diceMatch = damageRaw.match(/(\d+)d(\d+)/i);
    let baseDiceCount = 0, diceSize = 0, damageBonus = 0, damageType = "";
    if (diceMatch) {
      baseDiceCount = parseInt(diceMatch[1]);
      diceSize = parseInt(diceMatch[2]);
      const bonusMatch = damageRaw.match(/[+-]\s*(\d+)(?!\s*d)/);
      damageBonus = bonusMatch ? parseInt(bonusMatch[0].replace(/\s/g, "")) : 0;
      damageType = damageRaw.replace(diceMatch[0], "").replace(/[+-]\s*\d+(?!\s*d)/, "").trim();
    }

    const dialogContent = `
      <form><p style="margin-bottom:12px;"><strong>${weaponName}</strong></p>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
        <label style="font-weight:bold;width:60px;">Bonus:</label>
        <input type="number" name="bonus" value="${weaponBonus}" style="width:60px;text-align:center;"/>
      </div>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
        <label style="font-weight:bold;width:60px;">Accuracy:</label>
        <button type="button" class="acc-minus" style="width:28px;">-</button>
        <span class="acc-value" style="width:30px;text-align:center;font-weight:bold;">${weaponAccuracy}</span>
        <button type="button" class="acc-plus" style="width:28px;">+</button>
      </div>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
        <label style="font-weight:bold;width:60px;">Difficulty:</label>
        <button type="button" class="diff-minus" style="width:28px;">-</button>
        <span class="diff-value" style="width:30px;text-align:center;font-weight:bold;">${weaponDifficulty}</span>
        <button type="button" class="diff-plus" style="width:28px;">+</button>
      </div></form>`;

    new Dialog({
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

            let formula = "1d20";
            if (net !== 0) formula += ` + ${Math.abs(net)}d6`;
            const attackRoll = await new Roll(formula).evaluate();
            if (game.dice3d) game.dice3d.showForRoll(attackRoll, game.user, true);

            const d20 = attackRoll.dice[0].results[0].result;
            let d6Text = "", d6Result = 0;
            if (net !== 0) {
              const d6s = attackRoll.dice[1].results.map(r => r.result);
              d6Result = Math.max(...d6s);
              let h = false;
              const d6Disp = d6s.map(r => { if (r === d6Result && !h) { h = true; return `<strong>${r}</strong>`; } return `<span style="opacity:0.5">${r}</span>`; }).join(", ");
              d6Text = net > 0 ? ` + ${Math.abs(net)}d6 Acc [${d6Disp}]` : ` - ${Math.abs(net)}d6 Diff [${d6Disp}]`;
              if (net < 0) d6Result = -d6Result;
            }
            const total = d20 + d6Result + grit + bonus;
            const isCrit = total >= 20;
            const gritTxt = grit ? (grit > 0 ? ` + ${grit} Grit` : ` - ${Math.abs(grit)} Grit`) : "";
            const bonusTxt = bonus ? (bonus > 0 ? ` + ${bonus} Bonus` : ` - ${Math.abs(bonus)} Bonus`) : "";

            // Build weapon details line
            const weaponDetails = [];
            if (item.system.mount) weaponDetails.push(item.system.mount);
            if (item.system.type) weaponDetails.push(item.system.type);
            if (item.system.range) weaponDetails.push(`Range ${item.system.range}`);
            if (item.system.tags) weaponDetails.push(item.system.tags);
            const weaponDetailsText = weaponDetails.length > 0 ? `<p style="opacity:0.8;font-size:0.9em;">${weaponDetails.join(" • ")}</p>` : "";

            let content = `<h3>${weaponName} - Attack</h3>${weaponDetailsText}<p><strong>1d20</strong> (${d20})${d6Text}${gritTxt}${bonusTxt} = <span style="font-size:1.4em;font-weight:bold;color:#cc2936;">${total}</span></p>`;
            if (isCrit) content += `<p style="color:#cc2936;font-weight:bold;font-size:1.2em;">CRITICAL HIT!</p>`;

            if (baseDiceCount > 0) {
              const dmgFormula = `${baseDiceCount}d${diceSize}`;
              const dmgRoll = await new Roll(dmgFormula).evaluate();
              if (game.dice3d) await game.dice3d.showForRoll(dmgRoll, game.user, true);
              const dmgResults = dmgRoll.dice[0].results.map(r => r.result);
              const dmgBonusTxt = damageBonus ? (damageBonus > 0 ? ` + ${damageBonus}` : ` - ${Math.abs(damageBonus)}`) : "";
              if (isCrit) {
                const r1 = dmgResults.reduce((a,b)=>a+b,0);
                const dmgRoll2 = await new Roll(dmgFormula).evaluate();
                if (game.dice3d) await game.dice3d.showForRoll(dmgRoll2, game.user, true);
                const dmgResults2 = dmgRoll2.dice[0].results.map(r=>r.result);
                const r2 = dmgResults2.reduce((a,b)=>a+b,0);
                const chosen = r1 >= r2 ? 1 : 2;
                const dmgTotal = Math.max(r1,r2) + damageBonus;
                content += `<p><strong>Damage (Crit):</strong> ${baseDiceCount}d${diceSize}${dmgBonusTxt} ${damageType}</p>`;
                content += `<p style="margin-left:12px;">Roll 1: [${dmgResults.join(", ")}] = ${r1}${chosen===1?" <strong>chosen</strong>":""}</p>`;
                content += `<p style="margin-left:12px;">Roll 2: [${dmgResults2.join(", ")}] = ${r2}${chosen===2?" <strong>chosen</strong>":""}</p>`;
                content += `<p><strong>Total:</strong> <span style="font-size:1.4em;font-weight:bold;color:#cc2936;">${dmgTotal}</span></p>`;
              } else {
                const dmgTotal = dmgResults.reduce((a,b)=>a+b,0) + damageBonus;
                content += `<p><strong>Damage:</strong> ${baseDiceCount}d${diceSize}${dmgBonusTxt} ${damageType} [${dmgResults.join(", ")}] = <span style="font-size:1.4em;font-weight:bold;color:#cc2936;">${dmgTotal}</span></p>`;
              }
            } else if (damageRaw) content += `<p><strong>Damage:</strong> ${damageRaw}</p>`;
            await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
          }
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
      },
      default: "attack",
      render: (html) => {
        let acc = weaponAccuracy, diff = weaponDifficulty;
        html.find('.acc-plus').click(() => { acc++; html.find('.acc-value').text(acc); });
        html.find('.acc-minus').click(() => { acc = Math.max(0, acc-1); html.find('.acc-value').text(acc); });
        html.find('.diff-plus').click(() => { diff++; html.find('.diff-value').text(diff); });
        html.find('.diff-minus').click(() => { diff = Math.max(0, diff-1); html.find('.diff-value').text(diff); });
      }
    }).render(true);
  },
  
  async scanToChat(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) { ui.notifications.warn("Actor not found"); return; }
    await actor.sheet.render(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    if (typeof actor.sheet._onScanToChat === "function") {
      actor.sheet._onScanToChat({ preventDefault: () => {}, stopPropagation: () => {} });
    }
  }
};

// ── Hotbar Macro Drop Support ────────────────────────────
Hooks.on("hotbarDrop", async (bar, data, slot) => {
  if (data.type !== "lancerMacro") return true;
  
  let command = "";
  switch (data.macroType) {
    case "skillCheck":
      command = `LancerRolls.skillCheck("${data.actorId}");`;
      break;
    case "haseCheck":
      command = `LancerRolls.haseCheck("${data.actorId}", "${data.skill}");`;
      break;
    case "techAttack":
      command = `LancerRolls.techAttack("${data.actorId}");`;
      break;
    case "structureRoll":
      command = `LancerRolls.structureRoll("${data.actorId}");`;
      break;
    case "stressRoll":
      command = `LancerRolls.stressRoll("${data.actorId}");`;
      break;
    case "weaponAttack":
      command = `LancerRolls.weaponAttack("${data.actorId}", "${data.itemId}");`;
      break;
    case "scanToChat":
      command = `LancerRolls.scanToChat("${data.actorId}");`;
      break;
  }
  
  const macroData = {
    name: data.label || "Lancer Macro",
    type: "script",
    img: data.img || "icons/svg/dice-target.svg",
    command: command,
    flags: { "lancer-minimal": { actorId: data.actorId, macroType: data.macroType } }
  };

  let macro = game.macros.find(m => m.name === macroData.name && m.command === macroData.command);
  if (!macro) {
    macro = await Macro.create(macroData);
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
});
