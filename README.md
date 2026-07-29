# Synodal Room Intelligence

Interactive geospatial dashboard for the Catholic Church in Indonesia. Built with MapLibre GL — overlays ecclesiastical, demographic, wealth, climate, and disaster risk data on a single map.

Part of the **Synodal Room** platform: pairs with [SR_dashboard](https://github.com/uradn/SR_dashboard) which embeds this map alongside macro intelligence (Dexter/dex_indonesia) at `localhost:8300`.

## Layers

| Layer | Source | Default | Notes |
|---|---|---|---|
| **Keuskupan se-Indonesia** | GeoJSON (bundled) | On | 38 dioceses; click for bishop + live news |
| **Batas Kabupaten/Kota** | Martin (idn_adm2) | Off | ADM2 boundaries, zoom ≥ 4 |
| **Batas Kecamatan** | Martin (idn_admin3_hdx2020) | Off | ADM3 boundaries, zoom ≥ 8 |
| **Relative Wealth Index** | Martin (rwi_indonesia) | Off | Meta/HDX ~2.4 km grid; circle + dual heatmap (poverty/wealth) |
| **Functional Urban Areas** | Martin (IDN_FUA) | On | |
| **Population Density** | Martin (indopopulation-res5-10) | On | H3 hexagons |
| **Local Climate Zones** | LCZ Generator / WUDAPT | Off | |
| **Disaster Risk — Flood** | BNPB via TiTiler COG | On | |
| **Disaster Risk — Extreme Weather** | BNPB via TiTiler COG | On | |
| **Disaster Risk — Drought** | BNPB via TiTiler COG | On | |
| **Disaster Risk — Landslide** | BNPB via TiTiler COG | On | |

### Keuskupan popup

Clicking any diocese shows:
- **Uskup** (bishop name + year of appointment, updated Jul 2026 via Exa search)
- **Umat Katolik** + total wilayah population for comparison (BPS SP2020)
- **Catatan Strategis** (static pastoral note)
- **Berita Terbaru** — live news fetched via `localhost:8300/api/search` (Exa → Tavily fallback)

Bishop data last verified: **July 2026**. 10 updates applied from previous GeoJSON:
KA Medan, KA Kupang, Banjarmasin, Surabaya, KA Makassar, KA Pontianak (Sede Vacante), Bogor (Sede Vacante), KA Ende, Labuan Bajo (uskup pertama), Maumere.

### Basemap

Dropdown — Street / Satellite / Dark / Positron (OpenFreeMap vector tiles + ArcGIS satellite raster).

## Tech Stack

- [MapLibre GL JS](https://maplibre.org/) — WebGL map rendering
- [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- [Martin](https://martin.maplibre.org/) — self-hosted vector tile server
- [TiTiler](https://developmentseed.org/titiler/) — COG raster tile server (BNPB data)
- Nginx — static file serving inside Docker

## Getting Started

### Development

```bash
npm install
npm run dev
```

`.env` at project root:

```env
VITE_MARTIN_TILE_SERVER=http://localhost:8120
VITE_LCZ_TILE_SERVER=http://localhost:8130
VITE_BNPB_TILE_SERVER=http://localhost:8110
```

### Build

```bash
npm run build   # output: dist/
```

## Docker Deployment

Part of a larger TITAN ADMF compose stack. Minimum services needed:

```yaml
services:
  synodal-room:
    build: .
    ports:
      - "8200:80"
    restart: unless-stopped

  martin-tileserver:
    image: ghcr.io/maplibre/martin:1.0.0
    ports:
      - "8120:3000"
    volumes:
      - ./tiles:/data
    command: ["--config", "/data/config.yaml"]

  titiler:
    image: ghcr.io/developmentseed/titiler:latest
    ports:
      - "8110:8000"
    environment:
      - PYTHONWARNINGS=ignore
```

### Required Martin tile sources

- `IDN_FUA` — Functional Urban Areas
- `indopopulation-res5-10` — H3 population density
- `idn_adm2` — Kabupaten/Kota boundaries (geoBoundaries ADM2)
- `idn_admin3_hdx2020` — Kecamatan boundaries (HDX 2020)
- `rwi_indonesia` — Relative Wealth Index point grid (Meta Data for Good)

### Required BNPB COG files (mounted in TiTiler)

```
bnpb/
├── ID_BANJIR_COG.tif
├── ID_CUACAEKSTRIM_COG.tif
├── ID_KEKERINGAN_COG.tif
└── ID_TANAHLONGSOR_COG.tif
```

### Live news (optional)

Popup fetches berita terbaru from `localhost:8300/api/search`. Requires
[SR_dashboard](https://github.com/uradn/SR_dashboard) running with `EXASEARCH_API_KEY`
or `TAVILY_API_KEY` in `../dexter/.env`. Degrades gracefully if unavailable.

```bash
# Start SR_dashboard (sibling dir)
cd ../SR_dashboard && bun start
```

### Run

```bash
docker compose up -d
# Dashboard: http://localhost:8200
```

## License

MIT
