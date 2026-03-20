import { Container, Graphics, Text, TextStyle } from 'pixi.js';

/**
 * Map coordinate entry from map-data.json.
 * sua = superarea ID, x/y = world coordinates.
 */
interface MapEntry {
  sua: number;
  x: number;
  y: number;
}

/**
 * Displays the current map coordinates [x, y] and zone name
 * in the top-left of the game area, faithful to Dofus 1.29.
 *
 * Self-sufficient: loads map-data.json + subarea-names.json at construction
 * and only needs the mapId to display coordinates.
 */
export class LocationDisplay {
  public readonly container: Container;

  private coordText: Text;
  private zoneText: Text;
  private bg: Graphics;
  private mapCoords: Record<string, MapEntry> = {};
  private subareaNames: Record<string, string> = {};
  private dataReady = false;
  private currentZoom = 1;
  private pendingMapId: number | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = 'location-display';

    this.bg = new Graphics();
    this.container.addChild(this.bg);

    const coordStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 14,
      fill: 0xffffff,
      fontWeight: 'bold',
      dropShadow: {
        color: 0x000000,
        blur: 2,
        distance: 1,
        angle: Math.PI / 4,
        alpha: 0.9,
      },
    });

    const zoneStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 13,
      fill: 0xdddddd,
      fontWeight: 'bold',
      dropShadow: {
        color: 0x000000,
        blur: 2,
        distance: 1,
        angle: Math.PI / 4,
        alpha: 0.9,
      },
    });

    this.coordText = new Text({ text: '', style: coordStyle });
    this.zoneText = new Text({ text: '', style: zoneStyle });

    this.container.addChild(this.zoneText);
    this.container.addChild(this.coordText);

    this.container.visible = false;

    void this.loadData();
  }

  /** Load both map-data.json and subarea-names.json in parallel. */
  private async loadData(): Promise<void> {
    try {
      const [mapDataResp, subareaResp] = await Promise.all([
        fetch('/assets/data/map-data.json'),
        fetch('/assets/data/subarea-names.json'),
      ]);

      const mapData = await mapDataResp.json();
      const subareaData = await subareaResp.json();

      this.mapCoords = mapData.maps ?? {};
      this.subareaNames = subareaData.subareas ?? {};
      this.dataReady = true;

      console.log(
        `[LocationDisplay] Loaded ${Object.keys(this.mapCoords).length} maps, ${Object.keys(this.subareaNames).length} subareas`
      );

      // If a map update was requested before data finished loading, apply it now
      if (this.pendingMapId != null) {
        this.updateForMap(this.pendingMapId);
        this.pendingMapId = null;
      }
    } catch (err) {
      console.warn('[LocationDisplay] Failed to load data:', err);
    }
  }

  /**
   * Update the display for a given mapId.
   * Looks up coordinates and zone name from local data files.
   */
  updateForMap(mapId: number): void {
    if (!this.dataReady) {
      // Data not loaded yet — queue for later
      this.pendingMapId = mapId;
      return;
    }

    const entry = this.mapCoords[String(mapId)];
    if (!entry) {
      console.warn(`[LocationDisplay] No coords for map ${mapId}`);
      this.container.visible = false;
      return;
    }

    // Coordinates — format faithful to Dofus 1.29: [x, y]
    this.coordText.text = `[${entry.x}, ${entry.y}]`;

    // Zone name from subarea mapping
    const zoneName = this.subareaNames[String(entry.sua)] ?? '';
    this.zoneText.text = zoneName;

    this.draw();
    this.container.visible = true;
  }

  /**
   * Update with explicit coordinates (e.g. from server payload).
   */
  update(x: number, y: number, subareaId?: number): void {
    this.coordText.text = `[${x}, ${y}]`;

    const zoneName =
      subareaId != null
        ? this.subareaNames[String(subareaId)] ?? ''
        : '';
    this.zoneText.text = zoneName;

    this.draw();
    this.container.visible = true;
  }

  /**
   * Set the zoom level and redraw.
   */
  setZoom(zoom: number): void {
    this.currentZoom = zoom;
    if (this.container.visible) {
      this.draw();
    }
  }

  private draw(): void {
    const s = this.currentZoom;
    const fontSize = Math.round(14 * s);
    const zoneFontSize = Math.round(13 * s);

    this.coordText.style.fontSize = fontSize;
    this.zoneText.style.fontSize = zoneFontSize;

    const padding = 8 * s;
    const gap = 2 * s;

    // Layout: zone name on top, coordinates below
    const hasZone = this.zoneText.text.length > 0;

    if (hasZone) {
      this.zoneText.visible = true;
      this.zoneText.x = padding;
      this.zoneText.y = padding;
      this.coordText.x = padding;
      this.coordText.y = this.zoneText.y + this.zoneText.height + gap;
    } else {
      this.zoneText.visible = false;
      this.coordText.x = padding;
      this.coordText.y = padding;
    }

    // Background
    const totalW =
      Math.max(this.coordText.width, hasZone ? this.zoneText.width : 0) +
      padding * 2;
    const totalH =
      (hasZone
        ? this.zoneText.height + gap + this.coordText.height
        : this.coordText.height) +
      padding * 2;

    this.bg.clear();
    this.bg.roundRect(0, 0, totalW, totalH, 4 * s);
    this.bg.fill({ color: 0x000000, alpha: 0.55 });
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
