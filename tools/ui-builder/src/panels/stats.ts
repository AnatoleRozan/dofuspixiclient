import type { PanelDef } from '../schema';

const W = 250;
const H = 420;
const ROW_H = 18;
const HEADER_H = 17;
const PX = 10;

export const statsPanel: PanelDef = {
  name: 'stats',
  w: W, h: H,
  bg: 0xddd7b2,
  border: 0x8a7f5f,
  borderWidth: 2,
  radius: 3,
  viewport: { position: 'top-right', fillPercent: 75 },
  children: [
    // Header
    { type: 'rect', x: 0, y: 0, w: W, h: 28, fill: 0x5c5040, radius: 3 },
    { type: 'rect', x: 0, y: 3, w: W, h: 25, fill: 0x5c5040 },
    { type: 'text', x: PX + 62, y: 14, value: 'Nom du personnage', size: 13, color: 0xffffff, bold: true, anchorY: 0.5 },

    // Alignment icon frame
    { type: 'slot', x: PX, y: 4, size: 50, id: 'align_icon', borderColor: 0x88bbcc },

    // Level
    { type: 'text', x: PX + 56, y: 36, value: 'Niveau 1', size: 11, bold: true },

    // Energy bar
    ...makeStatRow(46, 'Energie', 'energy', true),
    // XP bar
    ...makeStatRow(46 + ROW_H, 'Expérience', 'xp', true),

    // Combat stats
    ...makeCombatRow(46 + ROW_H * 2, 'Points de vie', 'hp', 0),
    ...makeCombatRow(46 + ROW_H * 3, "Points d'actions", 'ap', 1),
    ...makeCombatRow(46 + ROW_H * 4, 'Points de mouvement', 'mp', 2),
    ...makeCombatRow(46 + ROW_H * 5, 'Initiative', 'init', 3),
    ...makeCombatRow(46 + ROW_H * 6, 'Prospection', 'pp', 4),

    // Caractéristiques header
    { type: 'rect', x: 0, y: 46 + ROW_H * 7, w: W, h: HEADER_H, fill: 0x5c5040 },
    { type: 'text', x: PX, y: 46 + ROW_H * 7 + HEADER_H / 2, value: 'Caractéristiques', size: 11, color: 0xffffff, bold: true, anchorY: 0.5 },

    // 6 stat rows
    ...makeCharacRow(46 + ROW_H * 7 + HEADER_H, 'Vitalité', 'vitality', 0),
    ...makeCharacRow(46 + ROW_H * 8 + HEADER_H, 'Sagesse', 'wisdom', 1),
    ...makeCharacRow(46 + ROW_H * 9 + HEADER_H, 'Force', 'strength', 2),
    ...makeCharacRow(46 + ROW_H * 10 + HEADER_H, 'Intelligence', 'intelligence', 3),
    ...makeCharacRow(46 + ROW_H * 11 + HEADER_H, 'Chance', 'chance', 4),
    ...makeCharacRow(46 + ROW_H * 12 + HEADER_H, 'Agilité', 'agility', 5),

    // Capital header
    { type: 'rect', x: 0, y: 46 + ROW_H * 13 + HEADER_H, w: W, h: HEADER_H, fill: 0x7a7a56 },
    { type: 'text', x: PX, y: 46 + ROW_H * 13 + HEADER_H + HEADER_H / 2, value: 'Capital', size: 11, color: 0xffffff, bold: true, anchorY: 0.5 },
    { type: 'text', x: W - PX, y: 46 + ROW_H * 13 + HEADER_H + HEADER_H / 2, value: '0', size: 12, color: 0xffffff, bold: true, anchorX: 1, anchorY: 0.5 },

    // Métiers header
    { type: 'rect', x: 0, y: 46 + ROW_H * 13 + HEADER_H * 2, w: W, h: HEADER_H, fill: 0x5c5040 },
    { type: 'text', x: PX, y: 46 + ROW_H * 13 + HEADER_H * 2 + HEADER_H / 2, value: 'Mes métiers', size: 11, color: 0xffffff, bold: true, anchorY: 0.5 },

    // Job slots (3) + Spec slots (3)
    { type: 'slot', x: 30, y: H - 56, size: 42, id: 'job_0' },
    { type: 'slot', x: 76, y: H - 56, size: 42, id: 'job_1' },
    { type: 'slot', x: 122, y: H - 56, size: 42, id: 'job_2' },
    { type: 'slot', x: 176, y: H - 42, size: 30, id: 'spec_0' },
    { type: 'slot', x: 209, y: H - 42, size: 30, id: 'spec_1' },
  ],
};

function makeStatRow(y: number, label: string, id: string, _isBar: boolean) {
  return [
    { type: 'text' as const, x: PX, y: y + ROW_H / 2, value: label, size: 11, bold: true, anchorY: 0.5 },
    { type: 'bar' as const, x: 90, y: y + 3, w: W - 90 - PX, h: 12, value: 0.5, id },
  ];
}

function makeCombatRow(y: number, label: string, id: string, idx: number) {
  return [
    ...(idx % 2 === 1 ? [{ type: 'rect' as const, x: 0, y, w: W, h: ROW_H, fill: 0xc4be96 }] : []),
    { type: 'slot' as const, x: PX, y: y + 2, size: 14, id: `icon_${id}` },
    { type: 'text' as const, x: PX + 18, y: y + ROW_H / 2, value: label, size: 11, bold: true, anchorY: 0.5 },
    { type: 'text' as const, x: W - PX, y: y + ROW_H / 2, value: '0', size: 11, bold: true, anchorX: 1, anchorY: 0.5 },
  ];
}

function makeCharacRow(y: number, label: string, id: string, idx: number) {
  return [
    ...(idx % 2 === 1 ? [{ type: 'rect' as const, x: 0, y, w: W, h: ROW_H, fill: 0xc4be96 }] : []),
    { type: 'text' as const, x: PX, y: y + ROW_H / 2, value: label, size: 11, bold: true, anchorY: 0.5 },
    { type: 'text' as const, x: W - PX - 40, y: y + ROW_H / 2, value: '0', size: 11, bold: true, anchorX: 1, anchorY: 0.5 },
    { type: 'slot' as const, x: W - PX - 14, y: y + 2, size: 14, id: `boost_${id}` },
  ];
}
