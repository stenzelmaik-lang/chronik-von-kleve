"use client";

import { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Compass, LocateFixed, Minus, Plus } from "lucide-react";
import { useEffect, useRef } from "react";

import type { WorldMapMarker } from "./world-map-contract";
import styles from "./world-experience.module.css";

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

function fitChronicleRegion(map: MapLibreMap) {
  map.fitBounds(CHRONICLE_REGION_BOUNDS, {
    padding: regionPadding(),
    maxZoom: 11.5,
    duration: 350,
  });
}

function createMarkerElement(place: WorldMapMarker) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = styles.mapLibreMarker;
  const positionText = place.precision === "candidate"
    ? "unbestätigte, noch nicht gespeicherte Kartenauswahl"
    : place.precision === "approximate"
    ? `ungefähre Position, Genauigkeit etwa ${place.accuracyMeters ?? 0} Meter`
    : "geprüfte genaue Position";
  button.setAttribute("aria-label", `${place.title}, ${positionText}. Vorschau anzeigen.`);
  button.setAttribute("aria-pressed", "false");
  button.title = `${place.title} · ${positionText}`;
  button.innerHTML = '<span aria-hidden="true"></span><i aria-hidden="true"></i>';
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
}: {
  places: WorldMapMarker[];
  visibleIds: string[];
  selectedId: string;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onFocusPlace: (id: string) => void;
  onStateChange: (state: "loading" | "ready" | "error") => void;
  onMapClick?: (coordinates: [longitude: number, latitude: number]) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; element: HTMLButtonElement; coordinates: [number, number] }>());
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

    const instance = new MapLibreMap({
      container,
      style: OPENFREEMAP_DARK_STYLE,
      center: [6.18, 51.78],
      zoom: 9,
      minZoom: 5,
      maxZoom: 19,
      attributionControl: { compact: false },
      dragPan: true,
      touchZoomRotate: true,
      dragRotate: false,
      pitchWithRotate: false,
      keyboard: true,
    });
    map.current = instance;

    const handleLoad = () => {
      if (!active) return;
      mapReady = true;
      window.clearTimeout(loadTimeout);
      fitChronicleRegion(instance);
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
      if (existing) {
        if (existing.coordinates[0] !== longitude || existing.coordinates[1] !== latitude) {
          existing.marker.setLngLat([longitude, latitude]);
          existing.coordinates = [longitude, latitude];
        }
        continue;
      }
      const element = createMarkerElement(place);
      const marker = new Marker({ element, anchor: "center" })
        .setLngLat([longitude, latitude])
        .addTo(instance);
      element.addEventListener("mouseenter", () => callbacks.current.onHover(place.id));
      element.addEventListener("mouseleave", () => callbacks.current.onHover(null));
      element.addEventListener("focus", () => callbacks.current.onHover(place.id));
      element.addEventListener("blur", () => callbacks.current.onHover(null));
      element.addEventListener("click", () => {
        callbacks.current.onSelect(place.id);
        instance.flyTo({ center: [longitude, latitude], zoom: Math.max(instance.getZoom(), 16), essential: true });
      });
      markers.current.set(place.id, { marker, element, coordinates: [longitude, latitude] });
    }
  }, [places]);

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

  function changeZoom(delta: number) {
    if (delta > 0) map.current?.zoomIn();
    else map.current?.zoomOut();
  }

  function returnToRegion() {
    if (map.current) fitChronicleRegion(map.current);
  }

  function focusSelected() {
    const entry = markers.current.get(selectedId);
    if (!entry || !visibleIds.includes(selectedId) || !map.current) return;
    callbacks.current.onFocusPlace(selectedId);
    map.current.flyTo({ center: entry.coordinates, zoom: Math.max(map.current.getZoom(), 16), essential: true });
  }

  return (
    <>
      <div ref={host} className={styles.mapLibreCanvas} aria-label="Interaktive OpenStreetMap der Chronikregion" />
      <div className={styles.mapLibreControls} aria-label="Kartensteuerung">
        <button type="button" aria-label="Hineinzoomen" title="Hineinzoomen" onClick={() => changeZoom(1)}><Plus size={17} /></button>
        <button type="button" aria-label="Herauszoomen" title="Herauszoomen" onClick={() => changeZoom(-1)}><Minus size={17} /></button>
        <button type="button" aria-label="Zur Chronikregion" title="Zur Chronikregion" onClick={returnToRegion}><Compass size={17} /></button>
        <button type="button" aria-label="Bekannten Ort fokussieren" title="Bekannten Ort fokussieren" onClick={focusSelected} disabled={!visibleIds.includes(selectedId)}><LocateFixed size={17} /></button>
      </div>
    </>
  );
}
