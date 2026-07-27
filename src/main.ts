import maplibregl, { type IControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  InitialViewState,
  MapBasemapsRaster,
  MapBasemapsVector,
  MapConstants,
} from "./constants/map";
import "./style.css";

// ── Keuskupan Dashboard (Bappenas-style ranking panel) ─────────────────────
interface KeuskupanRow {
  kode: string;
  nama_pendek: string;
  nama: string;
  jenis: string;
  umat: number;
  paroki: number;
  stasi: number;
}

function createKeuskupanDashboard() {
  let isOpen = false;
  let keuskupanData: KeuskupanRow[] = [];
  let selectedKode: string | null = null;
  let centroidsCache: GeoJSON.FeatureCollection | null = null;
  type Metric = "umat" | "paroki" | "stasi";

  // Panel
  const panel = document.createElement("div");
  panel.id = "keuskupan-dashboard";
  document.body.appendChild(panel);

  // Toggle button (vertical label on right edge)
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "keuskupan-dashboard-toggle";
  toggleBtn.innerHTML = `<span>📊</span><span>Data Keuskupan</span>`;
  toggleBtn.addEventListener("click", () => {
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
  });
  document.body.appendChild(toggleBtn);

  // Header
  panel.innerHTML = `
    <div class="kd-header">
      <div>
        <div class="kd-title">Data Keuskupan se-Indonesia</div>
        <div class="kd-subtitle">38 keuskupan · klik nama untuk pindah ke peta</div>
      </div>
      <button class="kd-close" title="Tutup">✕</button>
    </div>
    <div class="kd-controls">
      <label class="kd-select-label">TAMPILKAN DATA</label>
      <select id="kd-metric-select" class="kd-select">
        <option value="umat">Umat Katolik (estimasi)</option>
        <option value="paroki">Jumlah Paroki</option>
        <option value="stasi">Jumlah Stasi</option>
      </select>
    </div>
    <div id="kd-chart" class="kd-chart"></div>
    <div class="kd-footer">Sumber: Bimas Katolik Kemenag 2025</div>
  `;

  panel.querySelector(".kd-close")!.addEventListener("click", () => {
    isOpen = false;
    panel.classList.remove("open");
  });

  const metricSelect = panel.querySelector<HTMLSelectElement>("#kd-metric-select")!;
  metricSelect.addEventListener("change", () => renderChart(metricSelect.value as Metric));

  const chartDiv = panel.querySelector<HTMLDivElement>("#kd-chart")!;

  function jenisColor(j: string) {
    return j === "KA" ? "#dc2626" : j === "OM" ? "#d97706" : "#2563eb";
  }

  function renderChart(metric: Metric) {
    if (!keuskupanData.length) return;
    const sorted = [...keuskupanData].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
    const maxVal = sorted[0]?.[metric] ?? 1;

    chartDiv.innerHTML = sorted.map((d, i) => {
      const val = d[metric] ?? 0;
      const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
      const color = jenisColor(d.jenis);
      const isSel = d.kode === selectedKode;
      const label = metric === "umat"
        ? (val > 0 ? val.toLocaleString("id-ID") : "–")
        : (val > 0 ? String(val) : "–");
      return `<div class="kd-bar-row${isSel ? " kd-selected" : ""}" data-kode="${d.kode}">
        <div class="kd-bar-meta">
          <span class="kd-bar-name">${i + 1}. ${d.nama_pendek}</span>
          <span class="kd-bar-val" style="color:${isSel ? "#1d4ed8" : "#333"}">${label}</span>
        </div>
        <div class="kd-bar-track">
          <div class="kd-bar-fill" style="width:${pct}%;background:${isSel ? "#1d4ed8" : color}"></div>
        </div>
      </div>`;
    }).join("");

    chartDiv.querySelectorAll<HTMLElement>(".kd-bar-row").forEach(row => {
      row.addEventListener("click", () => {
        const kode = row.dataset.kode!;
        selectedKode = kode;
        renderChart(metric);
        flyToKeuskupan(kode);
      });
    });
  }

  function flyToKeuskupan(kode: string) {
    const doFly = (geojson: GeoJSON.FeatureCollection) => {
      const f = geojson.features.find((ft) => (ft as any).properties?.kode === kode);
      if (f && f.geometry.type === "Point") {
        const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
        map.flyTo({ center: [lng, lat], zoom: 6, duration: 1000 });
      }
    };
    if (centroidsCache) { doFly(centroidsCache); return; }
    fetch("/data/keuskupan-centroids.geojson")
      .then(r => r.json())
      .then((geojson: GeoJSON.FeatureCollection) => { centroidsCache = geojson; doFly(geojson); });
  }

  // Load GeoJSON data once
  fetch("/data/keuskupan-indonesia-simplified.geojson")
    .then(r => r.json())
    .then((geojson: GeoJSON.FeatureCollection) => {
      keuskupanData = geojson.features.map((f) => {
        const p = (f as any).properties ?? {};
        const stasiStr = String(p.stasi_data ?? "");
        const stasiMatch = stasiStr.match(/\d[\d.,]*/);
        const stasi = stasiMatch ? parseInt(stasiMatch[0].replace(/[.,]/g, "")) : 0;
        return {
          kode: p.kode ?? "",
          nama_pendek: p.nama_pendek ?? p.nama ?? "",
          nama: p.nama ?? "",
          jenis: p.jenis ?? "K",
          umat: p.umat_katolik_est ?? 0,
          paroki: p.jml_paroki ?? 0,
          stasi,
        };
      });
      renderChart("umat");
    });

  return {
    highlight(kode: string) {
      selectedKode = kode;
      const metric = (metricSelect.value ?? "umat") as Metric;
      renderChart(metric);
      // Scroll bar into view
      requestAnimationFrame(() => {
        const row = chartDiv.querySelector<HTMLElement>(`[data-kode="${kode}"]`);
        row?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      // Auto-open panel
      if (!isOpen) { isOpen = true; panel.classList.add("open"); }
    },
  };
}

let keuskupanDashboard: ReturnType<typeof createKeuskupanDashboard> | null = null;

const TILE_SERVER = import.meta.env.VITE_MARTIN_TILE_SERVER || "/tiles";
const LCZ_TILE_SERVER = import.meta.env.VITE_LCZ_TILE_SERVER || "/tms";
const BNPB_TILE_SERVER = import.meta.env.VITE_BNPB_TILE_SERVER || "";

const map = new maplibregl.Map({
  container: "map",
  center: new maplibregl.LngLat(
    InitialViewState.longitude,
    InitialViewState.latitude,
  ),
  zoom: InitialViewState.zoom,
  maxBounds: MapConstants.INDONESIA_BOUNDS as maplibregl.LngLatBoundsLike,
});

const navControl = new maplibregl.NavigationControl({
  visualizePitch: true,
  showZoom: true,
  showCompass: true,
});
map.addControl(navControl, "top-right");

function addLayers() {
  // FUA Layer
  !map.getSource("idn-fua") &&
    map.addSource("idn-fua", {
      type: "vector",
      url: `${TILE_SERVER}/IDN_FUA`,
    }) &&
    map.addLayer(
      {
        id: "idn-fua-fill-layer",
        source: "idn-fua",
        "source-layer": "IDN_FUA",
        type: "fill",
        paint: {
          "fill-outline-color": "#808080",
          "fill-color": "#FFA500",
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.2, 15, 0],
        },
        minzoom: 8,
      },
      map.getLayer("park")?.id,
    ) &&
    map.addLayer({
      id: "idn-fua-line-layer",
      source: "idn-fua",
      "source-layer": "IDN_FUA",
      type: "line",
      paint: {
        "line-color": "#808080",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 15, 0],
      },
      minzoom: 8,
    });

  // H3 Indopopulation Density Layer
  !map.getLayer("idn-h3-pop-density-layer") &&
    map.addLayer(
      {
        source: {
          type: "vector",
          url: `${TILE_SERVER}/indopopulation-res5-10`,
        },
        "source-layer": "h3_data",
        id: "idn-h3-pop-density-layer",
        type: "fill",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "value"],
            10,
            "#440154", // viridis min (purple)
            20,
            "#31688e", // dark blue
            50,
            "#35b779", // green
            100,
            "#fde724", // yellow
            200,
            "#fde724", // viridis max (yellow)
          ],
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.8,
            15,
            0.2,
          ],
        },
        filter: [">", ["get", "value"], 5],
        minzoom: 5,
      },
      // "water"
      map.getLayer("idn-fua-fill-layer")?.id,
    );

  // Local Climate Zones (LCZ) Raster Layer
  !map.getSource("lcz-tiles") &&
    map.addSource("lcz-tiles", {
      type: "raster",
      tiles: [`${LCZ_TILE_SERVER}/global-map-tiles/latest/{z}/{x}/{y}.png`],
      tileSize: 256,
      attribution:
        '© <a href="https://lcz-generator.rub.de">LCZ Generator</a> | WUDAPT',
    });

  !map.getLayer("lcz-layer") &&
    map.getSource("lcz-tiles") &&
    map.addLayer(
      {
        id: "lcz-layer",
        type: "raster",
        source: "lcz-tiles",
        paint: {
          "raster-opacity": 0.5,
        },
        layout: {
          visibility: "none", // Hidden by default
        },
        minzoom: 5,
      },
      map.getLayer("tunnel-service-track-casing")?.id,
    );

  // BNPB Layers
  const LayerToRasterURL = new Map([
    ["bnpb-flood-tiles", "/data/bnpb/ID_BANJIR_COG.tif"],
    ["bnpb-extreme-weather-tiles", "/data/bnpb/ID_CUACAEKSTRIM_COG.tif"],
    ["bnpb-drought-tiles", "/data/bnpb/ID_KEKERINGAN_COG.tif"],
    ["bnpb-landslide-tiles", "/data/bnpb/ID_TANAHLONGSOR_COG.tif"],
  ]);
  const getFloodTileURL = (layerId: string) => {
    const baseUrl = `${BNPB_TILE_SERVER}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png`;
    const params = new URLSearchParams({
      bidx: "1",
      colormap_name: "turbo",
      url: LayerToRasterURL.get(layerId)!,
    });
    return `${baseUrl}?${params.toString()}`;
  };
  // Add all BNPB disaster layers
  const bnpbLayerConfigs = [
    { sourceId: "bnpb-flood-tiles", layerId: "bnpb-flood-layer" },
    {
      sourceId: "bnpb-extreme-weather-tiles",
      layerId: "bnpb-extreme-weather-layer",
    },
    { sourceId: "bnpb-drought-tiles", layerId: "bnpb-drought-layer" },
    { sourceId: "bnpb-landslide-tiles", layerId: "bnpb-landslide-layer" },
  ];

  bnpbLayerConfigs.forEach(({ sourceId, layerId }) => {
    !map.getSource(sourceId) &&
      map.addSource(sourceId, {
        type: "raster",
        tiles: [getFloodTileURL(sourceId)],
        attribution: '© <a href="https://bnpb.go.id">BNPB</a>',
      });
    !map.getLayer(layerId) &&
      map.getSource(sourceId) &&
      map.addLayer(
        {
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: {
            "raster-opacity": 0.6,
          },
          layout: {
            visibility: "none",
          },
        },
        map.getLayer("building")?.id,
      );
  });

  // Keuskupan se-Indonesia Layer
  if (!map.getSource("keuskupan")) {
    map.addSource("keuskupan", {
      type: "geojson",
      data: "/data/keuskupan-indonesia-simplified.geojson",
      generateId: true,
    });

    map.addLayer(
      {
        id: "keuskupan-fill",
        type: "fill",
        source: "keuskupan",
        paint: {
          "fill-color": [
            "match", ["get", "jenis"],
            "KA", "#dc2626",
            "K",  "#2563eb",
            "OM", "#d97706",
            "#6b7280",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false], 0.35,
            0.1,
          ],
        },
        layout: { visibility: "visible" },
      },
      map.getLayer("idn-fua-fill-layer")?.id,
    );

    map.addLayer(
      {
        id: "keuskupan-line",
        type: "line",
        source: "keuskupan",
        paint: {
          "line-color": [
            "match", ["get", "jenis"],
            "KA", "#dc2626",
            "K",  "#2563eb",
            "OM", "#d97706",
            "#6b7280",
          ],
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 8, 2.0],
        },
        layout: { visibility: "visible" },
      },
      map.getLayer("idn-fua-fill-layer")?.id,
    );

    // Label dari centroid terpisah — satu titik per keuskupan, tidak berulang di MultiPolygon
    map.addSource("keuskupan-centroids", {
      type: "geojson",
      data: "/data/keuskupan-centroids.geojson",
    });

    map.addLayer({
      id: "keuskupan-label",
      type: "symbol",
      source: "keuskupan-centroids",
      minzoom: 5,
      layout: {
        "text-field": ["get", "nama_pendek"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 9, 9, 13],
        "text-font": ["Noto Sans Bold"],
        "text-allow-overlap": false,
        visibility: "visible",
      },
      paint: {
        "text-color": "#1a1a2e",
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
      },
    });

    // Hover feature-state
    let hoveredKeuskupanId: number | null = null;
    map.on("mousemove", "keuskupan-fill", (e) => {
      if (hoveredKeuskupanId !== null) {
        map.setFeatureState({ source: "keuskupan", id: hoveredKeuskupanId }, { hover: false });
      }
      hoveredKeuskupanId = (e.features?.[0]?.id as number) ?? null;
      if (hoveredKeuskupanId !== null) {
        map.setFeatureState({ source: "keuskupan", id: hoveredKeuskupanId }, { hover: true });
      }
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "keuskupan-fill", () => {
      if (hoveredKeuskupanId !== null) {
        map.setFeatureState({ source: "keuskupan", id: hoveredKeuskupanId }, { hover: false });
        hoveredKeuskupanId = null;
      }
      map.getCanvas().style.cursor = "";
    });

    // Popup on click
    const keuskupanPopup = new maplibregl.Popup({ closeButton: true, maxWidth: "340px" });
    map.on("click", "keuskupan-fill", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as Record<string, unknown>;

      const str = (k: string): string | null => {
        const v = p[k];
        if (v === null || v === undefined || v === "null" || v === "None" || String(v).trim() === "") return null;
        return String(v).trim();
      };
      const num = (k: string): number | null => {
        const v = Number(p[k]);
        return isNaN(v) || v === 0 ? null : v;
      };

      const jenis = str("jenis") ?? "K";
      const jenisColor = jenis === "KA" ? "#dc2626" : jenis === "OM" ? "#d97706" : "#2563eb";
      const jenisBadge = jenis === "KA" ? "Keuskupan Agung" : jenis === "OM" ? "Ordinariat Militer" : "Keuskupan";

      // Umat: pakai umat_data jika bukan referensi silang ("→"), else umat_katolik_est
      const rawUmat = str("umat_data");
      const umatEst = num("umat_katolik_est");
      const umatFmt = umatEst ? `±${umatEst.toLocaleString("id-ID")} jiwa (est. dari data provinsi)` : null;
      const umatShow = rawUmat && !rawUmat.startsWith("→") ? rawUmat : umatFmt;

      // Paroki: pakai paroki_data dari Excel, fallback ke jml_paroki dari metadata
      const parokiShow = str("paroki_data") ?? (num("jml_paroki") ? String(num("jml_paroki")) : null);
      const stasiShow  = str("stasi_data");

      const row = (label: string, val: string | null, icon = "") =>
        val ? `<tr>
          <td style="color:#888;font-size:11px;white-space:nowrap;padding:2px 8px 2px 0;vertical-align:top">${icon}${label}</td>
          <td style="color:#111;font-size:12px;padding:2px 0;vertical-align:top">${val}</td>
        </tr>` : "";

      // Highlight in dashboard
      const kodeVal = str("kode");
      if (kodeVal && keuskupanDashboard) keuskupanDashboard.highlight(kodeVal);

      keuskupanPopup
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family:system-ui,sans-serif;font-size:12.5px;line-height:1.6;max-width:330px">
            <div style="margin-bottom:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span style="background:${jenisColor};color:#fff;font-size:10px;padding:2px 7px;border-radius:3px;font-weight:700;letter-spacing:.3px">${jenisBadge}</span>
              ${str("provinsi_gerejawi") ? `<span style="color:#888;font-size:11px">Prov. Gerejawi <b>${str("provinsi_gerejawi")}</b></span>` : ""}
            </div>

            <strong style="font-size:14px;display:block;margin-bottom:8px;line-height:1.3;color:#000">${str("nama") ?? ""}</strong>

            <table style="border-collapse:collapse;width:100%;font-size:12px">
              ${row("Uskup", str("uskup"), "👤 ")}
              ${row("Katedral", str("katedral"), "⛪ ")}
              ${row("Wilayah", str("wilayah_admin"), "📍 ")}
              ${row("Umat Katolik", umatShow, "🙏 ")}
              ${row("Paroki", parokiShow, "🏘️ ")}
              ${row("Stasi", stasiShow, "📌 ")}
            </table>

            ${str("catatan_strategis") ? `
            <div style="margin-top:9px;padding:7px 9px;background:#fafafa;border-left:3px solid ${jenisColor};border-radius:0 4px 4px 0;font-size:11.5px;color:#444;line-height:1.5">
              <div style="font-weight:600;color:#333;margin-bottom:3px;font-size:11px;text-transform:uppercase;letter-spacing:.4px">Catatan Strategis</div>
              ${str("catatan_strategis")}
            </div>` : ""}

            <div style="margin-top:7px;font-size:10px;color:#bbb;text-align:right">
              Sumber: Bimas Katolik Kemenag 2025 · Wikipedia ID
            </div>
          </div>
        `)
        .addTo(map);
    });
  }

  // Relative Wealth Index per Kabupaten/Kota — added after keuskupan so keuskupan-label exists
  if (!map.getSource("kabupaten-rwi")) {
    map.addSource("kabupaten-rwi", {
      type: "geojson",
      data: "/data/kabupaten_rwi.geojson",
      generateId: true,
    });
    // Insert below keuskupan-line so keuskupan & provinsi boundaries render on top
    map.addLayer(
      {
        id: "kabupaten-rwi-fill",
        type: "fill",
        source: "kabupaten-rwi",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["to-number", ["get", "rwi_mean"], 0], 0],
            -0.7, "#2166ac",
            -0.3, "#74add1",
             0.0, "#f7f7f7",
             0.4, "#f4a582",
             1.4, "#b2182b",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false], 0.6,
            0.45,
          ],
        },
        layout: { visibility: "none" },
      },
      "keuskupan-line",
    );
    map.addLayer(
      {
        id: "kabupaten-rwi-line",
        type: "line",
        source: "kabupaten-rwi",
        paint: {
          "line-color": "#555555",
          "line-width": 0.4,
          "line-opacity": 0.4,
        },
        layout: { visibility: "none" },
      },
      "keuskupan-line",
    );

    let hoveredKabId: string | number | null = null;
    const rwi_popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

    map.on("mousemove", "kabupaten-rwi-fill", (e) => {
      if (hoveredKabId !== null) {
        map.setFeatureState({ source: "kabupaten-rwi", id: hoveredKabId }, { hover: false });
      }
      if (e.features && e.features.length > 0) {
        hoveredKabId = e.features[0].id!;
        map.setFeatureState({ source: "kabupaten-rwi", id: hoveredKabId }, { hover: true });
        const p = e.features[0].properties as Record<string, unknown>;
        const rwiVal = p.rwi_mean !== null && p.rwi_mean !== undefined ? Number(p.rwi_mean) : null;
        const rwiStr = rwiVal !== null ? rwiVal.toFixed(3) : "N/A";
        const label = rwiVal !== null
          ? rwiVal >= 0.3 ? "Relatif kaya" : rwiVal <= -0.3 ? "Relatif miskin" : "Menengah"
          : "";
        rwi_popup
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-size:12px;line-height:1.5">
            <b style="color:#111">${p.nama || ""}</b><br>
            <span style="color:#555">${p.provinsi || ""}</span><br>
            <span style="color:#111">RWI: <b>${rwiStr}</b>${label ? ` <em>(${label})</em>` : ""}</span><br>
            <span style="color:#888;font-size:11px">${p.rwi_count || 0} titik data</span>
          </div>`)
          .addTo(map);
      }
    });
    map.on("mouseleave", "kabupaten-rwi-fill", () => {
      if (hoveredKabId !== null) {
        map.setFeatureState({ source: "kabupaten-rwi", id: hoveredKabId }, { hover: false });
        hoveredKabId = null;
      }
      rwi_popup.remove();
    });
  }

}

function toogleBasemap(isRaster: boolean) {
  const style: string | maplibregl.StyleSpecification = isRaster
    ? {
        version: 8,
        sources: {
          "raster-tiles": {
            type: "raster",
            tiles: [MapBasemapsRaster["satellite"].url],
            tileSize: 128,
          },
        },
        layers: [
          {
            id: "raster-layer",
            type: "raster",
            source: "raster-tiles",
          },
        ],
      }
    : MapBasemapsVector["street"].url;

  map.setStyle(style);
  isRaster ? map.setMaxZoom(16) : map.setMaxZoom(null);

  const waitForStyle = () => {
    if (map.isStyleLoaded()) {
      try {
        addLayers();
      } catch (err) {
        console.error("[addLayers] error:", err);
      }
    } else {
      requestAnimationFrame(waitForStyle);
    }
  };

  map.on("styledata", waitForStyle);
}

// map.on("click", "idn-fua-fill-layer", (e) => {
//   console.log(e.features);
// });

// Layer configuration for the toggle control with legend data
interface LegendItem {
  color: string;
  label: string;
  shape?: "circle" | "square";
}

interface LegendGradient {
  colors: string[];
  labels: string[];
}

interface LayerLegend {
  type: "categorical" | "gradient" | "heatmap" | "simple";
  items?: LegendItem[];
  gradient?: LegendGradient;
  note?: string;
}

interface LayerChildConfig {
  id: string;
  label: string;
  layers: string[];
  color: string;
}

interface LayerConfig {
  id: string;
  label: string;
  layers: string[];
  color: string;
  legend: LayerLegend;
  isGroup?: boolean;
  children?: LayerChildConfig[];
}

const LAYER_CONFIGS: LayerConfig[] = [
  {
    id: "keuskupan",
    label: "Keuskupan se-Indonesia",
    layers: ["keuskupan-fill", "keuskupan-line", "keuskupan-label", "keuskupan-centroids"],
    color: "#dc2626",
    legend: {
      type: "categorical",
      items: [
        { color: "#dc2626", label: "Keuskupan Agung (KA)", shape: "square" },
        { color: "#2563eb", label: "Keuskupan (K)", shape: "square" },
        { color: "#d97706", label: "Ordinariat Militer (OM)", shape: "square" },
      ],
      note: "38 keuskupan — batas wilayah berdasarkan kabupaten/kota. Klik keuskupan untuk info.",
    },
  },
  {
    id: "rwi",
    label: "Relative Wealth Index",
    layers: ["kabupaten-rwi-fill", "kabupaten-rwi-line"],
    color: "#e53935",
    legend: {
      type: "gradient",
      gradient: {
        colors: ["#2166ac", "#74add1", "#f7f7f7", "#f4a582", "#b2182b"],
        labels: ["Miskin", "", "Tengah", "", "Kaya"],
      },
      note: "Rata-rata RWI per kabupaten/kota. Sumber: Meta Data for Good 2024.",
    },
  },
  {
    id: "fua",
    label: "Functional Urban Areas",
    layers: ["idn-fua-fill-layer", "idn-fua-line-layer"],
    color: "#FFA500",
    legend: {
      type: "simple",
      items: [
        { color: "#FFA500", label: "Functional Urban Area", shape: "square" },
      ],
      note: "Opacity decreases at higher zoom levels",
    },
  },
  {
    id: "population",
    label: "Population Density",
    layers: ["idn-h3-pop-density-layer"],
    color: "#35b779",
    legend: {
      type: "gradient",
      gradient: {
        colors: ["#440154", "#31688e", "#35b779", "#fde724"],
        labels: ["10", "20", "50", "100+"],
      },
      note: "Population Density / km²",
    },
  },
  {
    id: "lcz",
    label: "Local Climate Zones",
    layers: ["lcz-layer"],
    color: "#ff6600",
    legend: {
      type: "categorical",
      items: [
        { color: "#8c0000", label: "1 - Compact high-rise", shape: "square" },
        { color: "#d10000", label: "2 - Compact mid-rise", shape: "square" },
        { color: "#ff0000", label: "3 - Compact low-rise", shape: "square" },
        { color: "#bf4d00", label: "4 - Open high-rise", shape: "square" },
        { color: "#ff6600", label: "5 - Open mid-rise", shape: "square" },
        { color: "#ff9955", label: "6 - Open low-rise", shape: "square" },
        {
          color: "#faee05",
          label: "7 - Lightweight low-rise",
          shape: "square",
        },
        { color: "#bcbcbc", label: "8 - Large low-rise", shape: "square" },
        { color: "#ffccaa", label: "9 - Sparsely built", shape: "square" },
        { color: "#555555", label: "10 - Heavy industry", shape: "square" },
        { color: "#006a00", label: "A - Dense trees", shape: "square" },
        { color: "#00aa00", label: "B - Scattered trees", shape: "square" },
        { color: "#648525", label: "C - Bush, scrub", shape: "square" },
        { color: "#b9db79", label: "D - Low plants", shape: "square" },
        { color: "#000000", label: "E - Bare rock/paved", shape: "square" },
        { color: "#fbf7ae", label: "F - Bare soil/sand", shape: "square" },
        { color: "#6a6aff", label: "G - Water", shape: "square" },
      ],
      note: "WUDAPT Local Climate Zone classification",
    },
  },
  {
    id: "disaster-risk",
    label: "Disaster Risk (BNPB)",
    layers: [
      "bnpb-flood-layer",
      "bnpb-extreme-weather-layer",
      "bnpb-drought-layer",
      "bnpb-landslide-layer",
    ],
    color: "#FF5722",
    isGroup: true,
    children: [
      {
        id: "disaster-flood",
        label: "Flood Risk",
        layers: ["bnpb-flood-layer"],
        color: "#2196F3",
      },
      {
        id: "disaster-extreme-weather",
        label: "Extreme Weather",
        layers: ["bnpb-extreme-weather-layer"],
        color: "#9C27B0",
      },
      {
        id: "disaster-drought",
        label: "Drought Risk",
        layers: ["bnpb-drought-layer"],
        color: "#FF9800",
      },
      {
        id: "disaster-landslide",
        label: "Landslide Risk",
        layers: ["bnpb-landslide-layer"],
        color: "#795548",
      },
    ],
    legend: {
      type: "gradient",
      gradient: {
        colors: [
          "#30123b",
          "#4662d7",
          "#36aac7",
          "#1ae4b6",
          "#72fe5e",
          "#c8ef34",
          "#faba39",
          "#f66b19",
          "#ca2a04",
          "#7a0403",
        ],
        labels: ["Low", "High"],
      },
      note: "Risk level based on BNPB data (Turbo colormap)",
    },
  },
];

const LAYER_STORAGE_KEY = "synodal-layer-visibility";

class LayerToggleControl implements IControl {
  private _container!: HTMLDivElement;
  private _toggleButton!: HTMLButtonElement;
  private _layerList!: HTMLDivElement;
  private _map!: maplibregl.Map;
  private _expanded: boolean = false;
  private _layerStates: Map<string, boolean>;
  private _checkboxes: Map<string, HTMLInputElement> = new Map();
  private _activeLegend: HTMLDivElement | null = null;

  constructor() {
    this._layerStates = this._loadLayerStates();
  }

  private _loadLayerStates(): Map<string, boolean> {
    const saved = localStorage.getItem(LAYER_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return new Map(Object.entries(parsed));
      } catch {
        // Invalid JSON, use defaults
      }
    }
    // Default: all layers visible except LCZ and disaster risk (hidden by default)
    const defaultStates = new Map<string, boolean>();
    LAYER_CONFIGS.forEach((config) => {
      const hiddenByDefault =
        config.id === "lcz" ||
        config.id === "disaster-risk" ||
        config.id === "rwi";
      defaultStates.set(config.id, !hiddenByDefault);
      // Add child layer states for groups
      if (config.children) {
        config.children.forEach((child) => {
          // Disaster risk children default visible; others hidden
          const visibleByDefault =
            child.id === "disaster-flood" ||
            child.id === "disaster-extreme-weather" ||
            child.id === "disaster-drought" ||
            child.id === "disaster-landslide";
          defaultStates.set(child.id, visibleByDefault);
        });
      }
    });
    return defaultStates;
  }

  private _saveLayerStates(): void {
    const obj = Object.fromEntries(this._layerStates);
    localStorage.setItem(LAYER_STORAGE_KEY, JSON.stringify(obj));
  }

  onAdd(map: maplibregl.Map): HTMLElement {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-layers";

    // Create toggle button
    this._toggleButton = this._createToggleButton();
    this._container.appendChild(this._toggleButton);

    // Create layer list
    this._layerList = this._createLayerList();
    this._container.appendChild(this._layerList);

    // Apply initial layer states when style is loaded
    this._map.on("styledata", () => this._applyLayerStates());

    return this._container;
  }

  private _createToggleButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "maplibregl-ctrl-layers-toggle";
    button.setAttribute("aria-label", "Toggle layer panel");
    button.innerHTML = `
      <span>Layers</span>
      <span class="maplibregl-ctrl-layers-toggle-icon">▼</span>
    `;

    button.addEventListener("click", () => {
      this._expanded = !this._expanded;
      button.classList.toggle("expanded", this._expanded);
      this._layerList.classList.toggle("expanded", this._expanded);
    });

    return button;
  }

  private _createLayerList(): HTMLDivElement {
    const list = document.createElement("div");
    list.className = "maplibregl-ctrl-layers-list";

    LAYER_CONFIGS.forEach((config) => {
      if (config.isGroup && config.children) {
        const groupItem = this._createGroupItem(config);
        list.appendChild(groupItem);
      } else {
        const item = this._createLayerItem(config);
        list.appendChild(item);
      }
    });

    return list;
  }

  private _createLayerItem(config: LayerConfig): HTMLDivElement {
    const wrapper = document.createElement("div");
    wrapper.className = "maplibregl-ctrl-layers-item-wrapper";

    const item = document.createElement("div");
    item.className = "maplibregl-ctrl-layers-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "maplibregl-ctrl-layers-checkbox";
    checkbox.id = `layer-${config.id}`;
    checkbox.checked = this._layerStates.get(config.id) ?? true;
    this._checkboxes.set(config.id, checkbox);

    const label = document.createElement("label");
    label.className = "maplibregl-ctrl-layers-label";
    label.htmlFor = `layer-${config.id}`;
    label.textContent = config.label;

    const colorIndicator = document.createElement("span");
    colorIndicator.className = "maplibregl-ctrl-layers-color";
    colorIndicator.style.backgroundColor = config.color;

    // Legend toggle button
    const legendBtn = document.createElement("button");
    legendBtn.type = "button";
    legendBtn.className = "maplibregl-ctrl-layers-legend-btn";
    legendBtn.title = "Show legend";
    legendBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;

    // Create legend content (hidden by default)
    const legendContent = this._createLegendContent(config);
    legendContent.className = "maplibregl-ctrl-layers-legend";

    // Toggle on checkbox change
    checkbox.addEventListener("change", (e) => {
      e.stopPropagation();
      this._toggleLayer(config.id, checkbox.checked);
    });

    // Toggle layer on item click (excluding checkbox and legend button)
    item.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (
        target !== checkbox &&
        !target.closest(".maplibregl-ctrl-layers-legend-btn")
      ) {
        checkbox.checked = !checkbox.checked;
        this._toggleLayer(config.id, checkbox.checked);
      }
    });

    // Toggle legend on button click
    legendBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggleLegendVisibility(legendContent, legendBtn);
    });

    item.appendChild(checkbox);
    item.appendChild(label);
    item.appendChild(colorIndicator);
    item.appendChild(legendBtn);

    wrapper.appendChild(item);
    wrapper.appendChild(legendContent);

    return wrapper;
  }

  private _createGroupItem(config: LayerConfig): HTMLDivElement {
    const wrapper = document.createElement("div");
    wrapper.className = "maplibregl-ctrl-layers-group-wrapper";

    // Group header
    const header = document.createElement("div");
    header.className = "maplibregl-ctrl-layers-group-header";

    const expandBtn = document.createElement("button");
    expandBtn.type = "button";
    expandBtn.className = "maplibregl-ctrl-layers-group-expand";
    expandBtn.innerHTML = "▶";

    const label = document.createElement("span");
    label.className = "maplibregl-ctrl-layers-group-label";
    label.textContent = config.label;

    const colorIndicator = document.createElement("span");
    colorIndicator.className = "maplibregl-ctrl-layers-color";
    colorIndicator.style.backgroundColor = config.color;

    // Legend toggle button for the group
    const legendBtn = document.createElement("button");
    legendBtn.type = "button";
    legendBtn.className = "maplibregl-ctrl-layers-legend-btn";
    legendBtn.title = "Show legend";
    legendBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;

    header.appendChild(expandBtn);
    header.appendChild(label);
    header.appendChild(colorIndicator);
    header.appendChild(legendBtn);

    // Create legend content for group (hidden by default)
    const legendContent = this._createLegendContent(config);
    legendContent.className = "maplibregl-ctrl-layers-legend";

    // Children container
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "maplibregl-ctrl-layers-group-children";

    config.children?.forEach((child) => {
      const childItem = this._createChildItem(child);
      childrenContainer.appendChild(childItem);
    });

    // Toggle group expansion
    let isExpanded = false;
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      isExpanded = !isExpanded;
      expandBtn.innerHTML = isExpanded ? "▼" : "▶";
      childrenContainer.classList.toggle("expanded", isExpanded);
      header.classList.toggle("expanded", isExpanded);
    });

    // Toggle legend on button click
    legendBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggleLegendVisibility(legendContent, legendBtn);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(legendContent);
    wrapper.appendChild(childrenContainer);

    return wrapper;
  }

  private _createChildItem(child: LayerChildConfig): HTMLDivElement {
    const item = document.createElement("div");
    item.className = "maplibregl-ctrl-layers-child-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "maplibregl-ctrl-layers-checkbox";
    checkbox.id = `layer-${child.id}`;
    checkbox.checked = this._layerStates.get(child.id) ?? false;
    this._checkboxes.set(child.id, checkbox);

    const label = document.createElement("label");
    label.className = "maplibregl-ctrl-layers-label";
    label.htmlFor = `layer-${child.id}`;
    label.textContent = child.label;

    const colorIndicator = document.createElement("span");
    colorIndicator.className = "maplibregl-ctrl-layers-color";
    colorIndicator.style.backgroundColor = child.color;

    checkbox.addEventListener("change", (e) => {
      e.stopPropagation();
      this._toggleChildLayer(child.id, child.layers, checkbox.checked);
    });

    item.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        this._toggleChildLayer(child.id, child.layers, checkbox.checked);
      }
    });

    item.appendChild(checkbox);
    item.appendChild(label);
    item.appendChild(colorIndicator);

    return item;
  }

  private _toggleChildLayer(
    childId: string,
    layers: string[],
    isVisible: boolean,
  ): void {
    this._layerStates.set(childId, isVisible);
    this._saveLayerStates();

    layers.forEach((layer) => {
      if (this._map.getLayer(layer)) {
        this._map.setLayoutProperty(
          layer,
          "visibility",
          isVisible ? "visible" : "none",
        );
      }
    });
  }

  private _toggleLegendVisibility(
    legend: HTMLDivElement,
    btn: HTMLButtonElement,
  ): void {
    const isExpanded = legend.classList.contains("expanded");

    // Close any other open legend
    if (this._activeLegend && this._activeLegend !== legend) {
      this._activeLegend.classList.remove("expanded");
      const activeBtn =
        this._activeLegend.previousElementSibling?.querySelector(
          ".maplibregl-ctrl-layers-legend-btn",
        );
      activeBtn?.classList.remove("active");
    }

    legend.classList.toggle("expanded", !isExpanded);
    btn.classList.toggle("active", !isExpanded);
    this._activeLegend = isExpanded ? null : legend;
  }

  private _createLegendContent(config: LayerConfig): HTMLDivElement {
    const legend = document.createElement("div");
    const { legend: legendData } = config;

    // Inner wrapper for grid animation and scrolling
    const inner = document.createElement("div");
    inner.className = "maplibregl-ctrl-layers-legend-inner";

    if (legendData.type === "gradient" || legendData.type === "heatmap") {
      inner.appendChild(this._createGradientLegend(legendData));
    } else if (
      legendData.type === "categorical" ||
      legendData.type === "simple"
    ) {
      inner.appendChild(this._createCategoricalLegend(legendData));
    }

    if (legendData.note) {
      const note = document.createElement("div");
      note.className = "maplibregl-ctrl-layers-legend-note";
      note.textContent = legendData.note;
      inner.appendChild(note);
    }

    legend.appendChild(inner);
    return legend;
  }

  private _createGradientLegend(legendData: LayerLegend): HTMLDivElement {
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl-layers-legend-gradient";

    const bar = document.createElement("div");
    bar.className = "maplibregl-ctrl-layers-legend-bar";
    bar.style.background = `linear-gradient(to right, ${legendData.gradient!.colors.join(
      ", ",
    )})`;
    container.appendChild(bar);

    const labels = document.createElement("div");
    labels.className = "maplibregl-ctrl-layers-legend-labels";
    legendData.gradient!.labels.forEach((label, i) => {
      const span = document.createElement("span");
      span.textContent = label;
      if (i === 0) span.style.textAlign = "left";
      else if (i === legendData.gradient!.labels.length - 1)
        span.style.textAlign = "right";
      else span.style.textAlign = "center";
      labels.appendChild(span);
    });
    container.appendChild(labels);

    return container;
  }

  private _createCategoricalLegend(legendData: LayerLegend): HTMLDivElement {
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl-layers-legend-categorical";

    legendData.items?.forEach((item) => {
      const row = document.createElement("div");
      row.className = "maplibregl-ctrl-layers-legend-row";

      const swatch = document.createElement("span");
      swatch.className = `maplibregl-ctrl-layers-legend-swatch ${
        item.shape === "circle" ? "circle" : "square"
      }`;
      swatch.style.backgroundColor = item.color;

      const label = document.createElement("span");
      label.className = "maplibregl-ctrl-layers-legend-label";
      label.textContent = item.label;

      row.appendChild(swatch);
      row.appendChild(label);
      container.appendChild(row);
    });

    return container;
  }

  private _toggleLayer(layerId: string, isVisible: boolean): void {
    this._layerStates.set(layerId, isVisible);
    this._saveLayerStates();

    const config = LAYER_CONFIGS.find((c) => c.id === layerId);
    if (!config) return;

    config.layers.forEach((layer) => {
      if (this._map.getLayer(layer)) {
        this._map.setLayoutProperty(
          layer,
          "visibility",
          isVisible ? "visible" : "none",
        );
      }
    });
  }

  private _applyLayerStates(): void {
    LAYER_CONFIGS.forEach((config) => {
      if (config.isGroup && config.children) {
        // For groups, apply visibility based on each child's state
        config.children.forEach((child) => {
          const isVisible = this._layerStates.get(child.id) ?? false;
          child.layers.forEach((layer) => {
            if (this._map.getLayer(layer)) {
              this._map.setLayoutProperty(
                layer,
                "visibility",
                isVisible ? "visible" : "none",
              );
            }
          });
        });
      } else {
        // Regular layers
        const isVisible = this._layerStates.get(config.id) ?? true;
        config.layers.forEach((layer) => {
          if (this._map.getLayer(layer)) {
            this._map.setLayoutProperty(
              layer,
              "visibility",
              isVisible ? "visible" : "none",
            );
          }
        });
      }
    });
  }

  onRemove(): void {
    this._container.parentNode?.removeChild(this._container);
  }
}

class BasemapControl implements IControl {
  private _container!: HTMLDivElement;
  private _button!: HTMLButtonElement;
  private _isRaster: boolean = false;

  onAdd(): HTMLElement {
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.title = "Toggle Satellite/Street";
    this._button.textContent = this._isRaster ? "🛰️" : "🗺️";
    this._button.style.fontSize = "16px";
    this._button.style.width = "29px";
    this._button.style.height = "29px";

    this._button.addEventListener("click", () => {
      this._isRaster = !this._isRaster;
      this._button.textContent = this._isRaster ? "🛰️" : "🗺️";
      toogleBasemap(this._isRaster);
    });

    this._container.appendChild(this._button);
    return this._container;
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container);
  }
}

map.addControl(new LayerToggleControl(), "top-left");
map.addControl(new BasemapControl(), "bottom-left");

// Init dashboard once — outside addLayers so style reload doesn't recreate it
keuskupanDashboard = createKeuskupanDashboard();

toogleBasemap(false);
(window as any)._map = map;
