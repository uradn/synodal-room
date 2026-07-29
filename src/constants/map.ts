export const MapConstants = {
  CENTER: [-2.5, 118.0], // Indonesia center
  ZOOM: 4,
  INDONESIA_BOUNDS: [90, -15, 150, 15],
};

const MapLayerTypes = {
  VECTOR: "vector",
  RASTER: "raster",
} as const;

type MapLayerTypes = (typeof MapLayerTypes)[keyof typeof MapLayerTypes];

// Define the structure of a basemap to be leaflet compatible
type BaseMap = {
  title: string;
  type: MapLayerTypes;
  url: string;
  options?: {
    maxZoom: number;
    attribution: string;
  };
};

// Currated list of all available basemaps
const _MapBasemapsRaster: Record<string, BaseMap> = {
  Satellite: {
    type: MapLayerTypes.RASTER,
    title: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxZoom: 19,
      attribution:
        'Map data: <a href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer">ArcGIS</a>',
    },
  },
  CartoLightAll: {
    type: MapLayerTypes.RASTER,
    title: "Carto Light All",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution:
        "Map data: <a href='https://carto.com/attribution'>CARTO</a>",
    },
  },
  CartoDarkAll: {
    type: MapLayerTypes.RASTER,
    title: "Carto Dark All",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution:
        "Map data: <a href='https://carto.com/attribution'>CARTO</a>",
    },
  },
  Voyager: {
    type: MapLayerTypes.RASTER,
    title: "Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution:
        "Map data: <a href='https://carto.com/attribution'>CARTO</a>",
    },
  },

  OpenStreetMap: {
    type: MapLayerTypes.RASTER,
    title: "Open Street Map",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution:
        'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    },
  },
  OpenTopoMap: {
    type: MapLayerTypes.RASTER,
    title: "Open Topo Map",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 17,
      attribution:
        'Map data: <a href="https://opentopomap.org">OpenTopoMap</a>',
    },
  },
  OpenCycleMap: {
    type: MapLayerTypes.RASTER,
    title: "Open Cycle Map",
    url: "https://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png",
    options: {
      maxZoom: 17,
      attribution:
        'Map data: <a href="https://opencyclemap.org">OpenCycleMap</a>',
    },
  },
  OpenSeaMap: {
    type: MapLayerTypes.RASTER,
    title: "Open Sea Map",
    url: "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png",
    options: {
      maxZoom: 18,
      attribution: 'Map data: <a href="https://openseamap.org">OpenSeaMap</a>',
    },
  },
  OpenFireMap: {
    type: MapLayerTypes.RASTER,
    title: "Open Fire Map",
    url: "https://openfiremap.org/hytiles/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution:
        'Map data: <a href="https://openfiremap.org">OpenFireMap</a>',
    },
  },
};

const _MapBasemapsVector: Record<string, BaseMap> = {
  // Placeholder for future vector basemaps
  OpenFreeMapBright: {
    type: MapLayerTypes.VECTOR,
    title: "Open Free Map Bright",
    url: "https://tiles.openfreemap.org/styles/bright",
    options: {
      maxZoom: 19,
      attribution:
        'Map data: <a href="https://openfreemap.org">OpenFreeMap</a>',
    },
  },
  OpenFreeMapLiberty: {
    type: MapLayerTypes.VECTOR,
    title: "Open Free Map Liberty",
    url: "https://tiles.openfreemap.org/styles/liberty",
    options: {
      maxZoom: 19,
      attribution:
        'Map data: <a href="https://openfreemap.org">OpenFreeMap</a>',
    },
  },
  OpenFreeMapPositron: {
    type: MapLayerTypes.VECTOR,
    title: "Open Free Map Positron",
    url: "https://tiles.openfreemap.org/styles/positron",
    options: {
      maxZoom: 19,
      attribution:
        'Map data: <a href="https://openfreemap.org">OpenFreeMap</a>',
    },
  },
  OpenFreeMapDark: {
    type: MapLayerTypes.VECTOR,
    title: "Open Free Map Dark",
    url: "https://tiles.openfreemap.org/styles/dark",
    options: {
      maxZoom: 19,
      attribution:
        'Map data: <a href="https://openfreemap.org">OpenFreeMap</a>',
    },
  },
};

// Choose default basemaps to be used in the app
export const MapBasemapsRaster: Record<string, BaseMap> = {
  street: _MapBasemapsRaster.OpenStreetMap,
  satellite: _MapBasemapsRaster.Satellite,
  grayscale: _MapBasemapsRaster.Voyager,
};
export const MapBasemapsVector: Record<string, BaseMap> = {
  street: _MapBasemapsVector.OpenFreeMapBright,
  satellite: _MapBasemapsVector.OpenFreeMapLiberty,
  dark: _MapBasemapsVector.OpenFreeMapDark,
  positron: _MapBasemapsVector.OpenFreeMapPositron,
};

export type BasemapKey = 'street' | 'satellite' | 'dark' | 'positron';

export const DefaultBasemapKey = "street";
export const InitialViewState = {
  latitude: MapConstants.CENTER[0],
  longitude: MapConstants.CENTER[1],
  zoom: MapConstants.ZOOM,
};
export const DefaultCursor = "grab";
