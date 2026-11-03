"use client";

import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Compass, LocateFixed, Minus, Plus } from "lucide-react";
import { useEffect, useRef } from "react";

import { locationSearchRing } from "@/domain/location-map-area";
import { mapDiscoveryLabels, type WorldMapMarker } from "./world-map-contract";
import styles from "./world-experience.module.css";

const OPENFREEMAP_ATLAS_STYLE = "https://tiles.openfreemap.org/styles/fiord";
const OPENFREEMAP_DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";
const CHRONICLE_REGION_BOUNDS: [[number, number], [number, number]] = [
  [6.03, 51.65], // Goch / A57 side of the regional starting frame.
  [6.34, 51.91], // Kalkar through Elten and the Rhine.
];

function regionPadding() {
  const mobile = window.matchMedia("(max-width: 700px)").matches;
  return mobile
    ? { top: 76, right: 20, bottom: 194, left: 20 }
    : { top: 76, right: 76, bottom: 186, left: 76 };
}

function fitChronicleRegion(map: MapLibreMap, compact = false) {
  map.fitBounds(CHRONICLE_REGION_BOUNDS, {
    padding: compact ? 28 : regionPadding(),
    maxZoom: 11.5,
    duration: 350,
  });
}

function focusMapMarker(map: MapLibreMap, coordinates: [number, number], accuracyMeters?: number) {
  if (!accuracyMeters) {
    map.flyTo({ center: coordinates, zoom: Math.max(map.getZoom(), 16), essential: true });
    return;
  }
  const ring = locationSearchRing(coordinates, accuracyMeters);
  const longitudes = ring.map(point => point[0]);
  const latitudes = ring.map(point => point[1]);
  map.fitBounds([
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ], { padding: 40, maxZoom: 16, duration: 350 });
}

const discoveryGlyphs = {
  hidden: '<rect x="4" y="12" width="12" height="10" rx="2"/><path d="M6.5 12V8a3.5 3.5 0 0 1 7 0v4"/>',
  rumored: '<path d="M6 8a4 4 0 1 1 6 3.5c-1.5 1-2 2-2 4M10 21h.01"/>',
  known: '<path d="M10 4l7 9-7 9-7-9z"/>',
  visited: '<path d="M10 14C7 12 5.5 9.3 5.5 6.8a4.5 4.5 0 0 1 9 0c0 2.5-1.5 5.2-4.5 7.2v10M4 14h12"/>',
  investigated: '<path d="M10 3l2.5 7 7.5 3-7.5 3-2.5 7-2.5-7L0 13l7.5-3z"/>',
};

function WorldMapLegend({includeInternal,compact}: {includeInternal: boolean;compact:boolean}) {
  const states = includeInternal ? (["known","visited","investigated","rumored","hidden"] as const) : (["known","visited","investigated","rumored"] as const);
  return <ul className={styles.mapDiscoveryLegend} data-compact={compact||undefined} aria-label="Kartenzeichen">
    {states.map(state=><li key={state} data-discovery={state}>
      <svg aria-hidden="true" viewBox="0 0 20 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" dangerouslySetInnerHTML={{__html:discoveryGlyphs[state]}}/>
      <span>{state==="known"?"Bekannt":mapDiscoveryLabels[state]}</span>
    </li>)}
  </ul>;
}

function updateMarkerElement(button: HTMLButtonElement, place: WorldMapMarker) {
  const positionText = place.precision === "candidate"
    ? "unbestätigte, noch nicht gespeicherte Kartenauswahl"
    : place.precision === "approximate"
    ? `ungefähre Position, Genauigkeit etwa ${place.accuracyMeters ?? 0} Meter`
    : "geprüfte genaue Position";
  const riskLabels={peaceful:"Friedlich",neutral:"Neutral",dangerous:"Gefährlich",hostile:"Feindesgebiet"};
  if(place.mapRisk)button.dataset.mapRisk=place.mapRisk;
  else delete button.dataset.mapRisk;
  const risk=place.mapRisk?" · "+riskLabels[place.mapRisk]:"";
  const description = `${place.title} · ${mapDiscoveryLabels[place.discovery]} · ${positionText}${risk}`;
  button.setAttribute("aria-label", `${description}. Vorschau anzeigen.`);
  button.title = description;
  if (button.dataset.discovery === place.discovery) return;
  button.dataset.discovery = place.discovery;
  button.innerHTML = `<svg aria-hidden="true" viewBox="-2 0 24 26" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">${discoveryGlyphs[place.discovery]}</svg>`;
}

function createMarkerElement(place: WorldMapMarker, compact: boolean) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = compact ? styles.atlasMarker : styles.mapLibreMarker;
  button.setAttribute("aria-pressed", "false");
  updateMarkerElement(button, place);
  return button;
}

export function WorldMapLibre({
  places,
  visibleIds,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onFocusPlace,
  onStateChange,
  onMapClick,
  compact = false,
  showDiscoveryLegend = false,
  includeInternal = false,
}: {
  places: WorldMapMarker[];
  visibleIds: string[];
  selectedId: string;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onFocusPlace: (id: string) => void;
  onStateChange: (state: "loading" | "ready" | "error") => void;
  compact?: boolean;
  showDiscoveryLegend?: boolean;
  includeInternal?: boolean;
  onMapClick?: (coordinates: [longitude: number, latitude: number]) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const styleReady = useRef(false);
  const markers = useRef(new Map<string, { marker: Marker; element: HTMLButtonElement; coordinates: [number, number]; accuracyMeters?: number }>());
  const callbacks = useRef({ onSelect, onHover, onFocusPlace, onMapClick });

  useEffect(() => {
    callbacks.current = { onSelect, onHover, onFocusPlace, onMapClick };
  }, [onFocusPlace, onHover, onMapClick, onSelect]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let active = true;
    let mapReady = false;
    const markerRegistry = markers.current;
    onStateChange("loading");

    // v6 uses a separate module worker. Bundle its shared dependencies rather
    // than resolving a nonexistent sibling of the application client chunk.
    setWorkerUrl(workerUrl);
    let instance: MapLibreMap;
    try {
      instance = new MapLibreMap({
      container,
      style: compact ? OPENFREEMAP_ATLAS_STYLE : OPENFREEMAP_DARK_STYLE,
      center: [6.18, 51.78],
      zoom: 9,
      minZoom: 5,
      maxZoom: 19,
      attributionControl: compact ? false : { compact: false },
      dragPan: true,
      touchZoomRotate: true,
      dragRotate: false,
      pitchWithRotate: false,
      keyboard: true,
      });
    } catch {
      // v6 requires WebGL2. Older devices retain the usable schematic view.
      onStateChange("error");
      return;
    }
    map.current = instance;

    const handleLoad = () => {
      if (!active) return;
      mapReady = true;
      styleReady.current = true;
      window.clearTimeout(loadTimeout);
      fitChronicleRegion(instance, compact);
      onStateChange("ready");
    };
    const loadTimeout = window.setTimeout(() => {
      if (active && !mapReady) onStateChange("error");
    }, 12000);
    instance.once("load", handleLoad);
    instance.on("click", (event) => {
      callbacks.current.onMapClick?.([
        Number(event.lngLat.lng.toFixed(6)),
        Number(event.lngLat.lat.toFixed(6)),
      ]);
    });
    instance.on("error", (event) => {
      // Individual tile failures may recover. Fall back only if the map style
      // itself cannot initialize, using the bounded timer above.
      if (active && !mapReady && event.error.message.includes("style")) {
        onStateChange("error");
      }
    });

    return () => {
      active = false;
      window.clearTimeout(loadTimeout);
      for (const entry of markerRegistry.values()) entry.marker.remove();
      markerRegistry.clear();
      instance.remove();
      map.current = null;
      styleReady.current = false;
    };
    // Keep one map instance for this component lifetime; callbacks and markers
    // update independently so editor clicks never restart the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const nextIds = new Set(places.map((place) => place.id));
    for (const [id, entry] of markers.current) {
      if (!nextIds.has(id)) {
        entry.marker.remove();
        markers.current.delete(id);
      }
    }
    for (const place of places) {
      const [longitude, latitude] = place.coordinates;
      const existing = markers.current.get(place.id);
      const accuracyMeters = place.precision === "approximate" ? place.accuracyMeters : undefined;
      if (existing) {
        updateMarkerElement(existing.element, place);
        existing.accuracyMeters = accuracyMeters;
        if (existing.coordinates[0] !== longitude || existing.coordinates[1] !== latitude) {
          existing.marker.setLngLat([longitude, latitude]);
          existing.coordinates = [longitude, latitude];
        }
        continue;
      }
      const element = createMarkerElement(place, compact);
      const marker = new Marker({ element, anchor: "center" })
        .setLngLat([longitude, latitude])
        .addTo(instance);
      element.addEventListener("mouseenter", () => callbacks.current.onHover(place.id));
      element.addEventListener("mouseleave", () => callbacks.current.onHover(null));
      element.addEventListener("focus", () => callbacks.current.onHover(place.id));
      element.addEventListener("blur", () => callbacks.current.onHover(null));
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        callbacks.current.onSelect(place.id);
        const current = markers.current.get(place.id);
        if (!compact && current) focusMapMarker(instance, current.coordinates, current.accuracyMeters);
      });
      markers.current.set(place.id, { marker, element, coordinates: [longitude, latitude], accuracyMeters });
    }
  }, [places, compact]);

  useEffect(() => {
    const visible = new Set(visibleIds);
    for (const [id, entry] of markers.current) {
      // MapLibre owns these marker nodes outside the React tree.
      // eslint-disable-next-line react-hooks/immutability
      entry.element.style.display = visible.has(id) ? "" : "none";
      const active = id === selectedId || id === hoveredId;
      entry.element.dataset.active = String(active);
      entry.element.setAttribute("aria-pressed", String(id === selectedId));
    }
  }, [selectedId, hoveredId, visibleIds]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const visible = new Set(visibleIds);
    const data = {
      type: "FeatureCollection" as const,
      features: places.flatMap(place =>
        place.precision === "approximate" && place.accuracyMeters && visible.has(place.id)
          ? [{
            type: "Feature" as const,
            properties: { active: place.id === selectedId || place.id === hoveredId },
            geometry: { type: "Polygon" as const, coordinates: [locationSearchRing(place.coordinates, place.accuracyMeters)] },
          }]
          : []),
    };
    const sourceId = "chroniplay-search-areas";
    const render = () => {
      const source = instance.getSource<GeoJSONSource>(sourceId);
      if (source) {
        void source.setData(data);
      } else if (data.features.length) {
        instance.addSource(sourceId, { type: "geojson", data });
        instance.addLayer({
          id: sourceId + "-fill", type: "fill", source: sourceId,
          paint: { "fill-color": "#e9b66a", "fill-opacity": ["case", ["boolean", ["get", "active"], false], 0.18, 0.08] },
        });
        instance.addLayer({
          id: sourceId + "-outline", type: "line", source: sourceId,
          paint: { "line-color": "#e9b66a", "line-opacity": 0.8, "line-width": 2, "line-dasharray": [3, 2] },
        });
      }
    };
    if (styleReady.current) render();
    else instance.once("load", render);
    return () => { instance.off("load", render); };
  }, [places, visibleIds, selectedId, hoveredId]);

  function changeZoom(delta: number) {
    if (delta > 0) map.current?.zoomIn();
    else map.current?.zoomOut();
  }

  function returnToRegion() {
    if (map.current) fitChronicleRegion(map.current, compact);
  }

  function focusSelected() {
    const entry = markers.current.get(selectedId);
    if (!entry || !visibleIds.includes(selectedId) || !map.current) return;
    callbacks.current.onFocusPlace(selectedId);
    focusMapMarker(map.current, entry.coordinates, entry.accuracyMeters);
  }

  return (
    <>
      <div ref={host} className={styles.mapLibreCanvas} aria-label="Interaktive OpenStreetMap der Chronikregion" />
      {showDiscoveryLegend&&<WorldMapLegend includeInternal={includeInternal} compact={compact}/>}
      <div className={styles.mapLibreControls} data-compact={compact||undefined} aria-label="Kartensteuerung">
        <button type="button" aria-label="Hineinzoomen" title="Hineinzoomen" onClick={() => changeZoom(1)}><Plus size={17} /></button>
        <button type="button" aria-label="Herauszoomen" title="Herauszoomen" onClick={() => changeZoom(-1)}><Minus size={17} /></button>
        <button type="button" aria-label="Zur Chronikregion" title="Zur Chronikregion" onClick={returnToRegion}><Compass size={17} /></button>
        {!compact&&<button type="button" aria-label="Bekannten Ort fokussieren" title="Bekannten Ort fokussieren" onClick={focusSelected} disabled={!visibleIds.includes(selectedId)}><LocateFixed size={17} /></button>}
      </div>
    </>
  );
}
