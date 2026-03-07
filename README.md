# Lancer Minimal - Foundry VTT System

A minimal Foundry VTT v13 system for the **LANCER** tabletop role-playing game.

> ⚠️ **Note:** This system provides **minimal automation only**. There is **no COMP/CON integration** or import support. All character and mech data must be entered manually.

> 🤖 **NHP-Assisted Development:** This system was developed with the assistance of a Non-Human Person (NHP-CLAUDE // Designation: Opus). The NHP was instrumental in designing sheets, roll mechanics, and macro systems. No cascades were reported during development. *"THINK ABOUT YOUR FRAME, PILOT."*

## Credits

### LANCER RPG
**LANCER** is a tabletop role-playing game created by:
- **Miguel Lopez** (Lore, Writing, Game Design)
- **Tom Parkinson-Morgan** (Art, Lore, Game Design)

Published by **Massif Press**.

- [Massif Press Official Website](https://massifpress.com/)
- [LANCER Core Book](https://massifpress.com/lancer)
- [LANCER on Itch.io](https://massif-press.itch.io/corebook-pdf-free)

### Disclaimer
This Foundry VTT system is an **unofficial, fan-made implementation** of the LANCER RPG rules. It is **not affiliated with, endorsed by, or sponsored by Massif Press**.

LANCER is copyright © Massif Press. All rights reserved. The LANCER name, logo, and all related content are trademarks of Massif Press.

This project is made with love by fans, for fans, to facilitate playing LANCER in Foundry VTT.

## Features

### Actor Sheets
- **Pilot Sheet** — Full pilot management with triggers, mech skills (HASE), talents, licenses, core bonuses, and personal loadout
- **Mech Sheet** — Complete mech management with frame stats, structure/stress tracking, weapons, systems, and core system
- **NPC Sheet** — Compact NPC stat blocks with tier, core stats, HASE skills, weapons, and systems

### Item Types
- Weapons (with mount, type, damage, range, tags, accuracy/difficulty/bonus)
- Systems (with SP cost and tags)
- Talents (with rank)
- Core Bonuses
- Frame Traits
- Core Systems
- Armor, Gear (for pilot loadout)

### Rolling System
- **Skill Checks** — 1d20 + triggers + accuracy/difficulty
- **HASE Checks** — Roll any mech skill with bonuses
- **Tech Attacks** — 1d20 + Tech Attack + accuracy/difficulty
- **Weapon Attacks** — Full attack + damage rolls with critical hit support (20+)
- **Structure Damage** — Roll for structure damage results
- **Overheat/Stress** — Roll for overheating results
- **NPC Scan to Chat** — Post NPC stat blocks to chat

### Dice So Nice Integration
All rolls display in Dice So Nice if the module is installed.

### Macro Bar Support
Drag any roll button to the macro bar for quick access.

### Lancer Status Effects
Custom status conditions: Danger Zone, Down and Out, Engaged, Exposed, Hidden, Invisible, Prone, Shut Down, Immobilized, Impaired, Jammed, Lock On, Shredded, Slowed, Stunned.

## Installation

### Method 1: Manifest URL
1. In Foundry VTT, go to **Game Systems** tab
2. Click **Install System**
3. Paste this URL in the **Manifest URL** field:
   ```
   https://raw.githubusercontent.com/rob8341/lancer-minimal/main/system.json
   ```
4. Click **Install**

### Method 2: Manual Installation
1. Download the latest release from [Releases](https://github.com/rob8341/lancer-minimal/releases)
2. Extract to your Foundry VTT `Data/systems/` folder
3. Restart Foundry VTT

## License

This project is licensed under the MIT License.

LANCER content is used under Massif Press's community content policy. This is a fan project and is not official LANCER content.

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub.

## Author

- **rob8341** — [GitHub](https://github.com/rob8341)
