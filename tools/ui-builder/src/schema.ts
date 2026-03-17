/**
 * Declarative panel definition schema.
 *
 * A panel is described as a tree of nodes. The renderer walks the tree
 * and creates Pixi.js display objects. This keeps the definition pure
 * data — no Pixi imports, serializable as JSON.
 */

// ─── Interactions & data bindings ─────────────────────────────

/** Bind a node's display value to a protocol/data field */
export interface DataBinding {
  /** Data path: e.g. "inventory.kamas", "character.hp", "item.quantity" */
  field: string;
  /** How to format the value for display */
  format?: 'number' | 'percent' | 'text';
}

/** Event handler declaration */
export interface EventHandler {
  /** Event type */
  event: 'click' | 'hover' | 'drag' | 'drop';
  /** Protocol message to send: e.g. "INVENTORY_MOVE", "INVENTORY_USE" */
  action?: string;
  /** Emit a local UI event: e.g. "select-item", "toggle-filter" */
  emit?: string;
  /** Payload template — keys reference data paths */
  payload?: Record<string, string>;
}

/** Common interaction properties that any node can have */
export interface NodeInteraction {
  /** Bind display value to data */
  bind?: DataBinding;
  /** Event handlers */
  events?: EventHandler[];
  /** Cursor on hover */
  cursor?: 'pointer' | 'move' | 'grab' | 'default';
  /** Tooltip text or data binding */
  tooltip?: string;
  /** Whether this node is draggable (for drag & drop items) */
  draggable?: boolean;
  /** Drop target id (accepts dragged items) */
  dropTarget?: string;
}

// ─── Base ────────────────────────────────────────────────────

interface BaseNode {
  /** Interaction / protocol binding (optional on any node) */
  interaction?: NodeInteraction;
}

// ─── Leaf node types ─────────────────────────────────────────

export interface RectNode extends BaseNode {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: number;
  fillAlpha?: number;
  radius?: number;
  stroke?: number;
  strokeWidth?: number;
}

export interface TextNode extends BaseNode {
  type: 'text';
  x: number;
  y: number;
  value: string;
  size?: number;
  color?: number;
  bold?: boolean;
  anchorX?: number;
  anchorY?: number;
  wordWrapWidth?: number;
}

export interface SlotNode extends BaseNode {
  type: 'slot';
  x: number;
  y: number;
  size: number;
  id?: string;            // logical slot id (e.g. "helmet", "dofus_1")
  borderColor?: number;
  icon?: string;          // asset path for icon
}

export interface SpriteNode extends BaseNode {
  type: 'sprite';
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;            // asset path
  alpha?: number;
}

export interface BarNode extends BaseNode {
  type: 'bar';
  x: number;
  y: number;
  w: number;
  h: number;
  value?: number;         // 0..1
  id?: string;
}

export interface DividerNode extends BaseNode {
  type: 'divider';
  x: number;
  y: number;
  w: number;
  h: number;
  color?: number;
}

// ─── Layout nodes ────────────────────────────────────────────

export interface GroupNode extends BaseNode {
  type: 'group';
  x?: number;
  y?: number;
  children: PanelNode[];
}

export interface ColumnNode extends BaseNode {
  type: 'column';
  x: number;
  y: number;
  gap: number;
  children: PanelNode[];
}

export interface RowNode extends BaseNode {
  type: 'row';
  x: number;
  y: number;
  gap: number;
  children: PanelNode[];
}

/**
 * Repeat a template node N times in a column layout.
 * Useful for slot columns (e.g. 6 dofus slots).
 */
export interface RepeatColumnNode extends BaseNode {
  type: 'repeat-column';
  x: number;
  y: number;
  count: number;
  gap: number;
  template: Omit<SlotNode, 'x' | 'y'>;
  idPrefix?: string;      // generates ids: `${idPrefix}_0`, `${idPrefix}_1`…
}

/**
 * Scrollable list — renders a clipped container with N visible rows.
 * Each row is built from `rowTemplate`. Scrolls via wheel or drag.
 */
export interface ScrollListNode extends BaseNode {
  type: 'scroll-list';
  x: number;
  y: number;
  w: number;
  h: number;
  id?: string;
  rowHeight: number;
  rowCount: number;         // total data rows (for scrollbar sizing)
  visibleRows?: number;     // auto-calculated from h/rowHeight if omitted
  rowTemplate: PanelNode[]; // nodes rendered per row (x/y relative to row origin)
  bg?: number;
  scrollbarWidth?: number;
}

// ─── Union type ──────────────────────────────────────────────

export type PanelNode =
  | RectNode
  | TextNode
  | SlotNode
  | SpriteNode
  | BarNode
  | DividerNode
  | GroupNode
  | ColumnNode
  | RowNode
  | RepeatColumnNode
  | ScrollListNode;

// ─── Panel definition ────────────────────────────────────────

export interface PanelDef {
  name: string;
  w: number;
  h: number;
  bg?: number;
  bgAlpha?: number;
  border?: number;
  borderWidth?: number;
  radius?: number;
  children: PanelNode[];

  /** Viewport placement (for preview overlay) */
  viewport?: {
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    fillPercent?: number;   // e.g. 75 = 75% of game area
    offsetX?: number;
    offsetY?: number;
  };
}
