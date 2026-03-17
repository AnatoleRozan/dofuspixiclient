/**
 * Interactive editor overlay for panel definitions.
 * - Click a node to select it (shows bounding box + properties)
 * - Drag a node to move it (updates x/y in the definition)
 * - Property panel on the right to edit values
 * - JSON export/import
 */
import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js';
import type { PanelDef, PanelNode } from './schema';
import type { RenderResult } from './renderer';

export interface EditorState {
  selectedNode: PanelNode | null;
  selectedDisplay: Container | null;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
  onSelect: (node: PanelNode | null) => void;
  onMove: (node: PanelNode, x: number, y: number) => void;
}

export function createEditor(
  result: RenderResult,
  _panelDef: PanelDef,
  onUpdate: () => void,
): EditorState {
  const selectionBox = new Graphics();
  selectionBox.eventMode = 'none';
  selectionBox.visible = false;
  result.container.addChild(selectionBox);

  const state: EditorState = {
    selectedNode: null,
    selectedDisplay: null,
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    onSelect: () => {},
    onMove: () => {},
  };

  // Make all rendered nodes interactive
  for (const entry of result.nodes) {
    const { node, display } = entry;
    display.eventMode = 'static';
    display.cursor = 'pointer';

    display.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      selectNode(state, node, display, selectionBox);
      state.onSelect(node);

      // Start drag
      if ('x' in node && 'y' in node) {
        state.isDragging = true;
        const pos = display.parent!.toLocal(e.global);
        state.dragOffset.x = pos.x - (node as { x: number }).x;
        state.dragOffset.y = pos.y - (node as { y: number }).y;
      }
    });

    display.on('globalpointermove', (e: FederatedPointerEvent) => {
      if (!state.isDragging || state.selectedNode !== node) return;
      const pos = display.parent!.toLocal(e.global);

      const n = node as { x: number; y: number };
      const newX = Math.round(pos.x - state.dragOffset.x);
      const newY = Math.round(pos.y - state.dragOffset.y);

      n.x = newX;
      n.y = newY;
      state.onMove(node, newX, newY);
      onUpdate();
    });

    display.on('pointerup', () => {
      state.isDragging = false;
    });

    display.on('pointerupoutside', () => {
      state.isDragging = false;
    });
  }

  // Click on background to deselect
  const bgChild = result.container.children[0];
  if (bgChild) {
    bgChild.eventMode = 'static';
    bgChild.on('pointerdown', (e: FederatedPointerEvent) => {
      if (e.target === bgChild) {
        selectNode(state, null, null, selectionBox);
        state.onSelect(null);
      }
    });
  }

  return state;
}

function selectNode(
  state: EditorState,
  node: PanelNode | null,
  display: Container | null,
  selectionBox: Graphics,
): void {
  state.selectedNode = node;
  state.selectedDisplay = display;

  selectionBox.clear();
  if (display && node) {
    const bounds = display.getBounds();
    const local = selectionBox.parent!.toLocal({ x: bounds.x, y: bounds.y });

    selectionBox.rect(local.x - 2, local.y - 2, bounds.width + 4, bounds.height + 4);
    selectionBox.stroke({ color: 0x00aaff, width: 2 });
    selectionBox.visible = true;
  } else {
    selectionBox.visible = false;
  }
}

/**
 * Build the HTML property panel for editing the selected node.
 */
export function createPropertyPanel(
  container: HTMLElement,
  state: EditorState,
  panelDef: PanelDef,
  onUpdate: () => void,
): void {
  state.onSelect = (node) => {
    container.innerHTML = '';

    if (!node) {
      container.innerHTML = '<p class="hint">Click a node to select it.<br>Drag to move.</p>';
      return;
    }

    const title = document.createElement('h3');
    title.textContent = node.type;
    container.appendChild(title);

    // Editable properties
    const props = Object.entries(node).filter(([k]) => k !== 'type' && k !== 'children' && k !== 'template');
    for (const [key, value] of props) {
      const row = document.createElement('div');
      row.className = 'prop-row';

      const label = document.createElement('label');
      label.textContent = key;
      row.appendChild(label);

      const input = document.createElement('input');
      input.type = typeof value === 'number' ? 'number' : 'text';
      input.value = String(value);
      input.addEventListener('input', () => {
        const n = node as unknown as Record<string, unknown>;
        if (typeof value === 'number') {
          n[key] = parseFloat(input.value) || 0;
        } else {
          n[key] = input.value;
        }
        onUpdate();
      });
      row.appendChild(input);
      container.appendChild(row);
    }
  };

  state.onMove = (_node, x, y) => {
    // Update inputs if property panel is showing this node
    const inputs = container.querySelectorAll<HTMLInputElement>('.prop-row input');
    inputs.forEach((input) => {
      const label = input.previousElementSibling as HTMLLabelElement;
      if (label?.textContent === 'x') input.value = String(x);
      if (label?.textContent === 'y') input.value = String(y);
    });
  };

  // Export JSON button
  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Export JSON';
  exportBtn.className = 'export-btn';
  exportBtn.addEventListener('click', () => {
    const json = JSON.stringify(panelDef, null, 2);
    navigator.clipboard.writeText(json);
    exportBtn.textContent = 'Copied!';
    setTimeout(() => { exportBtn.textContent = 'Export JSON'; }, 1500);
  });
  container.appendChild(exportBtn);

  // Initial state
  container.innerHTML = '<p class="hint">Click a node to select it.<br>Drag to move.</p>';
}
