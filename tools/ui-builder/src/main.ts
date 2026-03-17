import { Application, Container, Graphics } from 'pixi.js';
import { renderPanel, type RenderResult } from './renderer';
import type { PanelDef, PanelNode } from './schema';
import { generateCode } from './codegen';
import { History } from './history';
import { parsePanel } from './parser';

// ─── Known project panel files (relative to electrobun/src/lib/) ───
const PROJECT_PANELS: Array<{ name: string; path: string; desc: string }> = [
  { name: 'inventory', path: 'hud/inventory/inventory-panel.ts', desc: 'Inventaire (équipement + grille items)' },
  { name: 'stats', path: 'hud/stats/stats-panel.ts', desc: 'Fiche personnage (stats + carac)' },
  { name: 'worldmap', path: 'hud/worldmap/world-map-panel.ts', desc: 'Carte du monde' },
  { name: 'timeline', path: 'hud/combat/timeline.ts', desc: 'Timeline de combat' },
  { name: 'action-bar', path: 'hud/combat/action-bar.ts', desc: 'Barre d\'actions combat' },
  { name: 'spell-bar', path: 'hud/combat/spell-bar.ts', desc: 'Barre de sorts' },
];

// ─── State ───
const STORAGE_KEY = 'dofus-ui-builder';

// Load saved panels from localStorage, or use builtins
const panels: Record<string, PanelDef> = loadFromStorage() ?? buildDefaultPanels();
let currentName = '';
let selectedIndex = -1;
let selectedIndices: Set<number> = new Set();
let app: Application | null = null;
let result: RenderResult | null = null;
let viewZoom = 1;
const snapSize = 4;
let snapEnabled = true;
let viewportMode = true;

const history = new History();

// Game viewport dimensions (Dofus 1.29)
const GAME_W = 860;
const GAME_H = 560;
const BANNER_H = 128;

// ─── Persistence ───
function saveToStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
    history.markClean();
    updateTitle();
  } catch { /* quota exceeded */ }
}

function loadFromStorage(): Record<string, PanelDef> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* corrupt */ }
  return null;
}

function buildDefaultPanels(): Record<string, PanelDef> {
  return {};
}

function updateTitle(): void {
  const dot = history.isDirty() ? ' •' : '';
  const c = history.counts();
  document.title = `UI Builder — ${currentName}${dot}`;
  const status = document.getElementById('status');
  if (status) {
    status.textContent = `${dot ? '● unsaved' : '✓ saved'} | undo: ${c.undo} | redo: ${c.redo}`;
  }
}

/** Push a snapshot before making a change */
function pushHistory(): void {
  history.push(getDef());
  updateTitle();
}

function applyUndo(def: PanelDef | null): void {
  if (!def) return;
  panels[currentName] = def;
  selectedIndex = -1;
  selectedIndices.clear();
  syncPanelInputs();
  rebuild();
}

// ─── DOM refs ───
const canvasWrap = document.getElementById('canvas-wrap')!;
const propsEl = document.getElementById('props')!;
const jsonArea = document.getElementById('json-area') as HTMLTextAreaElement;
const codeArea = document.getElementById('code-area') as HTMLTextAreaElement;
const nodeTree = document.getElementById('node-tree')!;
const panelSelect = document.getElementById('panel-select') as HTMLSelectElement;
const panelNameInput = document.getElementById('panel-name') as HTMLInputElement;
const panelWInput = document.getElementById('panel-w') as HTMLInputElement;
const panelHInput = document.getElementById('panel-h') as HTMLInputElement;
const panelBgInput = document.getElementById('panel-bg') as HTMLInputElement;
const panelBorderInput = document.getElementById('panel-border') as HTMLInputElement;
const zoomLabel = document.getElementById('zoom-label')!;

function getDef(): PanelDef {
  return panels[currentName] ?? { name: '', w: 0, h: 0, children: [] };
}
function snap(v: number): number { return snapEnabled ? Math.round(v / snapSize) * snapSize : v; }

// ─── Tabs (JSON / Code) ───
const tabJson = document.getElementById('tab-json')!;
const tabCode = document.getElementById('tab-code')!;
const jsonWrap = document.getElementById('json-wrap')!;
const codeWrap = document.getElementById('code-wrap')!;

tabJson.addEventListener('click', () => {
  tabJson.style.borderBottomColor = '#0078d4'; tabJson.style.color = '#ccc';
  tabCode.style.borderBottomColor = 'transparent'; tabCode.style.color = '#666';
  jsonWrap.style.display = 'flex'; codeWrap.style.display = 'none';
});
tabCode.addEventListener('click', () => {
  tabCode.style.borderBottomColor = '#0078d4'; tabCode.style.color = '#ccc';
  tabJson.style.borderBottomColor = 'transparent'; tabJson.style.color = '#666';
  codeWrap.style.display = 'flex'; jsonWrap.style.display = 'none';
  codeArea.value = generateCode(getDef());
});

document.getElementById('btn-copy-code')!.addEventListener('click', () => {
  navigator.clipboard.writeText(codeArea.value);
  const btn = document.getElementById('btn-copy-code')!;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = 'Copy Code'; }, 1500);
});

// ─── Panel selector ───
function refreshPanelSelect() {
  panelSelect.innerHTML = '';
  for (const name of Object.keys(panels)) {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    opt.selected = name === currentName;
    panelSelect.appendChild(opt);
  }
}

panelSelect.addEventListener('change', () => {
  openPanel(panelSelect.value);
});

document.getElementById('btn-home')!.addEventListener('click', () => {
  currentName = '';
  showWelcome();
});

document.getElementById('btn-new')!.addEventListener('click', () => {
  const name = prompt('Nom du panel:', `panel_${Object.keys(panels).length}`) || `panel_${Date.now()}`;
  panels[name] = {
    name, w: 400, h: 300,
    bg: 0xddd7b2, border: 0x8a7f5f, borderWidth: 2, radius: 3,
    children: [],
    viewport: { position: 'center', fillPercent: 75 },
  };
  openPanel(name);
});

// ─── Panel properties ───
function syncPanelInputs() {
  const def = getDef();
  panelNameInput.value = def.name;
  panelWInput.value = String(def.w);
  panelHInput.value = String(def.h);
  panelBgInput.value = '#' + (def.bg ?? 0xddd7b2).toString(16).padStart(6, '0');
  panelBorderInput.value = '#' + (def.border ?? 0x8a7f5f).toString(16).padStart(6, '0');
}

panelNameInput.addEventListener('input', () => {
  if (!currentName) return;
  const def = getDef();
  const old = currentName;
  def.name = panelNameInput.value || old;
  if (old !== def.name) {
    panels[def.name] = def; delete panels[old]; currentName = def.name;
    refreshPanelSelect();
  }
});
panelWInput.addEventListener('input', () => { if (!currentName) return; pushHistory(); getDef().w = parseInt(panelWInput.value) || 400; rebuild(); });
panelHInput.addEventListener('input', () => { if (!currentName) return; pushHistory(); getDef().h = parseInt(panelHInput.value) || 300; rebuild(); });
panelBgInput.addEventListener('input', () => { if (!currentName) return; pushHistory(); getDef().bg = parseInt(panelBgInput.value.slice(1), 16); rebuild(); });
panelBorderInput.addEventListener('input', () => { if (!currentName) return; pushHistory(); getDef().border = parseInt(panelBorderInput.value.slice(1), 16); rebuild(); });

// ─── Toolbox ───
document.querySelectorAll<HTMLButtonElement>('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    pushHistory();
    getDef().children.push(createDefaultNode(btn.dataset.type!));
    selectedIndex = getDef().children.length - 1;
    rebuild();
  });
});

function createDefaultNode(type: string): PanelNode {
  const defs: Record<string, PanelNode> = {
    rect:           { type: 'rect', x: 20, y: 40, w: 80, h: 40, fill: 0xc4be96, radius: 0 },
    text:           { type: 'text', x: 20, y: 40, value: 'Label', size: 11, bold: true },
    slot:           { type: 'slot', x: 20, y: 40, size: 32, id: `slot_${Date.now() % 10000}` },
    sprite:         { type: 'sprite', x: 20, y: 40, w: 48, h: 48, src: '' },
    bar:            { type: 'bar', x: 20, y: 40, w: 100, h: 10, value: 0.5, id: 'bar_new' },
    divider:        { type: 'divider', x: 20, y: 40, w: 100, h: 1 },
    'scroll-list':  { type: 'scroll-list', x: 20, y: 40, w: 200, h: 150, rowHeight: 28, rowCount: 20, id: 'list', rowTemplate: [
      { type: 'slot', x: 2, y: 2, size: 24, id: 'item' },
      { type: 'text', x: 30, y: 6, value: 'Item name', size: 10 },
    ]},
    'repeat-column': { type: 'repeat-column', x: 20, y: 40, count: 4, gap: 6, template: { type: 'slot', size: 28 }, idPrefix: 'col' },
    group:          { type: 'group', x: 20, y: 40, children: [] },
  };
  return structuredClone(defs[type] ?? defs.rect);
}

// ─── Toolbar ───
document.getElementById('btn-duplicate')!.addEventListener('click', () => {
  if (selectedIndex < 0) return;
  pushHistory();
  const clone = structuredClone(getDef().children[selectedIndex]);
  if ('x' in clone) (clone as { x: number }).x += 16;
  if ('y' in clone) (clone as { y: number }).y += 16;
  getDef().children.splice(selectedIndex + 1, 0, clone);
  selectedIndex++;
  rebuild();
});

document.getElementById('btn-delete')!.addEventListener('click', () => {
  if (selectedIndex < 0) return;
  pushHistory();
  getDef().children.splice(selectedIndex, 1);
  selectedIndex = Math.min(selectedIndex, getDef().children.length - 1);
  rebuild();
});

(document.getElementById('snap-toggle') as HTMLInputElement).addEventListener('change', (e) => {
  snapEnabled = (e.target as HTMLInputElement).checked;
});

(document.getElementById('viewport-toggle') as HTMLInputElement).addEventListener('change', (e) => {
  viewportMode = (e.target as HTMLInputElement).checked;
  rebuild();
});

document.getElementById('btn-zoom-in')!.addEventListener('click', () => { viewZoom = Math.min(3, viewZoom + 0.25); rebuild(); });
document.getElementById('btn-zoom-out')!.addEventListener('click', () => { viewZoom = Math.max(0.25, viewZoom - 0.25); rebuild(); });

document.getElementById('btn-export')!.addEventListener('click', () => {
  navigator.clipboard.writeText(JSON.stringify(getDef(), null, 2));
  const btn = document.getElementById('btn-export')!;
  btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy JSON'; }, 1500);
});

document.getElementById('btn-import')!.addEventListener('click', () => {
  try {
    const def = JSON.parse(jsonArea.value) as PanelDef;
    panels[def.name || 'imported'] = def;
    currentName = def.name || 'imported';
    selectedIndex = -1;
    refreshPanelSelect(); syncPanelInputs(); rebuild();
  } catch (e) { alert('Invalid JSON: ' + (e as Error).message); }
});

// Keyboard
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;

  // Undo/Redo/Save work even in inputs
  if (mod && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    applyUndo(history.undo());
    return;
  }
  if (mod && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    applyUndo(history.redo());
    return;
  }
  if (mod && e.key === 's') {
    e.preventDefault();
    saveToStorage();
    return;
  }

  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === 'Delete' || e.key === 'Backspace') document.getElementById('btn-delete')!.click();
  if (mod && e.key === 'd') { e.preventDefault(); document.getElementById('btn-duplicate')!.click(); }
  if (mod && e.key === 'a') { e.preventDefault(); selectAll(); }
  if (e.key === 'Escape') {
    selectedIndex = -1;
    selectedIndices.clear();
    rebuild();
  }
});

function selectAll() {
  const def = getDef();
  selectedIndices.clear();
  for (let i = 0; i < def.children.length; i++) {
    selectedIndices.add(i);
  }
  selectedIndex = def.children.length > 0 ? 0 : -1;
  rebuild();
}

function isSelected(i: number): boolean {
  return selectedIndices.size > 0 ? selectedIndices.has(i) : i === selectedIndex;
}

function getSelectedNodes(): Array<{ index: number; node: PanelNode }> {
  const def = getDef();
  if (selectedIndices.size > 0) {
    return [...selectedIndices].map(i => ({ index: i, node: def.children[i] })).filter(e => e.node);
  }
  if (selectedIndex >= 0 && selectedIndex < def.children.length) {
    return [{ index: selectedIndex, node: def.children[selectedIndex] }];
  }
  return [];
}

/** Bounding box of all selected nodes */
function getSelectionBounds(): { x: number; y: number; w: number; h: number } | null {
  const nodes = getSelectedNodes();
  if (nodes.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { node } of nodes) {
    if (!('x' in node && 'y' in node)) continue;
    const n = node as { x: number; y: number; w?: number; h?: number; size?: number };
    const nx = n.x;
    const ny = n.y;
    const nw = n.w ?? n.size ?? 32;
    const nh = n.h ?? n.size ?? 32;
    minX = Math.min(minX, nx);
    minY = Math.min(minY, ny);
    maxX = Math.max(maxX, nx + nw);
    maxY = Math.max(maxY, ny + nh);
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ─── Node tree ───
// Icons per type for quick visual identification
const TYPE_ICONS: Record<string, string> = {
  rect: '▢', text: 'T', slot: '◫', sprite: '🖼', bar: '▬',
  divider: '─', group: '⊞', column: '↕', row: '↔',
  'repeat-column': '⋮', 'scroll-list': '☰',
};

function renderTree() {
  nodeTree.innerHTML = '';
  getDef().children.forEach((node, i) => {
    renderTreeNode(node, i, 0);
  });
}

function renderTreeNode(node: PanelNode, i: number, depth: number) {
  const div = document.createElement('div');
  div.className = 'tree-node' + (isSelected(i) ? ' selected' : '');
  div.style.paddingLeft = `${8 + depth * 14}px`;
  div.dataset.index = String(i);

  const icon = TYPE_ICONS[node.type] ?? '?';
  const idStr = ('id' in node && node.id) ? `<span class="id">${node.id}</span>` : '';
  const valStr = node.type === 'text' ? `<span class="id">"${node.value.substring(0, 12)}"</span>` : '';
  const sizeStr = ('w' in node && 'h' in node)
    ? `<span class="id" style="color:#666">${(node as {w:number}).w}×${(node as {h:number}).h}</span>`
    : ('size' in node ? `<span class="id" style="color:#666">${(node as {size:number}).size}</span>` : '');

  const label = document.createElement('span');
  label.innerHTML = `<span style="opacity:0.5;margin-right:3px">${icon}</span><span class="type">${node.type}</span> ${idStr} ${valStr} ${sizeStr}`;
  div.appendChild(label);

  const del = document.createElement('button');
  del.className = 'del-btn'; del.textContent = '×';
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    pushHistory();
    getDef().children.splice(i, 1);
    selectedIndices.clear();
    if (selectedIndex >= getDef().children.length) selectedIndex = getDef().children.length - 1;
    rebuild();
  });
  div.appendChild(del);

  div.addEventListener('click', (e) => {
    if (e.shiftKey) {
      // Shift+click: toggle in multi-select
      if (selectedIndices.has(i)) selectedIndices.delete(i);
      else selectedIndices.add(i);
      selectedIndex = i;
    } else {
      selectedIndices.clear();
      selectedIndex = i;
    }
    rebuild();
  });

  nodeTree.appendChild(div);

  // Show children of group/column/row in the tree
  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      // Children aren't direct def.children — show them read-only, dimmed
      const childDiv = document.createElement('div');
      childDiv.className = 'tree-node';
      childDiv.style.paddingLeft = `${8 + (depth + 1) * 14}px`;
      childDiv.style.opacity = '0.6';
      const cIcon = TYPE_ICONS[child.type] ?? '?';
      const cId = ('id' in child && child.id) ? `<span class="id">${child.id}</span>` : '';
      childDiv.innerHTML = `<span style="opacity:0.5;margin-right:3px">${cIcon}</span><span class="type">${child.type}</span> ${cId}`;
      nodeTree.appendChild(childDiv);
    }
  }

  // Show repeat-column template info
  if (node.type === 'repeat-column') {
    const tmplDiv = document.createElement('div');
    tmplDiv.className = 'tree-node';
    tmplDiv.style.paddingLeft = `${8 + (depth + 1) * 14}px`;
    tmplDiv.style.opacity = '0.5';
    tmplDiv.innerHTML = `<span style="margin-right:3px">×</span>${node.count} slots (${node.idPrefix ?? 'unnamed'})`;
    nodeTree.appendChild(tmplDiv);
  }

  // Show scroll-list row template info
  if (node.type === 'scroll-list') {
    const tmplDiv = document.createElement('div');
    tmplDiv.className = 'tree-node';
    tmplDiv.style.paddingLeft = `${8 + (depth + 1) * 14}px`;
    tmplDiv.style.opacity = '0.5';
    tmplDiv.innerHTML = `<span style="margin-right:3px">☰</span>${node.rowCount} rows, ${node.rowTemplate.length} items/row`;
    nodeTree.appendChild(tmplDiv);
  }
}

// ─── Props panel ───
function renderProps() {
  propsEl.innerHTML = '';
  if (selectedIndex < 0 || selectedIndex >= getDef().children.length) {
    propsEl.innerHTML = '<p class="hint">Select a node to edit.<br>Drag nodes on canvas to move.</p>';
    return;
  }

  const node = getDef().children[selectedIndex];
  const h3 = document.createElement('h3');
  h3.textContent = node.type;
  propsEl.appendChild(h3);

  const skip = new Set(['type', 'children', 'template', 'rowTemplate', 'interaction']);
  for (const [key, value] of Object.entries(node)) {
    if (skip.has(key)) continue;
    propsEl.appendChild(makePropRow(key, value, (v) => {
      pushHistory();
      (node as unknown as Record<string, unknown>)[key] = v;
      rebuild();
    }));
  }

  // Template sub-props
  if (node.type === 'repeat-column' && node.template) {
    addSubProps('template', node.template, () => { pushHistory(); rebuild(); });
  }
  // Row template for scroll-list
  if (node.type === 'scroll-list' && node.rowTemplate) {
    const sub = document.createElement('h3');
    sub.textContent = `rowTemplate (${node.rowTemplate.length} items)`;
    sub.style.marginTop = '10px';
    propsEl.appendChild(sub);

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Edit row template items in JSON tab';
    propsEl.appendChild(hint);
  }

  // ─── Interaction section ───
  renderInteractionProps(node);
}

function renderInteractionProps(node: PanelNode) {
  const interaction: any = (node as any).interaction ?? {};

  const section = document.createElement('div');
  section.style.cssText = 'margin-top:12px;border-top:1px solid #3c3c3c;padding-top:8px';

  const toggle = document.createElement('button');
  toggle.style.cssText = 'background:none;border:1px solid #3c3c3c;color:#888;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:10px;width:100%;text-align:left';
  const hasInteraction = Object.keys(interaction).length > 0;
  toggle.textContent = hasInteraction ? '⚡ Interaction' : '+ Ajouter interaction';

  const content = document.createElement('div');
  content.style.cssText = 'margin-top:6px;' + (hasInteraction ? '' : 'display:none');

  // Bind field
  content.appendChild(makePropRow('bind.field', interaction.bind?.field ?? '', (v) => {
    pushHistory();
    if (!interaction.bind) interaction.bind = { field: '' };
    interaction.bind.field = v as string;
    (node as any).interaction = interaction;
    rebuild();
  }));

  // Tooltip
  content.appendChild(makePropRow('tooltip', interaction.tooltip ?? '', (v) => {
    pushHistory();
    interaction.tooltip = v as string;
    (node as any).interaction = interaction;
    rebuild();
  }));

  // Cursor
  content.appendChild(makePropRow('cursor', interaction.cursor ?? 'default', (v) => {
    pushHistory();
    interaction.cursor = v as string;
    (node as any).interaction = interaction;
    rebuild();
  }));

  // Events — simplified: one click action
  content.appendChild(makePropRow('onClick', interaction.events?.[0]?.action ?? '', (v) => {
    pushHistory();
    if (!interaction.events) interaction.events = [];
    if (interaction.events.length === 0) interaction.events.push({ event: 'click' });
    interaction.events[0].action = v as string;
    (node as any).interaction = interaction;
    rebuild();
  }));

  // Draggable checkbox
  content.appendChild(makePropRow('draggable', interaction.draggable ?? false, (v) => {
    pushHistory();
    interaction.draggable = v as boolean;
    (node as any).interaction = interaction;
    rebuild();
  }));

  // Drop target
  content.appendChild(makePropRow('dropTarget', interaction.dropTarget ?? '', (v) => {
    pushHistory();
    interaction.dropTarget = v as string;
    (node as any).interaction = interaction;
    rebuild();
  }));

  toggle.addEventListener('click', () => {
    content.style.display = content.style.display === 'none' ? '' : 'none';
  });

  section.appendChild(toggle);
  section.appendChild(content);
  propsEl.appendChild(section);
}

function addSubProps(title: string, obj: Record<string, unknown>, onChange: () => void) {
  const sub = document.createElement('h3');
  sub.textContent = title;
  sub.style.marginTop = '10px';
  propsEl.appendChild(sub);
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'type') continue;
    propsEl.appendChild(makePropRow(key, value, (v) => {
      obj[key] = v;
      onChange();
    }));
  }
}

/** Parse a color string: supports #51493c, 0x51493c, or raw decimal */
function parseColor(str: string): number {
  const s = str.trim();
  if (s.startsWith('#')) return parseInt(s.slice(1), 16) || 0;
  if (s.startsWith('0x') || s.startsWith('0X')) return parseInt(s.slice(2), 16) || 0;
  return parseInt(s, 10) || 0;
}

function colorToHex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

function makePropRow(key: string, value: unknown, onChange: (v: unknown) => void): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'prop-row';
  const label = document.createElement('label');
  label.textContent = key;
  row.appendChild(label);

  const isColor = typeof value === 'number' &&
    ['fill', 'color', 'stroke', 'borderColor', 'border', 'bg'].includes(key);

  if (isColor) {
    const ci = document.createElement('input');
    ci.type = 'color';
    ci.value = colorToHex(value as number);
    row.appendChild(ci);

    // Text input for hex (#51493c or 0x51493c)
    const hi = document.createElement('input');
    hi.type = 'text';
    hi.value = colorToHex(value as number);
    hi.style.width = '80px';
    hi.placeholder = '#51493c';

    ci.addEventListener('input', () => {
      const v = parseInt(ci.value.slice(1), 16);
      hi.value = ci.value;
      onChange(v);
    });
    hi.addEventListener('input', () => {
      const v = parseColor(hi.value);
      ci.value = colorToHex(v);
      onChange(v);
    });
    row.appendChild(hi);
  } else if (key === 'radius' && typeof value === 'number') {
    // Range slider + number input for radius
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0'; range.max = '50'; range.step = '1';
    range.value = String(value);
    range.style.cssText = 'flex:1;height:16px;cursor:pointer';
    const num = document.createElement('input');
    num.type = 'number';
    num.value = String(value);
    num.style.width = '42px';
    num.min = '0';
    range.addEventListener('input', () => { num.value = range.value; onChange(parseInt(range.value)); });
    num.addEventListener('input', () => { range.value = num.value; onChange(parseInt(num.value) || 0); });
    row.appendChild(range);
    row.appendChild(num);
  } else if (key === 'fillAlpha' || key === 'alpha') {
    // Range slider for alpha 0..1
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0'; range.max = '1'; range.step = '0.05';
    range.value = String(value);
    range.style.cssText = 'flex:1;height:16px;cursor:pointer';
    const num = document.createElement('input');
    num.type = 'number';
    num.value = String(value);
    num.style.width = '50px';
    num.step = '0.05'; num.min = '0'; num.max = '1';
    range.addEventListener('input', () => { num.value = range.value; onChange(parseFloat(range.value)); });
    num.addEventListener('input', () => { range.value = num.value; onChange(parseFloat(num.value) || 0); });
    row.appendChild(range);
    row.appendChild(num);
  } else if (typeof value === 'boolean') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value;
    input.style.width = 'auto';
    input.addEventListener('change', () => onChange(input.checked));
    row.appendChild(input);
  } else {
    const input = document.createElement('input');
    input.type = typeof value === 'number' ? 'number' : 'text';
    input.value = String(value ?? '');
    if (typeof value === 'number') input.step = '1';
    input.addEventListener('input', () => {
      if (typeof value === 'number') {
        onChange(parseFloat(input.value) || 0);
      } else {
        onChange(input.value);
      }
    });
    row.appendChild(input);
  }

  return row;
}

// ─── Resize handles ───
// We use a global resize state so the stage-level pointermove can drive it
// even after the handle Graphics is destroyed by rebuild().
let resizeState: {
  active: boolean;
  handlePos: string;
  startGX: number; startGY: number;
  origX: number; origY: number; origW: number; origH: number;
  zoom: number;
  hasWH: boolean; hasSize: boolean;
} | null = null;
let resizeOriginals: Array<{ x: number; y: number; w: number; h: number }> | null = null;

const HANDLE_SIZE = 8;
const HANDLE_COLOR = 0x00aaff;

function addResizeHandles(panelContainer: Container, zoom: number) {
  const selected = getSelectedNodes();
  if (selected.length === 0) return;

  const bounds = getSelectionBounds();
  if (!bounds) return;

  // Selection outline
  const selBox = new Graphics();
  selBox.rect(bounds.x - 1, bounds.y - 1, bounds.w + 2, bounds.h + 2);
  selBox.stroke({ color: HANDLE_COLOR, width: 1.5 });
  selBox.eventMode = 'none';
  panelContainer.addChild(selBox);

  // If multi-select, also outline each individual node
  if (selected.length > 1) {
    for (const { node } of selected) {
      if (!('x' in node && 'y' in node)) continue;
      const n = node as { x: number; y: number; w?: number; h?: number; size?: number };
      const nw = n.w ?? n.size ?? 32;
      const nh = n.h ?? n.size ?? 32;
      const indBox = new Graphics();
      indBox.rect(n.x, n.y, nw, nh);
      indBox.stroke({ color: 0x66ccff, width: 1 });
      indBox.eventMode = 'none';
      panelContainer.addChild(indBox);
    }
  }

  // Check if resizable (single node with w/h/size, or multi = group resize)
  const singleNode = selected.length === 1 ? selected[0].node : null;
  const hasWH = singleNode ? ('w' in singleNode && 'h' in singleNode) : true;
  const hasSize = singleNode ? ('size' in singleNode && !hasWH) : false;

  // 8 resize handles on the bounding box
  const bx = bounds.x, by = bounds.y, bw = bounds.w, bh = bounds.h;
  const corners: Array<{ pos: string; cx: number; cy: number; cursor: string }> = [
    { pos: 'tl', cx: bx,          cy: by,          cursor: 'nwse-resize' },
    { pos: 't',  cx: bx + bw / 2, cy: by,          cursor: 'ns-resize' },
    { pos: 'tr', cx: bx + bw,     cy: by,          cursor: 'nesw-resize' },
    { pos: 'l',  cx: bx,          cy: by + bh / 2, cursor: 'ew-resize' },
    { pos: 'r',  cx: bx + bw,     cy: by + bh / 2, cursor: 'ew-resize' },
    { pos: 'bl', cx: bx,          cy: by + bh,     cursor: 'nesw-resize' },
    { pos: 'b',  cx: bx + bw / 2, cy: by + bh,     cursor: 'ns-resize' },
    { pos: 'br', cx: bx + bw,     cy: by + bh,     cursor: 'nwse-resize' },
  ];

  for (const hp of corners) {
    const h = new Graphics();
    const hs = HANDLE_SIZE;
    h.rect(hp.cx - hs / 2, hp.cy - hs / 2, hs, hs);
    h.fill({ color: HANDLE_COLOR });
    h.stroke({ color: 0xffffff, width: 1 });
    h.eventMode = 'static';
    h.cursor = hp.cursor;

    h.on('pointerdown', (e: import('pixi.js').FederatedPointerEvent) => {
      e.stopPropagation();
      pushHistory();
      resizeState = {
        active: true,
        handlePos: hp.pos,
        startGX: e.global.x, startGY: e.global.y,
        origX: bx, origY: by,
        origW: bw, origH: bh,
        zoom, hasWH, hasSize,
      };
    });

    panelContainer.addChild(h);
  }
}

// Panel resize state (survives rebuild)
let panelResizeState: {
  active: boolean;
  edge: string; // 'r' | 'b' | 'br'
  startGX: number; startGY: number;
  origW: number; origH: number;
  zoom: number;
} | null = null;

function addPanelResizeHandles(panelContainer: Container, def: PanelDef, zoom: number) {
  const pw = def.w;
  const ph = def.h;
  const hs = 8;
  const edgeColor = 0x888888;

  const edges: Array<{ edge: string; x: number; y: number; w: number; h: number; cursor: string }> = [
    // Right edge
    { edge: 'r', x: pw - 3, y: ph / 4, w: 6, h: ph / 2, cursor: 'ew-resize' },
    // Bottom edge
    { edge: 'b', x: pw / 4, y: ph - 3, w: pw / 2, h: 6, cursor: 'ns-resize' },
    // Bottom-right corner
    { edge: 'br', x: pw - hs, y: ph - hs, w: hs, h: hs, cursor: 'nwse-resize' },
  ];

  for (const ed of edges) {
    const g = new Graphics();
    if (ed.edge === 'br') {
      // Corner triangle
      g.moveTo(ed.x + ed.w, ed.y);
      g.lineTo(ed.x + ed.w, ed.y + ed.h);
      g.lineTo(ed.x, ed.y + ed.h);
      g.closePath();
      g.fill({ color: edgeColor, alpha: 0.6 });
    } else {
      g.roundRect(ed.x, ed.y, ed.w, ed.h, 2);
      g.fill({ color: edgeColor, alpha: 0.3 });
    }
    g.eventMode = 'static';
    g.cursor = ed.cursor;

    g.on('pointerdown', (e: import('pixi.js').FederatedPointerEvent) => {
      e.stopPropagation();
      pushHistory();
      panelResizeState = {
        active: true,
        edge: ed.edge,
        startGX: e.global.x, startGY: e.global.y,
        origW: pw, origH: ph,
        zoom,
      };
    });

    panelContainer.addChild(g);
  }
}

// Global drag state (survives rebuild)
let dragState: {
  active: boolean;
  nodeIndex: number;
  startGX: number; startGY: number;
  origX: number; origY: number;
  zoom: number;
} | null = null;

// Throttle rebuild calls during drag/resize for real-time visual
let rebuildScheduled = false;
function scheduleRebuild() {
  if (rebuildScheduled) return;
  rebuildScheduled = true;
  requestAnimationFrame(() => {
    rebuildScheduled = false;
    rebuild();
  });
}

// Stage-level listeners for drag + resize (survive rebuild)
function initResizeListener() {
  if (!app) return;
  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  app.stage.on('globalpointermove', (e: import('pixi.js').FederatedPointerEvent) => {
    // Resize
    if (resizeState?.active) {
      const rs = resizeState;
      const dx = snap((e.global.x - rs.startGX) / rs.zoom);
      const dy = snap((e.global.y - rs.startGY) / rs.zoom);

      let newX = rs.origX, newY = rs.origY, newW = rs.origW, newH = rs.origH;
      if (rs.handlePos.includes('l')) { newX = rs.origX + dx; newW = rs.origW - dx; }
      if (rs.handlePos.includes('r')) { newW = rs.origW + dx; }
      if (rs.handlePos.includes('t')) { newY = rs.origY + dy; newH = rs.origH - dy; }
      if (rs.handlePos.includes('b')) { newH = rs.origH + dy; }
      newW = Math.max(8, newW); newH = Math.max(8, newH);

      const selected = getSelectedNodes();
      if (selected.length === 1) {
        const n = selected[0].node as { x: number; y: number; w?: number; h?: number; size?: number };
        n.x = newX; n.y = newY;
        if (rs.hasWH) { n.w = newW; n.h = newH; }
        if (rs.hasSize) { n.size = Math.max(newW, newH); }
      } else if (selected.length > 1 && rs.origW > 0 && rs.origH > 0) {
        const scaleX = newW / rs.origW;
        const scaleY = newH / rs.origH;
        if (!resizeOriginals) {
          resizeOriginals = selected.map(({ node }) => {
            const sn = node as { x: number; y: number; w?: number; h?: number; size?: number };
            return { x: sn.x, y: sn.y, w: sn.w ?? sn.size ?? 32, h: sn.h ?? sn.size ?? 32 };
          });
        }
        for (let i = 0; i < selected.length; i++) {
          const sn = selected[i].node as { x: number; y: number; w?: number; h?: number; size?: number };
          const orig = resizeOriginals[i];
          sn.x = snap(newX + (orig.x - rs.origX) * scaleX);
          sn.y = snap(newY + (orig.y - rs.origY) * scaleY);
          if ('w' in sn && 'h' in sn) {
            sn.w = Math.max(8, snap(orig.w * scaleX));
            sn.h = Math.max(8, snap(orig.h * scaleY));
          }
          if ('size' in sn && !('w' in sn)) {
            sn.size = Math.max(8, snap(Math.max(orig.w * scaleX, orig.h * scaleY)));
          }
        }
      }
      scheduleRebuild();
      return;
    }

    // Panel resize
    if (panelResizeState?.active) {
      const ps = panelResizeState;
      const def = getDef();
      const dx = snap((e.global.x - ps.startGX) / ps.zoom);
      const dy = snap((e.global.y - ps.startGY) / ps.zoom);
      if (ps.edge.includes('r')) def.w = Math.max(100, ps.origW + dx);
      if (ps.edge.includes('b')) def.h = Math.max(80, ps.origH + dy);
      panelWInput.value = String(def.w);
      panelHInput.value = String(def.h);
      scheduleRebuild();
      return;
    }

    // Drag
    if (dragState?.active) {
      const ds = dragState;
      const node = getDef().children[ds.nodeIndex];
      if (!node || !('x' in node && 'y' in node)) return;
      const n = node as { x: number; y: number };
      n.x = snap(ds.origX + (e.global.x - ds.startGX) / ds.zoom);
      n.y = snap(ds.origY + (e.global.y - ds.startGY) / ds.zoom);
      scheduleRebuild();
    }
  });

  const endInteraction = () => {
    if (resizeState) { resizeState.active = false; resizeState = null; resizeOriginals = null; }
    if (dragState) { dragState.active = false; dragState = null; }
    if (panelResizeState) { panelResizeState.active = false; panelResizeState = null; }
  };

  app.stage.on('pointerup', endInteraction);
  app.stage.on('pointerupoutside', endInteraction);
}

// ─── Rebuild canvas ───
async function rebuild() {
  if (!currentName || !panels[currentName]) return;
  const def = getDef();

  if (!app) {
    app = new Application();
    await app.init({
      backgroundColor: 0x1a1a1a,
      antialias: true,
      resizeTo: canvasWrap,
    });
    canvasWrap.innerHTML = '';
    canvasWrap.appendChild(app.canvas);
    initResizeListener();
  }

  app.stage.removeChildren();

  // ─── Viewport preview mode ───
  if (viewportMode) {
    const screenW = app.screen.width;
    const screenH = app.screen.height;
    const vpScale = Math.min((screenW - 40) / GAME_W, (screenH - 40) / GAME_H) * 0.9;

    const vpX = (screenW - GAME_W * vpScale) / 2;
    const vpY = (screenH - GAME_H * vpScale) / 2;

    // Game area background
    const gameArea = new Graphics();
    gameArea.rect(vpX, vpY, GAME_W * vpScale, (GAME_H - BANNER_H) * vpScale);
    gameArea.fill({ color: 0x333333 });
    app.stage.addChild(gameArea);

    // "Game area" label
    const { Text: PixiText } = await import('pixi.js');
    const areaLabel = new PixiText({ text: 'Zone de jeu', style: { fontSize: 12, fill: 0x666666 } });
    areaLabel.x = vpX + 8; areaLabel.y = vpY + 8;
    app.stage.addChild(areaLabel);

    // Banner area
    const bannerArea = new Graphics();
    bannerArea.rect(vpX, vpY + (GAME_H - BANNER_H) * vpScale, GAME_W * vpScale, BANNER_H * vpScale);
    bannerArea.fill({ color: 0xd5cfaa });
    app.stage.addChild(bannerArea);

    const bannerLabel = new PixiText({ text: 'Banner', style: { fontSize: 10, fill: 0x666666 } });
    bannerLabel.x = vpX + 8; bannerLabel.y = vpY + (GAME_H - BANNER_H) * vpScale + 4;
    app.stage.addChild(bannerLabel);

    // Border
    const vpBorder = new Graphics();
    vpBorder.rect(vpX, vpY, GAME_W * vpScale, GAME_H * vpScale);
    vpBorder.stroke({ color: 0x555555, width: 1 });
    app.stage.addChild(vpBorder);

    // Panel inside viewport
    result = renderPanel(def);
    const gameAreaH = (GAME_H - BANNER_H) * vpScale;
    const fillPct = (def.viewport?.fillPercent ?? 75) / 100;
    const fitScale = Math.min(
      GAME_W * vpScale * fillPct / def.w,
      gameAreaH * fillPct / def.h,
    );
    result.container.scale.set(fitScale);
    result.container.x = vpX + (GAME_W * vpScale - def.w * fitScale) / 2;
    result.container.y = vpY + (gameAreaH - def.h * fitScale) / 2;
    app.stage.addChild(result.container);
  } else {
    // ─── Normal edit mode ───
    result = renderPanel(def);
    result.container.scale.set(viewZoom);
    result.container.x = Math.max(20, (app.screen.width - def.w * viewZoom) / 2);
    result.container.y = Math.max(20, (app.screen.height - def.h * viewZoom) / 2);
    app.stage.addChild(result.container);
  }

  // Make nodes clickable to select + start drag
  const zoomForDrag = viewportMode ? (result?.container.scale.x ?? 1) : viewZoom;
  for (const entry of result!.nodes) {
    entry.display.eventMode = 'static';
    entry.display.cursor = 'move';

    entry.display.on('pointerdown', (e) => {
      e.stopPropagation();
      const defIdx = getDef().children.indexOf(entry.node);
      if (defIdx < 0) return;

      // Clear multi-select on single click (unless shift)
      if (!e.shiftKey && selectedIndices.size > 0) {
        selectedIndices.clear();
      }
      if (e.shiftKey) {
        selectedIndices.add(defIdx);
      }
      selectedIndex = defIdx;

      // Start drag immediately — push history before mutation
      if ('x' in entry.node && 'y' in entry.node) {
        pushHistory();
        const n = entry.node as { x: number; y: number };
        dragState = {
          active: true,
          nodeIndex: defIdx,
          startGX: e.global.x, startGY: e.global.y,
          origX: n.x, origY: n.y,
          zoom: zoomForDrag,
        };
      }

      // Rebuild to show selection handles (won't break drag since state is global)
      scheduleRebuild();
    });
  }

  // ─── Resize handles on selected node ───
  addResizeHandles(result!.container, zoomForDrag);

  // ─── Panel border resize handles (right + bottom + corner) ───
  addPanelResizeHandles(result!.container, def, zoomForDrag);

  zoomLabel.textContent = `${Math.round(viewZoom * 100)}%`;
  renderTree();
  renderProps();
  jsonArea.value = JSON.stringify(def, null, 2);
  // Update code if tab is active
  if (codeWrap.style.display !== 'none') {
    codeArea.value = generateCode(def);
  }
}

// ─── Init ───
// Ensure DOM is ready, then show welcome
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => showWelcome());
} else {
  showWelcome();
}

// Auto-save reminder on close
window.addEventListener('beforeunload', (e) => {
  if (history.isDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

function showWelcome() {
  // Destroy pixi app if any
  if (app) { app.destroy(true); app = null; }

  canvasWrap.innerHTML = '';
  const page = document.createElement('div');
  page.style.cssText = `
    width:100%; height:100%; overflow-y:auto;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    display:flex; flex-direction:column; align-items:center;
    padding:40px 20px;
  `;

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'text-align:center;margin-bottom:32px';
  hdr.innerHTML = `
    <div style="font-size:40px;margin-bottom:8px">⊞</div>
    <h1 style="color:#e0e0e0;font-size:26px;font-weight:600;margin:0 0 6px">Dofus UI Builder</h1>
    <p style="color:#7a8ba8;font-size:13px;margin:0">Éditeur d'interfaces HUD — Dofus 1.29</p>
  `;
  page.appendChild(hdr);

  // Actions row
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:12px;max-width:520px;width:100%;margin-bottom:28px';
  actions.appendChild(makeWelcomeBtn('+ Nouvelle interface', '#388a34', '#45a041', () => {
    const name = prompt('Nom du panel:', 'mon-panel') || 'mon-panel';
    const w = parseInt(prompt('Largeur:', '400') || '400');
    const h = parseInt(prompt('Hauteur:', '300') || '300');
    panels[name] = { name, w, h, bg: 0xddd7b2, border: 0x8a7f5f, borderWidth: 2, radius: 3, children: [], viewport: { position: 'center', fillPercent: 75 } };
    openPanel(name);
  }));
  actions.appendChild(makeWelcomeBtn('📋 Coller du code TS', '#0e639c', '#1177bb', () => showPasteDialog()));
  page.appendChild(actions);

  // ─── Import from project ───
  page.appendChild(makeSectionTitle('Importer depuis le projet'));
  const projectGrid = document.createElement('div');
  projectGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:520px;width:100%;margin-bottom:28px';
  for (const pf of PROJECT_PANELS) {
    projectGrid.appendChild(makeCard(pf.name, pf.desc, `📄 ${pf.path.split('/').pop()}`, '#c97b2a', async () => {
      await importProjectPanel(pf);
    }));
  }
  page.appendChild(projectGrid);

  // ─── Saved panels ───
  const savedNames = Object.keys(panels);
  if (savedNames.length > 0) {
    page.appendChild(makeSectionTitle(`Panels sauvegardés (${savedNames.length})`));
    const savedGrid = document.createElement('div');
    savedGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:520px;width:100%;margin-bottom:20px';
    for (const name of savedNames) {
      const p = panels[name];
      savedGrid.appendChild(makeCard(name, `${p.w}×${p.h} · ${p.children?.length ?? 0} nodes`, '● sauvegardé', '#69c', () => openPanel(name)));
    }
    page.appendChild(savedGrid);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Effacer les panels sauvegardés';
    clearBtn.style.cssText = 'background:none;border:none;color:#4a5568;cursor:pointer;font-size:10px;text-decoration:underline;';
    clearBtn.addEventListener('click', () => {
      if (!confirm('Supprimer tous les panels sauvegardés ?')) return;
      localStorage.removeItem(STORAGE_KEY);
      for (const key of Object.keys(panels)) delete panels[key];
      showWelcome();
    });
    page.appendChild(clearBtn);
  }

  canvasWrap.appendChild(page);
}

function makeSectionTitle(text: string): HTMLDivElement {
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;align-items:center;gap:12px;max-width:520px;width:100%;margin-bottom:12px';
  div.innerHTML = `
    <div style="flex:1;height:1px;background:rgba(255,255,255,0.1)"></div>
    <span style="color:#7a8ba8;font-size:11px;text-transform:uppercase;letter-spacing:1px">${text}</span>
    <div style="flex:1;height:1px;background:rgba(255,255,255,0.1)"></div>
  `;
  return div;
}

function makeWelcomeBtn(text: string, bg: string, hover: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.innerHTML = text;
  btn.style.cssText = `
    background:${bg}; border:none; color:#fff; padding:14px 20px;
    border-radius:8px; cursor:pointer; font-size:13px; flex:1;
    transition:all 0.2s; font-weight:500;
  `;
  btn.addEventListener('mouseenter', () => { btn.style.background = hover; btn.style.transform = 'translateY(-1px)'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = bg; btn.style.transform = 'none'; });
  btn.addEventListener('click', onClick);
  return btn;
}

function makeCard(title: string, desc: string, tag: string, tagColor: string, onClick: () => void): HTMLButtonElement {
  const card = document.createElement('button');
  card.style.cssText = `
    background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#ccc;
    padding:14px 12px; border-radius:10px; cursor:pointer; font-size:12px; text-align:center;
    transition:all 0.2s; display:flex; flex-direction:column; align-items:center; gap:4px;
    backdrop-filter:blur(4px);
  `;
  card.innerHTML = `
    <div style="font-size:14px;font-weight:600">${title}</div>
    <div style="font-size:9px;color:rgba(255,255,255,0.4)">${desc}</div>
    <div style="font-size:9px;color:${tagColor};margin-top:2px">${tag}</div>
  `;
  card.addEventListener('mouseenter', () => { card.style.background = 'rgba(255,255,255,0.1)'; card.style.borderColor = '#0078d4'; card.style.transform = 'translateY(-2px)'; });
  card.addEventListener('mouseleave', () => { card.style.background = 'rgba(255,255,255,0.05)'; card.style.borderColor = 'rgba(255,255,255,0.1)'; card.style.transform = 'none'; });
  card.addEventListener('click', onClick);
  return card;
}


async function importProjectPanel(pf: { name: string; path: string }) {
  try {
    const resp = await fetch(`/api/source?file=${encodeURIComponent(pf.path)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const source = await resp.text();
    const def = parsePanel(source);
    def.name = pf.name;
    panels[pf.name] = def;
    openPanel(pf.name);
  } catch {
    // Fallback: prompt user to paste the code manually
    showPasteDialog(pf.name);
  }
}

function showPasteDialog(defaultName?: string) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed; top:0; left:0; right:0; bottom:0; z-index:9999;
    background:rgba(10,10,10,0.85); backdrop-filter:blur(6px);
    display:flex; align-items:center; justify-content:center;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background:#1e1e1e; border:1px solid #3c3c3c; border-radius:12px;
    padding:24px 32px; max-width:700px; width:90%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    display:flex; flex-direction:column; gap:12px;
  `;

  const pasteHeader = document.createElement('div');
  pasteHeader.innerHTML = `
    <h2 style="color:#e0e0e0;font-size:16px;margin:0 0 4px">Importer du code TypeScript</h2>
    <p style="color:#666;font-size:11px;margin:0">Colle le contenu d'un fichier panel (ex: stats-panel.ts, inventory-panel.ts)</p>
  `;
  modal.appendChild(pasteHeader);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = defaultName ?? '';
  nameInput.placeholder = 'Nom du panel';
  nameInput.style.cssText = 'background:#2a2a2a;border:1px solid #3c3c3c;color:#ccc;padding:8px 12px;border-radius:6px;font-size:13px;';
  modal.appendChild(nameInput);

  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Colle le code TypeScript ici...';
  textarea.style.cssText = `
    background:#1a1a1a; color:#b5e853; border:1px solid #3c3c3c;
    border-radius:6px; padding:10px; font-family:'JetBrains Mono',monospace;
    font-size:11px; min-height:300px; resize:vertical; tab-size:2;
  `;
  modal.appendChild(textarea);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;';

  btnRow.appendChild(makeWelcomeBtn('Annuler', '#555', '#666', () => {
    overlay.remove();
  }));

  btnRow.appendChild(makeWelcomeBtn('Importer', '#0e639c', '#1177bb', () => {
    const source = textarea.value.trim();
    if (!source) { alert('Colle du code TypeScript'); return; }
    try {
      const def = parsePanel(source);
      def.name = nameInput.value || def.name || 'imported';
      panels[def.name] = def;
      overlay.remove();
      openPanel(def.name);
    } catch (e) {
      alert('Erreur de parsing: ' + (e as Error).message);
    }
  }));
  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  textarea.focus();
}

function openPanel(name: string) {
  currentName = name;
  selectedIndex = -1;
  selectedIndices.clear();
  history.init(getDef());
  refreshPanelSelect();
  syncPanelInputs();
  updateTitle();
  rebuild();
}
