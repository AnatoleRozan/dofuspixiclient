import type { PanelDef } from '../schema';

export const timelinePanel: PanelDef = {
  name: 'combat-timeline',
  w: 500, h: 60,
  bg: 0x2a2218,
  border: 0x5c5040,
  borderWidth: 2,
  radius: 4,
  viewport: { position: 'top-left', fillPercent: 60 },
  children: [
    // Header
    { type: 'rect', x: 0, y: 0, w: 500, h: 18, fill: 0x5c5040, radius: 4 },
    { type: 'rect', x: 0, y: 4, w: 500, h: 14, fill: 0x5c5040 },
    { type: 'text', x: 8, y: 9, value: 'Timeline', size: 10, color: 0xffffff, bold: true, anchorY: 0.5 },

    // Fighter portraits row
    ...Array.from({ length: 12 }, (_, i) => ({
      type: 'slot' as const,
      x: 8 + i * 40,
      y: 22,
      size: 34,
      id: `fighter_${i}`,
      borderColor: i < 6 ? 0x3366cc : 0xcc3333,
    })),
  ],
};

export const actionBarPanel: PanelDef = {
  name: 'combat-action-bar',
  w: 320, h: 44,
  bg: 0x3d3529,
  border: 0x5c5040,
  borderWidth: 2,
  radius: 4,
  viewport: { position: 'bottom-right', fillPercent: 40 },
  children: [
    // Action buttons
    { type: 'slot', x: 6, y: 6, size: 32, id: 'btn_ready' },
    { type: 'slot', x: 44, y: 6, size: 32, id: 'btn_pass' },
    { type: 'slot', x: 82, y: 6, size: 32, id: 'btn_forfeit' },
    { type: 'divider', x: 120, y: 6, w: 1, h: 32, color: 0x5c5040 },
    // AP/MP display
    { type: 'text', x: 130, y: 22, value: 'PA: 6', size: 12, color: 0xffcc00, bold: true, anchorY: 0.5 },
    { type: 'text', x: 190, y: 22, value: 'PM: 3', size: 12, color: 0x33ccff, bold: true, anchorY: 0.5 },
    // Timer
    { type: 'text', x: 280, y: 22, value: '0:30', size: 14, color: 0xffffff, bold: true, anchorX: 0.5, anchorY: 0.5 },
  ],
};

export const spellBarPanel: PanelDef = {
  name: 'combat-spell-bar',
  w: 400, h: 50,
  bg: 0x3d3529,
  border: 0x5c5040,
  borderWidth: 2,
  radius: 4,
  viewport: { position: 'bottom-left', fillPercent: 50 },
  children: [
    // Spell slots (row of 10)
    ...Array.from({ length: 10 }, (_, i) => ({
      type: 'slot' as const,
      x: 6 + i * 39,
      y: 6,
      size: 36,
      id: `spell_${i}`,
    })),
  ],
};
