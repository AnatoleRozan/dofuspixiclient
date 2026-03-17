import type { PanelDef } from '../schema';

export const worldMapPanel: PanelDef = {
  name: 'worldmap',
  w: 800, h: 420,
  bg: 0x2a2218,
  border: 0x8a7f5f,
  borderWidth: 2,
  radius: 3,
  viewport: { position: 'center', fillPercent: 90 },
  children: [
    // Header
    { type: 'rect', x: 0, y: 0, w: 800, h: 24, fill: 0x5c5040, radius: 3 },
    { type: 'rect', x: 0, y: 3, w: 800, h: 21, fill: 0x5c5040 },
    { type: 'text', x: 10, y: 12, value: 'Carte du monde', size: 13, color: 0xffffff, bold: true, anchorY: 0.5 },

    // Map area (placeholder)
    { type: 'rect', x: 8, y: 32, w: 784, h: 380, fill: 0x1a1610, radius: 2 },
    { type: 'text', x: 400, y: 222, value: 'Carte du monde', size: 16, color: 0x555555, anchorX: 0.5, anchorY: 0.5 },
  ],
};
