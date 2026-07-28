"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MLMap } from "maplibre-gl";
import type { StatesCollection } from "@/lib/types";

interface IndiaMapProps {
  states: StatesCollection;
  dots: GeoJSON.FeatureCollection | null;
  selectedState: string | null;
  visibleStates: Set<string> | null; // null = no filter (show all)
  onSelectState: (state: string | null) => void;
  onHoverState: (state: string | null, x: number, y: number) => void;
  flyToBbox: [number, number, number, number] | null;
}

const EMPTY_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0B0B12" } },
  ],
};

export default function IndiaMap({
  states,
  dots,
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

      // Clean state outline only - no district lines, avoids clutter
      map.addLayer({
        id: "states-fill",
        type: "fill",
        source: "states",
        paint: {
          "fill-color": "#1a1a28",
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.3,
            ["boolean", ["feature-state", "hover"], false],
            0.18,
            0.015,
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
            1.3,
            0.6,
          ],
        },
      });

      map.addLayer({
        id: "states-dim",
        type: "fill",
        source: "states",
        paint: { "fill-color": "#0B0B12", "fill-opacity": 0.75 },
        filter: ["==", "state", "__none__"],
      });

      // Soft outer bloom
      map.addLayer({
        id: "dots-bloom",
        type: "circle",
        source: "dots",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 5, 6, 9, 10, 16],
          "circle-color": "#ff2fb0",
          "circle-blur": 1.6,
          "circle-opacity": 0.2,
        },
      });

      // Mid glow halo
      map.addLayer({
        id: "dots-halo",
        type: "circle",
        source: "dots",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2.2, 6, 4, 10, 7],
          "circle-color": "#e0399f",
          "circle-blur": 0.9,
          "circle-opacity": 0.48,
        },
      });

      // Sharp bright core
      map.addLayer({
        id: "dots-core",
        type: "circle",
        source: "dots",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 6, 1.3, 10, 2.2],
          "circle-color": "#ffe3f5",
          "circle-blur": 0.1,
          "circle-opacity": 0.95,
        },
      });

      loadedRef.current = true;

      map.on("click", "states-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        onSelectState((f.properties?.state as string) ?? null);
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
            map.setFeatureState({ source: "states", id: hoveredRef.current }, { hover: false });
          }
          hoveredRef.current = name;
          map.setFeatureState({ source: "states", id: name }, { hover: true });
        }
        onHoverState(name, e.point.x, e.point.y);
      });
      map.on("mouseleave", "states-fill", () => {
        map.getCanvas().style.cursor = "";
        if (hoveredRef.current) {
          map.setFeatureState({ source: "states", id: hoveredRef.current }, { hover: false });
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !dots) return;
    const src = map.getSource("dots") as maplibregl.GeoJSONSource | undefined;
    src?.setData(dots as unknown as GeoJSON.FeatureCollection);
  }, [dots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    for (const f of states.features) {
      const name = f.properties.state;
      map.setFeatureState({ source: "states", id: name }, { selected: name === selectedState });
    }
  }, [selectedState, states]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (!visibleStates) {
      map.setFilter("states-dim", ["==", "state", "__none__"]);
      map.setFilter("dots-bloom", null);
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
      map.setFilter("dots-bloom", dotFilter);
      map.setFilter("dots-halo", dotFilter);
      map.setFilter("dots-core", dotFilter);
    }
  }, [visibleStates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToBbox) return;
    map.fitBounds(
      [
        [flyToBbox[0], flyToBbox[1]],
        [flyToBbox[2], flyToBbox[3]],
      ],
      { padding: { top: 100, bottom: 100, left: 60, right: 420 }, duration: 900, maxZoom: 8 }
    );
  }, [flyToBbox]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
