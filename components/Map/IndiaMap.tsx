"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MLMap } from "maplibre-gl";
import type { StatesCollection } from "@/lib/types";

interface IndiaMapProps {
  states: StatesCollection;
  dots: GeoJSON.FeatureCollection | null;
  indicatorKey: string;
  selectedState: string | null;
  visibleStates: Set<string> | null; // null = no filter (show all)
  onSelectState: (stateName: string | null) => void;
  onHoverState: (stateName: string | null, x: number, y: number) => void;
  flyToBbox: [number, number, number, number] | null;
}

const EMPTY_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "bg",
      type: "background",
      paint: { "background-color": "#0B0B12" },
    },
  ],
};

export default function IndiaMap({
  states,
  dots,
  indicatorKey,
  selectedState,
  visibleStates,
  onSelectState,
  onHoverState,
  flyToBbox,
}: IndiaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const loadedRef = useRef(false);
  const hoveredRef = useRef<string | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: EMPTY_STYLE,
      center: [82.5, 22.5],
      zoom: 3.6,
      minZoom: 3,
      maxZoom: 10,
      pitchWithRotate: false,
      dragRotate: false,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      map.addSource("states", {
        type: "geojson",
        data: states as unknown as GeoJSON.FeatureCollection,
        promoteId: "state",
      });
      map.addSource("dots", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Base state fill (very subtle, mostly for hit-testing + gentle tone)
      map.addLayer({
        id: "states-fill",
        type: "fill",
        source: "states",
        paint: {
          "fill-color": "#1a1a28",
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.35,
            ["boolean", ["feature-state", "hover"], false],
            0.22,
            0.06,
          ],
        },
      });

      map.addLayer({
        id: "states-line",
        type: "line",
        source: "states",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#ff2fb0",
            ["boolean", ["feature-state", "hover"], false],
            "#a855f7",
            "#2a2a3a",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            2,
            ["boolean", ["feature-state", "hover"], false],
            1.4,
            0.6,
          ],
        },
      });

      // Dimmed overlay for filtered-out states
      map.addLayer({
        id: "states-dim",
        type: "fill",
        source: "states",
        paint: {
          "fill-color": "#0B0B12",
          "fill-opacity": 0.72,
        },
        filter: ["==", "state", "__none__"],
      });

      // Glow halo (blurred, larger)
      map.addLayer({
        id: "dots-halo",
        type: "circle",
        source: "dots",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3.5, 6, 6, 9, 10],
          "circle-color": "#ff2fb0",
          "circle-blur": 1.1,
          "circle-opacity": 0.35,
        },
      });

      // Sharp core dot
      map.addLayer({
        id: "dots-core",
        type: "circle",
        source: "dots",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 0.9, 6, 1.6, 9, 2.6],
          "circle-color": "#ffd1ee",
          "circle-blur": 0.15,
          "circle-opacity": 0.9,
        },
      });

      loadedRef.current = true;

      // Interactions
      map.on("click", "states-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        onSelectState(f.properties?.state ?? null);
      });
      map.on("click", (e) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: ["states-fill"] });
        if (feats.length === 0) onSelectState(null);
      });

      map.on("mousemove", "states-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const name = f.properties?.state as string;
        if (hoveredRef.current !== name) {
          if (hoveredRef.current) {
            setFeatureStateByName(map, hoveredRef.current, { hover: false });
          }
          hoveredRef.current = name;
          setFeatureStateByName(map, name, { hover: true });
        }
        onHoverState(name, e.point.x, e.point.y);
      });
      map.on("mouseleave", "states-fill", () => {
        map.getCanvas().style.cursor = "";
        if (hoveredRef.current) {
          setFeatureStateByName(map, hoveredRef.current, { hover: false });
          hoveredRef.current = null;
        }
        onHoverState(null, 0, 0);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update dots source when indicator/data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !dots) return;
    const src = map.getSource("dots") as maplibregl.GeoJSONSource | undefined;
    src?.setData(dots as unknown as GeoJSON.FeatureCollection);
  }, [dots, indicatorKey]);

  // Update selected feature-state
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    // Clear all selections then set the new one
    const features = (states.features || []) as GeoJSON.Feature[];
    for (const f of features) {
      const name = (f.properties as { state?: string })?.state;
      if (name) setFeatureStateByName(map, name, { selected: name === selectedState });
    }
  }, [selectedState, states]);

  // Apply visibility filter (search / region / range)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (!visibleStates) {
      map.setFilter("states-dim", ["==", "state", "__none__"]);
      map.setFilter("dots-halo", null);
      map.setFilter("dots-core", null);
    } else {
      const allowed = Array.from(visibleStates);
      map.setFilter("states-dim", ["!", ["in", ["get", "state"], ["literal", allowed]]]);
      const dotFilter: maplibregl.FilterSpecification = [
        "in",
        ["get", "s"],
        ["literal", allowed],
      ];
      map.setFilter("dots-halo", dotFilter);
      map.setFilter("dots-core", dotFilter);
    }
  }, [visibleStates]);

  // Fly to selected state bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToBbox) return;
    map.fitBounds(
      [
        [flyToBbox[0], flyToBbox[1]],
        [flyToBbox[2], flyToBbox[3]],
      ],
      { padding: { top: 80, bottom: 80, left: 80, right: 420 }, duration: 900, maxZoom: 7.5 }
    );
  }, [flyToBbox]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

function setFeatureStateByName(
  map: MLMap,
  stateName: string,
  state: Record<string, boolean>
) {
  map.setFeatureState({ source: "states", id: hashId(stateName) }, state);
}

// MapLibre feature-state requires numeric/string ids on features. We didn't
// set explicit `id`s in the GeoJSON, so we derive a stable one from the
// state name (must match promoteId config below).
function hashId(name: string): string {
  return name;
}
