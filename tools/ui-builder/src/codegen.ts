/**
 * Code generator — converts a PanelDef into a TypeScript HUD component
 * following the project's StatsPanel/InventoryPanel pattern.
 */
import type { PanelDef, PanelNode } from './schema';

function hex(n: number): string {
  return '0x' + n.toString(16).padStart(6, '0');
}

function indent(code: string, level: number): string {
  const pad = '    '.repeat(level);
  return code.split('\n').map(l => l ? pad + l : l).join('\n');
}

export function generateCode(def: PanelDef): string {
  const className = pascalCase(def.name) + 'Panel';
  const slotIds: string[] = [];
  const barIds: string[] = [];
  const textIds: string[] = [];

  // Collect ids
  collectIds(def.children, slotIds, barIds, textIds);

  const lines: string[] = [];

  // Imports
  lines.push(`import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';`);
  lines.push(`import {`);
  lines.push(`  COLORS, METRICS, boldText, regularText,`);
  lines.push(`  createCloseButton, createSlot, createProgressBar, createSectionHeader,`);
  lines.push(`} from '../core';`);
  lines.push('');

  // Constants
  lines.push(`const W = ${def.w};`);
  lines.push(`const PANEL_H = ${def.h};`);
  lines.push('');

  // Class
  lines.push(`export class ${className} {`);
  lines.push(`  public container: Container;`);
  lines.push('');

  // Fields for named slots/bars
  if (slotIds.length > 0) {
    lines.push(`  private slots = new Map<string, { graphics: Graphics; iconSprite: Sprite }>();`);
  }
  if (barIds.length > 0) {
    for (const id of barIds) {
      lines.push(`  private ${camelCase(id)}Bar!: { graphics: Graphics; redraw: (pct: number) => void };`);
    }
  }
  lines.push('');
  lines.push(`  private onClose?: () => void;`);
  lines.push('');

  // Constructor
  lines.push(`  constructor() {`);
  lines.push(`    this.container = new Container();`);
  lines.push(`    this.container.label = '${def.name}-panel';`);
  lines.push(`    this.container.visible = false;`);
  lines.push(`    this.container.eventMode = 'static';`);
  lines.push('');

  // Background
  if (def.bg != null) {
    lines.push(`    const bg = new Graphics();`);
    lines.push(`    bg.roundRect(0, 0, W, PANEL_H, ${def.radius ?? 3});`);
    lines.push(`    bg.fill({ color: ${hex(def.bg)} });`);
    lines.push(`    bg.eventMode = 'static';`);
    lines.push(`    this.container.addChild(bg);`);
    lines.push('');
  }

  // Children
  let varCounter = 0;
  for (const child of def.children) {
    const childCode = generateNodeCode(child, () => `_n${varCounter++}`);
    lines.push(indent(childCode, 2));
    lines.push('');
  }

  // Border
  if (def.border != null) {
    lines.push(`    const border = new Graphics();`);
    lines.push(`    border.roundRect(0, 0, W, PANEL_H, ${def.radius ?? 3});`);
    lines.push(`    border.stroke({ color: ${hex(def.border)}, width: ${def.borderWidth ?? 2} });`);
    lines.push(`    border.eventMode = 'none';`);
    lines.push(`    this.container.addChild(border);`);
  }

  lines.push(`  }`);
  lines.push('');

  // Public API
  lines.push(`  toggle(): void { this.container.visible = !this.container.visible; }`);
  lines.push(`  show(): void { this.container.visible = true; }`);
  lines.push(`  hide(): void { this.container.visible = false; }`);
  lines.push(`  isVisible(): boolean { return this.container.visible; }`);
  lines.push(`  setScale(s: number): void { this.container.scale.set(s); }`);
  lines.push(`  setPosition(x: number, y: number): void { this.container.x = x; this.container.y = y; }`);
  lines.push(`  setOnClose(fn: () => void): void { this.onClose = fn; }`);
  lines.push('');
  lines.push(`  destroy(): void {`);
  if (slotIds.length > 0) lines.push(`    this.slots.clear();`);
  lines.push(`    this.container.destroy({ children: true });`);
  lines.push(`  }`);
  lines.push(`}`);

  return lines.join('\n');
}

function generateNodeCode(node: PanelNode, nextVar: () => string): string {
  switch (node.type) {
    case 'rect': {
      const v = nextVar();
      const shape = node.radius ? `roundRect` : `rect`;
      const args = node.radius
        ? `${node.x}, ${node.y}, ${node.w}, ${node.h}, ${node.radius}`
        : `${node.x}, ${node.y}, ${node.w}, ${node.h}`;
      let code = `const ${v} = new Graphics();\n`;
      code += `${v}.${shape}(${args});\n`;
      code += `${v}.fill({ color: ${hex(node.fill ?? 0xcccccc)}${node.fillAlpha != null ? `, alpha: ${node.fillAlpha}` : ''} });\n`;
      if (node.stroke != null) {
        code += `${v}.${shape}(${args});\n`;
        code += `${v}.stroke({ color: ${hex(node.stroke)}, width: ${node.strokeWidth ?? 1} });\n`;
      }
      code += `this.container.addChild(${v});`;
      return code;
    }

    case 'text': {
      const v = nextVar();
      const styleFn = node.bold ? 'boldText' : 'regularText';
      let code = `const ${v} = new Text({ text: '${escStr(node.value)}', style: ${styleFn}(${node.size ?? 11}, ${hex(node.color ?? 0x3d3529)}) });\n`;
      code += `${v}.x = ${node.x};\n`;
      code += `${v}.y = ${node.y};\n`;
      if (node.anchorX != null || node.anchorY != null) {
        code += `${v}.anchor.set(${node.anchorX ?? 0}, ${node.anchorY ?? 0});\n`;
      }
      code += `this.container.addChild(${v});`;
      return code;
    }

    case 'slot': {
      const v = nextVar();
      let code = `const ${v} = createSlot(${node.x}, ${node.y}, ${node.size});\n`;
      code += `this.container.addChild(${v}.graphics);\n`;
      code += `this.container.addChild(${v}.iconSprite);`;
      if (node.id) {
        code += `\nthis.slots.set('${node.id}', ${v});`;
      }
      return code;
    }

    case 'sprite': {
      const v = nextVar();
      let code = `const ${v} = new Sprite(Texture.EMPTY);\n`;
      code += `${v}.x = ${node.x}; ${v}.y = ${node.y};\n`;
      code += `${v}.width = ${node.w}; ${v}.height = ${node.h};\n`;
      if (node.alpha != null && node.alpha !== 1) code += `${v}.alpha = ${node.alpha};\n`;
      code += `this.container.addChild(${v});\n`;
      if (node.src) {
        code += `Assets.load('${node.src}').then((tex: Texture) => {\n`;
        code += `  ${v}.texture = tex;\n`;
        code += `  ${v}.width = ${node.w}; ${v}.height = ${node.h};\n`;
        code += `}).catch(() => {});`;
      }
      return code;
    }

    case 'bar': {
      const v = nextVar();
      let code = `const ${v} = createProgressBar(${node.x}, ${node.y}, ${node.w}, ${node.h});\n`;
      code += `this.container.addChild(${v}.graphics);\n`;
      code += `${v}.redraw(${node.value ?? 0});`;
      if (node.id) {
        code += `\nthis.${camelCase(node.id)}Bar = ${v};`;
      }
      return code;
    }

    case 'divider': {
      const v = nextVar();
      let code = `const ${v} = new Graphics();\n`;
      code += `${v}.rect(${node.x}, ${node.y}, ${node.w}, ${node.h});\n`;
      code += `${v}.fill({ color: ${hex(node.color ?? 0x8a7f5f)} });\n`;
      code += `this.container.addChild(${v});`;
      return code;
    }

    case 'repeat-column': {
      let code = `for (let i = 0; i < ${node.count}; i++) {\n`;
      code += `  const dy = ${node.y} + i * (${node.template.size} + ${node.gap});\n`;
      code += `  const s = createSlot(${node.x}, dy, ${node.template.size});\n`;
      code += `  this.container.addChild(s.graphics);\n`;
      code += `  this.container.addChild(s.iconSprite);\n`;
      if (node.idPrefix) {
        code += `  this.slots.set('${node.idPrefix}_' + i, s);\n`;
      }
      code += `}`;
      return code;
    }

    case 'scroll-list': {
      const v = nextVar();
      let code = `// Scroll list: ${node.id ?? 'list'}\n`;
      code += `const ${v} = new Container();\n`;
      code += `${v}.x = ${node.x}; ${v}.y = ${node.y};\n`;
      code += `// TODO: implement scroll mask (${node.w}×${node.h}, rowHeight=${node.rowHeight}, rows=${node.rowCount})\n`;
      code += `this.container.addChild(${v});`;
      return code;
    }

    case 'group': {
      const v = nextVar();
      let code = `const ${v} = new Container();\n`;
      if (node.x) code += `${v}.x = ${node.x};\n`;
      if (node.y) code += `${v}.y = ${node.y};\n`;
      code += `this.container.addChild(${v});`;
      return code;
    }

    case 'column':
    case 'row':
      return `// ${node.type} layout — flatten children at build time`;

    default:
      return `// unknown node type`;
  }
}

function collectIds(nodes: PanelNode[], slotIds: string[], barIds: string[], textIds: string[]): void {
  for (const node of nodes) {
    if (node.type === 'slot' && node.id) slotIds.push(node.id);
    if (node.type === 'bar' && node.id) barIds.push(node.id);
    if (node.type === 'text' && node.value) textIds.push(node.value);
    if (node.type === 'repeat-column' && node.idPrefix) {
      for (let i = 0; i < node.count; i++) slotIds.push(`${node.idPrefix}_${i}`);
    }
    if ('children' in node && Array.isArray(node.children)) {
      collectIds(node.children, slotIds, barIds, textIds);
    }
  }
}

function pascalCase(s: string): string {
  return s.replace(/(^|[_-])(\w)/g, (_, _sep, c) => c.toUpperCase());
}

function camelCase(s: string): string {
  const p = pascalCase(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

function escStr(s: string): string {
  return s.replace(/'/g, "\\'").replace(/\n/g, '\\n');
}
