/**
 * Lancer Initiative System
 * - Sorts by disposition: Players > Friendly > Neutral > Hostile
 * - Two-step activation: Active (check) -> Passed (X)
 * - Color coded by faction
 * - Context menu options for activations
 */

export class LancerCombat extends Combat {
  
  /** @override */
  _sortCombatants(a, b) {
    // Sort by disposition first (lower = higher priority)
    // FRIENDLY = 1, NEUTRAL = 0, HOSTILE = -1
    // We want: Players (FRIENDLY) > Friendly NPCs > Neutral > Hostile
    const dispositionOrder = (c) => {
      const disposition = c.token?.disposition ?? c.actor?.prototypeToken?.disposition ?? 0;
      const isPlayer = c.actor?.type === "pilot" || c.actor?.type === "mech";
      if (isPlayer) return 0; // Players first
      if (disposition === 1) return 1; // Friendly NPCs
      if (disposition === 0) return 2; // Neutral
      return 3; // Hostile
    };
    
    const orderA = dispositionOrder(a);
    const orderB = dispositionOrder(b);
    if (orderA !== orderB) return orderA - orderB;
    
    // Then by activation status (not activated first, then active, then passed)
    const stateA = a.getFlag("lancer-minimal", "activationState") ?? 0;
    const stateB = b.getFlag("lancer-minimal", "activationState") ?? 0;
    if (stateA !== stateB) return stateA - stateB;
    
    // Then by initiative (higher first)
    const initA = a.initiative ?? -Infinity;
    const initB = b.initiative ?? -Infinity;
    if (initA !== initB) return initB - initA;
    
    // Then by name
    return (a.name || "").localeCompare(b.name || "");
  }
  
  /** @override */
  async rollInitiative(ids, options = {}) {
    // Don't roll d20, just set initiative to 0
    const updates = ids.map(id => ({ _id: id, initiative: 0 }));
    await this.updateEmbeddedDocuments("Combatant", updates);
    return this;
  }
  
  /**
   * Activate a combatant (take their turn) - Step 1
   * Sets state to 1 (active - showing check mark)
   */
  async activateCombatant(combatantId) {
    const combatant = this.combatants.get(combatantId);
    if (!combatant) return;
    
    // Set as current combatant
    await this.update({ turn: this.turns.findIndex(t => t.id === combatantId) });
    
    // Mark as active (state 1 = active, showing check)
    await combatant.setFlag("lancer-minimal", "activationState", 1);
  }
  
  /**
   * Pass turn - Step 2
   * Sets state to 2 (passed - showing X)
   */
  async passTurn(combatantId) {
    const combatant = this.combatants.get(combatantId);
    if (!combatant) return;
    
    // Mark as passed (state 2 = passed, showing X)
    await combatant.setFlag("lancer-minimal", "activationState", 2);
    
    // Set low initiative to sort to bottom of their group
    await combatant.update({ initiative: -1000 });
  }
  
  /**
   * Deactivate a combatant (undo their turn)
   */
  async deactivateCombatant(combatantId) {
    const combatant = this.combatants.get(combatantId);
    if (!combatant) return;
    
    await combatant.setFlag("lancer-minimal", "activationState", 0);
    await combatant.update({ initiative: 0 });
  }
  
  /**
   * Reset all activations for a new round
   */
  async resetActivations() {
    const updates = this.combatants.map(c => ({
      _id: c.id,
      initiative: 0,
      "flags.lancer-minimal.activationState": 0
    }));
    await this.updateEmbeddedDocuments("Combatant", updates);
  }
  
  /** @override */
  async nextRound() {
    await this.resetActivations();
    return super.nextRound();
  }
  
  /** @override */
  async previousRound() {
    await this.resetActivations();
    return super.previousRound();
  }
}

/**
 * Initialize combat tracker hooks
 */
export function initCombatTrackerHooks() {
  console.log("lancer-minimal | Registering combat tracker hooks");
  
  // Modify combat tracker on render
  Hooks.on("renderCombatTracker", (app, html, data) => {
    const combat = game.combat;
    if (!combat) return;
    
    const tracker = html[0] ?? html;
    
    // Find all combatant rows
    const combatantRows = tracker.querySelectorAll(".combatant");
    
    combatantRows.forEach(row => {
      const combatantId = row.dataset.combatantId;
      const combatant = combat.combatants.get(combatantId);
      if (!combatant) return;
      
      // Get disposition for coloring
      const disposition = combatant.token?.disposition ?? combatant.actor?.prototypeToken?.disposition ?? 0;
      const isPlayer = combatant.actor?.type === "pilot" || combatant.actor?.type === "mech";
      
      // Activation states: 0 = not activated, 1 = active (taking turn), 2 = passed (done)
      const activationState = combatant.getFlag("lancer-minimal", "activationState") ?? 0;
      
      // Add faction class
      if (isPlayer) {
        row.classList.add("lancer-player");
      } else if (disposition === 1) {
        row.classList.add("lancer-friendly");
      } else if (disposition === 0) {
        row.classList.add("lancer-neutral");
      } else {
        row.classList.add("lancer-hostile");
      }
      
      // Add state class
      if (activationState === 2) {
        row.classList.add("lancer-passed");
      } else if (activationState === 1) {
        row.classList.add("lancer-active");
      }
      
      // Find the initiative element and roll button
      const initiative = row.querySelector(".token-initiative");
      if (initiative) {
        // Clear existing content
        initiative.innerHTML = "";
        
        // Determine button faction class
        let factionClass = "hostile";
        if (isPlayer) {
          factionClass = "player";
        } else if (disposition === 1) {
          factionClass = "friendly";
        } else if (disposition === 0) {
          factionClass = "neutral";
        }
        
        // Create button based on activation state
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `lancer-activate-btn ${factionClass}`;
        
        if (activationState === 0) {
          // Not activated - show play button
          btn.innerHTML = '<i class="fas fa-play"></i>';
          btn.title = "Activate";
          
          btn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Check if player owns this combatant
            if (!game.user.isGM && !combatant.isOwner) {
              ui.notifications.warn("You can only activate your own combatants.");
              return;
            }
            await combat.activateCombatant(combatantId);
          });
        } else if (activationState === 1) {
          // Active (taking turn) - show check button
          btn.innerHTML = '<i class="fas fa-check"></i>';
          btn.title = "End turn";
          btn.classList.add("active");
          
          btn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Check if player owns this combatant
            if (!game.user.isGM && !combatant.isOwner) {
              ui.notifications.warn("You can only end your own turn.");
              return;
            }
            await combat.passTurn(combatantId);
          });
        } else {
          // Passed (done) - show X button
          btn.innerHTML = '<i class="fas fa-times"></i>';
          btn.classList.add("passed");
          
          // GM can click X to undo, players cannot
          if (game.user.isGM) {
            btn.title = "Undo activation (GM)";
            btn.addEventListener("click", async (e) => {
              e.preventDefault();
              e.stopPropagation();
              await combat.deactivateCombatant(combatantId);
            });
          } else {
            btn.title = "Turn ended";
            btn.disabled = true;
          }
        }
        
        initiative.appendChild(btn);
      }
    });
    
    // Add reset button for GM
    if (game.user.isGM) {
      const header = tracker.querySelector(".combat-tracker-header") || tracker.querySelector("header");
      if (header && !header.querySelector(".lancer-reset-btn")) {
        const resetBtn = document.createElement("button");
        resetBtn.type = "button";
        resetBtn.className = "lancer-reset-btn";
        resetBtn.innerHTML = '<i class="fas fa-undo"></i> Reset Round';
        resetBtn.title = "Reset all activations";
        resetBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await combat.resetActivations();
        });
        header.appendChild(resetBtn);
      }
    }
  });
  
  // Add context menu options
  Hooks.on("getCombatTrackerEntryContext", (html, options) => {
    options.push(
      {
        name: "Activate",
        icon: '<i class="fas fa-play"></i>',
        condition: li => {
          const combatant = game.combat?.combatants.get(li.data("combatant-id"));
          const state = combatant?.getFlag("lancer-minimal", "activationState") ?? 0;
          return combatant && state === 0;
        },
        callback: li => {
          const combatantId = li.data("combatant-id");
          game.combat?.activateCombatant(combatantId);
        }
      },
      {
        name: "End Turn",
        icon: '<i class="fas fa-check"></i>',
        condition: li => {
          const combatant = game.combat?.combatants.get(li.data("combatant-id"));
          const state = combatant?.getFlag("lancer-minimal", "activationState") ?? 0;
          return combatant && state === 1;
        },
        callback: li => {
          const combatantId = li.data("combatant-id");
          game.combat?.passTurn(combatantId);
        }
      },
      {
        name: "Deactivate",
        icon: '<i class="fas fa-undo"></i>',
        condition: li => {
          const combatant = game.combat?.combatants.get(li.data("combatant-id"));
          const state = combatant?.getFlag("lancer-minimal", "activationState") ?? 0;
          return game.user.isGM && state > 0;
        },
        callback: li => {
          const combatantId = li.data("combatant-id");
          game.combat?.deactivateCombatant(combatantId);
        }
      },
      {
        name: "Reset All Activations",
        icon: '<i class="fas fa-sync"></i>',
        condition: () => game.user.isGM,
        callback: () => {
          game.combat?.resetActivations();
        }
      }
    );
  });
}
