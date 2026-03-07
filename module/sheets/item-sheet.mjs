/**
 * Lancer Minimal — Item Sheet
 * A generic item sheet that adapts its layout based on item type.
 */
export class LancerItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["lancer-minimal", "sheet", "item"],
      template: "systems/lancer-minimal/templates/item-sheet.hbs",
      width: 520,
      height: 480
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get isEditable() {
    // If the item is locked, it's not editable
    if (this.item.system.locked) return false;
    return super.isEditable;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    const context = await super.getData();
    context.system = foundry.utils.duplicate(this.item.system);
    context.itemType = this.item.type;
    context.locked = this.item.system.locked ?? false;

    // Friendly type labels
    const typeLabels = {
      weapon: "Weapon",
      system: "System",
      talent: "Talent",
      frame: "Frame",
      skill: "Skill",
      armor: "Armor",
      gear: "Gear",
      core_bonus: "Core Bonus"
    };
    context.typeLabel = typeLabels[this.item.type] || this.item.type;

    return context;
  }
}
