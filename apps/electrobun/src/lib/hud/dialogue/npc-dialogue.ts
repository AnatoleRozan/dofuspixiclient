import { Container, Graphics, Text, TextStyle } from 'pixi.js';

const PADDING = 16;
const HEADER_H = 32;
const CLOSE_SIZE = 20;
const MAX_WIDTH = 420;
const BORDER_RADIUS = 6;

const COLOR_BG = 0x1a1a2e;
const COLOR_HEADER = 0x2d2d44;
const COLOR_BORDER = 0x8a7f5f;
const COLOR_CLOSE_BG = 0xcc4400;
const COLOR_CLOSE_HOVER = 0xff6622;
const COLOR_TEXT = 0xf0ece0;
const COLOR_NPC_NAME = 0xffdd44;

/**
 * NPC dialogue panel, faithful to Dofus 1.29 style.
 * Centered on screen, shows NPC name + messages, click to close.
 */
export class NpcDialogue {
  public readonly container: Container;
  private bg: Graphics;
  private onClose?: () => void;

  constructor() {
    this.container = new Container();
    this.container.label = 'npc-dialogue';
    this.container.zIndex = 2000;
    this.container.visible = false;
    this.container.eventMode = 'static';

    this.bg = new Graphics();
    this.container.addChild(this.bg);
  }

  /**
   * Show a dialogue from an NPC.
   */
  show(
    npcName: string,
    messages: string[],
    screenWidth: number,
    screenHeight: number,
  ): void {
    // Clear previous content
    this.container.removeChildren();
    this.bg = new Graphics();
    this.container.addChild(this.bg);

    const bodyText = messages.join('\n\n');

    // Name text
    const nameStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 14,
      fontWeight: 'bold',
      fill: COLOR_NPC_NAME,
    });
    const nameText = new Text({ text: npcName, style: nameStyle });
    nameText.x = PADDING;
    nameText.y = (HEADER_H - nameText.height) / 2;

    // Body text
    const bodyStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 12,
      fill: COLOR_TEXT,
      wordWrap: true,
      wordWrapWidth: MAX_WIDTH - PADDING * 2,
      lineHeight: 18,
    });
    const bodyTextObj = new Text({ text: bodyText, style: bodyStyle });
    bodyTextObj.x = PADDING;
    bodyTextObj.y = HEADER_H + PADDING;

    // Compute dimensions
    const contentW = Math.max(
      nameText.width + PADDING * 2 + CLOSE_SIZE + 8,
      bodyTextObj.width + PADDING * 2,
      240,
    );
    const panelW = Math.min(contentW, MAX_WIDTH);
    const panelH = HEADER_H + PADDING + bodyTextObj.height + PADDING * 2;

    // Draw background
    this.bg.clear();

    // Main panel
    this.bg.roundRect(0, 0, panelW, panelH, BORDER_RADIUS);
    this.bg.fill({ color: COLOR_BG, alpha: 0.95 });

    // Header bar
    this.bg.roundRect(0, 0, panelW, HEADER_H, BORDER_RADIUS);
    this.bg.fill({ color: COLOR_HEADER, alpha: 1 });
    // Fix bottom corners of header (overlap with body)
    this.bg.rect(0, HEADER_H - BORDER_RADIUS, panelW, BORDER_RADIUS);
    this.bg.fill({ color: COLOR_HEADER, alpha: 1 });

    // Border
    this.bg.roundRect(0, 0, panelW, panelH, BORDER_RADIUS);
    this.bg.stroke({ color: COLOR_BORDER, width: 2 });

    // Close button
    const closeBtn = new Graphics();
    closeBtn.roundRect(0, 0, CLOSE_SIZE, CLOSE_SIZE, 3);
    closeBtn.fill({ color: COLOR_CLOSE_BG });
    closeBtn.x = panelW - CLOSE_SIZE - 6;
    closeBtn.y = (HEADER_H - CLOSE_SIZE) / 2;
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';

    // X text on close button
    const xText = new Text({
      text: '✕',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 12,
        fontWeight: 'bold',
        fill: 0xffffff,
      }),
    });
    xText.anchor.set(0.5, 0.5);
    xText.x = CLOSE_SIZE / 2;
    xText.y = CLOSE_SIZE / 2;
    closeBtn.addChild(xText);

    closeBtn.on('pointerover', () => {
      closeBtn.clear();
      closeBtn.roundRect(0, 0, CLOSE_SIZE, CLOSE_SIZE, 3);
      closeBtn.fill({ color: COLOR_CLOSE_HOVER });
    });
    closeBtn.on('pointerout', () => {
      closeBtn.clear();
      closeBtn.roundRect(0, 0, CLOSE_SIZE, CLOSE_SIZE, 3);
      closeBtn.fill({ color: COLOR_CLOSE_BG });
    });
    closeBtn.on('pointertap', () => {
      this.hide();
      this.onClose?.();
    });

    this.container.addChild(nameText);
    this.container.addChild(bodyTextObj);
    this.container.addChild(closeBtn);

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

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
