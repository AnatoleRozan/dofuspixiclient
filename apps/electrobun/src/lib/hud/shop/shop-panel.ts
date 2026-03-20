import { Container, Graphics, Text, TextStyle } from "pixi.js";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ShopItem {
  id: number;
  name: string;
  slot: number;
  level: number;
  price: number;
  effects: Array<{ stat: string; value: number }>;
  description: string;
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
  vitality: "Vita",
  wisdom: "Sag",
  strength: "Fo",
  chance: "Cha",
  agility: "Agi",
  intelligence: "Int",
};

/* ------------------------------------------------------------------ */
/*  Shop Panel                                                        */
/* ------------------------------------------------------------------ */

export class ShopPanel {
  public readonly container: Container;
  private onClose?: () => void;
  private onBuy?: (itemId: number) => void;

  constructor() {
    this.container = new Container();
    this.container.label = "shop-panel";
    this.container.zIndex = 2000;
    this.container.visible = false;
    this.container.eventMode = "static";
  }

  /* ─── Show ─── */

  show(
    npcName: string,
    items: ShopItem[],
    kamas: number,
    screenWidth: number,
    screenHeight: number
  ): void {
    this.container.removeChildren();

    const PADDING = 16;
    const HEADER_H = 32;
    const ROW_H = 48;
    const CLOSE_SIZE = 20;
    const MAX_W = 440;
    const KAMA_BAR_H = 28;

    // Compute dimensions
    const maxVisibleRows = Math.min(items.length, 8);
    const listH = items.length * ROW_H;
    const visibleListH = maxVisibleRows * ROW_H;
    const panelW = MAX_W;
    const panelH = HEADER_H + visibleListH + KAMA_BAR_H;

    // Background
    const bg = new Graphics();
    bg.roundRect(0, 0, panelW, panelH, 6);
    bg.fill({ color: 0x1a1a2e, alpha: 0.97 });
    bg.eventMode = "static";
    this.container.addChild(bg);

    // Header
    const hdrBg = new Graphics();
    hdrBg.roundRect(0, 0, panelW, HEADER_H, 6);
    hdrBg.fill({ color: 0x2d2d44 });
    hdrBg.rect(0, HEADER_H - 6, panelW, 6);
    hdrBg.fill({ color: 0x2d2d44 });
    this.container.addChild(hdrBg);

    const nameText = new Text({
      text: npcName,
      style: new TextStyle({
        fontFamily: "Arial",
        fontSize: 14,
        fontWeight: "bold",
        fill: 0xffdd44,
      }),
    });
    nameText.x = PADDING;
    nameText.y = (HEADER_H - nameText.height) / 2;
    this.container.addChild(nameText);

    // Close button
    const closeBtn = new Graphics();
    closeBtn.roundRect(0, 0, CLOSE_SIZE, CLOSE_SIZE, 3);
    closeBtn.fill({ color: 0xcc4400 });
    closeBtn.x = panelW - CLOSE_SIZE - 6;
    closeBtn.y = (HEADER_H - CLOSE_SIZE) / 2;
    closeBtn.eventMode = "static";
    closeBtn.cursor = "pointer";

    const xText = new Text({
      text: "✕",
      style: new TextStyle({
        fontFamily: "Arial",
        fontSize: 12,
        fontWeight: "bold",
        fill: 0xffffff,
      }),
    });
    xText.anchor.set(0.5, 0.5);
    xText.x = CLOSE_SIZE / 2;
    xText.y = CLOSE_SIZE / 2;
    closeBtn.addChild(xText);
    closeBtn.on("pointerdown", () => {
      this.hide();
      this.onClose?.();
    });
    this.container.addChild(closeBtn);

    // Scrollable item list container
    const listContainer = new Container();
    listContainer.y = HEADER_H;
    this.container.addChild(listContainer);

    // Clip mask
    const listMask = new Graphics();
    listMask.rect(0, HEADER_H, panelW, visibleListH);
    listMask.fill({ color: 0xffffff });
    this.container.addChild(listMask);
    listContainer.mask = listMask;

    // Build rows
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const ry = i * ROW_H;

      // Alternating row bg
      const rowBg = new Graphics();
      rowBg.rect(0, ry, panelW, ROW_H);
      rowBg.fill({ color: i % 2 === 0 ? 0x222240 : 0x1a1a2e });
      listContainer.addChild(rowBg);

      // Item name
      const itemName = new Text({
        text: item.name,
        style: new TextStyle({
          fontFamily: "Arial",
          fontSize: 12,
          fontWeight: "bold",
          fill: 0xf0ece0,
        }),
      });
      itemName.x = PADDING;
      itemName.y = ry + 4;
      listContainer.addChild(itemName);

      // Slot type
      const slotText = new Text({
        text: SLOT_LABELS[item.slot] ?? "",
        style: new TextStyle({
          fontFamily: "Arial",
          fontSize: 9,
          fill: 0x888888,
        }),
      });
      slotText.x = PADDING;
      slotText.y = ry + 20;
      listContainer.addChild(slotText);

      // Effects
      const effectsStr = item.effects
        .map((e) => `+${e.value} ${STAT_LABELS[e.stat] ?? e.stat}`)
        .join("  ");
      const effectsText = new Text({
        text: effectsStr,
        style: new TextStyle({
          fontFamily: "Arial",
          fontSize: 10,
          fill: 0x88cc88,
        }),
      });
      effectsText.x = PADDING + 60;
      effectsText.y = ry + 20;
      listContainer.addChild(effectsText);

      // Price
      const priceText = new Text({
        text: `${item.price.toLocaleString()} K`,
        style: new TextStyle({
          fontFamily: "Arial",
          fontSize: 11,
          fontWeight: "bold",
          fill: kamas >= item.price ? 0xffdd44 : 0xff4444,
        }),
      });
      priceText.anchor.set(1, 0.5);
      priceText.x = panelW - 70;
      priceText.y = ry + ROW_H / 2;
      listContainer.addChild(priceText);

      // Buy button
      const btnW = 54;
      const btnH = 22;
      const btnX = panelW - btnW - 8;
      const btnY = ry + (ROW_H - btnH) / 2;
      const canAfford = kamas >= item.price;

      const btn = new Graphics();
      btn.roundRect(btnX, btnY, btnW, btnH, 4);
      btn.fill({ color: canAfford ? 0x336633 : 0x333333 });
      btn.eventMode = "static";
      btn.cursor = canAfford ? "pointer" : "not-allowed";
      listContainer.addChild(btn);

      const btnLabel = new Text({
        text: "Acheter",
        style: new TextStyle({
          fontFamily: "Arial",
          fontSize: 10,
          fontWeight: "bold",
          fill: canAfford ? 0xffffff : 0x666666,
        }),
      });
      btnLabel.anchor.set(0.5, 0.5);
      btnLabel.x = btnX + btnW / 2;
      btnLabel.y = btnY + btnH / 2;
      listContainer.addChild(btnLabel);

      if (canAfford) {
        btn.on("pointerover", () => {
          btn.clear();
          btn.roundRect(btnX, btnY, btnW, btnH, 4);
          btn.fill({ color: 0x449944 });
        });
        btn.on("pointerout", () => {
          btn.clear();
          btn.roundRect(btnX, btnY, btnW, btnH, 4);
          btn.fill({ color: 0x336633 });
        });
        btn.on("pointerdown", () => {
          this.onBuy?.(item.id);
        });
      }
    }

    // Scroll with wheel
    bg.on("wheel", (e: any) => {
      if (listH <= visibleListH) return;
      const dy = e.deltaY > 0 ? -30 : 30;
      const minY = HEADER_H - (listH - visibleListH);
      listContainer.y = Math.min(
        HEADER_H,
        Math.max(minY, listContainer.y + dy)
      );
    });

    // Kamas bar at bottom
    const kamaY = HEADER_H + visibleListH;
    const kamaBar = new Graphics();
    kamaBar.roundRect(0, kamaY, panelW, KAMA_BAR_H, 6);
    kamaBar.fill({ color: 0x2d2d44 });
    kamaBar.rect(0, kamaY, panelW, 6);
    kamaBar.fill({ color: 0x2d2d44 });
    this.container.addChild(kamaBar);

    const kamaLabel = new Text({
      text: "Tes kamas :",
      style: new TextStyle({
        fontFamily: "Arial",
        fontSize: 11,
        fill: 0xf0ece0,
      }),
    });
    kamaLabel.x = PADDING;
    kamaLabel.y = kamaY + (KAMA_BAR_H - kamaLabel.height) / 2;
    this.container.addChild(kamaLabel);

    const kamaVal = new Text({
      text: kamas.toLocaleString(),
      style: new TextStyle({
        fontFamily: "Arial",
        fontSize: 12,
        fontWeight: "bold",
        fill: 0xffdd44,
      }),
    });
    kamaVal.anchor.set(1, 0);
    kamaVal.x = panelW - PADDING;
    kamaVal.y = kamaY + (KAMA_BAR_H - kamaVal.height) / 2;
    this.container.addChild(kamaVal);

    // Border
    const border = new Graphics();
    border.roundRect(0, 0, panelW, panelH, 6);
    border.stroke({ color: 0x8a7f5f, width: 2 });
    border.eventMode = "none";
    this.container.addChild(border);

    // Center on screen
    this.container.x = Math.round((screenWidth - panelW) / 2);
    this.container.y = Math.round((screenHeight - panelH) / 2);

    this.container.visible = true;
  }

  hide(): void {
    this.container.visible = false;
  }

  get isVisible(): boolean {
    return this.container.visible;
  }

  setOnClose(fn: () => void): void {
    this.onClose = fn;
  }

  setOnBuy(fn: (itemId: number) => void): void {
    this.onBuy = fn;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
