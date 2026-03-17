/**
 * Inventory panel definition — Dofus 1.29
 *
 * Two-column layout:
 * Left:  Equipment paperdoll (5 cols of slots) + kamas + pods + item detail
 * Right: Category tabs + filter dropdown + 8×10 item grid
 */
import type { PanelDef } from '../schema';

const LEFT_W = 270;
const RIGHT_W = 290;
const DIV = 2;
const W = LEFT_W + DIV + RIGHT_W;
const H = 440;
const HEADER_H = 24;
const S = 32;   // slot size
const DS = 28;  // dofus slot size

// Equipment zone
const EQ_Y = HEADER_H + 4;
const EQ_H = 192;

// Column X positions
const C1X = 6;              // dofus
const C2X = C1X + DS + 8;   // bouclier, anneau g
const C3X = C2X + S + 8;    // amu, ceinture, bottes
const C4X = C3X + S + 8;    // arme, anneau d
const C5X = C4X + S + 8;    // coiffe, cape, familier, monture

// Y helper for vertically centered columns
function colY(idx: number, total: number): number {
  const gap = 6;
  const colH = (total - 1) * (S + gap);
  const top = EQ_Y + (EQ_H - colH - S) / 2;
  return top + idx * (S + gap);
}

// Dofus vertical distribution
const dGap = (EQ_H - 6 * DS) / 5;

// Right column
const RX = LEFT_W + DIV;

export const inventoryPanel: PanelDef = {
  name: 'inventory',
  w: W,
  h: H,
  bg: 0xc8c2a4,
  border: 0x8a7f5f,
  borderWidth: 2,
  radius: 3,
  children: [
    // ═══════ Left column background ═══════
    { type: 'rect', x: 2, y: HEADER_H, w: LEFT_W - 2, h: H - HEADER_H - 2, fill: 0xd0caae },

    // ═══════ Header ═══════
    { type: 'rect', x: 0, y: 0, w: W, h: HEADER_H, fill: 0x5c5040, radius: 3 },
    { type: 'rect', x: 0, y: 3, w: W, h: HEADER_H - 3, fill: 0x5c5040 },
    { type: 'text', x: 10, y: HEADER_H / 2, value: 'Ton inventaire', size: 12, color: 0xffffff, bold: true, anchorY: 0.5 },

    // ═══════ Vertical divider ═══════
    { type: 'divider', x: LEFT_W, y: HEADER_H, w: DIV, h: H - HEADER_H },

    // ═══════ Silhouette ═══════
    {
      type: 'sprite',
      x: C2X + ((C4X + S - C2X) - 120) / 2,
      y: EQ_Y + (EQ_H - 150) / 2,
      w: 120,
      h: 150,
      src: '/assets/hud/inventory/silhouette.svg',
      alpha: 0.5,
    },

    // ═══════ Col 1: 6 Dofus ═══════
    { type: 'repeat-column', x: C1X, y: EQ_Y, count: 6, gap: dGap, template: { type: 'slot', size: DS }, idPrefix: 'dofus' },

    // ═══════ Col 2: Bouclier, Anneau G ═══════
    { type: 'slot', x: C2X, y: colY(0, 2), size: S, id: 'shield' },
    { type: 'slot', x: C2X, y: colY(1, 2), size: S, id: 'left_ring' },

    // ═══════ Col 3: Amulette, Ceinture, Bottes ═══════
    { type: 'slot', x: C3X, y: colY(0, 3), size: S, id: 'amulet' },
    { type: 'slot', x: C3X, y: colY(1, 3), size: S, id: 'belt' },
    { type: 'slot', x: C3X, y: colY(2, 3), size: S, id: 'boots' },

    // ═══════ Col 4: Arme, Anneau D ═══════
    { type: 'slot', x: C4X, y: colY(0, 2), size: S, id: 'weapon' },
    { type: 'slot', x: C4X, y: colY(1, 2), size: S, id: 'right_ring' },

    // ═══════ Col 5: Coiffe, Cape, Familier, Monture ═══════
    { type: 'slot', x: C5X, y: colY(0, 4), size: S, id: 'helmet' },
    { type: 'slot', x: C5X, y: colY(1, 4), size: S, id: 'cloak' },
    { type: 'slot', x: C5X, y: colY(2, 4), size: S, id: 'pet' },
    { type: 'slot', x: C5X, y: colY(3, 4), size: S, id: 'mount' },

    // ═══════ Kamas + Pods ═══════
    {
      type: 'sprite', x: 6, y: EQ_Y + EQ_H + 2, w: 14, h: 14,
      src: '/assets/hud/inventory/kama-symbol.svg',
    },
    { type: 'text', x: 24, y: EQ_Y + EQ_H + 3, value: '0', size: 11, bold: true },
    { type: 'text', x: LEFT_W - 6, y: EQ_Y + EQ_H + 1, value: '0 pods sur 0', size: 9, anchorX: 1 },
    { type: 'bar', x: 6, y: EQ_Y + EQ_H + 18, w: LEFT_W - 12, h: 10, value: 0.6, id: 'pods' },

    // ═══════ Separator ═══════
    { type: 'divider', x: 4, y: EQ_Y + EQ_H + 34, w: LEFT_W - 8, h: 1 },

    // ═══════ Item detail zone ═══════
    { type: 'rect', x: 4, y: EQ_Y + EQ_H + 39, w: LEFT_W - 8, h: H - (EQ_Y + EQ_H + 39) - 4, fill: 0xc4be96 },
    { type: 'text', x: 10, y: EQ_Y + EQ_H + 45, value: 'Sélectionne un objet', size: 11, bold: true },

    // ═══════ Right column: category header ═══════
    { type: 'rect', x: RX, y: HEADER_H + 2, w: RIGHT_W, h: 17, fill: 0x5c5040 },
    { type: 'text', x: RX + RIGHT_W / 2, y: HEADER_H + 2 + 8.5, value: 'Équipement', size: 11, color: 0xffffff, bold: true, anchorX: 0.5, anchorY: 0.5 },

    // ═══════ Filter tabs ═══════
    ...(['Équipement', 'Divers', 'Ressources', 'Quêtes'] as const).map((_label, i) => ({
      type: 'rect' as const,
      x: RX + i * (RIGHT_W / 4),
      y: HEADER_H + 21,
      w: RIGHT_W / 4,
      h: 20,
      fill: i === 0 ? 0x5c5040 : 0xc4be96,
    })),
    ...(['Équipement', 'Divers', 'Ressources', 'Quêtes'] as const).map((text, i) => ({
      type: 'text' as const,
      x: RX + i * (RIGHT_W / 4) + RIGHT_W / 8,
      y: HEADER_H + 31,
      value: text,
      size: 8,
      bold: true,
      color: i === 0 ? 0xffffff : 0x3d3529,
      anchorX: 0.5,
      anchorY: 0.5,
    })),

    // ═══════ Dropdown ═══════
    { type: 'rect', x: RX + 4, y: HEADER_H + 43, w: RIGHT_W - 8, h: 18, fill: 0xffffff, radius: 2, stroke: 0x8a7f5f },
    { type: 'text', x: RX + 10, y: HEADER_H + 45, value: 'Tous types', size: 9 },
    { type: 'text', x: RX + RIGHT_W - 16, y: HEADER_H + 47, value: '▼', size: 7 },

    // ═══════ Item grid background ═══════
    { type: 'rect', x: RX, y: HEADER_H + 63, w: RIGHT_W, h: H - HEADER_H - 63 - 2, fill: 0xc4be96 },

    // ═══════ Item grid (8×10) ═══════
    ...Array.from({ length: 80 }, (_, i) => {
      const col = i % 8;
      const row = Math.floor(i / 8);
      const padX = (RIGHT_W - 8 * 34) / 2;
      return {
        type: 'slot' as const,
        x: RX + padX + col * 34,
        y: HEADER_H + 67 + row * 34,
        size: S,
        id: `grid_${i}`,
      };
    }),
  ],
};
