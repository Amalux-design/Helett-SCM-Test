import { useEffect, useRef, useState } from "react";
import { FC_LOCATIONS, FC_COVERAGE_RADIUS_M } from "../data/fcLocations.js";

/* ═══════════════════════════════════════════════════════════════
   FC MAP — real Amazon FC locations on an interactive Leaflet map,
   with a 300km coverage circle per FC. Static reference (not tied
   to any SKU's demand) — just "where are the FCs".
   Leaflet is loaded from a CDN at runtime, same pattern this app
   already uses for PapaParse (loadPapa in App.tsx).
═══════════════════════════════════════════════════════════════ */

let leafletPromise = null;
function loadLeaflet() {
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return; }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/leaflet.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/leaflet.js";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Leaflet load failed"));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

// Leaflet's own panes/controls default to z-index 400-1000, which floats
// above this app's sticky settings bar (z-index 10) once you scroll past
// it. Pin every Leaflet-internal layer well below the app's own chrome —
// the map only needs to stack within its own card, never above the page.
const ZINDEX_FIX_ID = "fc-map-zindex-fix";
function ensureZIndexFix() {
  if (document.getElementById(ZINDEX_FIX_ID)) return;
  const style = document.createElement("style");
  style.id = ZINDEX_FIX_ID;
  style.textContent = `
    .fc-map-scope .leaflet-pane { z-index: 1; }
    .fc-map-scope .leaflet-tile-pane { z-index: 1; }
    .fc-map-scope .leaflet-overlay-pane { z-index: 2; }
    .fc-map-scope .leaflet-marker-pane { z-index: 3; }
    .fc-map-scope .leaflet-tooltip-pane { z-index: 4; }
    .fc-map-scope .leaflet-popup-pane { z-index: 5; }
    .fc-map-scope .leaflet-top, .fc-map-scope .leaflet-bottom { z-index: 6; }
  `;
  document.head.appendChild(style);
}

function MapCanvas({ height }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    ensureZIndexFix();
    loadLeaflet().then(L => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { center: [22.5937, 78.9629], zoom: 4.5, scrollWheelZoom: true });
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Draw ALL coverage circles first (background layer), THEN all FC
      // markers on top in a separate pass — otherwise a later FC's large
      // circle can paint over an earlier FC's marker and steal its clicks,
      // which is exactly what was happening in dense clusters (e.g. Delhi NCR).
      FC_LOCATIONS.forEach(({ lat, lng }) => {
        L.circle([lat, lng], {
          radius: FC_COVERAGE_RADIUS_M,
          color: "#e6a23c", weight: 1, opacity: 0.8,
          fillColor: "#e6a23c", fillOpacity: 0.06,
          interactive: false, // never blocks clicks meant for a marker
        }).addTo(map);
      });

      FC_LOCATIONS.forEach(({ fc, lat, lng, label }) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            background:#0c447c;color:#fff;font:700 9px/1 -apple-system,system-ui,sans-serif;
            padding:2px 5px;border-radius:4px;white-space:nowrap;border:1px solid #3a8fed;
            box-shadow:0 1px 3px rgba(0,0,0,.4);">${fc}</div>`,
          iconSize: null,
          iconAnchor: [16, 8],
        });
        L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(`<b>FC:</b> ${fc}<br><b>Region:</b> ${label}`);
      });
    }).catch(e => !cancelled && setErr(e.message));

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  if (err) {
    return <div style={{ padding: 20, fontSize: 11, color: "#e0837a" }}>Map failed to load: {err}</div>;
  }
  return <div className="fc-map-scope" ref={containerRef} style={{ width: "100%", height, minHeight: 240, borderRadius: 8, position: "relative", zIndex: 0 }} />;
}

export default function FCMap({ t }) {
  const [enlarged, setEnlarged] = useState(false);

  return (
    <div style={{ position: "relative", height: "100%", minHeight: 240 }}>
      <MapCanvas height="100%" />
      <button
        onClick={() => setEnlarged(true)}
        title="Enlarge map"
        style={{
          position: "absolute", top: 8, right: 8, zIndex: 20,
          background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6,
          padding: "4px 8px", fontSize: 11, cursor: "pointer", color: t.text2,
          fontFamily: "'Inter',system-ui,sans-serif",
        }}
      >⛶ Enlarge</button>

      {enlarged && (
        <div
          onClick={() => setEnlarged(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.6)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`,
            width: "min(1100px, 100%)", maxHeight: "90vh", overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Amazon FC Locations — India</div>
              <button onClick={() => setEnlarged(false)} style={{
                background: "transparent", border: "none", color: t.text3, fontSize: 18, cursor: "pointer", lineHeight: 1,
              }}>✕</button>
            </div>
            <MapCanvas height={640} />
          </div>
        </div>
      )}
    </div>
  );
}
