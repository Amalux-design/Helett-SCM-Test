/* ═══════════════════════════════════════════════════════════════
   AMAZON FC LOCATIONS (India) — lat/lng + ~300km coverage radius
   Source: user-provided reference map (Leaflet/Folium export).
   JPX1/JPX2 (Rajasthan) were missing from that source — added from
   public address records (locality-level coordinates, same precision
   as the rest of this dataset): JPX1 = Jhotwara Industrial Area,
   Jaipur; JPX2 = Bagru, Tehsil Sanganer, off NH-8 Jaipur–Ajmer Road.
═══════════════════════════════════════════════════════════════ */
export const FC_LOCATIONS = [
  { fc: "AMD2", lat: 22.8669, lng: 72.4117, label: "Ahmedabad (Bavla)" },
  { fc: "BLR4", lat: 13.2484, lng: 77.7127, label: "Bengaluru (Devanahalli)" },
  { fc: "BLR5", lat: 13.0722, lng: 77.7942, label: "Bengaluru (Hoskote)" },
  { fc: "BLR7", lat: 12.7067, lng: 77.7103, label: "Bengaluru (Anekal)" },
  { fc: "BLR8", lat: 13.25,   lng: 77.715,  label: "Bengaluru (Devanahalli)" },
  { fc: "BOM5", lat: 19.3321, lng: 73.1616, label: "Mumbai/Thane (Bhiwandi)" },
  { fc: "BOM7", lat: 19.31,   lng: 73.05,   label: "Mumbai/Thane (Bhiwandi)" },
  { fc: "CCX1", lat: 22.5386, lng: 88.1364, label: "Kolkata (Panchla)" },
  { fc: "CCX2", lat: 22.54,   lng: 88.14,   label: "Kolkata (Panchla)" },
  { fc: "CJB1", lat: 10.9254, lng: 77.0191, label: "Coimbatore" },
  { fc: "DED1", lat: 28.8028, lng: 77.1414, label: "Delhi NCR (Alipur)" },
  { fc: "DED4", lat: 28.3182, lng: 76.8174, label: "Gurugram (Jamalpur)" },
  { fc: "DED5", lat: 28.2439, lng: 77.0652, label: "Gurugram (Sohna)" },
  { fc: "DEL4", lat: 28.319,  lng: 76.818,  label: "Gurugram (Jamalpur)" },
  { fc: "DEL5", lat: 28.2934, lng: 76.8481, label: "Gurugram (Binola)" },
  { fc: "DEL8", lat: 28.245,  lng: 77.066,  label: "Gurugram (Sohna)" },
  { fc: "DEX3", lat: 28.51,   lng: 77.29,   label: "Delhi (Mathura Road)" },
  { fc: "DEX8", lat: 28.5035, lng: 77.302,  label: "Delhi (Badarpur)" },
  { fc: "HYD3", lat: 17.2181, lng: 78.4356, label: "Hyderabad (Shamshabad)" },
  { fc: "HYD8", lat: 17.22,   lng: 78.44,   label: "Hyderabad (Shamshabad)" },
  { fc: "JPX1", lat: 26.9863, lng: 75.7743, label: "Jaipur (Jhotwara)" },
  { fc: "JPX2", lat: 26.8093, lng: 75.5417, label: "Jaipur (Bagru)" },
  { fc: "LKO1", lat: 26.7606, lng: 80.9142, label: "Lucknow" },
  { fc: "MAA4", lat: 13.1415, lng: 79.9071, label: "Chennai (Thiruvallur)" },
  { fc: "PAX1", lat: 25.5941, lng: 85.1376, label: "Patna" },
  { fc: "PNQ2", lat: 28.505,  lng: 77.3,    label: "Delhi (Mohan Cooperative)" },
  { fc: "PNQ3", lat: 18.7831, lng: 73.8682, label: "Pune (Khed/Chakan)" },
  { fc: "SBLL", lat: 15.3647, lng: 75.124,  label: "Hubli-Dharwad/Belgaum Cluster" },
];

export const FC_COVERAGE_RADIUS_M = 300000; // 300km
