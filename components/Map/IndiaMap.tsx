"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MLMap } from "maplibre-gl";
import type { DistrictsCollection } from "@/lib/types";

interface IndiaMapProps {
  districts: DistrictsCollection;
  dots: GeoJSON.FeatureCollection | null;
  selectedUid: string | null;
  visibleUids: Set<string> | null; // null = no filter (show all)
  onSelectDistrict: (uid: string | null) => void;
  onHoverDistrict: (uid: string | null, x: number, y: number) => void;
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
  districts,
  dots,
  selectedUid,
  visibleUids,
  onSelectDistrict,
  onHoverDistrict,
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
      maxZoom: 11,
      pitchWithRotate: false,
      dragRotate: false,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      map.addSource("districts", {
        type: "geojson",
        data: districts as unknown as GeoJSON.FeatureCollection,
        promoteId: "uid",
      });
      map.addSource("dots", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "districts-fill",
        type: "fill",
        source: "districts",
        paint: {
          "fill-color": "#1a1a28",
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.32,
            ["boolean", ["feature-state", "hover"], false],
            0.2,
            0.02,
          ],
        },
      });

      map.addLayer({
        id: "districts-line",
        type: "line",
        source: "districts",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#ff2fb0",
            ["boolean", ["feature-state", "hover"], false],
            "#a855f7",
            "#22222f",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            2,
            ["boolean", ["feature-state", "hover"], false],
            1.2,
            0.35,
          ],
        },
      });

      map.addLayer({
        id: "districts-dim",
        type: "fill",
        source: "districts",
        paint: { "fill-color": "#0B0B12", "fill-opacity": 0.78 },
        filter: ["==", "uid", "__none__"],
      });

      // Wide, soft outer bloom
      map.addLayer({
        id: "dots-bloom",
        type: "circle",
        source: "dots",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 5, 6, 9, 10, 16],
          "circle-color": "#ff2fb0",
          "circle-blur": 1.6,
          "circle-opacity": 0.22,
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
          "circle-opacity": 0.5,
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

      map.on("click", "districts-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        onSelectDistrict((f.properties?.uid as string) ?? null);
      });
      map.on("click", (e) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: ["districts-fill"] });
        if (feats.length === 0) onSelectDistrict(null);
      });

      map.on("mousemove", "districts-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const uid = f.properties?.uid as string;
        if (hoveredRef.current !== uid) {
          if (hoveredRef.current) {
            map.setFeatureState({ source: "districts", id: hoveredRef.current }, { hover: false });
          }
          hoveredRef.current = uid;
          map.setFeatureState({ source: "districts", id: uid }, { hover: true });
        }
        onHoverDistrict(uid, e.point.x, e.point.y);
      });
      map.on("mouseleave", "districts-fill", () => {
        map.getCanvas().style.cursor = "";
        if (hoveredRef.current) {
          map.setFeatureState({ source: "districts", id: hoveredRef.current }, { hover: false });
          hoveredRef.current = null;
        }
        onHoverDistrict(null, 0, 0);
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
    for (const f of districts.features) {
      const uid = f.properties.uid;
      map.setFeatureState({ source: "districts", id: uid }, { selected: uid === selectedUid });
    }
  }, [selectedUid, districts]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (!visibleUids) {
      map.setFilter("districts-dim", ["==", "uid", "__none__"]);
      map.setFilter("dots-bloom", null);
      map.setFilter("dots-halo", null);
      map.setFilter("dots-core", null);
    } else {
      const allowed = Array.from(visibleUids);
      map.setFilter("districts-dim", ["!", ["in", ["get", "uid"], ["literal", allowed]]]);
      const dotUid: maplibregl.ExpressionSpecification = [
        "concat",
        ["get", "s"],
        "|",
        ["get", "d"],
      ];
      const dotFilter: maplibregl.FilterSpecification = ["in", dotUid, ["literal", allowed]];
      map.setFilter("dots-bloom", dotFilter);
      map.setFilter("dots-halo", dotFilter);
      map.setFilter("dots-core", dotFilter);
    }
  }, [visibleUids]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToBbox) return;
    map.fitBounds(
      [
        [flyToBbox[0], flyToBbox[1]],
        [flyToBbox[2], flyToBbox[3]],
      ],
      { padding: { top: 100, bottom: 100, left: 60, right: 420 }, duration: 900, maxZoom: 9.5 }
    );
  }, [flyToBbox]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
