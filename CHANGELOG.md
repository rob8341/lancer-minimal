# Changelog

All notable changes to this project will be documented in this file.

## [1.0.3] - Combat & Linking Update

### Added
- **Bidirectional Pilot-Mech Linking**
  - Dragging a mech onto a pilot sheet also sets the pilot link on the mech
  - Dragging a pilot onto a mech sheet also adds the mech to the pilot's shortcuts
  - Deleting a link from either sheet removes the link from both sides
  - Keeps pilot-mech relationships synchronized in both directions

### Changed
- **Combat System — One Active at a Time**
  - Only one combatant can be active (taking their turn) at a time
  - Cannot activate while another combatant is active — shows warning message
  - Must wait for current combatant to click checkmark (✓) to pass turn
  - Then another combatant can activate
  - GM can still undo passed combatants by clicking their X button

### Fixed
- Combat turn order now properly enforced — players cannot steal turns from others

---

## [1.0.2] - Combat System Update

### Added
- **Lancer Initiative System**
  - Replaces d20 initiative with activation-based system
  - Combatants sorted by faction: Players > Friendly > Neutral > Hostile
  - Color-coded activate buttons: Blue (player), Green (friendly), Yellow (neutral), Red (hostile)
  - Two-step activation: Click Play (▶) to activate → Click Check (✓) to pass turn → Shows X (✕) when done
  - GM can click X button to undo/deactivate any combatant
  - Players can only activate their own combatants
  - Reset Round button for GM to reset all activations
  - Context menu options: Activate, End Turn, Deactivate (GM), Reset All (GM)

- **NPC Recharge System**
  - Recharge roll button on NPC sheet header
  - Target number field (default 5+)
  - Ready checkbox that auto-ticks on successful recharge
  - Dice So Nice support for recharge rolls

### Changed
- Token bars no longer track HP/Overshield by default (configurable per token)
- Removed tier display from NPC weapon attack dialogs
- Activated combatants show X icon instead of checkmark, keeping faction color

### Fixed
- Weapon attack bonus now properly labeled in chat for NPCs
- Combat tracker properly shows faction colors throughout activation states

---

## [1.0.0] - Initial Release

### Added
- **Pilot Sheet**
  - Name, Callsign, Background fields
  - License Level (LL) and Grit
  - HP, Armor, E-Defense, Evasion, Speed stats
  - Mech Skills (HASE): Hull, Agility, Systems, Engineering
  - Triggers with highlight functionality for skill checks
  - Talents, Licenses, Core Bonuses
  - Personal Loadout: Armor (1), Weapons (2), Gear (3)
  - Skill Check button with accuracy/difficulty
  - Mech shortcut links (up to 3)
  - Bio tab

- **Mech Sheet**
  - Mech Name, Frame, Pilot link
  - Structure, Stress, HP, Heat tracking
  - Overshield and Armor
  - Full HASE stats with roll buttons
  - Sensors, Save, Grit, Tech Attack, SP
  - Weapons with attack + damage rolls
  - Systems with SP tracking
  - Frame Traits, Core System, Core Bonuses
  - Core Power (CP) tracking
  - Mounts and Notes sections
  - Structure Damage and Overheat rolls

- **NPC Sheet**
  - Compact stat block layout
  - Tier (1-3)
  - HP, Structure, Stress, Heat
  - Full HASE stats
  - Weapons and Systems (Base + Optional)
  - Tactics description
  - Scan to Chat functionality
  - Structure Damage and Overheat rolls

- **Item Sheets**
  - Weapons: Mount, Type, Damage, Range, Tags, Accuracy, Difficulty, Attack Bonus
  - Systems: SP, Tags, Description
  - Talents: Rank, Description
  - Core Bonuses: Source, Description
  - Frame Traits: Description
  - Core Systems: Tags, Description
  - Armor: HP Bonus, Armor, Evasion, E-Def, Speed, Tags
  - Gear: Uses, Tags, Description

- **Rolling System**
  - Skill Checks with trigger support
  - HASE skill checks
  - Tech Attacks
  - Weapon Attacks with Grit bonus
  - Critical hits on 20+ (roll damage twice, take higher)
  - Structure Damage checks
  - Overheat/Stress checks
  - Accuracy/Difficulty dice (d6, take highest)

- **Macro Bar Support**
  - All roll buttons can be dragged to macro bar
  - Macros execute independently of sheets

- **Dice So Nice Integration**
  - All rolls display in Dice So Nice if installed

- **Custom Status Effects**
  - Danger Zone, Down and Out, Engaged, Exposed
  - Hidden, Invisible, Prone, Shut Down
  - Immobilized, Impaired, Jammed, Lock On
  - Shredded, Slowed, Stunned

- **Chat Cards**
  - Attack rolls show weapon details (mount, type, range, tags)
  - Labeled bonuses (Trigger, Bonus, Grit, HASE skill, Tech Atk)
  - Critical hit announcements
  - NPC scan with stat highlighting for damage/heat
