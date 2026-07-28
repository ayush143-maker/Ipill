"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl, { Map as MLMap } from "maplibre-gl";
import type { StatesCollection } from "@/lib/types";
import { buildClusterDots } from "@/lib/genClusterDots";

interface IndiaMapProps {
  states: StatesCollection;
  indicatorKey: string;
  selectedState: string | null;
  visibleStates: Set<string> | null; // null = no filter (show all)
  onSelectState: (stateName: string | null) => void;
  onHoverState: (stateName: string | null, x: number, y: number) => void;
  flyToBbox: [number, number, number, number] | null;
}

// Builds a single glossy "gel sphere" sprite: saturated hot-pink body,
// soft lavender bloom fading to transparent at the edge, and a white
// glossy specular highlight offset toward the upper-left.
function createGelSprite(size = 128): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  // 1. Soft outer lavender/pink bloom (large, low opacity, fades to nothing)
  const bloom = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
  bloom.addColorStop(0, "rgba(255,139,239,0.55)"); // FF8BEF
  bloom.addColorStop(0.55, "rgba(255,94,219,0.28)"); // FF5EDB
  bloom.addColorStop(1, "rgba(255,46,190,0)"); // FF2EBE -> transparent
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, size, size);

  // 2. Saturated gel body
  const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.72);
  body.addColorStop(0, "rgba(255,247,255,0.95)"); // FFF7FF
  body.addColorStop(0.28, "rgba(255,208,247,0.95)"); // FFD0F7
  body.addColorStop(0.5, "rgba(255,139,239,0.92)"); // FF8BEF
  body.addColorStop(0.72, "rgba(255,94,219,0.9)"); // FF5EDB
  body.addColorStop(0.88, "rgba(255,67,209,0.88)"); // FF43D1
  body.addColorStop(1, "rgba(255,46,190,0)"); // FF2EBE -> soft edge
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.fill();

  // 3. Glossy specular highlight, offset upper-left
  const hx = cx - r * 0.26;
  const hy = cy - r * 0.28;
  const highlight = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.32);
  highlight.addColorStop(0, "rgba(255,255,255,0.95)");
  highlight.addColorStop(0.5, "rgba(255,247,255,0.55)");
  highlight.addColorStop(1, "rgba(255,247,255,0)");
  ctx.fillStyle = highlight;
  ctx.beginPath();
  ctx.arc(hx, hy, r * 0.32, 0, Math.PI * 2);
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
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

  // Synthetic density clusters — stylistic only, not real district data.
  // Regenerated whenever the indicator changes (values differ per indicator).
  // Declared before the mount effect below so its "load" callback can seed
  // the dots source with real data immediately instead of an empty placeholder.
  const dots = useMemo(() => buildClusterDots(states, indicatorKey), [states, indicatorKey]);

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
      if (!map.hasImage("gel-dot")) {
        map.addImage("gel-dot", createGelSprite(128), { pixelRatio: 2 });
      }

      map.addSource("states", {
        type: "geojson",
        data: states as unknown as GeoJSON.FeatureCollection,
        promoteId: "state",
      });
      map.addSource("dots", {
        type: "geojson",
        data: dots as unknown as GeoJSON.FeatureCollection,
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

      // Soft outer bloom (blurred circle) — size/opacity now come straight
      // from each point's own "size"/"glow" (already baked in per role +
      // state intensity + organic jitter during generation).
      map.addLayer({
        id: "dots-bloom",
        type: "circle",
        source: "dots",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            ["*", ["get", "size"], 3],
            6,
            ["*", ["get", "size"], 5.5],
            9,
            ["*", ["get", "size"], 9.5],
          ],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "glow"],
            0,
            "#FFD0F7",
            0.5,
            "#FF8BEF",
            1,
            "#FF43D1",
          ],
          "circle-blur": 1.3,
          "circle-opacity": ["interpolate", ["linear"], ["get", "glow"], 0, 0.08, 1, 0.4],
        },
      });

      // Glossy gel-sphere marker (sprite): white upper-left hotspot, hot-pink
      // body, lavender bloom edge. Size + opacity read from the point itself.
      map.addLayer({
        id: "dots-gel",
        type: "symbol",
        source: "dots",
        layout: {
          "icon-image": "gel-dot",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            ["*", ["get", "size"], 0.035],
            6,
            ["*", ["get", "size"], 0.065],
            9,
            ["*", ["get", "size"], 0.11],
          ],
        },
        paint: {
          "icon-opacity": ["interpolate", ["linear"], ["get", "glow"], 0, 0.5, 1, 0.98],
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
      map.setFilter("dots-bloom", null);
      map.setFilter("dots-gel", null);
    } else {
      const allowed = Array.from(visibleStates);
      map.setFilter("states-dim", ["!", ["in", ["get", "state"], ["literal", allowed]]]);
      const dotFilter: maplibregl.FilterSpecification = [
        "in",
        ["get", "s"],
        ["literal", allowed],
      ];
      map.setFilter("dots-bloom", dotFilter);
      map.setFilter("dots-gel", dotFilter);
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
