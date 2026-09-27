"use client";

import { useEffect, useRef } from "react";
import { Map as MlMap, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import type { Analysis, CategoryResult } from "@/lib/engine";

// The bundler doesn't emit MapLibre's worker; it's served from public/ (see scripts/copy-maplibre-worker.mjs).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const CHIHUAHUA: [number, number] = [-106.0889, 28.6353];
const BASEMAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

type Props = {
  analysis: Analysis | null;
  selected: CategoryResult | null;
  onPick: (lat: number, lon: number) => void;
};

function circle(lat: number, lon: number, radiusM: number, steps = 64): GeoJSON.Feature {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const dLat = (radiusM / 111_320) * Math.sin(a);
    const dLon = (radiusM / (111_320 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a);
    coords.push([lon + dLon, lat + dLat]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}

const points = (items: { lat: number; lon: number; props?: Record<string, unknown> }[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: items.map((p) => ({
    type: "Feature",
    properties: p.props ?? {},
    geometry: { type: "Point", coordinates: [p.lon, p.lat] },
  })),
});

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export default function MapView({ analysis, selected, onPick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const ready = useRef(false);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!container.current) return;
    const m = new MlMap({ container: container.current, style: BASEMAP, center: CHIHUAHUA, zoom: 12 });
    map.current = m;
    m.addControl(new NavigationControl({ showCompass: false }), "top-left");
    m.on("load", () => {
      m.addSource("area", { type: "geojson", data: EMPTY });
      m.addLayer({ id: "area-fill", type: "fill", source: "area", paint: { "fill-color": "#e7e9e6", "fill-opacity": 0.07 } });
      m.addLayer({ id: "area-line", type: "line", source: "area", paint: { "line-color": "#e7e9e6", "line-width": 1.5 } });

      m.addSource("twins", { type: "geojson", data: EMPTY });
      m.addLayer({
        id: "twins", type: "circle", source: "twins",
        paint: { "circle-radius": 5, "circle-color": "#8c918c", "circle-opacity": 0.8, "circle-stroke-color": "#0a0a0a", "circle-stroke-width": 1 },
      });

      m.addSource("competitors", { type: "geojson", data: EMPTY });
      m.addLayer({
        id: "competitors", type: "circle", source: "competitors",
        paint: { "circle-radius": 5.5, "circle-color": "#ffffff", "circle-stroke-color": "#0a0a0a", "circle-stroke-width": 1.5 },
      });

      m.addSource("point", { type: "geojson", data: EMPTY });
      m.addLayer({
        id: "point", type: "circle", source: "point",
        paint: { "circle-radius": 7, "circle-color": "#e7e9e6", "circle-stroke-color": "#0a0a0a", "circle-stroke-width": 3 },
      });
      ready.current = true;
    });
    m.on("click", (e) => onPickRef.current(e.lngLat.lat, e.lngLat.lng));

    const popup = new Popup({ closeButton: false, closeOnClick: false });
    m.on("mouseenter", "competitors", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      m.getCanvas().style.cursor = "pointer";
      popup
        .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
        .setHTML(`<strong>${f.properties.name}</strong><br/>${f.properties.distance} m · ${f.properties.size} empleados`)
        .addTo(m);
    });
    m.on("mouseleave", "competitors", () => {
      m.getCanvas().style.cursor = "";
      popup.remove();
    });
    return () => m.remove();
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      const src = (id: string) => m.getSource(id) as GeoJSONSource;
      if (!analysis) {
        ["area", "twins", "competitors", "point"].forEach((id) => src(id).setData(EMPTY));
        return;
      }
      src("area").setData({ type: "FeatureCollection", features: [circle(analysis.lat, analysis.lon, analysis.radiusM)] });
      src("point").setData(points([{ lat: analysis.lat, lon: analysis.lon }]));
      src("twins").setData(points(analysis.twins.map((t) => ({ lat: t.lat, lon: t.lon }))));
      src("competitors").setData(
        points(
          (selected?.competitors ?? []).map((c) => ({
            lat: c.lat, lon: c.lon, props: { name: c.name, distance: c.distanceM, size: c.size },
          })),
        ),
      );
    };
    if (ready.current) apply();
    else m.once("load", apply);
  }, [analysis, selected]);

  useEffect(() => {
    if (analysis && map.current) map.current.easeTo({ center: [analysis.lon, analysis.lat], zoom: 14, duration: 600 });
  }, [analysis]);

  return <div ref={container} className="h-full w-full" />;
}
