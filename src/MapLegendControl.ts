import maplibregl, { type IControl } from "maplibre-gl";

interface LegendItem {
  type: "gradient" | "categorical" | "heatmap" | "note";
  title: string;
  items?: Array<{ color: string; label: string; shape?: "circle" | "square" }>;
  gradient?: { colors: string[]; labels: string[] };
  note?: string;
}

interface LayerLegend {
  layerId: string;
  title: string;
  legends: LegendItem[];
}

// Legend configurations for each layer
const LEGEND_CONFIGS: LayerLegend[] = [
  {
    layerId: "fua",
    title: "Urban Areas (FUA)",
    legends: [
      {
        type: "categorical",
        title: "Urban Zones",
        items: [
          {
            color: "#FFA500",
            label: "Functional Urban Area",
            shape: "square",
          },
        ],
      },
      {
        type: "note",
        title: "",
        note: "Opacity decreases with zoom (8-15)",
      },
    ],
  },
  {
    layerId: "population",
    title: "Population Density",
    legends: [
      {
        type: "gradient",
        title: "People per H3 cell",
        gradient: {
          colors: ["#440154", "#31688e", "#35b779", "#fde724"],
          labels: ["10", "20", "50", "100+"],
        },
      },
    ],
  },
  {
    layerId: "competitors",
    title: "Competitor Branches",
    legends: [
      {
        type: "categorical",
        title: "Companies",
        items: [
          { color: "#00EEFF", label: "ACC / TAF / FIF", shape: "circle" },
          { color: "#FF8C00", label: "BFIN", shape: "circle" },
          { color: "#034EA1", label: "MTF / MUF", shape: "circle" },
          { color: "#07198A", label: "IMFI", shape: "circle" },
          { color: "#00AB50", label: "OTO", shape: "circle" },
        ],
      },
    ],
  },
  {
    layerId: "heatmap",
    title: "Customer Heatmap",
    legends: [
      {
        type: "heatmap",
        title: "Density",
        gradient: {
          colors: [
            "#3288bd",
            "#66c2a5",
            "#fee08b",
            "#fc8d59",
            "#d53e4f",
          ],
          labels: ["Low", "", "", "", "High"],
        },
      },
    ],
  },
  {
    layerId: "branches",
    title: "ADMF Branches",
    legends: [
      {
        type: "categorical",
        title: "Branch Types",
        items: [
          {
            color: "#FCDE02",
            label: "Cabang (Brown outline)",
            shape: "circle",
          },
          {
            color: "#FCDE02",
            label: "Satellite (Brown outline)",
            shape: "circle",
          },
          {
            color: "#FCDE02",
            label: "ADMF HI (Blue outline)",
            shape: "circle",
          },
        ],
      },
      {
        type: "note",
        title: "",
        note: "Icons: Syariah branches show crescent, Car branches show car icon",
      },
    ],
  },
];

const LEGEND_STORAGE_KEY = "titan-legend-state";

export class MapLegendControl implements IControl {
  private _container!: HTMLDivElement;
  private _toggleButton!: HTMLButtonElement;
  private _legendPanel!: HTMLDivElement;
  private _expanded: boolean = false;
  private _visibleLayers: Set<string> = new Set();

  constructor() {
    this._loadState();
  }

  private _loadState(): void {
    const saved = localStorage.getItem(LEGEND_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this._expanded = parsed.expanded ?? false;
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }

  private _saveState(): void {
    localStorage.setItem(
      LEGEND_STORAGE_KEY,
      JSON.stringify({ expanded: this._expanded })
    );
  }

  onAdd(_map: maplibregl.Map): HTMLElement {
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-legend";

    // Create toggle button
    this._toggleButton = this._createToggleButton();
    this._container.appendChild(this._toggleButton);

    // Create legend panel
    this._legendPanel = this._createLegendPanel();
    this._container.appendChild(this._legendPanel);

    // Apply initial state
    if (this._expanded) {
      this._toggleButton.classList.add("expanded");
      this._legendPanel.classList.add("expanded");
    }

    // Listen for custom events from layer toggle control
    window.addEventListener("layerVisibilityChanged", ((
      e: CustomEvent
    ) => {
      this._handleLayerVisibilityChange(e.detail.layerId, e.detail.visible);
    }) as EventListener);

    return this._container;
  }

  private _createToggleButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "maplibregl-ctrl-legend-toggle";
    button.setAttribute("aria-label", "Toggle legend panel");
    button.title = "Map Legend";
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="3" width="16" height="3" rx="1" fill="currentColor"/>
        <rect x="2" y="8.5" width="10" height="3" rx="1" fill="currentColor"/>
        <rect x="2" y="14" width="13" height="3" rx="1" fill="currentColor"/>
        <circle cx="15" cy="10" r="2" fill="currentColor"/>
      </svg>
    `;

    button.addEventListener("click", () => {
      this._expanded = !this._expanded;
      button.classList.toggle("expanded", this._expanded);
      this._legendPanel.classList.toggle("expanded", this._expanded);
      this._saveState();
    });

    return button;
  }

  private _createLegendPanel(): HTMLDivElement {
    const panel = document.createElement("div");
    panel.className = "maplibregl-ctrl-legend-panel";

    const title = document.createElement("div");
    title.className = "maplibregl-ctrl-legend-title";
    title.textContent = "Map Legend";
    panel.appendChild(title);

    const content = document.createElement("div");
    content.className = "maplibregl-ctrl-legend-content";
    panel.appendChild(content);

    return panel;
  }

  private _handleLayerVisibilityChange(
    layerId: string,
    visible: boolean
  ): void {
    if (visible) {
      this._visibleLayers.add(layerId);
    } else {
      this._visibleLayers.delete(layerId);
    }
    this._updateLegends();
  }

  private _updateLegends(): void {
    const content = this._legendPanel.querySelector(
      ".maplibregl-ctrl-legend-content"
    ) as HTMLDivElement;
    if (!content) return;

    content.innerHTML = "";

    if (this._visibleLayers.size === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "maplibregl-ctrl-legend-empty";
      emptyState.textContent = "No layers visible";
      content.appendChild(emptyState);
      return;
    }

    // Render legends for visible layers only
    LEGEND_CONFIGS.forEach((config) => {
      if (this._visibleLayers.has(config.layerId)) {
        const layerSection = this._createLayerSection(config);
        content.appendChild(layerSection);
      }
    });
  }

  private _createLayerSection(config: LayerLegend): HTMLDivElement {
    const section = document.createElement("div");
    section.className = "maplibregl-ctrl-legend-section";

    const header = document.createElement("div");
    header.className = "maplibregl-ctrl-legend-section-title";
    header.textContent = config.title;
    section.appendChild(header);

    config.legends.forEach((legend) => {
      const item = this._createLegendItem(legend);
      section.appendChild(item);
    });

    return section;
  }

  private _createLegendItem(legend: LegendItem): HTMLDivElement {
    const item = document.createElement("div");
    item.className = "maplibregl-ctrl-legend-item";

    if (legend.type === "gradient") {
      item.appendChild(this._createGradientLegend(legend));
    } else if (legend.type === "heatmap") {
      item.appendChild(this._createHeatmapLegend(legend));
    } else if (legend.type === "categorical") {
      item.appendChild(this._createCategoricalLegend(legend));
    } else if (legend.type === "note") {
      item.appendChild(this._createNoteLegend(legend));
    }

    return item;
  }

  private _createGradientLegend(legend: LegendItem): HTMLDivElement {
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl-legend-gradient";

    if (legend.title) {
      const title = document.createElement("div");
      title.className = "maplibregl-ctrl-legend-item-title";
      title.textContent = legend.title;
      container.appendChild(title);
    }

    const gradientBar = document.createElement("div");
    gradientBar.className = "maplibregl-ctrl-legend-gradient-bar";

    if (legend.gradient) {
      const gradientString = `linear-gradient(to right, ${legend.gradient.colors.join(", ")})`;
      gradientBar.style.background = gradientString;

      const labels = document.createElement("div");
      labels.className = "maplibregl-ctrl-legend-gradient-labels";

      legend.gradient.labels.forEach((label, index) => {
        const labelEl = document.createElement("span");
        labelEl.textContent = label;
        labelEl.style.left = `${(index / (legend.gradient!.labels.length - 1)) * 100}%`;
        labels.appendChild(labelEl);
      });

      container.appendChild(gradientBar);
      container.appendChild(labels);
    }

    return container;
  }

  private _createHeatmapLegend(legend: LegendItem): HTMLDivElement {
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl-legend-gradient";

    if (legend.title) {
      const title = document.createElement("div");
      title.className = "maplibregl-ctrl-legend-item-title";
      title.textContent = legend.title;
      container.appendChild(title);
    }

    const gradientBar = document.createElement("div");
    gradientBar.className = "maplibregl-ctrl-legend-gradient-bar maplibregl-ctrl-legend-heatmap-bar";

    if (legend.gradient) {
      const gradientString = `linear-gradient(to right, ${legend.gradient.colors.join(", ")})`;
      gradientBar.style.background = gradientString;

      const labels = document.createElement("div");
      labels.className = "maplibregl-ctrl-legend-gradient-labels";

      // Only show first and last label for heatmap
      const visibleLabels = [
        legend.gradient.labels[0],
        legend.gradient.labels[legend.gradient.labels.length - 1],
      ];
      visibleLabels.forEach((label, index) => {
        const labelEl = document.createElement("span");
        labelEl.textContent = label;
        labelEl.style.left = index === 0 ? "0%" : "100%";
        labels.appendChild(labelEl);
      });

      container.appendChild(gradientBar);
      container.appendChild(labels);
    }

    return container;
  }

  private _createCategoricalLegend(legend: LegendItem): HTMLDivElement {
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl-legend-categorical";

    if (legend.title) {
      const title = document.createElement("div");
      title.className = "maplibregl-ctrl-legend-item-title";
      title.textContent = legend.title;
      container.appendChild(title);
    }

    const itemsList = document.createElement("div");
    itemsList.className = "maplibregl-ctrl-legend-items-list";

    legend.items?.forEach((item) => {
      const itemEl = document.createElement("div");
      itemEl.className = "maplibregl-ctrl-legend-category-item";

      const swatch = document.createElement("span");
      swatch.className = `maplibregl-ctrl-legend-swatch maplibregl-ctrl-legend-swatch-${item.shape || "square"}`;

      // For branches with outlined circles, add stroke visualization
      if (legend.title === "Branch Types") {
        swatch.style.backgroundColor = item.color;
        if (item.label.includes("Brown")) {
          swatch.style.border = "2px solid #643B0D";
        } else if (item.label.includes("Blue")) {
          swatch.style.border = "2px solid #214284";
        } else {
          swatch.style.border = "2px solid #643B0D";
        }
      } else {
        swatch.style.backgroundColor = item.color;
      }

      const label = document.createElement("span");
      label.className = "maplibregl-ctrl-legend-label";
      label.textContent = item.label;

      itemEl.appendChild(swatch);
      itemEl.appendChild(label);
      itemsList.appendChild(itemEl);
    });

    container.appendChild(itemsList);
    return container;
  }

  private _createNoteLegend(legend: LegendItem): HTMLDivElement {
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl-legend-note";

    const note = document.createElement("div");
    note.className = "maplibregl-ctrl-legend-note-text";
    note.textContent = legend.note || "";
    container.appendChild(note);

    return container;
  }

  onRemove(): void {
    this._container.parentNode?.removeChild(this._container);
  }
}
