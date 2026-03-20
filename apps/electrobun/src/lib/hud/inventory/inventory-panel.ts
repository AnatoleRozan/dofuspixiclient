import { Container, Graphics, Text } from "pixi.js";
import {
  COLORS,
  METRICS,
  boldText,
  regularText,
  createCloseButton,
  createSectionHeader,
} from "../core";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface InventoryItem {
  itemId: number;
  name: string;
  effects: Array<{ stat: string; value: number }>;
  description: string;
  /** Equipment slot of the item definition (0-6) */
  itemSlot: number;
  quantity: number;
  /** -1 = bag, 0-6 = equipped */
  slot: number;
}

const SLOT_LABELS: Record<number, string> = {
  0: "Amulette",
  1: "Arme",
  2: "Anneau",
  3: "Ceinture",
  4: "Bottes",
  5: "Coiffe",
  6: "Cape",
};

const STAT_LABELS: Record<string, string> = {
  vitality: "Vitalité",
  wisdom: "Sagesse",
  strength: "Force",
  chance: "Chance",
  agility: "Agilité",
  intelligence: "Intelligence",
};

/* ------------------------------------------------------------------ */
/*  Panel                                                             */
/* ------------------------------------------------------------------ */

export class InventoryPanel {
  public readonly container: Container;
  public panelW: number;
  public panelH: number;

  private zoom: number;
  private items: InventoryItem[] = [];
  private kamas = 0;
  private kamaText!: Text;

  private equipSection!: Container;
  private bagSection!: Container;
  private equipSlotTexts = new Map<number, Text>();

  private onClose?: () => void;
  private onEquip?: (itemId: number) => void;
  private onUnequip?: (slot: number) => void;

  constructor(zoom: number) {
    this.zoom = zoom;
    this.container = new Container();
    this.container.label = "inventory-panel";
    this.container.visible = false;
    this.container.eventMode = "static";

    this.panelW = Math.round(280 * zoom);
    this.panelH = Math.round(420 * zoom);

    this.build();
  }

  /* ─── Build ─── */

  private build(): void {
    const z = this.zoom;
    const W = this.panelW;
    const p = (n: number) => Math.round(n * z);
    const f = (n: number) => n * z;

    // Background
    const bg = new Graphics();
    bg.roundRect(0, 0, W, this.panelH, p(3));
    bg.fill({ color: COLORS.BG });
    bg.eventMode = "static";
    this.container.addChild(bg);

    let y = 0;

    // ═══════ HEADER ═══════
    const headerH = p(28);
    const hdrBg = new Graphics();
    hdrBg.roundRect(0, 0, W, headerH, p(3));
    hdrBg.fill({ color: COLORS.HEADER_BG });
    hdrBg.rect(0, p(3), W, headerH - p(3));
    hdrBg.fill({ color: COLORS.HEADER_BG });
    this.container.addChild(hdrBg);

    const title = new Text({
      text: "Inventaire",
      style: boldText(f(13), COLORS.TEXT_WHITE),
    });
    title.anchor.set(0, 0.5);
    title.x = p(8);
    title.y = headerH / 2;
    this.container.addChild(title);

    const closeBtn = createCloseButton(() => {
      this.hide();
      this.onClose?.();
    }, z);
    closeBtn.x = W - p(19);
    closeBtn.y = (headerH - p(METRICS.CLOSE_SIZE)) / 2;
    this.container.addChild(closeBtn);

    y = headerH;

    // ═══════ EQUIPMENT HEADER ═══════
    const equipHdr = createSectionHeader(y, W, "Équipements", z);
    this.container.addChild(equipHdr.graphics);
    this.container.addChild(equipHdr.text);
    y = equipHdr.nextY;

    // ═══════ EQUIPMENT SLOTS ═══════
    this.equipSection = new Container();
    this.equipSection.y = y;
    this.container.addChild(this.equipSection);

    const slotH = p(22);
    const slots = [5, 0, 1, 6, 2, 3, 4]; // Coiffe, Amulette, Arme, Cape, Anneau, Ceinture, Bottes
    for (let i = 0; i < slots.length; i++) {
      const slotId = slots[i];
      const rowY = i * slotH;

      // Alternating bg
      if (i % 2 === 1) {
        const altBg = new Graphics();
        altBg.rect(0, rowY, W, slotH);
        altBg.fill({ color: COLORS.BG_ALT });
        this.equipSection.addChild(altBg);
      }

      // Slot label
      const slotLabel = new Text({
        text: SLOT_LABELS[slotId] ?? `Slot ${slotId}`,
        style: regularText(f(10), COLORS.TEXT_DARK),
      });
      slotLabel.anchor.set(0, 0.5);
      slotLabel.x = p(8);
      slotLabel.y = rowY + slotH / 2;
      this.equipSection.addChild(slotLabel);

      // Item name (or "—")
      const itemText = new Text({
        text: "—",
        style: boldText(f(10), COLORS.TEXT_DARK),
      });
      itemText.anchor.set(1, 0.5);
      itemText.x = W - p(8);
      itemText.y = rowY + slotH / 2;
      this.equipSection.addChild(itemText);
      this.equipSlotTexts.set(slotId, itemText);

      // Click to unequip
      const hitArea = new Graphics();
      hitArea.rect(0, rowY, W, slotH);
      hitArea.fill({ color: 0x000000, alpha: 0 });
      hitArea.eventMode = "static";
      hitArea.cursor = "pointer";
      hitArea.on("pointerdown", () => {
        const equipped = this.items.find((e) => e.slot === slotId);
        if (equipped) this.onUnequip?.(slotId);
      });
      this.equipSection.addChild(hitArea);
    }

    y += slots.length * slotH;

    // ═══════ SAC HEADER ═══════
    const bagHdr = createSectionHeader(y, W, "Sac", z);
    this.container.addChild(bagHdr.graphics);
    this.container.addChild(bagHdr.text);
    y = bagHdr.nextY;

    // ═══════ BAG ITEMS (scrollable list) ═══════
    this.bagSection = new Container();
    this.bagSection.y = y;
    this.container.addChild(this.bagSection);

    // Bag area takes remaining height minus kamas bar
    const kamaBarH = p(28);
    const bagAreaH = this.panelH - y - kamaBarH;

    // Clip mask for bag scroll
    const bagMask = new Graphics();
    bagMask.rect(0, y, W, bagAreaH);
    bagMask.fill({ color: 0xffffff });
    this.container.addChild(bagMask);
    this.bagSection.mask = bagMask;

    // Scroll with mouse wheel
    bg.on("wheel", (e: any) => {
      const dy = e.deltaY > 0 ? -20 * z : 20 * z;
      const minY = y - Math.max(0, this.bagSection.height - bagAreaH);
      this.bagSection.y = Math.min(y, Math.max(minY, this.bagSection.y + dy));
    });

    y = this.panelH - kamaBarH;

    // ═══════ KAMAS BAR ═══════
    const kamaBar = new Graphics();
    kamaBar.roundRect(0, y, W, kamaBarH, p(3));
    kamaBar.fill({ color: 0x7a7a56 });
    this.container.addChild(kamaBar);

    const kamaLabel = new Text({
      text: "Kamas",
      style: boldText(f(11), COLORS.TEXT_WHITE),
    });
    kamaLabel.anchor.set(0, 0.5);
    kamaLabel.x = p(8);
    kamaLabel.y = y + kamaBarH / 2;
    this.container.addChild(kamaLabel);

    this.kamaText = new Text({
      text: "0",
      style: boldText(f(12), 0xffdd44),
    });
    this.kamaText.anchor.set(1, 0.5);
    this.kamaText.x = W - p(8);
    this.kamaText.y = y + kamaBarH / 2;
    this.container.addChild(this.kamaText);

    // Border overlay
    const border = new Graphics();
    border.roundRect(0, 0, W, this.panelH, p(3));
    border.stroke({ color: COLORS.BORDER, width: 2 });
    border.eventMode = "none";
    this.container.addChild(border);
  }

  /* ─── Refresh display ─── */

  private refreshEquipSlots(): void {
    for (const [slotId, text] of this.equipSlotTexts) {
      const equipped = this.items.find((e) => e.slot === slotId);
      if (equipped) {
        text.text = equipped.name;
        text.style.fill = 0x44bb44;
      } else {
        text.text = "—";
        text.style.fill = COLORS.TEXT_DARK;
      }
    }
  }

  private refreshBagList(): void {
    const z = this.zoom;
    const p = (n: number) => Math.round(n * z);
    const f = (n: number) => n * z;
    const W = this.panelW;
    const rowH = p(24);

    this.bagSection.removeChildren();

    const bagItems = this.items.filter((e) => e.slot === -1);

    if (bagItems.length === 0) {
      const empty = new Text({
        text: "Sac vide",
        style: regularText(f(10), 0x999999),
      });
      empty.x = p(8);
      empty.y = p(4);
      this.bagSection.addChild(empty);
      return;
    }

    for (let i = 0; i < bagItems.length; i++) {
      const item = bagItems[i];
      const ry = i * rowH;

      // Alternating bg
      if (i % 2 === 1) {
        const altBg = new Graphics();
        altBg.rect(0, ry, W, rowH);
        altBg.fill({ color: COLORS.BG_ALT });
        this.bagSection.addChild(altBg);
      }

      // Item name
      const nameText = new Text({
        text: item.name,
        style: boldText(f(10), COLORS.TEXT_DARK),
      });
      nameText.anchor.set(0, 0.5);
      nameText.x = p(8);
      nameText.y = ry + rowH / 2;
      this.bagSection.addChild(nameText);

      // Quantity
      if (item.quantity > 1) {
        const qtyText = new Text({
          text: `x${item.quantity}`,
          style: regularText(f(9), 0x888888),
        });
        qtyText.anchor.set(0, 0.5);
        qtyText.x = nameText.x + nameText.width + p(4);
        qtyText.y = ry + rowH / 2;
        this.bagSection.addChild(qtyText);
      }

      // Slot type label
      const slotLabel = new Text({
        text: SLOT_LABELS[item.itemSlot] ?? "",
        style: regularText(f(8), 0x999999),
      });
      slotLabel.anchor.set(1, 0.5);
      slotLabel.x = W - p(8);
      slotLabel.y = ry + rowH / 2;
      this.bagSection.addChild(slotLabel);

      // Effects tooltip on hover
      const statsStr = item.effects
        .map((e) => `+${e.value} ${STAT_LABELS[e.stat] ?? e.stat}`)
        .join(", ");

      // Click to equip
      const hitArea = new Graphics();
      hitArea.rect(0, ry, W, rowH);
      hitArea.fill({ color: 0x000000, alpha: 0 });
      hitArea.eventMode = "static";
      hitArea.cursor = "pointer";

      // Hover effect
      const hoverBg = new Graphics();
      hoverBg.rect(0, ry, W, rowH);
      hoverBg.fill({ color: 0xffffff, alpha: 0.1 });
      hoverBg.visible = false;
      this.bagSection.addChild(hoverBg);

      // Tooltip text
      const tooltipText = new Text({
        text: statsStr || "Aucun effet",
        style: regularText(f(8), 0xaaaaaa),
      });
      tooltipText.anchor.set(0, 0);
      tooltipText.x = p(8);
      tooltipText.y = ry + rowH - p(2);
      tooltipText.visible = false;
      this.bagSection.addChild(tooltipText);

      hitArea.on("pointerover", () => {
        hoverBg.visible = true;
        tooltipText.visible = true;
      });
      hitArea.on("pointerout", () => {
        hoverBg.visible = false;
        tooltipText.visible = false;
      });
      hitArea.on("pointerdown", () => {
        this.onEquip?.(item.itemId);
      });
      this.bagSection.addChild(hitArea);
    }
  }

  /* ─── Public API ─── */

  updateInventory(items: InventoryItem[]): void {
    this.items = items;
    this.refreshEquipSlots();
    this.refreshBagList();
  }

  updateKamas(kamas: number): void {
    this.kamas = kamas;
    this.kamaText.text = kamas.toLocaleString();
  }

  rebuild(zoom: number): void {
    this.zoom = zoom;
    this.panelW = Math.round(280 * zoom);
    this.panelH = Math.round(420 * zoom);

    this.equipSlotTexts.clear();
    this.container.removeChildren();
    this.build();
    this.refreshEquipSlots();
    this.refreshBagList();
    this.kamaText.text = this.kamas.toLocaleString();
  }

  setOnClose(fn: () => void): void {
    this.onClose = fn;
  }
  setOnEquip(fn: (itemId: number) => void): void {
    this.onEquip = fn;
  }
  setOnUnequip(fn: (slot: number) => void): void {
    this.onUnequip = fn;
  }

  toggle(): void {
    this.container.visible = !this.container.visible;
  }
  show(): void {
    this.container.visible = true;
  }
  hide(): void {
    this.container.visible = false;
  }
  isVisible(): boolean {
    return this.container.visible;
  }

  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  destroy(): void {
    this.equipSlotTexts.clear();
    this.container.destroy({ children: true });
  }
}
