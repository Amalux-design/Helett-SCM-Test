import { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle, lazy, Suspense, Children, isValidElement } from "react";
import { createPortal, flushSync } from "react-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell, ComposedChart, Area } from "recharts";
import { SKU_MAP } from "./data/skuMap.js";
import { FC_CITY, fcLabel, FC_REGION } from "./data/fcMapping.js";
import { STATE_TO_REGION } from "./data/stateRegion.js";
import { CLUSTERS, stateNameToCode, clusterForState, stateCodeToName } from "./data/fcStateMapping.js";
import PurchasePlanChart from "./purchasePlan/PurchasePlanChart";
import { trendRatio, getStartStock } from "./purchasePlan/planLogic";
import { CITY_ALIAS, normalizeCity } from "./data/cityNormalizer.js";
import { DARK, LIGHT } from "./data/themes.js";
import { LOGO_ICON, NAV_ICONS } from "./data/icons.jsx";
import { makeCSS } from "./data/makeCSS.js";
// Code-split: FCMap (and the Leaflet library it loads at runtime) is only
// fetched when someone actually opens a SKU Detail page — never part of
// the main bundle, so it can't slow down the initial Google Sheets fetch.
const FCMap = lazy(() => import("./components/FCMap.jsx"));


/* ═══════════════════════════════════════════════════════════════
   SKU CONFIG
═══════════════════════════════════════════════════════════════ */
const DEFAULT_SKU_CONFIG = {
  "B0D39NNN57": { active: false, note: "Not in use currently", category: "Paused" },
};
function loadSkuConfig() {
  try {
    const saved = localStorage.getItem("fba_sku_config");
    if (saved) {
      const parsed = JSON.parse(saved);
      const merged = { ...parsed };
      Object.keys(DEFAULT_SKU_CONFIG).forEach(asin => {
        if (merged[asin] === undefined) merged[asin] = { ...DEFAULT_SKU_CONFIG[asin] };
      });
      return merged;
    }
  } catch(_) {}
  return { ...DEFAULT_SKU_CONFIG };
}
function saveSkuConfig(cfg) {
  try { localStorage.setItem("fba_sku_config", JSON.stringify(cfg)); } catch(_) {}
}
function isActive(cfg, asin) {
  return cfg[asin] === undefined || cfg[asin].active !== false;
}

/* ═══════════════════════════════════════════════════════════════
   FC CITY / FC → REGION / STATE → REGION mappings
   (moved to ./data/fcMapping.js and ./data/stateRegion.js)
═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   UNSELLABLE DISPOSITIONS
═══════════════════════════════════════════════════════════════ */
const UNSELLABLE_DISPOSITIONS = new Set(["CUSTOMER_DAMAGED","CARRIER_DAMAGED","WAREHOUSE_DAMAGED","DEFECTIVE","DISTRIBUTOR_DAMAGED"]);

/* ═══════════════════════════════════════════════════════════════
   DATE HELPERS
═══════════════════════════════════════════════════════════════ */
function getToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function localKey(d) {
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

/* ═══════════════════════════════════════════════════════════════
   FORMATTERS
═══════════════════════════════════════════════════════════════ */
function fmt(n, dec=0) {
  if (n===null||n===undefined||isNaN(n)||!isFinite(n)) return "—";
  return Number(n).toLocaleString("en-IN",{maximumFractionDigits:dec,minimumFractionDigits:dec});
}
function fmtDate(d) {
  if (!d) return "—";
  return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}
// "14 Dec 26" — saves width in tables
function fmtDateShort(d) {
  if (!d) return "—";
  return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"2-digit"});
}
function extractSheetId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/* ═══════════════════════════════════════════════════════════════
   CSV EXPORT
═══════════════════════════════════════════════════════════════ */
function csvCell(v) {
  const str = v===null||v===undefined ? "" : String(v);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g,'""')}"` : str;
}
function downloadCSV(filename, headers, rows) {
  const lines = [headers.map(csvCell).join(","), ...rows.map(r=>r.map(csvCell).join(","))];
  const blob = new Blob(["﻿"+lines.join("\r\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════════
   PAPAPARSE
═══════════════════════════════════════════════════════════════ */
function loadPapa() {
  return new Promise((res,rej)=>{
    if (window.Papa){res();return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js";
    s.onload=res; s.onerror=()=>rej(new Error("PapaParse load failed"));
    document.head.appendChild(s);
  });
}
function parseCSV(text) {
  return loadPapa().then(()=>new Promise((res,rej)=>{
    const clean = text.charCodeAt(0)===0xFEFF ? text.slice(1) : text;
    window.Papa.parse(clean,{
      header:true, skipEmptyLines:true,
      transformHeader: h => h.trim(),
      transform: (v) => typeof v==="string" ? v.trim() : v,
      complete: r => res(r.data),
      error: e => rej(e),
    });
  }));
}
function makeGet(rows) {
  if (!rows||!rows.length) return ()=>"";
  const map = {};
  Object.keys(rows[0]).forEach(k => { map[k.toLowerCase()] = k; });
  return function(row, ...names) {
    for (const name of names) {
      const v1 = row[name];
      if (v1 !== undefined && v1 !== null && v1 !== "") return v1;
      const k2 = map[name.toLowerCase()];
      if (k2) { const v2 = row[k2]; if (v2 !== undefined && v2 !== null && v2 !== "") return v2; }
    }
    return "";
  };
}
function n(row, get, ...names) {
  const v = get(row, ...names);
  const f = parseFloat(v);
  return isNaN(f) ? 0 : Math.max(0, f);
}
function s(row, get, ...names) {
  return String(get(row, ...names)||"").trim();
}

/* ═══════════════════════════════════════════════════════════════
   INVENTORY PROCESSOR
═══════════════════════════════════════════════════════════════ */
function buildFcTransferMap(fbaInvRows) {
  const map={};
  if (!fbaInvRows||!fbaInvRows.length) return map;
  const get=makeGet(fbaInvRows);
  fbaInvRows.forEach(r=>{
    const asin = s(r,get,"asin","ASIN");
    if (!asin) return;
    map[asin] = n(r,get,"fc-transfer","fc transfer","fc_transfer","FC Transfer","FCTransfer");
  });
  return map;
}
function processInventory(rows, fbaInvRows) {
  const inv={}, warnings=[];
  if (!rows||!rows.length) return {inv,warnings};
  const get=makeGet(rows);
  const fctMap = buildFcTransferMap(fbaInvRows);
  rows.forEach((r,i)=>{
    const asin = s(r,get,"ASIN","asin");
    if (!asin) return;
    if (!SKU_MAP[asin]){
      warnings.push({type:"unmapped_inventory",asin,row:i+2,context:s(r,get,"SKU","sku")});
      return;
    }
    const csvSku = s(r,get,"SKU","sku");
    const mapSku = SKU_MAP[asin].sellerSku;
    if (csvSku&&mapSku&&csvSku.toLowerCase()!==mapSku.toLowerCase())
      warnings.push({type:"sku_mismatch_inv",asin,csvSku,mapSku,row:i+2});
    const fc   = n(r,get,"FC Sellable","fc sellable","FCsellable");
    const fba  = n(r,get,"FBA Available","fba available","FBAAvailable");
    const fcU  = n(r,get,"FC Unsellable","fc unsellable");
    const fbaU = n(r,get,"FBA Unsellable","fba unsellable");
    const inb  = n(r,get,"Inbound","inbound");
    const proc = n(r,get,"Processing","processing");
    const fctOld = n(r,get,"FC Transfer","fc transfer","FCTransfer");
    const fct  = (fctMap[asin]!==undefined) ? fctMap[asin] : fctOld;
    // "On Hand" from the file is kept only as a raw reference value — it's not
    // reliably just FBA+FC Transfer (can be a broader/stale figure from the
    // source report), so it must never be added into currentStock or it
    // double-counts against fc/inb. Planning stock = FBA + FC Transfer + FC
    // Sellable + Inbound, explicitly, regardless of what the file's own
    // "On Hand" column says.
    const onh  = n(r,get,"On Hand","on hand","OnHand") || (fba + fct);
    const cost = n(r,get,"Unit Cost (₹)","Unit Cost","unit cost");
    inv[asin]={
      asin, csvSku, finalName:SKU_MAP[asin].finalName, sellerSku:SKU_MAP[asin].sellerSku,
      fcSellable:fc, fcUnsellable:fcU, fbaAvailable:fba, fbaUnsellable:fbaU,
      inbound:inb, processing:proc, fcTransfer:fct, onHand:onh,
      currentStock: fba + fct + fc + inb,
      unitCost:cost,
      statusFlags: s(r,get,"Status Flags","StatusFlags","status flags"),
    };
  });
  return {inv,warnings};
}

/* ═══════════════════════════════════════════════════════════════
   CITY NORMALIZER (moved to ./data/cityNormalizer.js)
═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   ORDERS PROCESSOR — FIXED
   • Date anchor = MAX(purchase-date in dataset), matching Excel's MAX(AI:AI)
   • Status logic = exclude Cancelled + Returns only (matches Excel SUMPRODUCT)
   • Counts Pending + Shipped with qty > 0 (Excel counts these)
   • Tracks regional demand per ASIN via ship-state
   • Tracks city demand per ASIN via ship-city + ship-state
═══════════════════════════════════════════════════════════════ */
function processOrders(rows) {
  const warnings=[], salesByAsinDay={}, salesByAsinDayChart={}, regionalSales={}, citySales={}, seenU=new Set(), seenM=new Set();
  const lastOrderDate={};
  let maxDate = null, minSalesDate = null;
  if (!rows||!rows.length) return {salesByAsinDay,salesByAsinDayChart,warnings,maxDate,minSalesDate,regionalSales,citySales,lastOrderDate};
  const get=makeGet(rows);

  // Excel excludes exactly these — everything else (Pending, Shipped, etc.) with qty>0 is a sale
  const EXCLUDED_STATUSES = new Set([
    "cancelled",
    "shipped - returned to seller",
    "shipped - returning to seller",
    "shipped - rejected by buyer",
    "shipped - returning",
  ]);

  rows.forEach((r,i)=>{
    const asin    = s(r,get,"asin","ASIN");
    const status  = s(r,get,"order-status","order_status","Order Status").toLowerCase();
    const channel = s(r,get,"sales-channel","sales_channel","Sales Channel").toLowerCase();
    const dateRaw = s(r,get,"purchase-date","purchase_date","Date","date");
    const orderId = s(r,get,"amazon-order-id","order-id","Order ID");
    if (!asin||!dateRaw) return;
    if (orderId && orderId.startsWith("S02-")) return; // removal orders
    // (channel checked below — MCF/Non-Amazon rows still consume real FBA stock,
    //  so they stay IN demand/velocity/DOI/replenish calc; they're excluded only
    //  from the chart-vs-Amazon-dashboard sales history, see salesByAsinDayChart)
    // Use UTC date string (LEFT(C,10) equivalent) to match Excel exactly
    const utcDateStr = String(dateRaw).slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(utcDateStr)) return;
    const d = new Date(utcDateStr+"T00:00:00");

    // Track date range in the dataset
    if (!maxDate || d > maxDate) maxDate = d;
    if (!minSalesDate || d < minSalesDate) minSalesDate = d;

    if (!SKU_MAP[asin]){
      if(!seenU.has(asin)){seenU.add(asin);warnings.push({type:"unmapped_order",asin,row:i+2});}
      return;
    }
    const csvSku=s(r,get,"sku","SKU");
    const mapSku=SKU_MAP[asin]?.sellerSku||"";
    if(csvSku&&mapSku&&csvSku.toLowerCase()!==mapSku.toLowerCase()&&!seenM.has(asin)){
      seenM.add(asin); warnings.push({type:"sku_mismatch_order",asin,csvSku,mapSku,row:i+2});
    }

    // Skip excluded statuses
    if (EXCLUDED_STATUSES.has(status)) return;

    const qty=Math.max(0,parseFloat(s(r,get,"quantity","Quantity","qty")||"0")||0);
    if(qty===0) return;

    // Accumulate daily sales
    const key=localKey(d);
    if(!salesByAsinDay[asin]) salesByAsinDay[asin]={};
    if(!salesByAsinDay[asin][key]) salesByAsinDay[asin][key]={sold:0};
    salesByAsinDay[asin][key].sold+=qty;
    // Chart-only series: matches Amazon's Sales widget (excludes Non-Amazon/MCF rows)
    if(!(channel && channel.includes("non-amazon"))){
      if(!salesByAsinDayChart[asin]) salesByAsinDayChart[asin]={};
      if(!salesByAsinDayChart[asin][key]) salesByAsinDayChart[asin][key]={sold:0};
      salesByAsinDayChart[asin][key].sold+=qty;
    }
    // Track last order date per ASIN
    if(!lastOrderDate[asin]||d>lastOrderDate[asin]) lastOrderDate[asin]=d;

    // Track regional demand
    const stateRaw = s(r,get,"ship-state","Ship State","ship_state","state").toUpperCase().trim();
    const region = STATE_TO_REGION[stateRaw] || "Unknown";
    if(!regionalSales[asin]) regionalSales[asin]={North:0,South:0,East:0,West:0,Central:0,Unknown:0};
    regionalSales[asin][region] = (regionalSales[asin][region]||0) + qty;

    // Track city demand — store as "CITY||STATE" key so we keep state context
    const cityRaw = s(r,get,"ship-city","Ship City","ship_city","city");
    const cityNorm = normalizeCity(cityRaw);
    const stateName = stateRaw || "UNKNOWN";
    if (cityNorm) {
      const cityKey = cityNorm + "||" + stateName;
      if (!citySales[asin]) citySales[asin] = {};
      citySales[asin][cityKey] = (citySales[asin][cityKey] || 0) + qty;
    }
  });

  return {salesByAsinDay,salesByAsinDayChart,warnings,maxDate,minSalesDate,regionalSales,citySales,lastOrderDate};
}

/* ═══════════════════════════════════════════════════════════════
   LEDGER PROCESSOR
═══════════════════════════════════════════════════════════════ */
function processLedger(rows) {
  if (!rows||!rows.length) return {};
  const get=makeGet(rows);
  function parseLedgerDate(str) {
    if (!str) return null;
    const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy) { const d=new Date(+mdy[3],+mdy[1]-1,+mdy[2]); d.setHours(0,0,0,0); return d; }
    const d=new Date(str); if(isNaN(d)) return null;
    d.setHours(0,0,0,0); return d;
  }
  let latestDate=null;
  rows.forEach(r=>{
    const d=parseLedgerDate(s(r,get,"Date","date"));
    if(d&&(!latestDate||d>latestDate)) latestDate=d;
  });
  if(!latestDate) return {fcData:{}, ledgerDate:null};
  const byKey={};
  rows.forEach(r=>{
    const asin=s(r,get,"ASIN","asin");
    const loc=s(r,get,"Location","location");
    const disp=s(r,get,"Disposition","disposition");
    if(!asin||!loc||!disp||!SKU_MAP[asin]) return;
    const key=`${asin}||${loc}||${disp}`;
    if(!byKey[key]) byKey[key]=[];
    byKey[key].push(r);
  });
  const fcData={};
  Object.keys(byKey).forEach(key=>{
    const [asin,loc,disp]=key.split("||");
    if(!fcData[asin]) fcData[asin]={fcStock:{},fcDemand:{},fcUnsellable:{},fcInTransit:{}};
    const entries=byKey[key];
    if(disp==="SELLABLE"){
      const latest=entries.find(r=>{
        const d=parseLedgerDate(s(r,get,"Date","date"));
        return d&&d.getTime()===latestDate.getTime();
      });
      if(latest){
        const bal=n(latest,get,"Ending Warehouse Balance","EndingWarehouseBalance");
        const tr=n(latest,get,"In Transit Between Warehouses","InTransitBetweenWarehouses");
        fcData[asin].fcStock[loc]=(fcData[asin].fcStock[loc]||0)+bal;
        fcData[asin].fcInTransit[loc]=(fcData[asin].fcInTransit[loc]||0)+tr;
      }
      const totalDemand=entries.reduce((sum,r)=>{
        const ship=parseFloat(s(r,get,"Customer Shipments","CustomerShipments")||"0")||0;
        return sum+Math.max(0,-ship);
      },0);
      fcData[asin].fcDemand[loc]=(fcData[asin].fcDemand[loc]||0)+(entries.length>0?totalDemand/entries.length:0);
    } else if(UNSELLABLE_DISPOSITIONS.has(disp)){
      const latest=entries.find(r=>{
        const d=parseLedgerDate(s(r,get,"Date","date"));
        return d&&d.getTime()===latestDate.getTime();
      });
      if(latest){
        const bal=n(latest,get,"Ending Warehouse Balance","EndingWarehouseBalance");
        fcData[asin].fcUnsellable[loc]=(fcData[asin].fcUnsellable[loc]||0)+bal;
      }
    }
  });
  return {fcData, ledgerDate: latestDate};
}

/* ═══════════════════════════════════════════════════════════════
   LEADTIME PROCESSOR
   Reads ASIN + Mode (Air/SEA) rows from Leadtime sheet.
   Produces: { [asin]: { air:{lead,ship,customs,safety,depart,total}, sea:{…}, cost } }
═══════════════════════════════════════════════════════════════ */
function processLeadtime(rows) {
  if (!rows || !rows.length) return {};
  const get = makeGet(rows);
  const lt = {};
  rows.forEach(r => {
    const asin    = s(r, get, "ASIN", "asin");
    const mode    = s(r, get, "Mode of shipment", "Mode", "mode", "shipment_mode").toLowerCase();
    if (!asin || (!mode.includes("air") && !mode.includes("sea"))) return;
    const lead    = n(r, get, "Lead Time (Days)", "Lead Time", "lead_time", "lead");
    const ship    = n(r, get, "Shipping Time (Days)", "Shipping Time", "shipping_time", "transit");
    const customs = n(r, get, "Customs (Days)", "customs", "Customs");
    const safety  = n(r, get, "Safety Stock (Days)", "Safety Stock", "safety_stock", "safety");
    const depart  = n(r, get, "Departure Delay", "departure_delay", "departure");
    const cost    = n(r, get, "Base Cost / Unit (₹)", "Base Cost / Unit", "Base Cost", "cost", "unit_cost");
    const transitDaysCol = n(r, get, "Total Transit Days", "total_transit_days", "Transit Days", "transit_days");
    const total   = transitDaysCol > 0 ? transitDaysCol : (lead + ship + customs + depart);
    if (!lt[asin]) lt[asin] = { cost: 0 };
    if (cost > 0) lt[asin].cost = cost;
    const modeData = { lead, ship, customs, safety, depart, total, transitDays: total };
    if (mode.includes("air")) { lt[asin].air = modeData; }
    else if (mode.includes("sea")) { lt[asin].sea = modeData; lt[asin].transitDays = total; /* sea = default */ }
  });
  return lt;
}

/* ═══════════════════════════════════════════════════════════════
   PURCHASES PROCESSOR
   Reads Purchases sheet, builds openPoQtyByAsin map.
   Excludes Status == "Delivered" (case-insensitive).
   O(n) single pass.
═══════════════════════════════════════════════════════════════ */
// poSelection: optional { [asin]: { [rowKey]: false } } — a PO row is included unless
// explicitly set to false (opt-out model, so default behavior with no selections is unchanged).
// Keyed by ROW POSITION (1,2,3,...), not the PO Number text — two line items can legitimately
// share the same real PO Number (e.g. split shipments), and keying by that text would make
// checking/unchecking one row affect every other row with the same PO Number.
// rowKey numbering matches the per-asin order used in the SKU Detail "Active Purchase Orders"
// table (and its "PO-N" fallback label) so checkbox state lines up with what the user sees there.
function buildOpenPoMap(rows, poSelection) {
  if (!rows || !rows.length) return {};
  const get = makeGet(rows);
  const map = {};
  const asinIdx = {};
  rows.forEach(r => {
    const asin   = s(r, get, "ASIN", "asin");
    const status = s(r, get, "Status", "status").toLowerCase().trim();
    if (!asin) return;
    if (status === "delivered") return;
    const rowKey = (asinIdx[asin] = (asinIdx[asin]||0) + 1);
    const qty = n(r, get, "Tr Qty", "tr qty", "Qty", "qty", "Quantity", "quantity");
    if (qty <= 0) return;
    const included = poSelection?.[asin]?.[rowKey] !== false;
    if (!included) return;
    map[asin] = (map[asin] || 0) + qty;
  });
  return map;
}

/* ═══════════════════════════════════════════════════════════════
   VELOCITY ENGINE — FIXED
   • Uses anchorDate (= maxDate from orders) instead of today
   • Pure averages: avg7=d7/7, avg14=d14/14, avg30=d30/30 — no multipliers
   • Window: anchor-29 to anchor = 30 days (matches Excel >= maxDate-29)
═══════════════════════════════════════════════════════════════ */
function calcVelocity(asin, salesByAsinDay, anchorDate) {
  const data = salesByAsinDay[asin] || {};
  const anchor = anchorDate || getToday();

  let d7=0, d14=0, d30=0;
  for(let i=0; i<30; i++){
    const d=new Date(anchor); d.setDate(d.getDate()-i);
    const {sold=0} = data[localKey(d)] || {};
    if(i<7)  d7  += sold;
    if(i<14) d14 += sold;
    d30 += sold;
  }
  // Pure division — matches Excel's (7d/7), (14d/14), (30d/30)
  const avg7  = d7  / 7;
  const avg14 = d14 / 14;
  const avg30 = d30 / 30;
  const demand = avg7*0.5 + avg14*0.3 + avg30*0.2;
  return { avg7, avg14, avg30, demand, raw7:d7, raw14:d14, raw30:d30 };
}

/* ═══════════════════════════════════════════════════════════════
   TREND ENGINE — compares avg7 vs avg30 to classify momentum
═══════════════════════════════════════════════════════════════ */
function calcTrend(avg7, avg30) {
  if (avg7 === 0 && avg30 === 0) return "—";
  if (avg7 === 0) return "▼▼ Strong Down";
  if (avg30 === 0) return "▲▲ Strong Up";
  const ratio = avg7 / avg30;
  if (ratio > 1.2)   return "▲▲ Strong Up";
  if (ratio > 1.1)   return "▲ Rising";
  if (ratio > 1.05)  return "↗ Slight Up";
  if (ratio >= 0.95) return "→ Stable";
  if (ratio >= 0.85) return "↘ Slight Down";
  if (ratio >= 0.6)  return "▼ Falling";
  return "▼▼ Strong Down";
}
// LOGO_ICON, NAV_ICONS moved to ./data/icons.jsx

function trendColor(trend, t) {
  if (trend.includes("▲")) return t.green;
  if (trend.includes("↗")) return t.green;
  if (trend.includes("→")) return t.text2;
  if (trend.includes("↘")) return t.yellow;
  if (trend.includes("▼▼")) return t.red;
  if (trend.includes("▼")) return t.yellow;
  return t.text3;
}

/* ═══════════════════════════════════════════════════════════════
   PLANNING ENGINE
═══════════════════════════════════════════════════════════════ */
function calcPlanning(inv, vel, settings) {
  const {totalLeadTime:addLT, safetyDays:saf, fbaCoverDays:fcd} = settings;
  const {demand} = vel;
  const cs = inv.currentStock;
  const inb = inv.inbound || 0;
  const doi = demand>0 ? cs/demand : Infinity;
  const anchor = inv._anchor || getToday();
  const stockoutDate = demand>0 ? new Date(anchor.getTime()+doi*86400000) : null;
  // Per-SKU lead times from ltData; fall back to addLT as total if no file data
  const seaLT = inv._seaLT != null ? inv._seaLT + addLT : addLT;
  const airLT = inv._airLT != null ? inv._airLT + addLT : Math.max(1, Math.round(seaLT * 0.35));
  // Reorder threshold = sea lead time + safety stock days
  const reorderThreshold = seaLT + saf;
  const required = demand * reorderThreshold;
  const gap = Math.max(0, reorderThreshold - doi);
  const netReq = gap * demand;
  const suggestedBuy = Math.round(netReq);
  // Deduct already-purchased units (on-order PO) from net requirement
  const poUnitsVal = inv._poUnits || 0;
  const adjustedBuy = Math.max(0, suggestedBuy - poUnitsVal);
  const adjustedNetReq = Math.max(0, netReq - poUnitsVal);
  // Shipment split: air bridges gap before sea arrives, sea covers the rest
  // If stockout happens before sea ETA → need air to cover (seaLT - airLT) day window
  const seaETA = seaLT; // days from now
  const stockDaysLeft = isFinite(doi) ? doi : seaETA + 1;
  const needsAir = demand > 0 && stockDaysLeft < seaETA;
  const airWindowDays = needsAir ? Math.max(0, seaETA - Math.max(stockDaysLeft, airLT)) : 0;
  const airQtyRec = Math.round(airWindowDays * demand);
  const seaQtyRec = Math.max(0, suggestedBuy - airQtyRec);
  const targetFBA = demand*fcd;
  const rawFba = inv._rawFbaAvailable ?? inv.fbaAvailable;
  const replenishQty = Math.max(0, Math.ceil(targetFBA-rawFba));
  const urgency = doi<0?2:doi<saf?2:doi<reorderThreshold?1.5:1;
  const rawPriority = Math.min(9999,Math.max(0,(reorderThreshold-doi))*demand*urgency*(adjustedBuy>0?1:0.15));
  let action="OK", priority="low";
  if(demand>0&&cs<=0){action="STOCKOUT";priority="critical";}
  else if(demand>0&&isFinite(doi)&&doi<=saf){action="SAFETY STOCK BREACH";priority="critical";}
  else if(doi<reorderThreshold*0.25&&adjustedBuy>0){action="REPLENISH FBA";priority="critical";}
  else if(doi<reorderThreshold&&adjustedBuy>0){action="PURCHASE REQUIRED";priority="high";}
  else if(adjustedBuy===0&&suggestedBuy>0){action="PO PLACED";priority="low";}
  else if(inb>required*0.6&&doi>reorderThreshold){action="HOLD";priority="low";}
  else if(doi>reorderThreshold*3&&reorderThreshold>0){action="OVERSTOCK";priority="low";}
  const purchasePct = (demand>0 && doi<reorderThreshold && reorderThreshold>0 && adjustedBuy>0)
    ? Math.min(100, Math.round((reorderThreshold-Math.max(0,doi))/reorderThreshold*100)) : 0;
  const replenishPct = (targetFBA>0 && replenishQty>0)
    ? Math.min(100, Math.round(replenishQty/targetFBA*100)) : 0;
  // ── Include-PO forecast add-on ──────────────────────────────────
  // Purely additive: doi/stockoutDate/suggestedBuy/action above are untouched
  // (still "actual stock" only). These extra fields fold PO qty (manual
  // "Purchased Units" + auto open-PO rows) into stock ONLY for forecasting
  // display — gated by settings.inclPO, off by default.
  const poStockQty = inv._poForecastQty || 0;
  const csWithPO = cs + poStockQty;
  const doiWithPO = demand>0 ? csWithPO/demand : Infinity;
  const stockoutDateWithPO = demand>0 ? new Date(anchor.getTime()+doiWithPO*86400000) : null;
  return {doi,stockoutDate,requiredStock:required,netRequirement:adjustedNetReq,
    suggestedPurchase:adjustedBuy,rawSuggestedPurchase:suggestedBuy,poUnits:poUnitsVal,
    airQtyRec,seaQtyRec,needsAir,seaLT,airLT,
    replenishQty,targetFBA,reorderStock:required,
    action,priority,rawPriority,displayScore:0,purchasePct,replenishPct,
    poStockQty,doiWithPO,stockoutDateWithPO};
}

/* ═══════════════════════════════════════════════════════════════
   FC PLANNING
═══════════════════════════════════════════════════════════════ */
function calcFCPlanning(asin, fcData, vel, settings) {
  if (!fcData||!fcData[asin]) return null;
  const {fcStock,fcDemand,fcUnsellable,fcInTransit}=fcData[asin];
  const allFCs=[...new Set([...Object.keys(fcStock),...Object.keys(fcDemand),...Object.keys(fcUnsellable),...Object.keys(fcInTransit)])].sort();
  const threshold=settings.fbaCoverDays||settings.safetyDays||14;
  const fcs=allFCs.map(fc=>{
    const stock=fcStock[fc]||0;
    const demand=fcDemand[fc]||0;
    const unsellable=fcUnsellable[fc]||0;
    const inTransit=fcInTransit[fc]||0;
    const doi=demand>0?stock/demand:Infinity;
    let status="ok";
    if(demand===0&&stock===0) status="ok";
    else if(stock===0&&demand>0) status="stockout";
    else if(isFinite(doi)&&doi<threshold/2) status="critical";
    else if(isFinite(doi)&&doi<threshold) status="low";
    else if(demand>0&&isFinite(doi)&&doi>threshold*4) status="surplus";
    return {fc,stock,demand:+demand.toFixed(2),unsellable,inTransit,doi,status,label:fcLabel(fc)};
  });
  const needy=fcs.filter(f=>f.status==="stockout"||f.status==="critical"||f.status==="low");
  const recommendations=needy.map(nf=>{
    const needed=nf.demand>0?Math.ceil(nf.demand*threshold)-nf.stock:0;
    return {fc:nf.fc,label:nf.label,needed:Math.max(0,needed),status:nf.status,doi:nf.doi,demand:nf.demand};
  }).filter(r=>r.needed>0);
  return {fcs,recommendations,threshold};
}

/* ═══════════════════════════════════════════════════════════════
   FORECAST — FIXED: uses anchorDate as today
═══════════════════════════════════════════════════════════════ */
function buildForecast(cs, demand, anchorDate, days=70){
  const today = anchorDate || getToday();
  let stock=cs;
  const pts=[];
  for(let i=0;i<=days;i++){
    const d=new Date(today); d.setDate(d.getDate()+i);
    pts.push({day:i,date:d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"}),stock:Math.max(0,Math.round(stock))});
    stock-=demand;
  }
  return pts;
}

/* ═══════════════════════════════════════════════════════════════
   MASTER COMPUTE — FIXED
   • Passes anchorDate through all velocity/forecast calls
   • Attaches regionalSales to each SKU
═══════════════════════════════════════════════════════════════ */
function computeAll(inv, salesByAsinDay, fcData, settings, anchorDate, regionalSales, citySales, ltData, poUnits, lastOrderDate, salesByAsinDayChart, openPoMap, skuCfg, extraInbound){
  const res={};
  // Stock inclusion flags
  const inclFBA      = settings.inclFBA      !== false;
  const inclFC       = settings.inclFC       !== false;
  const inclInbound  = settings.inclInbound  !== false;
  const inclTransfer = settings.inclTransfer !== false;
  const inclPO       = settings.inclPO       === true; // opt-in, default off
  Object.keys(inv).forEach(asin=>{
    const d = inv[asin];
    const vel = calcVelocity(asin, salesByAsinDay, anchorDate);
    // Centralized effective stock — only affects planning/DOI/forecast, not FC breakdown
    // File-derived inbound (Inbound column + 80% of Processing) — gated by the
    // "Include Inbound" checkbox in the settings bar.
    // The manual "Add Inbound" field (Recommended Actions) is deliberately NOT
    // gated: it's a last-minute planning override the user types in by hand, so
    // it always folds into planning stock even when Include Inbound is off
    // (e.g. drop the file's stale 2000 inbound, hand-enter the 1000 actually
    // going out). Only affects effectiveStock / DOI / forecast — never velocity.
    const manualInboundQty = extraInbound?.[asin] ?? 0;
    const fileInboundUnits = (d.inbound||0) + (d.processing||0)*0.8;
    // On Hand = FBA Available + FC Transfer; toggle FC Transfer in/out
    const fbaStock      = inclFBA      ? (d.fbaAvailable||0) : 0;
    const transferStock = inclTransfer ? (d.fcTransfer||0)   : 0;
    const fcStock    = inclFC      ? (d.fcSellable||0) : 0;
    const inbStock   = (inclInbound ? fileInboundUnits : 0) + manualInboundQty;
    const effectiveStock = fbaStock + transferStock + fcStock + inbStock;
    // effectiveFBA for replenishQty calc
    const effectiveFBA = fbaStock + transferStock;
    // ── Priority (manual) demand override — opt-in per SKU via SKU Manager ──
    // When set, fully replaces the computed weighted-average demand (can raise
    // OR lower it) for purchase qty, replenishment qty, DOI and stockout date.
    // Trend/velocity stats (avg7/avg14/avg30) stay untouched — actual history.
    // Unset (default) = weighted average, unchanged from before.
    const priorityDemand = Number(skuCfg?.[asin]?.priorityDemand) || 0;
    const effDemand = priorityDemand > 0 ? priorityDemand : vel.demand;
    const effVel = effDemand !== vel.demand ? { ...vel, demand: effDemand } : vel;
    // ── Include-PO forecast add-on — opt-in via settings.inclPO ──
    // Manual "Purchased Units" entry + auto-detected open PO rows, folded into
    // stock ONLY for the forecast/DOI/stockout-date fields below (see calcPlanning).
    const manualPoQty = poUnits?.[asin] ?? 0;
    const autoPoQty = openPoMap?.[asin] ?? 0;
    const poForecastQty = inclPO ? (manualPoQty + autoPoQty) : 0;
    const invWithAnchor = { ...d, _anchor: anchorDate, currentStock: effectiveStock, fbaAvailable: effectiveFBA,
      _rawFbaAvailable: d.fbaAvailable||0,
      _seaLT: ltData?.[asin]?.sea?.transitDays ?? null,
      _airLT: ltData?.[asin]?.air?.transitDays ?? null,
      _poUnits: poForecastQty, // manual Purchased Units + open POs, only when Include PO is on (matches SKU detail)
      _poForecastQty: poForecastQty,
    };
    const planning = calcPlanning(invWithAnchor, effVel, settings);
    const forecast = buildForecast(effectiveStock, effDemand, anchorDate);
    const forecastWithPO = poForecastQty>0 ? buildForecast(effectiveStock+poForecastQty, effDemand, anchorDate) : forecast;
    const fcPlanning = calcFCPlanning(asin, fcData, vel, settings);
    const defaultTransitDays = ltData?.[asin]?.transitDays ?? null;
    const skuSeaLT = ltData?.[asin]?.sea?.transitDays ?? null;
    const skuAirLT = ltData?.[asin]?.air?.transitDays ?? null;
    const salesHistory = [];
    for(let i=29;i>=0;i--){
      const dt = new Date(anchorDate || getToday());
      dt.setDate(dt.getDate()-i);
      const key = localKey(dt);
      salesHistory.push({date:key, units: (salesByAsinDayChart||salesByAsinDay)[asin]?.[key]?.sold || 0});
    }
    res[asin]={
      ...inv[asin], velocity:vel, planning, forecast, forecastWithPO, fcPlanning,
      effectiveStock, // toggle-aware planning stock (FBA/FC/Transfer/Inbound per settings + manual Add Inbound)
      hasFCData:!!fcData[asin],
      defaultTransitDays,
      skuSeaLT, skuAirLT,
      purchasedUnits: poUnits?.[asin] ?? 0,
      openPoQty: autoPoQty,
      extraInboundUnits: manualInboundQty,
      priorityDemand: priorityDemand>0 ? priorityDemand : null,
      effectiveDemand: effDemand,
      regionalSales: regionalSales?.[asin] || {},
      citySales: citySales?.[asin] || {},
      _lastOrderDate: lastOrderDate?.[asin] ?? null,
      salesHistory,
    };
  });
  const maxRaw=Object.values(res).reduce((m,d)=>Math.max(m,d.planning.rawPriority),0);
  Object.values(res).forEach(d=>{
    d.planning.displayScore=maxRaw>0?Math.round((d.planning.rawPriority/maxRaw)*100):0;
  });
  return res;
}

/* ═══════════════════════════════════════════════════════════════
   THEMES (moved to ./data/themes.js)
═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   SHARED SMALL COMPONENTS
═══════════════════════════════════════════════════════════════ */
function sentence(s){
  if(!s) return s;
  const l=String(s).toLowerCase();
  return (l.charAt(0).toUpperCase()+l.slice(1)).replace(/\b(fba|fc|po|doi|lis|sku|asin|ok)\b/gi,m=>m.toUpperCase());
}
function PBadge({action,priority,purchasePct=0,replenishPct=0,t}){
  // Colour by urgency % — applied to text only, not badge background
  function pctColor(pct){
    if(!t) return undefined;
    if(pct>=76) return t.red;
    if(pct>=51) return t.orange;
    if(pct>=26) return t.yellow;
    return t.green;
  }
  const containerC=priority==="critical"?"br":priority==="high"?"by":action==="OVERSTOCK"||action==="HOLD"?"bb":"bg";
  // Combined badge: both signals active
  const isCombined = purchasePct>0 && replenishPct>0 &&
    (action==="PURCHASE REQUIRED"||action==="REPLENISH FBA"||action==="STOCKOUT");
  if(isCombined){
    const purchaseFirst = purchasePct >= replenishPct;
    const pWord=<span>Purchase</span>;
    const rWord=<span>Replenish</span>;
    const title=`Purchase: ${purchasePct}% · Replenish: ${replenishPct}%`;
    return(
      <span className={`badge ${containerC}`} title={title} style={{gap:6}}>
        {purchaseFirst?pWord:rWord}
        <span style={{opacity:.55}}> + </span>
        {purchaseFirst?rWord:pWord}
      </span>
    );
  }
  // Single badge — colour only the action text by its own %
  const singlePct  = purchasePct||replenishPct;
  const textColor  = singlePct>0&&t ? pctColor(singlePct) : undefined;
  const dotC=priority==="critical"?"r":priority==="high"?"y":action==="OVERSTOCK"||action==="HOLD"?"b":"g";
  return<span className={`badge ${containerC}`}><span className={`dot ${dotC}`}></span><span>{sentence(action||"OK")}</span></span>;
}
function DOI({doi,t}){
  if(!isFinite(doi)||doi>999)return<span style={{color:t.green}}>∞</span>;
  const col=doi<7?t.red:doi<21?t.yellow:t.green;
  return<span style={{color:col,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>{fmt(doi,1)}d</span>;
}
// Trend keeps its arrows (coloured) and sits in the same pill shape as every status
function TrendLabel({trend,t,size=12}){
  if(!trend||trend==="—") return<span style={{color:t.text3,fontSize:size}}>—</span>;
  const m=String(trend).match(/^(\S+)\s+(.*)$/);
  const glyph=m?m[1]:"", label=m?m[2]:trend;
  return<span className="badge nodot" style={{["--bc" as any]:trendColor(trend,t)}}>
    {glyph&&<span className="tg">{glyph}</span>}{label}
  </span>;
}
function TrendBadge({avg7,avg30,t}){
  return<TrendLabel trend={calcTrend(avg7,avg30)} t={t} size={12}/>;
}

function DropZone({label,sub,onFile,loaded,fileName}){
  const[drag,setDrag]=useState(false);const ref=useRef();
  return loaded?(
    <div className="floaded">✓<span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fileName}</span>
      <span style={{cursor:"pointer",opacity:.5,fontSize:13}} onClick={()=>onFile(null)}>✕</span>
    </div>
  ):(
    <div className={`fdrop${drag?" drag":""}`}
      onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);onFile(e.dataTransfer.files[0])}}
      onClick={()=>ref.current.click()}>
      <input ref={ref} type="file" accept=".csv,.tsv,.txt" style={{display:"none"}} onChange={e=>onFile(e.target.files[0])}/>
      <div style={{fontSize:11,fontFamily:"'Instrument Sans',system-ui,sans-serif",color:"inherit",marginBottom:6,opacity:.6}}>Upload</div>
      <div style={{fontWeight:700,marginBottom:2}}>{label}</div>
      <div style={{fontSize:9}}>{sub}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INDIA DEMAND + STOCK HEATMAP
═══════════════════════════════════════════════════════════════ */
// Green → Yellow-green → Amber → Orange → Red based on demand intensity
function heatColor(intensity) {
  const stops = [
    {r:39,  g:174, b:96 },  // 0.00 — green   (low demand)
    {r:168, g:208, b:141},  // 0.25 — yellow-green
    {r:241, g:196, b:15 },  // 0.50 — amber
    {r:230, g:126, b:34 },  // 0.75 — orange
    {r:192, g:57,  b:43 },  // 1.00 — red     (peak demand)
  ];
  const t = Math.min(1, Math.max(0, intensity)) * (stops.length - 1);
  const i = Math.floor(t), f = t - i;
  const a = stops[Math.min(i, stops.length-1)];
  const b = stops[Math.min(i+1, stops.length-1)];
  return { r: Math.round(a.r+(b.r-a.r)*f), g: Math.round(a.g+(b.g-a.g)*f), b: Math.round(a.b+(b.b-a.b)*f) };
}
function rgba(rg, alpha) { return `rgba(${rg.r},${rg.g},${rg.b},${alpha})`; }
function hexish(rg) { return `rgb(${rg.r},${rg.g},${rg.b})`; }

function IndiaHeatmap({ regionalSales, fcPlanning, settings, velocity, t }) {
  const REGIONS = ["North","West","Central","East","South"];
  const reg = regionalSales || {};
  const totalUnits = REGIONS.reduce((s,r)=>s+(reg[r]||0),0);
  const unknownUnits = reg["Unknown"]||0;
  const coverDays = settings?.fbaCoverDays || 30;
  const totalDemandPerDay = velocity?.demand || 0;

  const regionStock = {};
  if (fcPlanning?.fcs) {
    fcPlanning.fcs.forEach(fc => {
      const region = FC_REGION[fc.fc];
      if (region) regionStock[region] = (regionStock[region]||0) + fc.stock;
    });
  }
  const hasStock = Object.keys(regionStock).length > 0;
  const pct = r => totalUnits > 0 ? Math.round((reg[r]||0) / totalUnits * 100) : 0;

  if (totalUnits === 0 && !hasStock) {
    return (
      <div style={{padding:"18px 0",textAlign:"center",fontSize:11,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
        No regional data — ship-state column not found in orders CSV
      </div>
    );
  }

  /* Status palette — meaning lives in the dot only */
  const STATUS = {
    STOCKOUT: { label:"Stockout", c:t.red },
    CRITICAL: { label:"Critical", c:t.red },
    LOW:      { label:"At risk",  c:t.orange },
    HEALTHY:  { label:"Healthy",  c:t.green },
    SURPLUS:  { label:"Surplus",  c:t.text2 },
    NONE:     { label:"No data",  c:t.text3 },
  };

  function RegBlock({ region }) {
    const demand30 = reg[region] || 0;
    const stock    = regionStock[region] || 0;
    const p        = pct(region);

    const regionShare        = totalUnits > 0 ? demand30 / totalUnits : 0;
    const regionDemandPerDay = totalDemandPerDay * regionShare;
    const targetStock        = Math.round(regionDemandPerDay * coverDays);
    const doi                = regionDemandPerDay > 0 ? stock / regionDemandPerDay : null;
    const coveragePct        = targetStock > 0 ? Math.round(stock / targetStock * 100) : null;
    const barFill            = targetStock > 0 ? Math.min(100, Math.round(stock / targetStock * 100)) : 0;
    const gap                = hasStock && targetStock > 0 ? targetStock - stock : null;
    const hasBothData        = demand30 > 0 && hasStock;

    /* Pick status */
    let st = STATUS.NONE;
    if (demand30 === 0 && stock === 0) {
      st = STATUS.NONE;
    } else if (hasStock && stock === 0 && demand30 > 0) {
      st = STATUS.STOCKOUT;
    } else if (hasStock && coveragePct !== null && coveragePct < 60) {
      st = STATUS.CRITICAL;
    } else if (hasStock && coveragePct !== null && coveragePct < 90) {
      st = STATUS.LOW;
    } else if (hasStock && coveragePct !== null && coveragePct <= 130) {
      st = STATUS.HEALTHY;
    } else if (hasStock && (coveragePct === null || coveragePct > 130)) {
      st = st = STATUS.SURPLUS;
    }

    const MONO = "'IBM Plex Mono',ui-monospace,Consolas,monospace";
    return (
      <div style={{
        background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 12,
        padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <span style={{fontSize:15,fontWeight:600,color:t.text}}>{region}</span>
          <span className="badge" style={{["--bc" as any]:st.c}}>{st.label}</span>
        </div>

        <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:28,fontWeight:600,fontFamily:MONO,color:t.text,lineHeight:1,letterSpacing:"-.5px"}}>{fmt(demand30)}</span>
          <span style={{fontSize:12.5,color:t.text3}}>units demand · {p}% of total</span>
        </div>

        {hasStock && (
          <div style={{fontSize:13,color:t.text2}}>
            <strong style={{color:stock>0?t.text:t.red,fontWeight:700}}>{fmt(stock)}</strong> in stock
            {targetStock > 0 && <> of <strong style={{color:t.text,fontWeight:700}}>{fmt(targetStock)}</strong> target</>}
            {doi !== null && <span style={{color:t.text3}}> · {fmt(doi,1)}d cover</span>}
          </div>
        )}

        {hasStock && targetStock > 0 && (
          <div>
            <div style={{height:6,background:t.border,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:barFill+"%",background:st.c,borderRadius:3,transition:"width .4s ease"}}/>
            </div>
            <div style={{fontSize:12,color:t.text3,marginTop:6}}>{coveragePct}% of target</div>
          </div>
        )}

        {hasBothData && gap !== null && (
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:10,borderTop:`1px solid ${t.border}`,marginTop:"auto",fontSize:13}}>
            <span style={{color:t.text3}}>{gap > 0 ? "Shortfall" : "Excess"}</span>
            <strong style={{color:gap > 0 ? t.text : t.text2,fontWeight:700}}>
              {gap > 0 ? `Send ${fmt(gap)} units` : `${fmt(Math.abs(gap))} units`}
            </strong>
          </div>
        )}

        {!hasStock && demand30 > 0 && (
          <div style={{fontSize:12,color:t.text3,paddingTop:8,borderTop:`1px solid ${t.border}`}}>
            Upload Ledger CSV to see FC stock and gap
          </div>
        )}
      </div>
    );
  }

  /* ── Legend ── */
  const legendItems = [
    {label:"Stockout / critical",    c:t.red},
    {label:"At risk, 60–90% of target", c:t.orange},
    {label:"Healthy, 90–130%",       c:t.green},
    {label:"Surplus, over 130%",     c:t.text2},
  ];

  return (
    <div>
      <div style={{display:"flex",gap:"6px 18px",marginBottom:12,flexWrap:"wrap",alignItems:"center",fontSize:12.5,color:t.text2}}>
        {legendItems.map(l=>(
          <span key={l.label} style={{display:"inline-flex",alignItems:"center",gap:7}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:l.c,flexShrink:0}}/>
            {l.label}
          </span>
        ))}
        <span style={{marginLeft:"auto",color:t.text3}}>
          target = demand/day × <strong style={{color:t.text}}>{coverDays}d</strong> cover
        </span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10,marginBottom:10}}>
        <RegBlock region="North"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,marginBottom:10}}>
        <RegBlock region="West"/>
        <RegBlock region="Central"/>
        <RegBlock region="East"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
        <RegBlock region="South"/>
      </div>

      <div style={{marginTop:12,fontSize:12,color:t.text3,display:"flex",gap:"4px 14px",flexWrap:"wrap"}}>
        <span>Total demand: {fmt(totalUnits)} units (30d)</span>
        {unknownUnits > 0 && <span>Unclassified: {fmt(unknownUnits)} units</span>}
        {!hasStock && <span style={{color:t.orange}}>Upload Ledger to enable stock and gap analysis</span>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DATA INPUT
═══════════════════════════════════════════════════════════════ */
const DataInput = forwardRef(function DataInput({onLoaded,loading,setLoading,t,parseDebug},ref){
  const[url,setUrl]=useState("https://docs.google.com/spreadsheets/d/1Va-jdWfO2dmO6R-QCnkg9S2YqIWacx9pKfkW3Th-RGw/edit?usp=sharing");
  const[files,setFiles]=useState({inventory:null,orders:null,ledger:null,leadtime:null});
  const[names,setNames]=useState({});
  const[err,setErr]=useState(null);

  const rf=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsText(f);});
  const hf=(k,f)=>{setFiles(p=>({...p,[k]:f}));setNames(p=>({...p,[k]:f?.name||null}));};

  const loadCSV=async()=>{
    if(!files.inventory||!files.orders){setErr("Inventory and Orders CSV files are required");return;}
    setErr(null);setLoading(true);
    try{
      const[it,ot]=await Promise.all([rf(files.inventory),rf(files.orders)]);
      const[ir,or]=await Promise.all([parseCSV(it),parseCSV(ot)]);
      let lr=[];if(files.ledger){try{const lt=await rf(files.ledger);lr=await parseCSV(lt);}catch(_){}}
      let ltr=[];if(files.leadtime){try{const ltt=await rf(files.leadtime);ltr=await parseCSV(ltt);}catch(_){}}
      let purchr=[];if(files.purchases){try{const pt=await rf(files.purchases);purchr=await parseCSV(pt);}catch(_){}}
      const debug={
        invCols:ir[0]?Object.keys(ir[0]):[],
        ordCols:or[0]?Object.keys(or[0]):[],
        ledCols:lr[0]?Object.keys(lr[0]):[],
        ltCols:ltr[0]?Object.keys(ltr[0]):[],
        invRows:ir.length,ordRows:or.length,ledRows:lr.length,ltRows:ltr.length,
      };
      onLoaded({invRows:ir,ordRows:or,ledRows:lr,ltRows:ltr,purchRows:purchr,debug});
    }catch(e){setErr("Parse error: "+e.message);}finally{setLoading(false);}
  };

  const loadSheets=async()=>{
    const id=extractSheetId(url);
    if(!id){setErr("Invalid Google Sheets URL");return;}
    setErr(null);setLoading(true);
    const base=`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=`;
    try{
      const ft=async(tab,required=true,extra="")=>{
        const r=await fetch(base+encodeURIComponent(tab)+extra);
        if(!r.ok){if(!required)return[];throw new Error(`Tab "${tab}" not accessible (HTTP ${r.status})`);}
        const txt=await r.text();
        if(txt.trim().startsWith("<!")){if(!required)return[];throw new Error(`Tab "${tab}" returned HTML — ensure sheet is public`);}
        return parseCSV(txt);
      };
      // Sales is ~5 MB across 36 columns but the app reads only 9 (cols A,C,E,G,L,M,O,Y,Z).
      // Ask Google for just those; if the headers don't match (columns moved), fall back to the full tab.
      const SALES_NEEDED=["amazon-order-id","purchase-date","order-status","sales-channel","sku","asin","quantity","ship-city","ship-state"];
      const fetchSales=async()=>{
        const rows=await ft("Sales",true,"&tq="+encodeURIComponent("select A,C,E,G,L,M,O,Y,Z")).catch(()=>null);
        if(rows&&rows[0]&&SALES_NEEDED.every(k=>k in rows[0])) return rows;
        console.warn("Sales column trim not usable (headers differ) - fetching the full tab");
        return ft("Sales",true);
      };
      const[ir,or,lr,ltr,purchr,fir]=await Promise.all([ft("Inventory",true),fetchSales(),ft("Ledger",false),ft("Leadtime",false),ft("Purchases",false),ft("FBA_Inv",false)]);
      const debug={
        invCols:ir[0]?Object.keys(ir[0]):[],
        ordCols:or[0]?Object.keys(or[0]):[],
        ledCols:lr[0]?Object.keys(lr[0]):[],
        ltCols:ltr[0]?Object.keys(ltr[0]):[],
        invRows:ir.length,ordRows:or.length,ledRows:lr.length,ltRows:ltr.length,
        source:"sheets",
      };
      await new Promise(r=>setTimeout(r,50)); // let the loading screen paint before the heavy parse
      onLoaded({invRows:ir,ordRows:or,ledRows:lr,ltRows:ltr,purchRows:purchr,fbaInvRows:fir,debug});
    }catch(e){setErr("Sheets error: "+e.message);}finally{setLoading(false);}
  };

  useImperativeHandle(ref,()=>({refreshSheets:loadSheets}));

  // Auto-fetch Google Sheets data as soon as the app opens — no manual click needed.
  // The Data Input tab (and this URL field) stays reachable afterwards for manual
  // re-fetching, CSV upload, or troubleshooting; nothing here disables or hides it.
  useEffect(()=>{ loadSheets(); },[]);

  return(
    <div style={{maxWidth:900}}>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:3}}>Load Inventory Data</div>
        <div style={{fontSize:10,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
          Upload CSVs or connect a public Google Sheets document with tabs: Inventory, Sales, Ledger
        </div>
      </div>
      <div className="alert ab" style={{marginBottom:12}}>
        <span>✓</span>
        <span><strong>sales logic:</strong> Counts all orders except Cancelled + Returns · Anchor = latest date in dataset · Pending orders included · </span>
      </div>
      <div className="card" style={{marginBottom:18}}>
        <div className="ch">Google Sheets — Live Connection</div>
        <div style={{fontSize:10,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif",marginBottom:11}}>
          Sheet must be public. Tabs: <strong>Inventory</strong> · <strong>Sales</strong> · <strong>Ledger</strong> (optional) · <strong>Leadtime</strong> (optional)
        </div>
        <div style={{display:"flex",gap:8,marginBottom:9}}>
          <input className="ti" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..."/>
          <button className="btn bp" onClick={loadSheets} disabled={loading}>{loading?"Fetching…":"Connect"}</button>
        </div>
        {extractSheetId(url)&&<div style={{fontSize:9,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>Sheet ID: {extractSheetId(url)}</div>}
      </div>
      <div className="igrid">
        {[{k:"inventory",l:"Inventory",s:"Required · ASIN, SKU, FC Sellable, FBA Available, Inbound"},
          {k:"orders",l:"Orders / Sales",s:"Required · purchase-date, asin, sku, quantity, order-status, ship-state"},
          {k:"ledger",l:"Ledger",s:"Optional · Date, ASIN, Location, Disposition, Ending Warehouse Balance"},
          {k:"leadtime",l:"Lead Time",s:"Optional · ASIN, Mode of shipment, Lead Time (Days), Shipping Time (Days), Customs (Days), Safety Stock (Days)"}].map(({k,l,s})=>(
          <div key={k} className="ic">
            <div className="icl">{l}{(k==="ledger"||k==="leadtime")&&<span style={{fontSize:9,color:t.text3,marginLeft:5}}>Optional</span>}</div>
            <div className="ics">{s}</div>
            <DropZone label={`Drop ${k}.csv`} sub="Drag & drop or click" onFile={f=>hf(k,f)} loaded={!!files[k]} fileName={names[k]}/>
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
        <button className="btn bp" onClick={loadCSV} disabled={loading||!files.inventory||!files.orders}>
          {loading?"Processing…":"▶ Load & Calculate"}</button>
        {(!files.inventory||!files.orders)&&<span style={{fontSize:10,color:t.text3}}>Inventory + Orders required</span>}
      </div>
      {err&&<div className="alert ar" style={{marginTop:10}}><span>⚠</span><span>{err}</span></div>}
      {parseDebug&&<div style={{marginTop:12,background:t.surface,border:`1px solid ${t.border}`,borderRadius:10,padding:12}}>
        <div style={{fontSize:10,fontWeight:700,color:t.text3,textTransform:"uppercase",letterSpacing:".7px",marginBottom:8}}>
          ✅ Parse Result — Columns Detected
        </div>
        {[["Inventory",parseDebug.invCols,parseDebug.invRows],
          ["Sales/Orders",parseDebug.ordCols,parseDebug.ordRows],
          ["Ledger",parseDebug.ledCols,parseDebug.ledRows],
          ["Lead Time",parseDebug.ltCols||[],parseDebug.ltRows||0]].map(([lbl,cols,cnt])=>(
          <div key={lbl} style={{marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:t.accent,marginBottom:3}}>{lbl} — {cnt} rows</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {cols.length===0
                ?<span style={{fontSize:9,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>No data / not loaded</span>
                :cols.map(c=>{
                  const important=["ASIN","FBA Available","FC Sellable","Inbound","order-status","purchase-date","asin","quantity","Location","Disposition","Ending Warehouse Balance","ship-state","ship-city","Mode of shipment","Lead Time (Days)","Shipping Time (Days)","Customs (Days)","Safety Stock (Days)"].includes(c);
                  return<span key={c} style={{fontSize:9,padding:"2px 6px",borderRadius:4,fontFamily:"'Instrument Sans',system-ui,sans-serif",
                    background:important?t.greenBg:t.surface2,color:important?t.green:t.text3,
                    border:`1px solid ${important?t.greenBdr:t.border}`}}>{c}</span>;
                })
              }
            </div>
          </div>
        ))}
        <div style={{fontSize:9,color:t.text3,marginTop:4,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
          Green = key columns. <strong>ship-state</strong> + <strong>ship-city</strong> needed for regional heatmap &amp; city breakdown. <strong>Leadtime</strong> tab needed for Procurement Forecast.
        </div>
      </div>}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SETTINGS BAR — sticky, recalculates on mouse release
═══════════════════════════════════════════════════════════════ */
function SBar({settings,setSettings,t,isTop}){
  const[local,setLocal]=useState(settings);
  useEffect(()=>setLocal(settings),[settings]);
  const onMove=(k,v)=>setLocal(p=>({...p,[k]:v}));
  const onRelease=(k,v)=>setSettings(p=>({...p,[k]:v}));
  const[mOpen,setMOpen]=useState(false); // phones only: the controls are collapsed until opened
  const[showInfo,setShowInfo]=useState(false);
  const[popoverPos,setPopoverPos]=useState({top:0,left:0});
  const infoRef=useRef(null);
  const popoverRef=useRef(null);
  useEffect(()=>{
    if(!showInfo) return;
    const onDocClick=e=>{
      if(infoRef.current?.contains(e.target)) return;
      if(popoverRef.current?.contains(e.target)) return;
      setShowInfo(false);
    };
    document.addEventListener("mousedown",onDocClick);
    return()=>document.removeEventListener("mousedown",onDocClick);
  },[showInfo]);
  // The settings bar has overflow:hidden, so a normal absolutely-positioned popover
  // gets clipped by it. Instead, render the popover into document.body (portal) with
  // fixed positioning computed from the icon's actual screen location — placed to
  // its right, flipping to the left if it would run off the right edge of the window.
  function toggleInfo(){
    if(!showInfo && infoRef.current){
      const rect = infoRef.current.getBoundingClientRect();
      const width = 300;
      const overflowsRight = rect.right + 10 + width > window.innerWidth;
      setPopoverPos({
        top: rect.top + rect.height/2,
        left: overflowsRight ? rect.left - 10 - width : rect.right + 10,
      });
    }
    setShowInfo(v=>!v);
  }
  const sliders=[
    ["totalLeadTime","Additional Lead Time",0,60,"d","Extra buffer days added on top of Excel lead time (default 0)"],
    ["safetyDays","Safety Stock",0,100,"d","Trigger reorder when remaining stock falls below this many days"],
    ["fbaCoverDays","FBA Cover Days",0,100,"d","Target days of stock to keep in FBA"],
  ];
  return(
    <div className={`sbar${isTop?" sbar-top":""}${mOpen?" m-open":""}`}>
      <button type="button" className="sbar-toggle" onClick={()=>setMOpen(v=>!v)} aria-expanded={mOpen} aria-label={mOpen?"Hide controls":"Show controls"}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {mOpen?<polyline points="4,11.5 9,6.5 14,11.5"/>:<polyline points="4,6.5 9,11.5 14,6.5"/>}
        </svg>
        <span>{mOpen?"Hide controls":"Controls"}</span>
      </button>
      <div className="sg">
        {sliders.map(([k,l,min,max,unit,tip])=>(
          <div key={k} className="slg">
            <label title={tip}>{l}<span>{local[k]}{unit}</span></label>
            <input type="range" min={min} max={max} value={local[k]}
              onChange={e=>onMove(k,+e.target.value)}
              onMouseUp={e=>onRelease(k,+e.target.value)}
              onTouchEnd={e=>onRelease(k,+e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="sbar-info" style={{display:"flex",alignItems:"center",flexWrap:"wrap"}}>
        <label style={{cursor:"pointer",userSelect:"none",display:"inline-flex",alignItems:"center"}}>
          <input type="checkbox"
            checked={local.inclFBA!==false}
            onChange={e=>{const v=e.target.checked;onMove("inclFBA",v);onRelease("inclFBA",v);}}
            style={{marginRight:4,accentColor:"currentColor"}}
          />Include FBA
        </label>
        <label style={{cursor:"pointer",userSelect:"none",display:"inline-flex",alignItems:"center"}}>
          <input type="checkbox"
            checked={local.inclTransfer!==false}
            onChange={e=>{const v=e.target.checked;onMove("inclTransfer",v);onRelease("inclTransfer",v);}}
            style={{marginRight:4,accentColor:"currentColor"}}
          />Include FC Transfer
        </label>
        <label style={{cursor:"pointer",userSelect:"none",display:"inline-flex",alignItems:"center"}}>
          <input type="checkbox"
            checked={local.inclFC!==false}
            onChange={e=>{const v=e.target.checked;onMove("inclFC",v);onRelease("inclFC",v);}}
            style={{marginRight:4,accentColor:"currentColor"}}
          />Include FC
        </label>
        <label style={{cursor:"pointer",userSelect:"none",display:"inline-flex",alignItems:"center"}}>
          <input type="checkbox"
            checked={local.inclInbound!==false}
            onChange={e=>{const v=e.target.checked;onMove("inclInbound",v);onRelease("inclInbound",v);}}
            style={{marginRight:4,accentColor:"currentColor"}}
          />Include Inbound
        </label>
        <label style={{cursor:"pointer",userSelect:"none",display:"inline-flex",alignItems:"center"}} title="Forecast-only: adds Purchased Units + open PO qty to stock for DOI / Stockout Date / the forecast chart. Does not affect purchase suggestions or actual stock figures.">
          <input type="checkbox"
            checked={local.inclPO===true}
            onChange={e=>{const v=e.target.checked;onMove("inclPO",v);onRelease("inclPO",v);}}
            style={{marginRight:4,accentColor:"currentColor"}}
          />Include PO (forecast)
        </label>
        <span ref={infoRef} style={{position:"relative",display:"inline-flex",alignItems:"center",marginLeft:8}}>
          <span
            onClick={toggleInfo}
            title={`Reorder Point: Sea LT + ${local.safetyDays}d safety · Additional Delay: +${local.totalLeadTime}d · Target FBA: ${local.fbaCoverDays}d cover · Demand: weighted avg (7d×0.5 + 14d×0.3 + 30d×0.2)`}
            style={{
              display:"inline-flex",alignItems:"center",justifyContent:"center",
              boxSizing:"border-box",width:16,height:16,lineHeight:1,borderRadius:"50%",
              cursor:"pointer",userSelect:"none",
              fontSize:10,fontWeight:700,color:t.text3,border:`1px solid ${t.border2}`,
              background:showInfo?t.accentBg:"transparent",
            }}
          >i</span>
        </span>
        {showInfo&&createPortal(
          <div ref={popoverRef} style={{
            position:"fixed",top:popoverPos.top,left:popoverPos.left,transform:"translateY(-50%)",zIndex:9999,
            width:300,padding:"10px 12px",borderRadius:8,
            background:t.tooltipBg,border:`1px solid ${t.border}`,
            boxShadow:"0 4px 16px rgba(0,0,0,.18)",fontSize:10,lineHeight:1.7,color:t.text2,
            whiteSpace:"normal",
          }}>
            Reorder Point: <strong style={{color:t.text}}>Sea LT + {local.safetyDays}d safety</strong><br/>
            Additional Delay: <strong style={{color:t.text}}>+{local.totalLeadTime}d</strong><br/>
            Target FBA: <strong style={{color:t.text}}>{local.fbaCoverDays}d cover</strong><br/>
            Demand: weighted avg (7d×0.5 + 14d×0.3 + 30d×0.2)
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════ */
function InventoryHealthBar({skus, t}) {
  const total = skus.length || 1;
  const data = [
    {label:"Critical",      count:skus.filter(d=>d.planning.priority==="critical").length,                                           color:t.red},
    {label:"High Priority", count:skus.filter(d=>d.planning.priority==="high"&&d.planning.action!=="OVERSTOCK").length,              color:t.yellow},
    {label:"Healthy",       count:skus.filter(d=>d.planning.priority==="low"&&d.planning.action!=="OVERSTOCK"&&d.velocity.demand>0).length, color:t.green},
    {label:"Overstock",     count:skus.filter(d=>d.planning.action==="OVERSTOCK").length,                                           color:t.purple},
    {label:"No Demand",     count:skus.filter(d=>d.velocity.demand===0).length,                                                     color:t.text3},
  ].filter(d=>d.count>0);

  return(
    <div>
      <DeferredChart h={180} delay={0}><ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" margin={{top:4,right:50,left:0,bottom:4}}>
          <CartesianGrid strokeDasharray="2 4" stroke={t.border} horizontal={false}/>
          <XAxis type="number" tick={{fill:t.text3,fontSize:11}} axisLine={false} tickLine={false}/>
          <YAxis type="category" dataKey="label" width={90} tick={{fill:t.text2,fontSize:11,fontFamily:"'Instrument Sans',system-ui,sans-serif"}} axisLine={false} tickLine={false}/>
          <Tooltip
            labelStyle={{color:t.text,fontWeight:600}} itemStyle={{color:t.text2}} contentStyle={{color:t.text,background:t.tooltipBg,border:`1px solid ${t.border}`,borderRadius:8,fontSize:12,fontFamily:"'Instrument Sans',system-ui,sans-serif",boxShadow:"0 4px 12px rgba(0,0,0,.08)"}}
            formatter={(v,_,{payload})=>[`${v} SKUs (${Math.round(v/total*100)}%)`,payload.label]}
            cursor={{fill:`${t.accent}08`}}
          />
          <Bar dataKey="count" radius={[0,4,4,0]} maxBarSize={20} isAnimationActive={false}>
            {data.map((d,i)=><Cell key={i} fill={d.color} fillOpacity={.82}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer></DeferredChart>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:4}}>
        {data.map(d=>(
          <span key={d.label} style={{display:"flex",alignItems:"center",gap:4,fontSize:9,fontFamily:"'Instrument Sans',system-ui,sans-serif",color:t.text3}}>
            <span style={{width:7,height:7,borderRadius:2,background:d.color,display:"inline-block",opacity:.85}}/>
            {d.label} <strong style={{color:d.color}}>{d.count}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

const DASH_MONO = "'IBM Plex Mono',ui-monospace,Consolas,monospace";

// One quiet list row: label (+sub) · thin bar · value
function DashRow({label, sub, value, frac, color, onClick, t}: any) {
  return (
    <div className={onClick ? "dash-row" : undefined} onClick={onClick}
      style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) minmax(0,1fr) auto",alignItems:"center",gap:14,padding:"9px 8px",borderRadius:8,cursor:onClick?"pointer":undefined}}>
      <div style={{minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
        {sub && <div style={{fontSize:12,color:t.text3,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub}</div>}
      </div>
      <div style={{height:6,background:t.border,borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${Math.max(3,Math.min(100,(frac||0)*100))}%`,height:"100%",background:color,borderRadius:3}}/>
      </div>
      <div style={{fontFamily:DASH_MONO,fontSize:13,fontWeight:600,color:t.text,textAlign:"right",minWidth:56}}>{value}</div>
    </div>
  );
}

function Dashboard({data,settings,setSettings,onSku,t,purchRows}){
  const skus=Object.values(data) as any[];
  const crit=skus.filter(d=>d.planning.priority==="critical").length;
  const high=skus.filter(d=>d.planning.priority==="high").length;
  const stockOf=(d:any)=>d.effectiveStock??d.currentStock;
  const totalStock=skus.reduce((s,d)=>s+stockOf(d),0);
  const totalDemand=skus.reduce((s,d)=>s+d.velocity.demand,0);
  const a7=skus.reduce((s,d)=>s+(d.velocity.avg7||0),0);
  const a30=skus.reduce((s,d)=>s+(d.velocity.avg30||0),0);
  const demandDelta=a30>0?(a7/a30-1)*100:0;
  const netCover=totalDemand>0?totalStock/totalDemand:Infinity;
  const totalTransfer=skus.reduce((s,d)=>s+(d.fcTransfer||0),0);                                              // FBA → FC transfers
  const totalInTransit=skus.reduce((s,d)=>s+(d.fcPlanning?.fcs||[]).reduce((q:number,fc:any)=>q+(fc.inTransit||0),0),0); // on the way to FCs

  // Open POs: units + count, grouped by status
  const poStats=useMemo(()=>{
    const out={units:0,count:0,byStatus:[] as {status:string,units:number,count:number}[]};
    if(!purchRows||!purchRows.length) return out;
    const get=makeGet(purchRows);
    const map:Record<string,{status:string,units:number,count:number}>={};
    purchRows.forEach(r=>{
      const st=s(r,get,"Status","status").trim();
      if(st.toLowerCase()==="delivered") return;
      const qty=Math.max(0,n(r,get,"Tr Qty","tr qty","Qty","qty","Quantity","quantity")||0);
      const k=st||"Unknown";
      (map[k]=map[k]||{status:k,units:0,count:0});
      map[k].units+=qty; map[k].count+=1; out.units+=qty; out.count+=1;
    });
    out.byStatus=Object.values(map).sort((a,b)=>b.units-a.units);
    return out;
  },[purchRows]);

  const [alertSort,setAlertSort]=useState({col:"score",dir:"desc"});
  const alerts=useMemo(()=>{
    const base=skus.filter(d=>d.planning.priority==="critical"||d.planning.priority==="high");
    const {col,dir}=alertSort;
    const m=dir==="asc"?1:-1;
    return base.sort((a,b)=>{
      if(col==="sku") return m*(a.finalName.localeCompare(b.finalName));
      if(col==="doi") return m*((isFinite(a.planning.doi)?a.planning.doi:9999)-(isFinite(b.planning.doi)?b.planning.doi:9999));
      if(col==="stock") return m*(stockOf(a)-stockOf(b));
      if(col==="demand") return m*(a.velocity.demand-b.velocity.demand);
      return m*(b.planning.displayScore-a.planning.displayScore);
    }).slice(0,10);
  },[skus,alertSort]);

  function SortTh({col,label,style={}}){
    const active=alertSort.col===col;
    return(
      <th style={{cursor:"pointer",userSelect:"none",...style}}
        onClick={()=>setAlertSort(s=>({col,dir:s.col===col&&s.dir==="asc"?"desc":"asc"}))}>
        {label}{active?(alertSort.dir==="asc"?" ▲":" ▼"):""}
      </th>
    );
  }

  // Network demand, last 30 days (sum of every SKU's daily units) + 7-day moving average
  const series=useMemo(()=>{
    const N=30, arr=Array.from({length:N},()=>({date:"",units:0}));
    skus.forEach(d=>(d.salesHistory||[]).forEach((h:any,i:number)=>{ if(i<N){ arr[i].date=h.date; arr[i].units+=h.units||0; } }));
    return arr.map((p,i)=>{
      const w=arr.slice(Math.max(0,i-6),i+1);
      return {
        label:p.date?new Date(p.date+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short"}):"",
        units:p.units, avg7:+(w.reduce((s,x)=>s+x.units,0)/w.length).toFixed(1),
      };
    });
  },[skus]);
  const lastAvg=series.length?series[series.length-1].avg7:0;

  // Stock cover buckets (days of inventory, demand > 0 only)
  const buckets=useMemo(()=>{
    const B=[
      {l:"Under 7 days",  c:t.red,    f:(x:number)=>x<7},
      {l:"7 to 21 days",  c:t.orange, f:(x:number)=>x>=7&&x<21},
      {l:"21 to 60 days", c:t.green,  f:(x:number)=>x>=21&&x<60},
      {l:"60 to 120 days",c:t.text2,  f:(x:number)=>x>=60&&x<120},
      {l:"Over 120 days", c:t.text3,  f:(x:number)=>x>=120},
    ];
    const live=skus.filter(d=>d.velocity.demand>0);
    return B.map(b=>({l:b.l,c:b.c,count:live.filter(d=>b.f(isFinite(d.planning.doi)?d.planning.doi:99999)).length}));
  },[skus,t]);
  const maxBucket=Math.max(1,...buckets.map(b=>b.count));

  // Regional demand share vs stock share (the gap is where stock is in the wrong place)
  const regional=useMemo(()=>{
    const R=["North","West","Central","East","South"];
    const dem:Record<string,number>={}, stk:Record<string,number>={};
    skus.forEach(d=>{
      R.forEach(r=>{ dem[r]=(dem[r]||0)+((d.regionalSales||{})[r]||0); });
      (d.fcPlanning?.fcs||[]).forEach((fc:any)=>{ const rg=FC_REGION[fc.fc]; if(rg) stk[rg]=(stk[rg]||0)+(fc.stock||0); });
    });
    const dT=R.reduce((s,r)=>s+(dem[r]||0),0)||1, sT=R.reduce((s,r)=>s+(stk[r]||0),0)||1;
    return R.map(r=>({r,dem:dem[r]||0,stk:stk[r]||0,dShare:Math.round((dem[r]||0)/dT*100),sShare:Math.round((stk[r]||0)/sT*100)}));
  },[skus]);

  const atRisk=useMemo(()=>skus
    .filter(d=>d.velocity.demand>0&&isFinite(d.planning.doi)&&d.planning.doi<9999)
    .sort((a,b)=>a.planning.doi-b.planning.doi).slice(0,7),[skus]);
  const topMovers=useMemo(()=>skus.filter(d=>d.velocity.demand>0)
    .sort((a,b)=>b.velocity.demand-a.velocity.demand).slice(0,7),[skus]);
  const maxMover=Math.max(1,...topMovers.map(d=>d.velocity.demand));

  // Plain-language insights, worst first
  const insights=useMemo(()=>{
    const out:{tone:string,text:any,sub?:string}[]=[];
    const names=(l:any[])=>l.slice(0,3).map(d=>d.finalName).join(", ")+(l.length>3?` +${l.length-3} more`:"");
    const soon=skus.filter(d=>d.velocity.demand>0&&isFinite(d.planning.doi)&&d.planning.doi<14);
    if(soon.length) out.push({tone:"bad",text:<><b>{soon.length} SKU{soon.length>1?"s":""}</b> run out within 14 days</>,sub:names(soon)});
    const accel=skus.filter(d=>d.velocity.demand>0&&d.velocity.avg30>0&&d.velocity.avg7/d.velocity.avg30>1.1&&isFinite(d.planning.doi)&&d.planning.doi<30);
    if(accel.length) out.push({tone:"warn",text:<><b>{accel.length} SKU{accel.length>1?"s":""}</b> speeding up with under 30 days of cover</>,sub:names(accel)});
    const lisList=skus.map(d=>({d,l:calcLIS(d)})).filter((x:any)=>x.l);
    const wSum=lisList.reduce((s:number,x:any)=>s+x.d.velocity.demand,0);
    if(wSum>0){
      const lisW=lisList.reduce((s:number,x:any)=>s+x.d.velocity.demand*x.l.pct,0)/wSum;
      const low=lisList.filter((x:any)=>x.l.pct<50).length;
      out.push({tone:lisW<60?"warn":"info",text:<>Local stock reaches <b>{Math.round(lisW)}%</b> of demand</>,sub:low?`${low} SKU${low>1?"s":""} below 50%`:"Every SKU is at least half covered"});
    }
    const over=skus.filter(d=>d.planning.action==="OVERSTOCK");
    if(over.length) out.push({tone:"info",text:<><b>{over.length} SKU{over.length>1?"s":""}</b> overstocked</>,sub:`${fmt(over.reduce((s:number,d:any)=>s+stockOf(d),0))} units on hand · ${names(over)}`});
    return out;
  },[skus]);
  const toneColor=(k:string)=>k==="bad"?t.red:k==="warn"?t.orange:k==="ok"?t.green:t.text3;
  const tipStyle={color:t.text,background:t.tooltipBg,border:`1px solid ${t.border}`,borderRadius:8,fontSize:12,fontFamily:"'Instrument Sans',system-ui,sans-serif",boxShadow:"0 4px 12px rgba(0,0,0,.12)"};
  const sub12={fontSize:12.5,color:t.text3};

  const kpis=[
    {l:"Daily demand",v:fmt(totalDemand,0),s:a30>0?`${demandDelta>=0?"↗":"↘"} ${Math.abs(demandDelta).toFixed(0)}% last 7d vs 30d`:"units per day",col:t.text},
    {l:"Units in stock",v:fmt(totalStock),s:"FBA + FC + inbound, per toggles",col:t.text},
    {l:"In transit",v:fmt(totalTransfer+totalInTransit),s:`${fmt(totalTransfer)} FC transfer · ${fmt(totalInTransit)} to FCs`,col:t.text},
    {l:"Network cover",v:isFinite(netCover)?`${fmt(netCover,0)}d`:"—",s:"stock at current demand",col:!isFinite(netCover)?t.text:netCover<7?t.red:netCover<21?t.yellow:t.text},
    {l:"Need action",v:crit+high,s:`${crit} critical · ${high} high`,col:crit>0?t.red:high>0?t.yellow:t.text},
    {l:"Open POs",v:poStats.count,s:`${fmt(poStats.units)} units on the way`,col:t.text},
  ];

  return(<div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>

    {/* KPI strip */}
    <div className="kg kg6" style={{marginBottom:12}}>
      {kpis.map(k=>(
        <div key={k.l} className="kc">
          <div className="kl">{k.l}</div>
          <div className="kv" style={{color:k.col}}>{k.v}</div>
          <div className="ks">{k.s}</div>
        </div>
      ))}
    </div>

    {/* Insights + demand trend */}
    <div className="dg a">
      <div className="card">
        <div className="ch">What needs attention</div>
        {insights.length===0?(
          <div style={{...sub12,padding:"6px 0"}}>Nothing urgent. Every SKU has healthy cover.</div>
        ):insights.map((it,i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"11px 0",borderTop:i?`1px solid ${t.border}`:"none"}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:toneColor(it.tone),flexShrink:0,marginTop:6}}/>
            <div style={{minWidth:0}}>
              <div style={{fontSize:14.5,color:t.text,lineHeight:1.4}}>{it.text}</div>
              {it.sub&&<div style={{...sub12,marginTop:2}}>{it.sub}</div>}
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="ch">Network demand, last 30 days</div>
        <div style={{...sub12,marginTop:-6,marginBottom:6}}>Units sold per day across all SKUs · 7-day average now <strong style={{color:t.text}}>{fmt(lastAvg,0)}</strong>/day</div>
        <DeferredChart h={220} delay={0}><ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={series} margin={{top:8,right:8,left:-8,bottom:0}}>
            <defs>
              <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.mode==="light"?"#5b3bd8":t.accent} stopOpacity={.16}/>
                <stop offset="100%" stopColor={t.mode==="light"?"#5b3bd8":t.accent} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke={t.border} vertical={false}/>
            <XAxis dataKey="label" interval={4} tick={{fill:t.text3,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:t.text3,fontSize:11}} axisLine={false} tickLine={false} width={44}/>
            <Tooltip contentStyle={tipStyle} labelStyle={{color:t.text,fontWeight:600}} itemStyle={{color:t.text2}} formatter={(v:any,name:any)=>[`${fmt(v,name==="avg7"?1:0)}`,name==="avg7"?"7-day average":"Units sold"]}/>
            <Area type="monotone" dataKey="units" stroke={t.text3} strokeWidth={1.2} fill="url(#dashArea)" isAnimationActive={false} dot={false}/>
            <Line type="monotone" dataKey="avg7" stroke={t.mode==="light"?"#5b3bd8":t.accent} strokeWidth={2.2} dot={false} isAnimationActive={false}/>
          </ComposedChart>
        </ResponsiveContainer></DeferredChart>
      </div>
    </div>

    {/* Cover, regions, POs */}
    <div className="dg b">
      <div className="card">
        <div className="ch">Stock cover</div>
        <div style={{...sub12,marginTop:-6,marginBottom:8}}>SKUs by days of inventory</div>
        {buckets.map(b=>(
          <DashRow key={b.l} label={b.l} value={b.count} frac={b.count/maxBucket} color={b.c} t={t}/>
        ))}
      </div>

      <div className="card">
        <div className="ch">Demand vs stock by region</div>
        <div style={{display:"flex",gap:16,...sub12,marginTop:-6,marginBottom:6}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:2,background:t.text3}}/>Demand share</span>
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:2,background:t.accent}}/>Stock share</span>
        </div>
        {regional.map(r=>{
          const gapPts=r.sShare-r.dShare;
          return(
            <div key={r.r} style={{padding:"8px 8px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
                <span style={{fontSize:14,fontWeight:600,color:t.text}}>{r.r}</span>
                <span style={{fontSize:12.5,color:gapPts<=-8?t.red:t.text3}}>{r.dShare}% demand · {r.sShare}% stock{gapPts<=-8?` · ${Math.abs(gapPts)} pts short`:""}</span>
              </div>
              <div style={{height:5,background:t.border,borderRadius:3,overflow:"hidden",marginBottom:4}}><div style={{width:`${Math.max(2,r.dShare)}%`,height:"100%",background:t.text3,opacity:.7}}/></div>
              <div style={{height:5,background:t.border,borderRadius:3,overflow:"hidden"}}><div style={{width:`${Math.max(2,r.sShare)}%`,height:"100%",background:t.accent}}/></div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="ch">Open POs by status</div>
        <div style={{...sub12,marginTop:-6,marginBottom:8}}>{fmt(poStats.units)} units across {poStats.count} order{poStats.count===1?"":"s"}</div>
        {poStats.byStatus.length===0?(
          <div style={{...sub12,padding:"6px 8px"}}>No open purchase orders.</div>
        ):poStats.byStatus.map(p=>{
          const c=({"in production":t.text2,"production completed":t.green,"in transit":t.orange,"partially shipped":t.orange} as any)[p.status.toLowerCase()]||t.text3;
          return <DashRow key={p.status} label={p.status} sub={`${p.count} order${p.count===1?"":"s"}`} value={fmt(p.units)} frac={p.units/Math.max(1,poStats.byStatus[0].units)} color={c} t={t}/>;
        })}
      </div>
    </div>

    {/* At risk + top movers */}
    <div className="dg c">
      <div className="card">
        <div className="ch">Most at risk</div>
        <div style={{...sub12,marginTop:-6,marginBottom:6}}>Lowest days of inventory · click to open</div>
        {atRisk.map(d=>(
          <DashRow key={d.asin} label={d.finalName} sub={`Stockout ${fmtDateShort(d.planning.stockoutDate)}`}
            value={`${fmt(d.planning.doi,1)}d`} frac={Math.min(1,d.planning.doi/30)}
            color={d.planning.priority==="critical"?t.red:d.planning.priority==="high"?t.orange:t.green} onClick={()=>onSku(d.asin)} t={t}/>
        ))}
      </div>
      <div className="card">
        <div className="ch">Top movers</div>
        <div style={{...sub12,marginTop:-6,marginBottom:6}}>Highest weighted daily demand · click to open</div>
        {topMovers.map(d=>(
          <DashRow key={d.asin} label={d.finalName}
            sub={<span style={{display:"inline-flex",alignItems:"center",gap:8}}><TrendLabel trend={calcTrend(d.velocity.avg7,d.velocity.avg30)} t={t}/><span>{isFinite(d.planning.doi)?`${fmt(d.planning.doi,0)}d cover`:"no end in sight"}</span></span>}
            value={`${fmt(d.velocity.demand,1)}/d`} frac={d.velocity.demand/maxMover} color={t.accent} onClick={()=>onSku(d.asin)} t={t}/>
        ))}
      </div>
    </div>

    {/* Priority Alerts table */}
    {alerts.length>0&&<div className="card">
      <div className="ch">Priority alerts</div>
      <div className="tw ts"><table>
        <thead><tr>
          <SortTh col="sku" label="SKU" style={{textAlign:"left"}}/>
          <th>ASIN</th>
          <SortTh col="doi" label="DOI"/>
          <SortTh col="stock" label="Stock"/>
          <SortTh col="demand" label="Demand/Day"/>
          <th>7D Total</th><th>Stockout</th><th>Action</th>
        </tr></thead>
        <tbody>{alerts.map(d=>(
          <tr key={d.asin} className="cr" onClick={()=>onSku(d.asin)}>
            <td><div className="tn" title={d.finalName}>{d.finalName}</div><div className="ta" title={d.sellerSku}>{d.sellerSku}</div></td>
            <td className="ta">{d.asin}</td>
            <td><DOI doi={d.planning.doi} t={t}/></td>
            <td>{fmt(stockOf(d))}</td>
            <td>{fmt(d.velocity.demand,2)}</td>
            <td style={{color:t.accent,fontWeight:700}}>{fmt(d.velocity.raw7)}</td>
            <td style={{color:t.red}}>{fmtDateShort(d.planning.stockoutDate)}</td>
            <td><PBadge action={d.planning.action} priority={d.planning.priority} purchasePct={d.planning.purchasePct||0} replenishPct={d.planning.replenishPct||0} t={t}/></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>}
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   ALL SKUs
═══════════════════════════════════════════════════════════════ */
/* LIS (Local In Stock): share of a SKU's demand (by ship-state) whose nearest-FC cluster
   holds stock (>0) right now. Clusters come from STATE_TO_CLUSTER, so states with no FC nearby
   (e.g. the Northeast) count as served by their fallback cluster (CCX1/CCX2). */
function calcLIS(d){
  const cs=d.citySales||{};
  const qtyByCluster={};
  let total=0;
  Object.entries(cs).forEach(([key,qty])=>{
    const ck=clusterForState(key.split("||")[1]);
    if(!ck) return;
    qtyByCluster[ck]=(qtyByCluster[ck]||0)+qty;
    total+=qty;
  });
  if(total<=0||!d.fcPlanning) return null;
  const stock={};
  (d.fcPlanning.fcs||[]).forEach(fc=>{ stock[fc.fc]=fc.stock||0; });
  let inStock=0; const missing=[];
  Object.entries(qtyByCluster).forEach(([ck,qty])=>{
    const has=(CLUSTERS[ck]?.fcs||[]).reduce((n,fc)=>n+(stock[fc]||0),0)>0;
    if(has) inStock+=qty; else missing.push({label:CLUSTERS[ck]?.label||ck,pct:qty/total*100});
  });
  missing.sort((a,b)=>b.pct-a.pct);
  return {pct:inStock/total*100,missing};
}

function AllSKUs({data,settings,setSettings,onSku,t,setPoUnits,setExtraInbound,skuCfg,setSkuCfg}){
  const[q,setQ]=useState(""),[fil,setFil]=useState("all");
  const[sort,setSort]=useState({col:"demand",dir:"desc"});
  const[picked,setPicked]=useState(()=>new Set());
  function togglePick(asin,e){e.stopPropagation();setPicked(prev=>{const nx=new Set(prev);nx.has(asin)?nx.delete(asin):nx.add(asin);return nx;});}
  // Reset just this one SKU's Purchased Units, Priority Demand and Add Inbound
  function resetSku(asin,e){
    e.stopPropagation();
    setPoUnits(asin,"");
    setExtraInbound(asin,"");
    const cur=skuCfg?.[asin]||{active:true};
    const {priorityDemand, ...rest}=cur;
    setSkuCfg({...skuCfg,[asin]:rest});
  }

  function toggleSort(col){
    setSort(s=>({col,dir:s.col===col&&s.dir==="asc"?"desc":"asc"}));
  }
  function SortTh({col,label,style={}}){
    const active=sort.col===col;
    return(
      <th style={{cursor:"pointer",userSelect:"none",...style}}
        onClick={()=>toggleSort(col)}>
        {label}{active?(sort.dir==="asc"?" ▲":" ▼"):""}
      </th>
    );
  }

  // Include PO on → DOI / stockout fold in the units already ordered
  const poOn=settings.inclPO===true;
  const poQtyOf=d=>poOn?(d.planning.poStockQty||0):0;                       // applied to DOI / stockout / buy
  const poAllOf=d=>(d.purchasedUnits||0)+(d.openPoQty||0);                   // shown always
  const doiOf=d=>poQtyOf(d)>0?d.planning.doiWithPO:d.planning.doi;
  const soOf=d=>poQtyOf(d)>0?d.planning.stockoutDateWithPO:d.planning.stockoutDate;
  const stockOf=d=>d.effectiveStock??d.currentStock;

  const lisMap=useMemo(()=>{
    const m={};
    Object.values(data).forEach(d=>{ m[d.asin]=calcLIS(d); });
    return m;
  },[data]);

  const skus=useMemo(()=>{
    const base=Object.values(data)
      .filter(d=>fil==="critical"?d.planning.priority==="critical":fil==="high"?d.planning.priority==="high":fil==="over"?d.planning.action==="OVERSTOCK":fil==="ok"?d.planning.priority==="low":true)
      .filter(d=>!q||d.finalName.toLowerCase().includes(q.toLowerCase())||d.asin.includes(q)||d.sellerSku.toLowerCase().includes(q.toLowerCase()));
    const {col,dir}=sort;
    const m=dir==="asc"?1:-1;
    return base.sort((a,b)=>{
      if(col==="sku")    return m*a.finalName.localeCompare(b.finalName);
      if(col==="stock")  return m*(stockOf(a)-stockOf(b));
      if(col==="fba")    return m*(a.fbaAvailable-b.fbaAvailable);
      if(col==="fc")     return m*(a.fcSellable-b.fcSellable);
      if(col==="demand") return m*(a.velocity.demand-b.velocity.demand);
      if(col==="doi")    return m*((isFinite(doiOf(a))?doiOf(a):99999)-(isFinite(doiOf(b))?doiOf(b):99999));
      if(col==="po")     return m*(poAllOf(a)-poAllOf(b));
      if(col==="buy")    return m*(a.planning.suggestedPurchase-b.planning.suggestedPurchase);
      if(col==="replen") return m*(a.planning.replenishQty-b.planning.replenishQty);
      if(col==="lis")    return m*((lisMap[a.asin]?.pct??-1)-(lisMap[b.asin]?.pct??-1));
      // default: priority score
      return m*(b.planning.displayScore-a.planning.displayScore);
    });
  },[data,q,sort,fil,lisMap,poOn]);

  // Export what's currently on screen (search + filter applied) as CSV.
  // Stock/FBA/FC/FC Transfer/Inbound columns are zeroed to "-" when their
  // "Include ___" checkbox is off, so the export matches what's actually
  // driving DOI/Stockout Date/Buy Qty below — those already reflect the
  // toggles via the planning engine and are exported unchanged.
  function exportCSV(){
    const inclFBA = settings.inclFBA !== false;
    const inclFC = settings.inclFC !== false;
    const inclInbound = settings.inclInbound !== false;
    const inclTransfer = settings.inclTransfer !== false;
    const headers = ["SKU Name","Seller SKU","ASIN","Trend","W.Demand/Day","Stock","FBA","FC","FC Transfer","Inbound","PO units",poOn?"DOI incl. PO (days)":"DOI (days)","Stockout Date","Buy Qty","Replenish Qty","LIS %","Action","Priority"];
    const rows = skus.map(d=>{
      const stock = (inclFBA?d.fbaAvailable||0:0) + (inclTransfer?d.fcTransfer||0:0) + (inclFC?d.fcSellable||0:0) + (inclInbound?(d.inbound||0)+(d.processing||0)*0.8:0);
      return [
        d.finalName, d.sellerSku, d.asin,
        calcTrend(d.velocity.avg7, d.velocity.avg30),
        fmt(d.velocity.demand,2),
        fmt(Math.round(stock)),
        inclFBA ? fmt(d.fbaAvailable) : "-",
        inclFC ? fmt(d.fcSellable) : "-",
        inclTransfer ? fmt(d.fcTransfer) : "-",
        inclInbound ? fmt(d.inbound) : "-",
        poAllOf(d)>0 ? fmt(poAllOf(d)) : "-",
        isFinite(doiOf(d)) ? fmt(doiOf(d),1) : "∞",
        fmtDate(soOf(d)),
        d.planning.suggestedPurchase>0 ? fmt(d.planning.suggestedPurchase) : "-",
        d.planning.replenishQty>0 ? fmt(d.planning.replenishQty) : "-",
        lisMap[d.asin] ? Math.round(lisMap[d.asin].pct) : "-",
        d.planning.action||"OK",
        d.planning.priority||"",
      ];
    });
    downloadCSV(`all_skus_${localKey(getToday())}.csv`, headers, rows);
  }

  return(<div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>
    <div className="card">
      <div className="srow">
        <div className="sbox"><span style={{color:t.text3}}>⌕</span><input placeholder="Name, ASIN, SKU…" value={q} onChange={e=>setQ(e.target.value)}/></div>
        <Select className="sel" value={fil} onChange={e=>setFil(e.target.value)}>
          <option value="all">All SKUs</option><option value="critical">Critical</option>
          <option value="high">High Priority</option><option value="ok">OK</option><option value="over">Overstock</option>
        </Select>
        <button className="btn bx" onClick={exportCSV} title="Exports the rows currently shown, with columns reflecting the Include FBA/FC/Transfer/Inbound toggles above">
          ⬇ Export CSV
        </button>
        {picked.size>0&&<span style={{fontSize:9,color:t.accent,fontFamily:"'Instrument Sans',system-ui,sans-serif",fontWeight:700}}>{picked.size} selected</span>}
        {picked.size>0&&<button className="btn bs" style={{fontSize:10,padding:"4px 9px"}} onClick={()=>setPicked(new Set())}>Deselect All</button>}
        <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>{skus.length}/{Object.keys(data).length}</span>
      </div>
      {picked.size>0&&(
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",padding:"7px 10px",marginBottom:8,background:t.accentBg,border:`1px solid ${t.accentBdr}`,borderRadius:6}}>
          <span style={{fontSize:9,fontWeight:700,color:t.accent,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>Selected:</span>
          {skus.filter(d=>picked.has(d.asin)).map(d=>(
            <span key={d.asin} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,color:t.text,background:t.surface,border:`1px solid ${t.border2}`,borderRadius:4,padding:"2px 7px",fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
              {d.finalName}
              <span className="ic-btn" style={{color:t.text3,padding:"0 4px"}} onClick={()=>setPicked(prev=>{const nx=new Set(prev);nx.delete(d.asin);return nx;})}>✕</span>
            </span>
          ))}
        </div>
      )}
      <div className="tw ts"><table className="tight" style={{fontSize:11}}>
        <thead><tr>
          <th style={{width:28}}></th>
          <SortTh col="sku" label="SKU Name" style={{textAlign:"left"}}/>
          <th style={{textAlign:"left"}}>ASIN</th>
          <th style={{textAlign:"left"}}>Trend</th>
          <SortTh col="demand" label="W.Demand"/>
          <SortTh col="stock" label="Stock"/>
          <SortTh col="fba" label="FBA"/>
          <SortTh col="fc" label="FC"/>
          <th>Inbound</th>
          <SortTh col="po" label="PO"/>
          <SortTh col="doi" label={poOn?"DOI + PO":"DOI"}/>
          <th>{poOn?"Stockout + PO":"Stockout"}</th>
          <SortTh col="buy" label="Buy Qty"/>
          <SortTh col="replen" label="Replenish"/>
          <SortTh col="lis" label="LIS"/>
          <th></th>
          <th style={{width:36,padding:"0 14px 0 4px"}} aria-label="Purchase / replenish status"></th>
        </tr></thead>
        <tbody>{skus.map(d=>{
          const hasPriorityDemand = (d.priorityDemand||0)>0;
          const displayDemand = hasPriorityDemand ? d.effectiveDemand : d.velocity.demand;
          const extraInboundQty = d.extraInboundUnits||0;
          const displayInbound = (d.inbound||0) + extraInboundQty;
          const hasAnyManual = hasPriorityDemand || extraInboundQty>0 || (d.purchasedUnits||0)>0;
          return(
          <tr key={d.asin} className="cr" onClick={()=>onSku(d.asin)} style={picked.has(d.asin)?{background:t.accentBg}:undefined}>
            <td onClick={e=>togglePick(d.asin,e)}><input type="checkbox" checked={picked.has(d.asin)} onChange={()=>{}} style={{cursor:"pointer"}}/></td>
            <td style={{textAlign:"left"}}><div className="tn" title={d.finalName}>{d.finalName}</div><div className="ta" title={d.sellerSku}>{d.sellerSku}</div></td>
            <td style={{textAlign:"left"}} className="ta">{d.asin}</td>
            <td style={{textAlign:"left"}}><TrendLabel trend={calcTrend(d.velocity.avg7,d.velocity.avg30)} t={t}/></td>
            <td style={{fontWeight:700,color:hasPriorityDemand?t.accent:t.text}} title={hasPriorityDemand?`Priority Demand override active (weighted avg is ${fmt(d.velocity.demand,2)})`:undefined}>{fmt(displayDemand,2)}</td>
            <td>{fmt(stockOf(d))}</td><td>{fmt(d.fbaAvailable)}</td><td>{fmt(d.fcSellable)}</td>
            <td style={{color:extraInboundQty>0?t.accent:undefined,fontWeight:extraInboundQty>0?700:undefined}} title={extraInboundQty>0?`Includes +${fmt(extraInboundQty)} Add Inbound (file value is ${fmt(d.inbound)})`:undefined}>{fmt(displayInbound)}</td>
            <td style={{color:poAllOf(d)>0?(poOn?t.text:t.text2):t.text3,fontWeight:poAllOf(d)>0?700:undefined}} title={poAllOf(d)>0?(poOn?"Units already ordered (Purchased Units + open POs), counted in DOI, stockout and Buy Qty":"Units already ordered. Not counted yet. Turn on Include PO to fold them into DOI, stockout and Buy Qty"):"No PO units for this SKU"}>{poAllOf(d)>0?fmt(poAllOf(d)):"—"}</td>
            <td title={poQtyOf(d)>0?`Includes ${fmt(poQtyOf(d))} PO units`:undefined}><DOI doi={doiOf(d)} t={t}/></td>
            <td style={{color:doiOf(d)<30?t.red:t.text3,whiteSpace:"nowrap"}} title={poQtyOf(d)>0?`Includes ${fmt(poQtyOf(d))} PO units`:undefined}>{fmtDateShort(soOf(d))}</td>
            <td style={{color:t.accent,fontWeight:700}}>{d.planning.suggestedPurchase>0?fmt(d.planning.suggestedPurchase):"—"}</td>
            <td style={{color:t.yellow,fontWeight:700}}>{d.planning.replenishQty>0?fmt(d.planning.replenishQty):"—"}</td>
            {(()=>{
              const l=lisMap[d.asin];
              if(!l) return <td style={{color:t.text3}} title="No ship-state sales or FC data">—</td>;
              const c=l.pct>=80?t.green:l.pct>=50?t.yellow:t.red;
              const tip=l.missing.length
                ? "No stock in: "+l.missing.map(x=>`${x.label} (${x.pct.toFixed(0)}% of demand)`).join(", ")
                : "Every demand cluster has stock in its nearest FC";
              return <td style={{color:c,fontWeight:700}} title={tip}>{l.pct.toFixed(0)}%</td>;
            })()}
            <td>
              {hasAnyManual&&(
                <span className="ic-btn" onClick={e=>resetSku(d.asin,e)} title="Reset this SKU's Purchased Units, Priority Demand and Add Inbound"
                  style={{color:t.text3,fontSize:13,padding:"2px 6px"}}>↺</span>
              )}
            </td>
            <td style={{padding:"0 14px 0 4px",width:36,textAlign:"right"}}>
              <span style={{display:"inline-flex",gap:5,alignItems:"center",verticalAlign:"middle"}}>
                {[["Purchase",d.planning.suggestedPurchase>0,`Purchase required: ${fmt(d.planning.suggestedPurchase)} units`],["Replenish",d.planning.replenishQty>0,`Replenishment needed: ${fmt(d.planning.replenishQty)} units`]].map(([k,bad,tip])=>(
                  <span key={k} title={bad?tip:`${k}: no action needed`} style={{
                    width:6,height:6,borderRadius:"50%",display:"inline-block",
                    background:bad?t.red:t.green,opacity:bad?1:.5,
                    boxShadow:bad?`0 0 0 2.5px ${t.redBg}`:"none",
                  }}/>
                ))}
              </span>
            </td>
          </tr>
          );
        })}</tbody>
      </table></div>
    </div>
  </div>);
}









/* ═══════════════════════════════════════════════════════════════
   FC VIEW — WAREHOUSE FIRST
   Each warehouse card lists all SKUs inside it with stock levels.
   Sorted by worst status. Collapsible. Click SKU row → SKU detail.
═══════════════════════════════════════════════════════════════ */
function FCView({data,settings,setSettings,onSku,t}){
  const[q,setQ]=useState(""),[fil,setFil]=useState("all");
  const[expanded,setExpanded]=useState(new Set());

  const FC_STATUS_COLOR={stockout:t.red,critical:t.red,low:t.orange,ok:t.green,surplus:t.text2};
  const FC_STATUS_LABEL={stockout:"Stockout",critical:"Critical",low:"Low",ok:"OK",surplus:"Surplus"};
  const STATUS_RANK={stockout:0,critical:1,low:2,ok:3,surplus:4};

  // Invert data structure: FC code → list of SKUs
  const warehouses=useMemo(()=>{
    const map={};
    Object.values(data).forEach(d=>{
      if(!d.fcPlanning) return;
      d.fcPlanning.fcs.forEach(fc=>{
        if(fc.stock===0&&fc.demand===0&&fc.unsellable===0&&fc.inTransit===0) return;
        if(!map[fc.fc]) map[fc.fc]={code:fc.fc,label:fc.label,skus:[],totalStock:0,totalUnsellable:0,totalInTransit:0};
        map[fc.fc].skus.push({
          asin:d.asin,name:d.finalName,sellerSku:d.sellerSku,
          stock:fc.stock,demand:fc.demand,doi:fc.doi,
          status:fc.status,unsellable:fc.unsellable,inTransit:fc.inTransit,
        });
        map[fc.fc].totalStock+=fc.stock;
        map[fc.fc].totalUnsellable+=fc.unsellable;
        map[fc.fc].totalInTransit+=fc.inTransit;
      });
    });
    Object.values(map).forEach(wh=>{
      wh.skus.sort((a,b)=>(STATUS_RANK[a.status]??3)-(STATUS_RANK[b.status]??3));
      wh.worstStatus=wh.skus.reduce((w,s)=>(STATUS_RANK[s.status]??3)<(STATUS_RANK[w]??3)?s.status:w,"ok");
      wh.critCount=wh.skus.filter(s=>s.status==="critical"||s.status==="stockout").length;
      wh.lowCount=wh.skus.filter(s=>s.status==="low").length;
    });
    return Object.values(map)
      .sort((a,b)=>(STATUS_RANK[a.worstStatus]??3)-(STATUS_RANK[b.worstStatus]??3));
  },[data]);

  const filtered=useMemo(()=>warehouses
    .filter(wh=>
      fil==="critical"?(wh.worstStatus==="critical"||wh.worstStatus==="stockout"):
      fil==="low"?wh.worstStatus==="low":true)
    .filter(wh=>!q||wh.code.toLowerCase().includes(q.toLowerCase())||wh.label.toLowerCase().includes(q.toLowerCase()))
  ,[warehouses,q,fil]);

  const critWH=warehouses.filter(w=>w.worstStatus==="critical"||w.worstStatus==="stockout").length;
  const lowWH=warehouses.filter(w=>w.worstStatus==="low").length;
  const totalStockAll=warehouses.reduce((s,w)=>s+w.totalStock,0);
  const totalUnsellAll=warehouses.reduce((s,w)=>s+w.totalUnsellable,0);
  const totalTransitAll=warehouses.reduce((s,w)=>s+w.totalInTransit,0);
  const byStock=useMemo(()=>[...warehouses].sort((a,b)=>b.totalStock-a.totalStock).slice(0,8),[warehouses]);
  const maxStock=Math.max(1,...byStock.map(w=>w.totalStock));
  // SKU × FC pairs that run dry first
  const runOutFirst=useMemo(()=>{
    const rows:any[]=[];
    warehouses.forEach(wh=>wh.skus.forEach(s=>{
      if(s.demand>0&&isFinite(s.doi)) rows.push({...s,fc:wh.code,fcLabel:wh.label});
    }));
    return rows.sort((a,b)=>(a.doi-b.doi)||(b.demand-a.demand)).slice(0,8);
  },[warehouses]);
  const sub12={fontSize:12.5,color:t.text3};

  function toggleCollapse(code){
    setExpanded(prev=>{const next=new Set(prev);next.has(code)?next.delete(code):next.add(code);return next;});
  }
  function openFc(code){
    setExpanded(prev=>new Set(prev).add(code));
    setTimeout(()=>document.getElementById(`fc-${code}`)?.scrollIntoView({behavior:"smooth",block:"start"}),60);
  }

  return(<div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>

    <div className="kg kg5" style={{marginBottom:12}}>
      {[
        {l:"Fulfilment centres",v:warehouses.length,s:"with ledger data",col:t.text},
        {l:"Need attention",v:critWH,s:`${lowWH} more running low`,col:critWH>0?t.red:t.text},
        {l:"Sellable units",v:fmt(totalStockAll),s:"across all FCs",col:t.text},
        {l:"Unsellable units",v:fmt(totalUnsellAll),s:"held at FCs",col:totalUnsellAll>0?t.yellow:t.text},
        {l:"In transit",v:fmt(totalTransitAll),s:"moving between FCs",col:t.text},
      ].map(k=>(
        <div key={k.l} className="kc">
          <div className="kl">{k.l}</div>
          <div className="kv" style={{color:k.col}}>{k.v}</div>
          <div className="ks">{k.s}</div>
        </div>
      ))}
    </div>

    {warehouses.length>0&&(
      <div className="dg c">
        <div className="card">
          <div className="ch">Stock by FC</div>
          <div style={{...sub12,marginTop:-6,marginBottom:6}}>Sellable units · click to open</div>
          {byStock.map(w=>(
            <DashRow key={w.code} label={w.label} sub={`${w.code} · ${w.skus.length} SKU${w.skus.length!==1?"s":""}${w.critCount>0?` · ${w.critCount} critical`:""}`}
              value={fmt(w.totalStock)} frac={w.totalStock/maxStock}
              color={t.text2} onClick={()=>openFc(w.code)} t={t}/>
          ))}
        </div>
        <div className="card">
          <div className="ch">Running out first</div>
          <div style={{...sub12,marginTop:-6,marginBottom:6}}>Lowest days of inventory at a single FC · click to open the SKU</div>
          {runOutFirst.length===0
            ?<div style={{...sub12,padding:"6px 8px"}}>No FC has an end date in sight.</div>
            :runOutFirst.map((r,i)=>(
              <DashRow key={r.asin+r.fc+i} label={r.name} sub={`${r.fcLabel} · ${r.fc}`}
                value={`${fmt(r.doi,1)}d`} frac={Math.min(1,r.doi/30)} color={FC_STATUS_COLOR[r.status]||t.green}
                onClick={()=>onSku(r.asin)} t={t}/>
            ))}
        </div>
      </div>
    )}

    <div className="srow" style={{marginBottom:12}}>
      <div className="sbox">
        <span style={{color:t.text3}}>⌕</span>
        <input placeholder="FC code or city…" value={q} onChange={e=>setQ(e.target.value)}/>
      </div>
      <Select className="sel" value={fil} onChange={e=>setFil(e.target.value)}>
        <option value="all">All warehouses ({warehouses.length})</option>
        <option value="critical">Critical or stockout ({critWH})</option>
        <option value="low">Low stock ({lowWH})</option>
      </Select>
      <span style={{marginLeft:"auto",fontSize:12.5,color:t.text3}}>
        {filtered.length} of {warehouses.length} warehouses
      </span>
    </div>

    {warehouses.length===0&&(
      <div className="empty">
        <div className="empty-ic">🏭</div>
        <h3>No ledger data</h3>
        <p>Upload a Ledger CSV or add a Ledger tab to your Google Sheet<br/>to see per-warehouse stock levels.</p>
      </div>
    )}

    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {filtered.map(wh=>{
        const wc=FC_STATUS_COLOR[wh.worstStatus]||t.green;
        const isOpen=expanded.has(wh.code);
        return(
          <div key={wh.code} id={`fc-${wh.code}`} className="fc-card" style={{overflow:"hidden"}}>
            <div className="dash-row" onClick={()=>toggleCollapse(wh.code)} role="button" tabIndex={0}
              onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggleCollapse(wh.code);}}}
              style={{display:"grid",gridTemplateColumns:"minmax(0,1.3fr) minmax(0,1.7fr) auto",alignItems:"center",gap:16,padding:"14px 18px",cursor:"pointer",borderRadius:0}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:15,fontWeight:600,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wh.label}</div>
                <div style={{fontSize:12.5,color:t.text3,marginTop:2}}>{wh.code} · {wh.skus.length} SKU{wh.skus.length!==1?"s":""}</div>
              </div>
              <div style={{display:"flex",gap:"4px 20px",flexWrap:"wrap",fontSize:13,color:t.text3}}>
                <span><strong style={{color:t.text,fontWeight:700}}>{fmt(wh.totalStock)}</strong> sellable</span>
                {wh.totalUnsellable>0&&<span><strong style={{color:t.text2,fontWeight:700}}>{fmt(wh.totalUnsellable)}</strong> unsellable</span>}
                {wh.totalInTransit>0&&<span><strong style={{color:t.text2,fontWeight:700}}>{fmt(wh.totalInTransit)}</strong> in transit</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
                {wh.critCount>0&&<span style={{fontSize:13,fontWeight:600,color:t.red}}>{wh.critCount} critical</span>}
                {wh.critCount===0&&wh.lowCount>0&&<span style={{fontSize:13,fontWeight:600,color:t.orange}}>{wh.lowCount} low</span>}
                <span className="badge" style={{["--bc" as any]:wc}}>{FC_STATUS_LABEL[wh.worstStatus]}</span>
                <span aria-hidden="true" style={{fontSize:12,color:t.text3,lineHeight:1,display:"inline-block",transform:isOpen?"rotate(0deg)":"rotate(-90deg)",transition:"transform .18s"}}>▾</span>
              </div>
            </div>

            {isOpen&&(
              <div className="tw" style={{maxHeight:380,overflowY:"auto",borderTop:`1px solid ${t.border}`,borderRadius:0}}>
                <table>
                  <thead><tr>
                    <th style={{minWidth:200,textAlign:"left"}}>SKU</th>
                    <th>Sellable</th>
                    <th>Demand / day</th>
                    <th>DOI</th>
                    <th>Unsellable</th>
                    <th>In transit</th>
                    <th style={{textAlign:"left"}}>Status</th>
                  </tr></thead>
                  <tbody>
                    {wh.skus.map(sku=>{
                      const sc=FC_STATUS_COLOR[sku.status]||t.green;
                      return(
                        <tr key={sku.asin} className="cr" onClick={e=>{e.stopPropagation();onSku(sku.asin);}}>
                          <td style={{textAlign:"left"}}>
                            <div className="tn" title={sku.name}>{sku.name}</div>
                            <div className="ta">{sku.asin}</div>
                          </td>
                          <td style={{fontWeight:700,color:sku.stock>0?t.text:t.red}}>{fmt(sku.stock)}</td>
                          <td style={{color:t.text2}}>{sku.demand>0?fmt(sku.demand,2):"—"}</td>
                          <td>
                            {sku.demand>0
                              ?<span style={{color:sc,fontWeight:700}}>{isFinite(sku.doi)?fmt(sku.doi,1)+"d":"∞"}</span>
                              :<span style={{color:t.text3}}>—</span>}
                          </td>
                          <td style={{color:sku.unsellable>0?t.text2:t.text3}}>{sku.unsellable>0?fmt(sku.unsellable):"—"}</td>
                          <td style={{color:sku.inTransit>0?t.text2:t.text3}}>{sku.inTransit>0?fmt(sku.inTransit):"—"}</td>
                          <td style={{textAlign:"left"}}>
                            <span className="badge" style={{["--bc" as any]:sc}}>{FC_STATUS_LABEL[sku.status]}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   STOCK COVER — every SKU × FC, no threshold
   FC DOI = stock at that FC / that FC's ledger demand.
   SKU cover = planning DOI (same figure as All SKUs).
═══════════════════════════════════════════════════════════════ */
function StockCoverView({data, settings, setSettings, onSku, t}) {
  const [q,setQ]=useState("");
  const [fcFil,setFcFil]=useState("all");
  const [sort,setSort]=useState({col:"doi",dir:-1});

  const COLORS:any={stockout:t.red,critical:t.red,low:t.orange,ok:t.green,surplus:t.text2,nosales:t.yellow,none:t.text3};
  const LABELS:any={stockout:"Stockout",critical:"Critical",low:"Low",ok:"OK",surplus:"Surplus",nosales:"No sales",none:"No stock"};

  const rows=useMemo(()=>{
    const out:any[]=[];
    Object.values(data).forEach((d:any)=>{
      const sku={asin:d.asin,name:d.finalName,sellerSku:d.sellerSku,
        totalStock:d.currentStock,cover:d.planning.doi};
      const fcs=(d.fcPlanning?.fcs||[]).filter((f:any)=>f.stock||f.demand||f.inTransit||f.unsellable);
      if(!fcs.length){
        out.push({...sku,fc:"",fcLabel:"",stock:null,demand:null,doi:null,inTransit:null,unsellable:null,status:null});
        return;
      }
      fcs.forEach((f:any)=>out.push({...sku,fc:f.fc,fcLabel:f.label,stock:f.stock,demand:f.demand,
        doi:f.demand>0?f.doi:f.stock>0?Infinity:null,inTransit:f.inTransit,unsellable:f.unsellable,
        status:f.demand>0?f.status:f.stock>0?"nosales":"none"}));
    });
    return out;
  },[data]);

  const fcCodes=useMemo(()=>[...new Set(rows.map(r=>r.fc).filter(Boolean))].sort() as string[],[rows]);

  const filtered=useMemo(()=>{
    const lq=q.trim().toLowerCase();
    const {col,dir}=sort;
    return rows
      .filter(r=>(fcFil==="all"||r.fc===fcFil) &&
        (!lq||[r.name,r.asin,r.sellerSku,r.fc,r.fcLabel].some(v=>String(v||"").toLowerCase().includes(lq))))
      .sort((a,b)=>{
        const va=a[col], vb=b[col];
        // blanks always sink to the bottom, whichever direction
        const ea=va===null||va===""||va===undefined, eb=vb===null||vb===""||vb===undefined;
        if(ea||eb) return ea&&eb?0:ea?1:-1;
        if(typeof va==="string") return dir*va.localeCompare(vb);
        if(va===vb) return (b.stock||0)-(a.stock||0);
        return va>vb?dir:-dir;
      });
  },[rows,q,fcFil,sort]);

  const COLS=[
    {col:"name",label:"SKU",text:true},
    {col:"fc",label:"FC",text:true},
    {col:"stock",label:"FC stock"},
    {col:"demand",label:"Demand/day"},
    {col:"doi",label:"FC DOI"},
    {col:"totalStock",label:"Total stock"},
    {col:"cover",label:"SKU cover days"},
    {col:"inTransit",label:"In transit"},
    {col:"unsellable",label:"Unsellable"},
    {col:"status",label:"Status",text:true},
  ];
  const toggle=(col:string,text?:boolean)=>setSort(p=>p.col===col?{col,dir:-p.dir}:{col,dir:text?1:-1});
  const days=(v:any)=>v===null?"—":isFinite(v)?fmt(v,1)+"d":"∞";
  const num=(v:any,dp=0)=>v===null?"—":fmt(v,dp);

  function exportCSV(){
    downloadCSV("stock_cover.csv",
      ["SKU Name","Seller SKU","ASIN","FC","FC Location","FC Stock","Demand/Day","FC DOI (days)","Total Stock","SKU Cover (days)","In Transit","Unsellable","Status"],
      filtered.map(r=>[r.name,r.sellerSku,r.asin,r.fc,r.fcLabel,r.stock??"",r.demand??"",
        r.doi===null?"":isFinite(r.doi)?r.doi.toFixed(1):"No sales",r.totalStock,
        isFinite(r.cover)?r.cover.toFixed(1):"No sales",r.inTransit??"",r.unsellable??"",r.status?LABELS[r.status]:""]));
  }

  const TD:any={textAlign:"right",whiteSpace:"nowrap"};

  return(<div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>
    <div className="srow" style={{marginBottom:10}}>
      <div className="sbox">
        <span style={{color:t.text3}}>⌕</span>
        <input placeholder="SKU, ASIN or FC…" value={q} onChange={e=>setQ(e.target.value)}/>
      </div>
      <Select className="sel" value={fcFil} onChange={e=>setFcFil(e.target.value)}>
        <option value="all">All FCs</option>
        {fcCodes.map(c=><option key={c} value={c}>{c}</option>)}
      </Select>
      <span style={{marginLeft:"auto",fontSize:12.5,color:t.text3}}>{filtered.length} rows · click a header to sort</span>
      <button className="btn" onClick={exportCSV}>Export CSV</button>
    </div>
    <div className="tw ts"><table style={{minWidth:980}}>
      <thead><tr>
        {COLS.map(c=>(
          <th key={c.col} onClick={()=>toggle(c.col,c.text)} aria-sort={sort.col===c.col?(sort.dir===1?"ascending":"descending"):"none"}
            style={{cursor:"pointer",userSelect:"none",textAlign:c.text?"left":"right",color:sort.col===c.col?t.accent:undefined}}>
            {c.label}{sort.col===c.col?(sort.dir===1?" ↑":" ↓"):""}
          </th>
        ))}
      </tr></thead>
      <tbody>{filtered.map(r=>(
        <tr key={r.asin+"|"+r.fc} className="cr" onClick={()=>onSku(r.asin)}>
          <td style={{textAlign:"left"}}><div className="tn" title={r.name}>{r.name}</div><div className="ta">{r.asin}</div></td>
          <td style={{textAlign:"left"}}>{r.fc?<><div style={{fontWeight:600}}>{r.fc}</div><div style={{fontSize:12,color:t.text3}}>{r.fcLabel}</div></>:"—"}</td>
          <td style={TD}>{num(r.stock)}</td>
          <td style={TD}>{num(r.demand,2)}</td>
          <td style={{...TD,fontWeight:700,color:r.status?COLORS[r.status]:t.text3}}>{days(r.doi)}</td>
          <td style={TD}>{num(r.totalStock)}</td>
          <td style={{...TD,fontWeight:700}}>{days(r.cover)}</td>
          <td style={TD}>{num(r.inTransit)}</td>
          <td style={TD}>{num(r.unsellable)}</td>
          <td style={{textAlign:"left"}}>{r.status?<span className="badge" style={{["--bc" as any]:COLORS[r.status]}}>{LABELS[r.status]}</span>:"—"}</td>
        </tr>
      ))}</tbody>
    </table></div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   LIS — Send-Stock Recommendation List
   Flat list of SKU × FC, sourced from fcPlanning.recommendations
   Same logic as SKUDetail send-stock section. Sorted by DOI asc.
═══════════════════════════════════════════════════════════════ */
function LISView({data, settings, setSettings, onSku, t}) {
  const [q, setQ]           = useState("");
  const [filSt, setFilSt]   = useState("actionable");
  const [sortCol, setSortCol] = useState("status");
  const [sortDir, setSortDir] = useState(1); // 1=asc, -1=desc

  const FC_STATUS_COLOR = {stockout:t.red,critical:t.red,low:t.orange,ok:t.green,surplus:t.text2};
  const STATUS_RANK     = {stockout:0,critical:1,low:2,ok:3,surplus:4};
  const TREND_RANK      = {"▲▲ Strong Up":0,"▲ Rising":1,"↗ Slight Up":2,"→ Stable":3,"↘ Slight Down":4,"▼ Falling":5,"▼▼ Strong Down":6,"—":7};

  function toggleSort(col) {
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => d * -1); return col; }
      setSortDir(1); return col;
    });
  }

  const rows = useMemo(() => {
    const out = [];
    Object.values(data).forEach(d => {
      if (!d.fcPlanning) return;
      const vel   = d.velocity;
      const trend = calcTrend(vel?.avg7, vel?.avg30);
      d.fcPlanning.recommendations.forEach(r => {
        if (r.needed <= 0) return;
        const fcEntry = d.fcPlanning.fcs.find(f => f.fc === r.fc);
        out.push({
          asin:    d.asin,
          name:    d.finalName,
          fc:      r.fc,
          fcLabel: r.label,
          demand:  r.demand,
          fcStock: fcEntry?.stock ?? 0,
          doi:     r.doi,
          status:  r.status,
          sendQty: r.needed,
          trend,
        });
      });
    });
    return out;
  }, [data]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a,b) => {
      let va, vb;
      if (sortCol === "status") {
        va = STATUS_RANK[a.status] ?? 3;
        vb = STATUS_RANK[b.status] ?? 3;
        if (va === vb) { // secondary: doi asc
          const ad = isFinite(a.doi)?a.doi:1e9, bd = isFinite(b.doi)?b.doi:1e9;
          return ad - bd;
        }
        return (va - vb) * sortDir;
      }
      if (sortCol === "doi") {
        va = isFinite(a.doi)?a.doi:1e9;
        vb = isFinite(b.doi)?b.doi:1e9;
      } else if (sortCol === "demand") { va=a.demand; vb=b.demand; }
      else if (sortCol === "fcStock")  { va=a.fcStock; vb=b.fcStock; }
      else if (sortCol === "sendQty")  { va=a.sendQty; vb=b.sendQty; }
      else if (sortCol === "trend")    { va=TREND_RANK[a.trend]??7; vb=TREND_RANK[b.trend]??7; }
      else if (sortCol === "name")     { return sortDir*a.name.localeCompare(b.name); }
      else if (sortCol === "fc")       { return sortDir*a.fc.localeCompare(b.fc); }
      else { va=0; vb=0; }
      return (va - vb) * sortDir;
    });
    return arr;
  }, [rows, sortCol, sortDir]);

  const filtered = useMemo(() => {
    let r = filSt === "all" ? sorted : sorted.filter(x => x.status==="stockout"||x.status==="critical"||x.status==="low");
    if (q) {
      const lq = q.toLowerCase();
      r = r.filter(x =>
        x.name.toLowerCase().includes(lq)||
        x.asin.toLowerCase().includes(lq)||
        x.fc.toLowerCase().includes(lq)||
        x.fcLabel.toLowerCase().includes(lq)
      );
    }
    return r;
  }, [sorted, filSt, q]);

  const totalSend = filtered.reduce((s,r)=>s+r.sendQty,0);
  const critCount = rows.filter(r=>r.status==="stockout"||r.status==="critical").length;
  const lowCount  = rows.filter(r=>r.status==="low").length;

  function SortTh({col, label, minW}) {
    const active = sortCol === col;
    const arrow  = active ? (sortDir===1?"↑":"↓") : "";
    return (
      <th onClick={()=>toggleSort(col)} style={{
        padding:"0 12px",height:40,fontSize:12,fontWeight:600,
        color:active?t.accent:t.text3,
        background:t.surface,
        textAlign:"left",whiteSpace:"nowrap",cursor:"pointer",
        userSelect:"none",minWidth:minW||undefined,
        borderBottom:active?`2px solid ${t.accent}`:`1px solid ${t.border}`,
      }}>
        {label}{active&&<span style={{marginLeft:4,fontSize:10}}>{arrow}</span>}
      </th>
    );
  }

  const TD = {padding:"0 12px",height:58,borderBottom:`1px solid ${t.border}`,verticalAlign:"middle",textAlign:"right"};

  return (
    <div>
      <SBar settings={settings} setSettings={setSettings} t={t}/>

      <div className="kg" style={{marginBottom:12}}>
        {[
          {l:"Total Recommendations",v:rows.length,   s:"FC × SKU needing stock",c:"b"},
          {l:"Critical / Stockout",  v:critCount,     s:"Immediate action",      c:"r"},
          {l:"Low Stock",            v:lowCount,      s:"Below cover target",    c:"y"},
          {l:"Total Units to Send",  v:fmt(totalSend),s:"Across filtered rows",  c:""},
        ].map(k=>(
          <div key={k.l} className={`kc ${k.c}`}>
            <div className="kl">{k.l}</div>
            <div className="kv" style={{color:k.c==="b"?t.accent:k.c==="r"?t.red:k.c==="y"?t.yellow:t.text}}>{k.v}</div>
            <div className="ks">{k.s}</div>
          </div>
        ))}
      </div>

      <div className="srow" style={{marginBottom:10}}>
        <div className="sbox">
          <span style={{color:t.text3}}>⌕</span>
          <input placeholder="SKU, ASIN or FC…" value={q} onChange={e=>setQ(e.target.value)}/>
        </div>
        <Select className="sel" value={filSt} onChange={e=>setFilSt(e.target.value)}>
          <option value="actionable">Critical + Low ({critCount+lowCount})</option>
          <option value="all">All ({rows.length})</option>
        </Select>
        <span style={{marginLeft:"auto",fontSize:12.5,color:t.text3}}>
          {filtered.length} rows · click a header to sort
        </span>
      </div>

      {rows.length === 0 && (
        <div className="empty">
          <div className="empty-ic">📦</div>
          <h3>No FC Data</h3>
          <p>Upload a Ledger CSV or add a Ledger tab to see FC-level send-stock recommendations.</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="tw">
          <table style={{minWidth:820,width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr>
                <SortTh col="name"    label="SKU"              minW={200}/>
                <SortTh col="fc"      label="APOB / FC"        minW={130}/>
                <SortTh col="demand"  label="Demand/d"/>
                <SortTh col="fcStock" label="FC Stock"/>
                <SortTh col="doi"     label="DOI"/>
                <SortTh col="trend"   label="Trend"/>
                <SortTh col="status"  label="Status"/>
                <SortTh col="sendQty" label="Send Recommendation" minW={210}/>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r,i)=>{
                const sc = FC_STATUS_COLOR[r.status]||t.green;
                const tc = trendColor(r.trend, t);
                return (
                  <tr key={`${r.asin}-${r.fc}-${i}`} className="cr"
                                        onClick={()=>onSku(r.asin)}>
                    <td style={TD}>
                      <div className="tn" title={r.name}>{r.name}</div>
                      <div className="ta">{r.asin}</div>
                    </td>
                    <td style={{...TD,textAlign:"left"}}>
                      <div style={{fontWeight:600,color:t.text,fontSize:14}}>{r.fc}</div>
                      <div style={{fontSize:12.5,color:t.text3,marginTop:1}}>{r.fcLabel}</div>
                    </td>
                    <td style={{...TD,fontFamily:"'Instrument Sans',system-ui,sans-serif",color:t.text2}}>
                      {r.demand>0?fmt(r.demand,2):<span style={{color:t.text3}}>—</span>}
                    </td>
                    <td style={{...TD,fontFamily:"'Instrument Sans',system-ui,sans-serif",fontWeight:700,color:r.fcStock>0?t.text:t.red}}>
                      {fmt(r.fcStock)}
                    </td>
                    <td style={TD}>
                      <span style={{color:sc,fontWeight:700,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
                        {isFinite(r.doi)?fmt(r.doi,1)+"d":"∞"}
                      </span>
                    </td>
                    <td style={{...TD,textAlign:"left"}}>
                      <TrendLabel trend={r.trend} t={t}/>
                    </td>
                    <td style={{...TD,textAlign:"left"}}>
                      <span className="badge" style={{["--bc" as any]:sc}}>{sentence(r.status)}</span>
                    </td>
                    <td style={TD}>
                      <span style={{color:t.text,fontWeight:700,fontSize:14}}>Send {fmt(r.sendQty)} units <span style={{color:t.text3,fontWeight:500}}>to {r.fc}</span></span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{marginTop:12,fontSize:12.5,color:t.text3,display:"flex",gap:20,flexWrap:"wrap"}}>
        <span>Cover target follows the FBA Cover Days slider, same formula as the SKU page.</span>
        <span style={{marginLeft:"auto"}}>Click a row to open the SKU.</span>
      </div>
    </div>
  );
}


function OrderQtyCell({qty, t}) {
  if (qty === null) return <span style={{color:t.text3}}>—</span>;
  const rounded = Math.round(qty);
  if (rounded <= 0) return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:5,fontSize:12,fontWeight:500,
      color:t.purple,fontFamily:"'Instrument Sans',system-ui,sans-serif",
    }}><span className="dot p"></span>{fmt(Math.abs(rounded))} surplus</span>
  );
  return <span style={{color:t.accent,fontWeight:700,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>{fmt(rounded)}</span>;
}

/* ═══════════════════════════════════════════════════════════════
   PROCUREMENT FORECAST
   • Reads per-ASIN lead times from ltData (Leadtime sheet)
   • Total Inventory = FBA Available + Local WH (FC Sellable) + Upcoming Goods (editable)
   • SEA is priority mode; AIR shown for urgency gap-fill
   • Reorder day for SEA = last safe date to place order before stockout
═══════════════════════════════════════════════════════════════ */
function ProcurementForecast({data, ltData, anchorDate, openPoMap, settings, t}) {
  // Upcoming Goods: user-editable per-SKU POs / supplier transit stock
  const [upcoming, setUpcoming] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fba_upcoming_goods") || "{}"); }
    catch { return {}; }
  });
  const [editingAsin, setEditingAsin] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [q, setQ] = useState("");
  const [fil, setFil] = useState("all");

  const saveUpcoming = (asin, val) => {
    const v = Math.max(0, parseInt(val) || 0);
    const next = {...upcoming, [asin]: v};
    setUpcoming(next);
    try { localStorage.setItem("fba_upcoming_goods", JSON.stringify(next)); } catch {}
    setEditingAsin(null);
  };

  const hasLtData = ltData && Object.keys(ltData).length > 0;
  const anchor = anchorDate || getToday();

  // Per-SKU procurement calculations
  const skus = useMemo(() => {
    if (!data) return [];
    const safetyDays = settings?.safetyDays ?? 30;
    return Object.values(data).map(d => {
      const lt       = ltData?.[d.asin] || null;
      const wfAds    = d.velocity.demand;
      const fba      = d.fbaAvailable || 0;
      const localWH  = d.fcSellable || 0;           // FC Sellable = local warehouse
      const upcomingQty = upcoming[d.asin] || 0;
      const totalInv = fba + localWH + upcomingQty;

      // Open PO qty from Purchases sheet (excluding Delivered)
      const openPoQty = Math.max(0, openPoMap?.[d.asin] ?? 0);

      const doh      = wfAds > 0 ? totalInv / wfAds : Infinity;
      const stockoutDate = wfAds > 0 && isFinite(doh)
        ? new Date(anchor.getTime() + doh * 86400000) : null;

      const airTotal = lt?.air?.total ?? null;
      const seaTotal = lt?.sea?.total ?? null;
      const cost     = lt?.cost || 0;

      // ── AIR recommendation ──
      // Only needed if stock runs out before sea arrives
      let orderAir = null;
      let airOrderDate = null;
      let airArrivalDate = null;
      if (airTotal !== null && seaTotal !== null && wfAds > 0) {
        if (isFinite(doh) && doh < seaTotal) {
          // Gap = days of sales not covered before sea arrives
          const gapDays = Math.max(0, seaTotal - doh);
          orderAir = Math.max(0, Math.round(gapDays * wfAds));
        } else {
          orderAir = 0;
        }
        airOrderDate   = new Date(anchor.getTime());
        airArrivalDate = new Date(anchor.getTime() + airTotal * 86400000);
      } else if (airTotal !== null && wfAds > 0) {
        // Have air LT but no sea LT — use legacy formula
        orderAir = wfAds * airTotal - totalInv;
        airOrderDate   = new Date(anchor.getTime());
        airArrivalDate = new Date(anchor.getTime() + airTotal * 86400000);
      } else if (airTotal !== null) {
        orderAir = 0;
      }

      // ── SEA recommendation ──
      // Target = daily_sales × (seaLT + safetyDays)
      // Available = totalInv + openPoQty
      // Sea = max(0, target - available - airQty)
      let orderSea = null;
      let seaOrderDate = null;
      let seaArrivalDate = null;
      if (seaTotal !== null) {
        if (wfAds > 0) {
          const targetUnits    = wfAds * (seaTotal + safetyDays);
          const availableInv   = totalInv + openPoQty;
          const airDeduct      = Math.max(0, orderAir ?? 0);
          orderSea = Math.max(0, Math.round(targetUnits - availableInv - airDeduct));
        } else {
          orderSea = 0;
        }
        seaOrderDate   = new Date(anchor.getTime());
        seaArrivalDate = new Date(anchor.getTime() + seaTotal * 86400000);
      }

      // Reorder day for SEA = last safe date to place the order = stockout − SEA days
      const reorderSeaDate = (stockoutDate && seaTotal)
        ? new Date(stockoutDate.getTime() - seaTotal * 86400000) : null;

      // Urgency status
      let statusLabel, statusTier;
      if (wfAds === 0 && totalInv === 0) {
        statusLabel = "⬜ No Sales Data"; statusTier = "none";
      } else if (totalInv === 0 && wfAds > 0) {
        statusLabel = "🔴 STOCK OUT — Order Air"; statusTier = "critical";
      } else if (airTotal !== null && isFinite(doh) && doh < airTotal) {
        statusLabel = "🔴 Order Air Now"; statusTier = "critical";
      } else if (seaTotal !== null && isFinite(doh) && doh < seaTotal) {
        statusLabel = "🟠 SEA + AIR gap order"; statusTier = "urgent";
      } else if (seaTotal !== null && isFinite(doh) && doh < seaTotal * 1.3) {
        statusLabel = "🟡 Place SEA order soon"; statusTier = "soon";
      } else if (wfAds > 0) {
        statusLabel = "🟢 Stock OK — routine SEA"; statusTier = "ok";
      } else {
        statusLabel = "⬜ No Sales Data"; statusTier = "none";
      }

      const trend = calcTrend(d.velocity.avg7, d.velocity.avg30);
      return {
        ...d, lt, wfAds, fba, localWH, upcomingQty, totalInv,
        openPoQty,
        doh, stockoutDate, airTotal, seaTotal, orderAir, orderSea,
        airOrderDate, airArrivalDate, seaOrderDate, seaArrivalDate,
        reorderSeaDate, statusLabel, statusTier, trend, cost,
      };
    });
  }, [data, ltData, upcoming, anchor, openPoMap, settings]);

  const filtered = useMemo(() => skus
    .filter(d =>
      fil === "critical" ? d.statusTier === "critical" :
      fil === "urgent"   ? (d.statusTier === "critical" || d.statusTier === "urgent") :
      fil === "soon"     ? d.statusTier === "soon" :
      fil === "has_lt"   ? d.lt !== null : true)
    .filter(d => !q || d.finalName.toLowerCase().includes(q.toLowerCase()) || d.asin.includes(q))
    .sort((a, b) => {
      const ord = {critical:0, urgent:1, soon:2, ok:3, none:4};
      const ao = ord[a.statusTier] ?? 5, bo = ord[b.statusTier] ?? 5;
      if (ao !== bo) return ao - bo;
      return (isFinite(a.doh)?a.doh:99999) - (isFinite(b.doh)?b.doh:99999);
    })
  , [skus, q, fil]);

  const critCount  = skus.filter(d => d.statusTier === "critical").length;
  const urgCount   = skus.filter(d => d.statusTier === "urgent").length;
  const soonCount  = skus.filter(d => d.statusTier === "soon").length;
  const totalSeaQty = skus.reduce((s, d) => s + Math.max(0, d.orderSea ?? 0), 0);
  const ltSkuCount  = hasLtData ? Object.keys(ltData).length : 0;

  function statusSty(tier) {
    if (tier === "critical") return {bg:t.redBg,   color:t.red,    bdr:t.redBdr};
    if (tier === "urgent")   return {bg:t.orangeBg, color:t.orange, bdr:t.yellowBdr};
    if (tier === "soon")     return {bg:t.yellowBg, color:t.yellow, bdr:t.yellowBdr};
    if (tier === "ok")       return {bg:t.greenBg,  color:t.green,  bdr:t.greenBdr};
    return {bg:t.surface2, color:t.text3, bdr:t.border};
  }

  const TH = {
    padding:"0 12px", height:40, textAlign:"left", fontSize:12, fontWeight:600,
    color:t.text3,
    background:t.surface, borderBottom:`2px solid ${t.border}`,
    whiteSpace:"nowrap", position:"sticky", top:0, zIndex:1,
  };
  const GL = {borderLeft:`1px solid ${t.border2}`};
  const TD = {
    padding:"0 12px", height:50, color:t.text2,
    fontSize:13, whiteSpace:"nowrap",
    borderBottom:`1px solid ${t.border}`,
  };

  return (
    <div>
      {/* Page header */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:20,fontWeight:700,color:t.text,marginBottom:4}}>Procurement Forecast</div>
        <div style={{fontSize:12.5,color:t.text3}}>
          WF ADS = (30d×0.2)+(14d×0.3)+(7d×0.5) · Sea = priority mode · Air = gap-fill only · Open POs auto-deducted from SEA rec · Safety stock included in SEA target
        </div>
      </div>

      {/* No leadtime warning */}
      {!hasLtData && (
        <div className="alert ay" style={{marginBottom:12}}>
          <span>⚠</span>
          <span>No Leadtime data loaded — AIR / SEA columns will show "—". Upload a <strong>Leadtime CSV</strong> or add a <strong>Leadtime</strong> tab to your Google Sheet.</span>
        </div>
      )}

      {/* KPI cards */}
      <div className="kg kg5" style={{marginBottom:12}}>
        {[
          {l:"Critical / Air", v:critCount,  s:"Order air immediately", c:"r"},
          {l:"SEA + AIR Gap",  v:urgCount,   s:"SEA + gap air order needed", c:"o"},
          {l:"Order SEA Soon", v:soonCount,  s:"Approaching SEA lead time", c:"y"},
          {l:"Total SEA Order",v:fmt(Math.round(totalSeaQty)), s:"Units to purchase (sea)", c:""},
          {l:"Leadtime SKUs",  v:ltSkuCount, s:"ASINs with LT data loaded", c:"b"},
        ].map(k=>(
          <div key={k.l} className={`kc ${k.c}`}>
            <div className="kl">{k.l}</div>
            <div className="kv" style={{color:k.c==="r"?t.red:k.c==="o"?t.orange:k.c==="y"?t.yellow:k.c==="b"?t.accent:t.text}}>{k.v}</div>
            <div className="ks">{k.s}</div>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="srow" style={{marginBottom:10}}>
        <div className="sbox">
          <span style={{color:t.text3}}>⌕</span>
          <input placeholder="Name, ASIN…" value={q} onChange={e=>setQ(e.target.value)}/>
        </div>
        <Select className="sel" value={fil} onChange={e=>setFil(e.target.value)}>
          <option value="all">All SKUs</option>
          <option value="critical">Critical only</option>
          <option value="urgent">Urgent (critical + gap)</option>
          <option value="soon">Order soon</option>
          <option value="has_lt">Has Leadtime Data</option>
        </Select>
        <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>{filtered.length} / {skus.length} SKUs</span>
      </div>

      {/* Main table */}
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{minWidth:1700,width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr>
                {/* Product */}
                <th style={{...TH,minWidth:170,borderRight:`1px solid ${t.border2}`}}>SKU</th>
                <th style={TH}>WF ADS</th>
                <th style={TH}>Trend</th>

                {/* Inventory group */}
                <th style={{...TH,...GL}}>FBA Avail</th>
                <th style={{...TH}}>Local WH</th>
                <th style={{...TH,color:t.accent}}>
                  Upcoming ✎
                </th>
                <th style={{...TH,fontWeight:800}}>Total Inv</th>

                {/* DOH / Stockout */}
                <th style={TH}>Days in Hand</th>
                <th style={TH}>Est. Stockout</th>

                {/* AIR group */}
                <th style={{...TH,...GL}}>AIR Days</th>
                <th style={{...TH}}>Order AIR</th>
                <th style={{...TH}}>AIR Arrival</th>

                {/* SEA group */}
                <th style={{...TH,...GL}}>SEA Days</th>
                <th style={{...TH}}>Open POs</th>
                <th style={{...TH}}>Order SEA</th>
                <th style={{...TH}}>SEA Arrival</th>
                <th style={{...TH}}>Reorder by (SEA)</th>

                {/* Status */}
                <th style={{...TH,minWidth:220}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const sc = statusSty(d.statusTier);
                const reorderPast = d.reorderSeaDate && d.reorderSeaDate < anchor;
                const reorderSoon = d.reorderSeaDate && !reorderPast
                  && (d.reorderSeaDate.getTime() - anchor.getTime() < 10 * 86400000);
                return (
                  <tr key={d.asin} style={{background:t.surface}}>
                    {/* SKU */}
                    <td style={{...TD,borderRight:`1px solid ${t.border2}`}}>
                      <div style={{fontWeight:600,color:t.text,fontSize:12,maxWidth:165,overflow:"hidden",textOverflow:"ellipsis"}}>{d.finalName}</div>
                      <div style={{fontSize:9,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif",marginTop:2}}>{d.asin}</div>
                    </td>
                    {/* WF ADS */}
                    <td style={TD}>
                      <span style={{fontWeight:700,fontFamily:"'Instrument Sans',system-ui,sans-serif",color:t.text}}>{fmt(d.wfAds,2)}</span>
                      <span style={{fontSize:9,color:t.text3,marginLeft:3}}>u/d</span>
                    </td>
                    {/* Trend */}
                    <td style={{...TD,textAlign:"left"}}>
                      <TrendLabel trend={d.trend} t={t}/>
                    </td>

                    {/* Inventory group */}
                    <td style={{...TD,...GL}}>{fmt(d.fba)}</td>
                    <td style={{...TD}}>{fmt(d.localWH)}</td>
                    {/* Upcoming — editable */}
                    <td style={{...TD,cursor:"pointer",userSelect:"none"}}
                        onClick={() => { setEditingAsin(d.asin); setEditVal(String(d.upcomingQty)); }}>
                      {editingAsin === d.asin ? (
                        <input
                          autoFocus type="number" min="0"
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => saveUpcoming(d.asin, editVal)}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveUpcoming(d.asin, editVal);
                            if (e.key === "Escape") setEditingAsin(null);
                          }}
                          onClick={e => e.stopPropagation()}
                          style={{
                            width:70,padding:"3px 6px",
                            background:t.surface,border:`1px solid ${t.accent}`,
                            borderRadius:4,color:t.text,fontSize:12,
                            fontFamily:"'Instrument Sans',system-ui,sans-serif",outline:"none",
                          }}
                        />
                      ) : (
                        <span style={{
                          display:"inline-flex",alignItems:"center",gap:5,
                          padding:"2px 8px",borderRadius:4,
                          background: d.upcomingQty > 0 ? t.accentBg : t.surface2,
                          border: `1px solid ${d.upcomingQty > 0 ? t.accentBdr : t.border}`,
                          color: d.upcomingQty > 0 ? t.accent : t.text3,
                          fontFamily:"'Instrument Sans',system-ui,sans-serif",fontSize:11,
                        }}>
                          {fmt(d.upcomingQty)}<span style={{fontSize:8,opacity:.5}}>✎</span>
                        </span>
                      )}
                    </td>
                    {/* Total Inv */}
                    <td style={{...TD,fontWeight:700,color:t.text,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
                      {fmt(d.totalInv)}
                    </td>

                    {/* Days in Hand */}
                    <td style={TD}>
                      <span style={{
                        fontWeight:700,fontFamily:"'Instrument Sans',system-ui,sans-serif",
                        color: !isFinite(d.doh) ? t.green
                             : d.doh < 30 ? t.red
                             : d.doh < 60 ? t.yellow : t.green,
                      }}>
                        {isFinite(d.doh) ? fmt(d.doh,1)+"d" : "∞"}
                      </span>
                    </td>
                    {/* Est. Stockout */}
                    <td style={TD}>
                      <span style={{fontSize:11,color:d.stockoutDate?t.text2:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
                        {d.stockoutDate ? fmtDate(d.stockoutDate) : "—"}
                      </span>
                    </td>

                    {/* AIR group */}
                    <td style={{...TD,...GL}}>
                      {d.airTotal !== null
                        ? <span style={{color:t.orange,fontFamily:"'Instrument Sans',system-ui,sans-serif",fontWeight:600}}>{d.airTotal}d</span>
                        : <span style={{color:t.text3}}>—</span>}
                    </td>
                    <td style={{...TD}}>
                      <OrderQtyCell qty={d.orderAir} t={t}/>
                    </td>
                    <td style={{...TD}}>
                      {d.airArrivalDate
                        ? <span style={{fontSize:11,color:t.orange,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>{fmtDate(d.airArrivalDate)}</span>
                        : <span style={{color:t.text3}}>—</span>}
                    </td>

                    {/* SEA group */}
                    <td style={{...TD,...GL}}>
                      {d.seaTotal !== null
                        ? <span style={{color:t.green,fontFamily:"'Instrument Sans',system-ui,sans-serif",fontWeight:600}}>{d.seaTotal}d</span>
                        : <span style={{color:t.text3}}>—</span>}
                    </td>
                    {/* Open POs */}
                    <td style={{...TD}}>
                      {d.openPoQty > 0
                        ? <span style={{
                            display:"inline-block",padding:"2px 8px",borderRadius:4,
                            background:t.accentBg,border:`1px solid ${t.accentBdr}`,
                            color:t.accent,fontFamily:"'Instrument Sans',system-ui,sans-serif",fontWeight:700,fontSize:11,
                          }}>{fmt(d.openPoQty)}</span>
                        : <span style={{color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>—</span>}
                    </td>
                    <td style={{...TD}}>
                      <OrderQtyCell qty={d.orderSea} t={t}/>
                    </td>
                    {/* SEA Arrival */}
                    <td style={{...TD}}>
                      {d.seaArrivalDate
                        ? <span style={{fontSize:11,color:t.green,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>{fmtDate(d.seaArrivalDate)}</span>
                        : <span style={{color:t.text3}}>—</span>}
                    </td>
                    {/* Reorder by (SEA) — last safe date */}
                    <td style={{...TD}}>
                      {d.reorderSeaDate ? (
                        <span style={{
                          fontSize:11,fontFamily:"'Instrument Sans',system-ui,sans-serif",fontWeight:reorderPast?700:400,
                          color: reorderPast ? t.red : reorderSoon ? t.yellow : t.green,
                        }}>
                          {reorderPast && "⚠ "}{fmtDate(d.reorderSeaDate)}
                        </span>
                      ) : <span style={{color:t.text3}}>—</span>}
                    </td>

                    {/* Status badge */}
                    <td style={TD}>
                      <span className="badge" style={{["--bc" as any]:sc.color}}>{d.statusLabel.replace(/^[⬜🔴🟠🟡🟢]\s*/,"")}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals row */}
      {filtered.length > 0 && (
        <div style={{
          marginTop:8,padding:"8px 12px",background:t.surface,border:`1px solid ${t.border}`,
          borderRadius:8,display:"flex",gap:"6px 22px",flexWrap:"wrap",alignItems:"center",
          fontSize:13,
        }}>
          <span style={{fontWeight:600,color:t.text3}}>Totals ({filtered.length} SKUs)</span>
          <span style={{color:t.text2}}>FBA: <strong style={{color:t.text}}>{fmt(filtered.reduce((s,d)=>s+d.fba,0))}</strong></span>
          <span style={{color:t.text2}}>Local WH: <strong style={{color:t.text}}>{fmt(filtered.reduce((s,d)=>s+d.localWH,0))}</strong></span>
          <span style={{color:t.accent}}>Upcoming: <strong>{fmt(filtered.reduce((s,d)=>s+d.upcomingQty,0))}</strong></span>
          <span style={{color:t.text2}}>Total Inv: <strong style={{color:t.text,fontWeight:800}}>{fmt(filtered.reduce((s,d)=>s+d.totalInv,0))}</strong></span>
          <span style={{color:t.accent}}>Open POs: <strong>{fmt(filtered.reduce((s,d)=>s+d.openPoQty,0))}</strong></span>
          <span style={{color:t.orange}}>Order AIR: <strong>{fmt(Math.round(filtered.reduce((s,d)=>s+Math.max(0,d.orderAir??0),0)))}</strong></span>
          <span style={{color:t.green}}>Order SEA: <strong>{fmt(Math.round(filtered.reduce((s,d)=>s+Math.max(0,d.orderSea??0),0)))}</strong></span>
        </div>
      )}

      {/* Legend */}
      <div style={{marginTop:12,display:"flex",gap:"6px 18px",flexWrap:"wrap",fontSize:12.5,color:t.text3}}>
        <span style={{display:"inline-flex",alignItems:"center",gap:7}}><span className="dot" style={{background:t.red}}/>Days in hand below AIR lead time: order air now</span>
        <span style={{display:"inline-flex",alignItems:"center",gap:7}}><span className="dot" style={{background:t.orange}}/>Below SEA lead time: SEA plus gap air</span>
        <span style={{display:"inline-flex",alignItems:"center",gap:7}}><span className="dot" style={{background:t.yellow}}/>Below SEA × 1.3: place SEA soon</span>
        <span style={{display:"inline-flex",alignItems:"center",gap:7}}><span className="dot" style={{background:t.green}}/>Stock OK: routine SEA</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WARNINGS PAGE
═══════════════════════════════════════════════════════════════ */
function WarningsPage({warnings,t}){
  const unmapped=warnings.filter(w=>w.type.includes("unmapped"));
  const mismatch=[...new Map(warnings.filter(w=>w.type.includes("mismatch")).map(w=>[w.asin,w])).values()];
  if(!warnings.length)return(<div className="empty"><div className="empty-ic">✅</div><h3>No Issues</h3><p>All ASINs mapped. SKUs match.</p></div>);
  return(<div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
      <span style={{fontSize:15,fontWeight:700,color:t.text}}>Data Quality Report</span>
      <span className="badge bgr"><span className="dot gr"></span>{warnings.length} total</span>
    </div>
    {unmapped.length>0&&<div className="wsec">
      <div className="wh" style={{color:t.red}}>Unmapped ASINs — Excluded ({unmapped.length})</div>
      <div className="alert ar" style={{marginBottom:8}}>Not found in SKU Map. Excluded from all calculations.</div>
      <div className="tw ts"><table>
        <thead><tr><th>Source</th><th>ASIN</th><th>Context</th><th>Row</th></tr></thead>
        <tbody>{unmapped.map((w,i)=>(
          <tr key={i}>
            <td><span className={`badge ${w.type.includes("inv")?"bb":"bgr"}`}><span className={`dot ${w.type.includes("inv")?"b":"gr"}`}></span>{w.type.includes("inv")?"Inventory":"Orders"}</span></td>
            <td style={{color:t.red,fontFamily:"'Instrument Sans',system-ui,sans-serif",fontSize:11}}>{w.asin}</td>
            <td style={{color:t.text3,fontSize:10}}>{w.context||"—"}</td>
            <td style={{fontSize:10,color:t.text3}}>{w.row||"—"}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>}
    {mismatch.length>0&&<div className="wsec">
      <div className="wh" style={{color:t.yellow}}>SKU Mismatches — Included ({mismatch.length})</div>
      <div className="alert ay" style={{marginBottom:8}}>Records still included. Verify these are the correct products.</div>
      <div className="tw ts"><table>
        <thead><tr><th>ASIN</th><th>SKU in File</th><th>Expected</th></tr></thead>
        <tbody>{mismatch.map((w,i)=>(
          <tr key={i}>
            <td style={{fontFamily:"'Instrument Sans',system-ui,sans-serif",fontSize:11}}>{w.asin}</td>
            <td style={{color:t.red,fontSize:11,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>{w.csvSku}</td>
            <td style={{color:t.green,fontSize:11,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>{w.mapSku}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>}
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   SKU DETAIL
   • Title = SKU name (set from parent)
   • Reorder level line on forecast chart
   • India demand heatmap
═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   TOP CITIES BREAKDOWN
   Reads citySales {asin→{"CITY||STATE"→qty}}, groups small cities
   into "Other [State]", shows top 15 by volume
═══════════════════════════════════════════════════════════════ */
function TopCities({ citySales, t }) {
  const [expanded, setExpanded] = useState(false);

  if (!citySales || Object.keys(citySales).length === 0) {
    return (
      <div style={{padding:"14px 0",textAlign:"center",fontSize:11,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
        No city data — ship-city column not found in orders CSV
      </div>
    );
  }

  // Parse "CITY||STATE" keys into [{city, stateLabel, qty}]
  const entries = Object.entries(citySales).map(([key, qty]) => {
    const [city, stateRaw] = key.split("||");
    const stateLabel = stateRaw
      ? stateRaw.split(" ").map(w=>w.charAt(0)+w.slice(1).toLowerCase()).join(" ")
      : "Unknown";
    return { city, stateLabel, stateRaw: stateRaw||"UNKNOWN", qty };
  });

  const totalQty = entries.reduce((s, e) => s + e.qty, 0);
  if (totalQty === 0) return null;

  const sorted = [...entries].sort((a,b) => b.qty - a.qty);
  const TOP_N = 15;
  // City eligibility pool: named cities beyond this rank get aggregated into
  // "Other [State]" buckets before ranking — keeps the long tail from being
  // hundreds of 1-2 unit rows, without hiding genuinely large buckets from
  // the top 15 (see below: buckets re-enter the ranking alongside named cities).
  const CITY_POOL = 60;
  const cityCandidates = sorted.slice(0, CITY_POOL);
  const smallCities = sorted.slice(CITY_POOL);

  // Group the long tail by state → "Other [State]" buckets
  const otherByState = {};
  smallCities.forEach(e => {
    const k = "Other " + e.stateLabel;
    if (!otherByState[k]) otherByState[k] = { city: k, stateLabel: e.stateLabel, qty: 0, isOther: true };
    otherByState[k].qty += e.qty;
  });
  const otherBuckets = Object.values(otherByState);

  // Rank named cities and "Other [State]" buckets together — a big Other bucket
  // (e.g. lots of small towns in one state) can legitimately outrank a small
  // named city, and should show up in the top 15 rather than always being
  // pushed into the collapsed section regardless of size.
  const combined = [...cityCandidates, ...otherBuckets].sort((a,b) => b.qty - a.qty);
  const top = combined.slice(0, TOP_N);
  const rest = combined.slice(TOP_N);
  const otherRows = rest; // kept name for the collapsible section below
  const hasRest = otherRows.length > 0;

  // Always show top 15; show the rest only when expanded
  const visibleRows = expanded ? [...top, ...otherRows] : top;
  const maxQty = top[0]?.qty || 1;

  function CityRow({ row, rank, isOther }) {
    const pct = totalQty > 0 ? (row.qty / totalQty * 100) : 0;
    const barPct = row.qty / maxQty * 100;
    return (
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {/* Rank */}
        <div style={{
          width:20, textAlign:"right", fontSize:9, flexShrink:0,
          color: isOther ? t.text3 : rank<3 ? t.accent : t.text3,
          fontFamily:"'Instrument Sans',system-ui,sans-serif",
        }}>
          {isOther ? "·" : `${rank+1}`}
        </div>

        {/* City + state */}
        <div style={{width:160,flexShrink:0}}>
          <div style={{
            fontSize:11, fontWeight: isOther?400:600,
            color: isOther ? t.text3 : t.text,
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          }}>{row.city}</div>
          <div style={{fontSize:9,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>{row.stateLabel}</div>
        </div>

        {/* Bar */}
        <div style={{flex:1,height:6,background:t.surface2,borderRadius:3,overflow:"hidden"}}>
          <div style={{
            width: barPct+"%", height:"100%", borderRadius:3,
            background: isOther ? t.border2 : rank<3 ? t.accent : "rgba(99,102,241,0.55)",
            transition:"width .3s",
          }}/>
        </div>

        {/* Units + % */}
        <div style={{width:70,textAlign:"right",flexShrink:0}}>
          <span style={{fontSize:11,fontWeight:700,fontFamily:"'Instrument Sans',system-ui,sans-serif",color:isOther?t.text3:t.text}}>{fmt(row.qty)}</span>
          <span style={{fontSize:9,color:t.text3,marginLeft:4}}>{pct.toFixed(1)}%</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div style={{fontSize:9,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif",marginBottom:10}}>
        Top {top.length} (cities and state groups, ranked together) · {hasRest ? `${otherRows.length} more collapsed below · ` : ""}total {fmt(totalQty)} units
      </div>

      {/* Top 15 rows — always visible */}
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {top.map((row, i) => <CityRow key={row.city+i} row={row} rank={i} isOther={!!row.isOther}/>)}
      </div>

      {/* Collapsible rest */}
      {hasRest && (
        <div style={{marginTop:8}}>
          <div
            onClick={()=>setExpanded(e=>!e)}
            style={{
              display:"flex", alignItems:"center", gap:6, cursor:"pointer",
              padding:"6px 10px", borderRadius:7,
              background: t.surface2, border:`1px solid ${t.border}`,
              fontSize:10, color:t.text3,
              userSelect:"none",
            }}
          >
            <span style={{
              display:"inline-block", transition:"transform .2s",
              transform: expanded?"rotate(90deg)":"rotate(0deg)",
              fontSize:10,
            }}>▶</span>
            <span>
              {expanded ? "Hide" : "Show"} remaining {otherRows.length} {otherRows.length===1?"entry":"entries"} &nbsp;·&nbsp; {fmt(rest.reduce((s,e)=>s+e.qty,0))} units ({(rest.reduce((s,e)=>s+e.qty,0)/totalQty*100).toFixed(1)}% of demand)
            </span>
          </div>

          {expanded && (
            <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:6,
              paddingLeft:8, borderLeft:`2px solid ${t.border}`}}>
              {otherRows.map((row, i) => <CityRow key={row.city+i} row={row} rank={top.length+i} isOther={!!row.isOther}/>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const JUMP_SECTIONS = [
  {id:"sec-inventory-breakdown", label:"Inventory Breakdown"},
  {id:"sec-active-pos", label:"Active Purchase Orders"},
  {id:"sec-shipment-plan", label:"Shipment Plan"},
  {id:"sec-recommended-actions", label:"Recommended Actions"},
  {id:"sec-purchase-plan", label:"Purchase Plan"},
  {id:"sec-fc-breakdown", label:"FC Breakdown"},
  {id:"sec-fba-replenishment", label:"FBA Replenishment Recommendation"},
  {id:"sec-top-cities", label:"Top Cities by Demand"},
  {id:"sec-sales-30d", label:"Sales — Last 30 Days"},
  {id:"sec-india-heatmap", label:"India Regional Demand & Stock Heatmap"},
  {id:"sec-70d-forecast", label:"70-Day Inventory Forecast"},
];

// Notion-style "jump to section" nav: a slim collapsed tab pinned to the
// left edge that expands into a list on click. Scrolling always lands the
// target section at the same spot — just below the sticky Back+Settings
// header — measured live off stickyHeaderRef so it stays correct however
// tall that header currently is (it wraps/grows with viewport width).
function JumpNav({sections, stickyHeaderRef, t}){
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);
  // Notion-style: hover opens/closes the panel (small delay on close so
  // crossing the gap between tab and list doesn't dismiss it). Click is kept
  // too, as a fallback for touch devices that have no hover.
  function openNow(){
    if(closeTimer.current){ clearTimeout(closeTimer.current); closeTimer.current=null; }
    setOpen(true);
  }
  function closeSoon(){
    closeTimer.current = setTimeout(()=>setOpen(false), 150);
  }
  useEffect(()=>()=>{ if(closeTimer.current) clearTimeout(closeTimer.current); },[]);
  useEffect(()=>{
    if(!open) return;
    const onDocClick=e=>{ if(!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    return()=>document.removeEventListener("mousedown", onDocClick);
  },[open]);
  function jumpTo(id){
    const el = document.getElementById(id);
    if(!el) return;
    // The app scrolls inside .content (not the window) — sticky headers are
    // positioned relative to it too, so offsets must be computed against it.
    const scroller = document.querySelector(".content") || document.scrollingElement;
    // stickyHeaderRef points at the .bk Back button; .sbar is its very next
    // sibling. Measuring each element's own height (not a wrapping div) keeps
    // both genuinely sticky — a shrink-wrapped parent would cap how far they
    // can stay pinned to just its own (short) height.
    const headerH = (stickyHeaderRef.current?.getBoundingClientRect().height || 0) + 6;
    const delta = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - headerH;
    scroller.scrollTo({top: Math.max(0, scroller.scrollTop + delta), behavior:"smooth"});
    setOpen(false);
  }
  return (
    <div ref={wrapRef}
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      style={{position:"fixed", right:0, top:"50%", transform:"translateY(-50%)", zIndex:30, display:"flex", justifyContent:"flex-end"}}
    >
      <button
        onClick={()=>setOpen(v=>!v)}
        title="Jump to section"
        style={{
          display:"flex", flexDirection:"column", gap:4, alignItems:"center", justifyContent:"center",
          width:24, height:52, flexShrink:0,
          background:"transparent", border:"none",
          cursor:"pointer",
        }}
      >
        {[0,1,2,3].map(i=>(
          <span key={i} style={{width:14,height:1.5,borderRadius:1,background:t.text3,opacity:.7}}/>
        ))}
      </button>
      <div style={{
        width: open ? 250 : 0, maxHeight:"70vh", overflow:"hidden",
        background:t.surface, border: open ? `1px solid ${t.border}` : "none", borderRight:"none",
        borderRadius:"12px 0 0 12px", boxShadow: open ? "0 8px 24px rgba(0,0,0,.22)" : "none",
        transition:"width .16s ease", fontFamily:"'Instrument Sans',system-ui,sans-serif",
      }}>
        <div style={{width:250, maxHeight:"70vh", overflowY:"auto", padding:6}}>
          <div style={{fontSize:10,color:t.text3,fontWeight:700,textTransform:"uppercase",letterSpacing:".4px",padding:"6px 10px 4px"}}>
            Jump to section
          </div>
          {sections.map(s=>(
            <div key={s.id}
              onClick={()=>jumpTo(s.id)}
              style={{
                fontSize:12, color:t.text2, padding:"7px 10px", borderRadius:6,
                cursor:"pointer", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
              }}
              onMouseEnter={e=>{e.currentTarget.style.background=t.surface2; e.currentTarget.style.color=t.text;}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent"; e.currentTarget.style.color=t.text2;}}
            >{s.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Sheet dates: dd/mm/yyyy (India) is read day-first; anything else ("Nov 18, 2026", ISO) goes to Date.
function parseSheetDate(str:string):Date|null{
  const m=String(str).trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  const d=m?new Date(+(m[3].length===2?"20"+m[3]:m[3]),+m[2]-1,+m[1]):new Date(str);
  return isNaN(d.getTime())?null:d;
}
function SKUDetail({sku, onBack, settings, setSettings, t, poUnits, setPoUnits, purchRows, skuCfg, setSkuCfg, extraInbound, setExtraInbound, poSelection, togglePoSelection}){
  if(!sku) return null;
  const {velocity:vel, planning:pl, forecast:baseForecast, forecastWithPO, fcPlanning, hasFCData, regionalSales, citySales, salesHistory} = sku;
  // "Include PO (forecast)" toggle — display-only swap, all underlying purchase/replenish logic untouched
  const poIncluded = settings.inclPO===true && (pl.poStockQty||0)>0;
  const forecast = poIncluded ? (forecastWithPO||baseForecast) : baseForecast;
  const displayDoi = poIncluded ? pl.doiWithPO : pl.doi;
  const displayStockoutDate = poIncluded ? pl.stockoutDateWithPO : pl.stockoutDate;

  // Per-SKU lead time from file; Additional Lead Time slider = extra buffer on top
  const seaLTBase = sku.skuSeaLT ?? null;
  const airLTBase = sku.skuAirLT ?? null;
  const defaultLT = seaLTBase ?? settings.totalLeadTime;
  const [ltAdj, setLtAdj] = useState(0);
  const stickyHeaderRef = useRef(null);
  const effectiveLT = seaLTBase != null ? (defaultLT + ltAdj + settings.totalLeadTime) : (defaultLT + ltAdj);
  const effectiveAirLT = airLTBase != null ? airLTBase + ltAdj + settings.totalLeadTime : null;

  // Recompute local planning values with per-SKU LTs + adjustment.
  // Uses sku.effectiveDemand (weighted avg, or the Priority Demand override if one is
  // set) — the SAME demand basis the KPI tiles/planning engine use above. Previously
  // this recompute used the raw weighted average (vel.demand) regardless of any
  // Priority Demand override, which could make this section (and Shipment Plan below)
  // show "stock OK" while the KPI tiles above correctly showed real urgency.
  const demand = sku.effectiveDemand;
  const stockEff = sku.effectiveStock ?? sku.currentStock; // honours the Include FBA/FC/Transfer/Inbound toggles
  const localReorderStock = Math.round(demand * (effectiveLT + settings.safetyDays));
  const localDoi = demand > 0 ? (stockEff / demand) : Infinity;
  const localGap = Math.max(0, (effectiveLT + settings.safetyDays) - localDoi);
  const localRequired = demand * (effectiveLT + settings.safetyDays);
  const localSuggestedPurchaseRaw = Math.round(Math.max(0, localGap) * demand);
  const currentPoUnits = poUnits?.[sku.asin] ?? 0;
  // Auto-fetched open POs from Purchases sheet (non-Delivered, this ASIN).
  // poNo numbering matches buildOpenPoMap's so checkbox state lines up with the global engine.
  const skuPoRows = (purchRows||[]).filter(r=>{
    const get = makeGet([r]);
    const asin   = s(r,get,"ASIN","asin");
    const status = s(r,get,"Status","status").toLowerCase().trim();
    return asin === sku.asin && status !== "delivered";
  }).map((r,i)=>{
    const get = makeGet([r]);
    const rowKey = i+1; // matches buildOpenPoMap's per-asin row position — unique even if PO Numbers repeat
    const poNo = s(r,get,"PO No","po no","PO Number","po_number","order_id") || `PO-${rowKey}`;
    const qty = Math.max(0, n(r,get,"Tr Qty","tr qty","Qty","qty","Quantity","quantity")||0);
    const included = poSelection?.[sku.asin]?.[rowKey] !== false;
    return { row:r, rowKey, poNo, qty, included };
  });
  const totalOpenPoQty = skuPoRows.reduce((sum,pr)=>sum+(pr.included?pr.qty:0),0);
  // Both the manual "Purchased Units" entry and the sheet's open POs are
  // forecast-only — they fold into Still-need-to-order / Shipment Plan /
  // Reorder Date ONLY when "Include PO (forecast)" is checked. Off = ignore
  // both entirely (matches computeAll's poForecastQty gating for DOI/Stockout,
  // so this local block and the global engine always agree).
  const poGateOn = settings.inclPO === true;
  const totalPoDeduction = poGateOn ? (currentPoUnits + totalOpenPoQty) : 0;
  const localSuggestedPurchase = Math.max(0, localSuggestedPurchaseRaw - totalPoDeduction);
  const fullyCoveredByPos = localSuggestedPurchaseRaw > 0 && localSuggestedPurchase === 0 && totalPoDeduction > 0;
  const hasAir = effectiveAirLT != null && effectiveAirLT > 0;

  // ── Shipment plan — adapted from Procurement Forecast's logic ──
  // Air = gap-fill only: just enough to survive until the sea shipment arrives.
  // Sea = the full replenishment target for the whole (lead time + safety) cycle,
  // independent of air, with air's contribution and open POs subtracted so nothing
  // is double-counted. This intentionally does NOT split one combined total into
  // two pieces — air and sea answer two different questions, so they're allowed
  // to look like two different-sized numbers. Lead times are effectiveLT/effectiveAirLT
  // (sheet lead time + the Additional Lead Time slider), matching the rest of this page.
  // Stock + already-placed PO units (manual "Purchased Units" + checked open POs) —
  // both the "will I stock out before sea arrives" check and the sea target need to
  // treat incoming PO the same way, otherwise air can fire a "bridge the gap" order
  // that's already covered by a PO the sea math already counted as available.
  const shipAvailableStock = stockEff + totalPoDeduction;
  const shipDoh = demand > 0 ? shipAvailableStock / demand : Infinity;
  let shipOrderAir = 0;
  if (hasAir && demand > 0) {
    if (isFinite(shipDoh) && shipDoh < effectiveLT) {
      const gapDays = Math.max(0, effectiveLT - shipDoh);
      shipOrderAir = Math.max(0, Math.round(gapDays * demand));
    }
  }
  let shipOrderSea = 0;
  if (demand > 0) {
    const targetUnits = demand * (effectiveLT + settings.safetyDays);
    shipOrderSea = Math.max(0, Math.round(targetUnits - shipAvailableStock - shipOrderAir));
  }
  const shipAirArrivalDate = hasAir ? new Date((sku._anchor||new Date()).getTime() + effectiveAirLT*86400000) : null;
  const shipSeaArrivalDate = new Date((sku._anchor||new Date()).getTime() + effectiveLT*86400000);
  const shipStockoutDate = demand > 0 && isFinite(shipDoh)
    ? new Date((sku._anchor||new Date()).getTime() + shipDoh*86400000) : null;
  const shipReorderDate = shipStockoutDate
    ? new Date(shipStockoutDate.getTime() - effectiveLT*86400000) : null;

  let shipStatusLabel, shipStatusTier;
  if (demand === 0 && stockEff === 0) { shipStatusLabel = "No sales data"; shipStatusTier = "none"; }
  else if (stockEff === 0 && demand > 0) { shipStatusLabel = "Stocked out — order air"; shipStatusTier = "critical"; }
  else if (hasAir && isFinite(shipDoh) && shipDoh < effectiveAirLT) { shipStatusLabel = "Order air now"; shipStatusTier = "critical"; }
  else if (isFinite(shipDoh) && shipDoh < effectiveLT) { shipStatusLabel = "Sea + air gap order"; shipStatusTier = "urgent"; }
  else if (isFinite(shipDoh) && shipDoh < effectiveLT * 1.3) { shipStatusLabel = "Place sea order soon"; shipStatusTier = "soon"; }
  else if (demand > 0) { shipStatusLabel = "Stock OK — routine sea"; shipStatusTier = "ok"; }
  else { shipStatusLabel = "No sales data"; shipStatusTier = "none"; }

  // ── FC manual inbound overrides (persisted to localStorage, keyed asin::fc) ──
  const [fcInbound, setFcInbound] = useState(()=>{
    try { return JSON.parse(localStorage.getItem("fc_inbound")||"{}"); } catch(_){ return {}; }
  });
  function setFcInboundVal(asin, fc, raw) {
    setFcInbound(prev=>{
      const key = `${asin}::${fc}`;
      const next = {...prev};
      const num = parseFloat(raw);
      if (raw===""||raw===null||raw===undefined||isNaN(num)) { delete next[key]; }
      else { next[key] = Math.max(0, Math.floor(num)); }
      try { localStorage.setItem("fc_inbound", JSON.stringify(next)); } catch(_){}
      return next;
    });
  }

  // ── Manual inbound override for the demand-based FBA Replenishment
  // Recommendation below (separate from the ledger-based fcInbound above,
  // since these rows are keyed by cluster, not by individual FC) ──
  const [groupInbound, setGroupInbound] = useState(()=>{
    try { return JSON.parse(localStorage.getItem("fc_group_inbound")||"{}"); } catch(_){ return {}; }
  });
  function setGroupInboundVal(asin, clusterKey, raw) {
    setGroupInbound(prev=>{
      const key = `${asin}::${clusterKey}`;
      const next = {...prev};
      const num = parseFloat(raw);
      if (raw===""||raw===null||raw===undefined||isNaN(num)) { delete next[key]; }
      else { next[key] = Math.max(0, Math.floor(num)); }
      try { localStorage.setItem("fc_group_inbound", JSON.stringify(next)); } catch(_){}
      return next;
    });
  }

  // ── FBA Replenishment Recommendation — demand-proximity based, separate
  // from the ledger-dispatch-based Send-Stock Recommendations above.
  // Puts stock near where customers actually are (ship-state), not where
  // Amazon has historically shipped it from. Dynamically follows the FBA
  // Cover Days slider and each state's share of this SKU's weighted demand.
  const clusterDemandRows = useMemo(()=>{
    const cs = sku.citySales || {};
    const stateQty = {};
    let totalQty = 0;
    Object.entries(cs).forEach(([key, qty])=>{
      const stateRaw = key.split("||")[1];
      const code = stateNameToCode(stateRaw);
      if (!code) return;
      stateQty[code] = (stateQty[code]||0) + qty;
      totalQty += qty;
    });
    if (totalQty === 0 || vel.demand <= 0) return [];
    const clusterQty = {};
    const clusterStates = {};
    Object.entries(stateQty).forEach(([code, qty])=>{
      const clusterKey = clusterForState(code);
      if (!clusterKey) return;
      clusterQty[clusterKey] = (clusterQty[clusterKey]||0) + qty;
      if (!clusterStates[clusterKey]) clusterStates[clusterKey] = new Set();
      clusterStates[clusterKey].add(code);
    });
    const fcStockByCode = {};
    (fcPlanning?.fcs||[]).forEach(fc=>{ fcStockByCode[fc.fc] = fc.stock||0; });
    return Object.entries(clusterQty).map(([clusterKey, qty])=>{
      const info = CLUSTERS[clusterKey];
      const dailyDemand = vel.demand * (qty/totalQty);
      const currentStock = (info?.fcs||[]).reduce((s,fc)=>s+(fcStockByCode[fc]||0),0);
      const manualInbound = groupInbound[`${sku.asin}::${clusterKey}`]||0;
      const target = Math.round(dailyDemand * settings.fbaCoverDays);
      const needed = Math.max(0, target - currentStock - manualInbound);
      return {
        clusterKey, label: info?.label || clusterKey, fcs: info?.fcs||[],
        statesCovered: [...(clusterStates[clusterKey]||[])],
        dailyDemand, pctOfDemand: qty/totalQty*100,
        currentStock, manualInbound, target, needed,
      };
    });
  }, [sku.citySales, sku.asin, vel.demand, fcPlanning, settings.fbaCoverDays, groupInbound]);
  const [clusterSortBy, setClusterSortBy] = useState("recommendation"); // "recommendation" | "demand"
  const sortedClusterRows = useMemo(()=>{
    const rows = [...clusterDemandRows];
    return clusterSortBy==="demand"
      ? rows.sort((a,b)=>b.dailyDemand-a.dailyDemand)
      : rows.sort((a,b)=>b.needed-a.needed);
  }, [clusterDemandRows, clusterSortBy]);

  const soi = forecast.findIndex(p=>p.stock===0);
  const reorderStock = localReorderStock;
  const FC_STATUS_COLOR = {stockout:t.red,critical:t.red,low:t.yellow,ok:t.green,surplus:t.purple};

  const anchor = sku._anchor || new Date();
  function daysFromAnchor(d) {
    if (!d) return null;
    return Math.round((d.getTime() - anchor.getTime()) / 86400000);
  }
  const shipReorderDaysLeft = daysFromAnchor(shipReorderDate);
  const shipReorderPast = shipReorderDaysLeft != null && shipReorderDaysLeft < 0;
  const shipReorderSoon = shipReorderDaysLeft != null && !shipReorderPast && shipReorderDaysLeft < 10;
  function shipStatusColor(tier) {
    if (tier === "critical") return t.red;
    if (tier === "urgent")   return t.orange;
    if (tier === "soon")     return t.yellow;
    if (tier === "ok")       return t.green;
    return t.text3;
  }

  return(<div>
    <JumpNav sections={JUMP_SECTIONS} stickyHeaderRef={stickyHeaderRef} t={t}/>
    <div className="skuhead" ref={stickyHeaderRef}>
    <div className="bk" onClick={onBack}><span className="bk-ar" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3 5 8l5 5"/></svg></span>Back</div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>
    </div>

    {/* Per-SKU Lead Time */}
    <div className="card" style={{marginBottom:10,padding:"10px 14px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{fontSize:13,fontWeight:600,color:t.text2,whiteSpace:"nowrap"}}>
          Lead Time
        </div>
        <div style={{flex:1,minWidth:160}}>
          <input type="range" min={-30} max={30} value={ltAdj}
            onChange={e=>setLtAdj(+e.target.value)}
            style={{width:"100%"}}
          />
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",fontSize:11,fontFamily:"'Instrument Sans',system-ui,sans-serif",flexWrap:"wrap"}}>
          <span>
            🚢 Sea: <span style={{color:t.green,fontWeight:700}}>{seaLTBase != null ? seaLTBase : "—"}d</span>
            {seaLTBase != null && <span style={{color:t.text3,fontSize:9}}> (file)</span>}
          </span>
          {effectiveAirLT != null && (
            <span style={{color:t.text3}}>
              ✈ Air: <span style={{color:t.accent}}>{airLTBase}d</span>
              {settings.totalLeadTime > 0 && <span style={{color:t.text3}}> +{settings.totalLeadTime}</span>}
              <span style={{color:t.accent}}> = {effectiveAirLT}d</span>
            </span>
          )}
          {ltAdj !== 0 && <span style={{color:t.yellow}}>{ltAdj > 0 ? "+" : ""}{ltAdj}d adj</span>}
          <span style={{color:t.text,fontWeight:700}}>→ Eff: {effectiveLT}d</span>
          {ltAdj !== 0 && <button onClick={()=>setLtAdj(0)} style={{fontSize:9,padding:"2px 6px",background:t.surface2,border:`1px solid ${t.border}`,borderRadius:4,color:t.text3,cursor:"pointer"}}>Reset</button>}
        </div>
        <div style={{fontSize:9,color:t.text3}}>
          Reorder @ <span style={{color:t.yellow,fontWeight:700}}>{fmt(localReorderStock)} units</span>
          &nbsp;·&nbsp;{settings.safetyDays}d safety
        </div>
      </div>
    </div>

    {/* Header */}
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <PBadge action={pl.action} priority={pl.priority} purchasePct={pl.purchasePct||0} replenishPct={pl.replenishPct||0} t={t}/>
      </div>
    </div>

    {/* KPI row */}
    {poIncluded&&(
      <div style={{fontSize:9,color:t.accent,marginBottom:6,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
        ⓘ Including {fmt(pl.poStockQty)} PO units in stock for the figures below (forecast-only — purchase/replenish qty unaffected)
      </div>
    )}
    <div className="d4 d3" style={{marginBottom:10}}>
      {[
        {l:"Days of Inventory",v:isFinite(displayDoi)?`${fmt(displayDoi,1)}d`:"∞",col:displayDoi<7?t.red:displayDoi<21?t.yellow:t.green},
        {l:"Stockout Date",v:fmtDate(displayStockoutDate),col:displayDoi<7?t.red:displayDoi<21?t.yellow:t.text},
        {l:"Weighted Demand",v:fmt(vel.demand,2)+"/day",col:t.accent},
        {l:"FBA Replenishment Qty",v:fmt(pl.replenishQty),col:pl.replenishQty>0?t.yellow:t.green},
        {l:"Gross Requirement",v:fmt(pl.netRequirement),col:pl.netRequirement>0?t.red:t.green},
        {l:"Trend",v:calcTrend(vel.avg7,vel.avg30),col:trendColor(calcTrend(vel.avg7,vel.avg30),t)},
      ].map(k=>(
        <div key={k.l} className="kc">
          <div className="kl">{k.l}</div>
          <div className="kv" style={{color:k.col}}>{k.l==="Trend"?<TrendLabel trend={k.v} t={t} size={20}/>:k.v}</div>
        </div>
      ))}
    </div>

    {/* Inventory + Velocity */}
    <div className="d2" style={{marginBottom:10}}>
      <div className="card" id="sec-inventory-breakdown">
        <div className="ch">Inventory Breakdown</div>
        {[["FBA Available",fmt(sku.fbaAvailable)],["FBA Unsellable",fmt(sku.fbaUnsellable)],
          ["FC Transfer",fmt(sku.fcTransfer||0)],["On Hand (FBA + FC Transfer)",fmt((sku.fbaAvailable||0)+(sku.fcTransfer||0))],
          ["FC Sellable",fmt(sku.fcSellable)],["FC Unsellable",fmt(sku.fcUnsellable)],
          ["Inbound",fmt(sku.inbound)],
          ["Total Current Stock",fmt(sku.currentStock)],["Unit Cost",sku.unitCost?`₹${fmt(sku.unitCost,2)}`:"—"]].map(([k,v])=>(
          <div key={k} className="sr"><span className="sk">{k}</span><span className="sv">{v}</span></div>
        ))}
      </div>
      <div className="card">
        <div className="ch">Sales Velocity<span className="ii" tabIndex={0}><i>i</i><span role="tooltip">Net sales: cancelled orders and returns are excluded.</span></span></div>
        {[["7-Day Total",fmt(vel.raw7)+" units"],
          ["7-Day Avg",fmt(vel.avg7,2)+" u/day"],
          ["14-Day Total",fmt(vel.raw14)+" units"],
          ["14-Day Avg",fmt(vel.avg14,2)+" u/day"],
          ["30-Day Total",fmt(vel.raw30)+" units"],
          ["30-Day Avg",fmt(vel.avg30,2)+" u/day"],
          ["Weighted Demand",fmt(vel.demand,2)+" u/day"],
          ["Formula","7D×0.5 + 14D×0.3 + 30D×0.2"],
          ["Reorder Stock Level",fmt(localReorderStock)+" units"],
          ["Urgency","auto × demand"]].map(([k,v])=>(
          <div key={k} className="sr"><span className="sk">{k}</span>
            <span className="sv" style={k==="Weighted Demand"?{color:t.accent}:k==="Reorder Stock Level"?{color:t.yellow}:{}}>{v}</span>
          </div>
        ))}
      </div>
    </div>

    {/* ── Active Purchase Orders ── */}
    {(()=>{
      const poRows = skuPoRows;
      const totalOpenQty = totalOpenPoQty;
      const STATUS_COLORS = {
        "in production": t.text2,
        "production completed": t.green,
        "in transit":    t.orange,
        "ordered":       t.text3,
        "open":          t.green,
        "pending":       t.text3,
        "partially shipped": t.orange,
      };
      function statusColor(st){ return STATUS_COLORS[st.toLowerCase()] || t.text2; }
      return (
        <div className="card" id="sec-active-pos" style={{marginBottom:10}}>
          <div className="ch">Active Purchase Orders</div>
          {poRows.length === 0 ? (
            <div style={{fontSize:11,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif",padding:"6px 0"}}>
              No active POs for this SKU
            </div>
          ) : (
            <>
              <div style={{fontSize:9,color:t.text3,marginBottom:6,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
                {poGateOn
                  ? "Uncheck a PO to exclude it from purchase/replenishment/DOI/stockout calculations everywhere in the app."
                  : <>Enable <strong style={{color:t.text2}}>Include PO (forecast)</strong> above to fold these into calculations — per-PO checkboxes are inactive until then.</>}
              </div>
              <div className="tw" style={{marginBottom:8}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr>
                      <th style={{width:32,padding:"0 12px",height:36,background:t.surface,borderBottom:`1px solid ${t.border}`}}></th>
                      {["Date of PO","PO Number","Status","Ordered Qty","Date of Completion","ETA"].map(h=>(
                        <th key={h} style={{padding:"0 12px",height:36,fontSize:12,fontWeight:600,color:t.text3,
                          background:t.surface,
                          borderBottom:`1px solid ${t.border}`,whiteSpace:"nowrap",textAlign:"left"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {poRows.map((pr,i)=>{
                      const r = pr.row;
                      const get  = makeGet([r]);
                      const poNo = pr.poNo;
                      const st   = s(r,get,"Status","status");
                      const qty  = pr.qty;
                      const poDate = s(r,get,"Date of PO","date_of_po","PO Date","po_date","Date of Po");
                      const comp = s(r,get,"Date of Completion","date_of_completion","Completion Date","completion_date");
                      const eta  = s(r,get,"Estimated Date of Delivery","estimated_date_of_delivery","Estimated Delivery Date","Expected Date of Delivery","Expected Delivery Date","Date of Delivery","date_of_delivery","Delivery Date","delivery_date","ETA");
                      const sc   = statusColor(st);
                      return (
                        <tr key={i} style={{borderBottom:`1px solid ${t.border}`,opacity:(poGateOn&&pr.included)?1:.45}}>
                          <td style={{padding:"7px 10px"}}>
                            <input type="checkbox" checked={pr.included} disabled={!poGateOn}
                              onChange={()=>togglePoSelection(sku.asin,pr.rowKey)}
                              title={!poGateOn?"Enable 'Include PO (forecast)' to use this":(pr.included?"Included in calculations":"Excluded from calculations")}
                              style={{cursor:poGateOn?"pointer":"not-allowed"}}/>
                          </td>
                          <td style={{padding:"7px 10px",fontSize:11,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif",textAlign:"left"}}>{poDate||"—"}</td>
                          <td style={{padding:"7px 10px",fontSize:11,fontFamily:"'Instrument Sans',system-ui,sans-serif",color:t.text,fontWeight:600,textAlign:"left"}}>{poNo}</td>
                          <td style={{padding:"7px 10px",textAlign:"left"}}>
                            {st?<span className="badge" style={{["--bc" as any]:sc}}>{st}</span>:<span style={{color:t.text3}}>—</span>}
                          </td>
                          <td style={{padding:"7px 10px",fontFamily:"'Instrument Sans',system-ui,sans-serif",fontSize:12,fontWeight:700,color:t.accent,textAlign:"left"}}>{qty>0?fmt(qty):"—"}</td>
                          <td style={{padding:"7px 10px",fontSize:11,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif",textAlign:"left"}}>{comp||"—"}</td>
                          <td style={{padding:"7px 10px",fontSize:11,fontFamily:"'Instrument Sans',system-ui,sans-serif",color:eta?t.green:t.text3,fontWeight:eta?600:400,textAlign:"left"}}>{eta||"—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{
                padding:"7px 12px",background:poGateOn?t.accentBg:t.surface2,border:`1px solid ${poGateOn?t.accentBdr:t.border}`,
                borderRadius:6,display:"flex",alignItems:"center",justifyContent:"space-between",
                fontSize:11,fontFamily:"'Instrument Sans',system-ui,sans-serif",opacity:poGateOn?1:.6,
              }}>
                <span style={{color:t.text3,fontSize:9,textTransform:"uppercase",letterSpacing:".5px"}}>
                  Total Open PO Qty ({poRows.filter(p=>p.included).length}/{poRows.length} PO{poRows.length!==1?"s":""} included){!poGateOn&&" — not applied"}
                </span>
                <span style={{fontWeight:800,fontSize:15,color:poGateOn?t.accent:t.text3}}>{fmt(totalOpenQty)} units</span>
              </div>
            </>
          )}
        </div>
      );
    })()}

    {/* Shipment Plan — adapted from Procurement Forecast's air/sea logic */}
    <div className="card" id="sec-shipment-plan" style={{marginBottom:10}}>
      <div className="ch">Shipment Plan</div>
      {demand === 0 ? (
        <div style={{fontSize:11,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif",padding:"6px 0"}}>No demand — not applicable</div>
      ) : (
        <div>
          {/* Single status line */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:shipStatusColor(shipStatusTier),display:"inline-block",flexShrink:0}}></span>
            <span style={{fontSize:14,fontWeight:700,color:shipStatusColor(shipStatusTier),fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>{shipStatusLabel}</span>
          </div>

          <div style={{display:"grid",gridTemplateColumns:hasAir?"1fr 1fr":"1fr",gap:10,marginBottom:10}}>
            {hasAir && (
              <div style={{padding:"12px 14px",borderRadius:8,background:t.surface2,border:`1px solid ${t.border}`}}>
                <div style={{fontSize:12,color:t.text3,marginBottom:6}}>✈ Air — bridge the gap</div>
                <div style={{fontSize:20,fontWeight:800,fontFamily:"'Instrument Sans',system-ui,sans-serif",color:shipOrderAir>0?t.accent:t.text3}}>
                  {shipOrderAir>0?fmt(shipOrderAir)+" units":"Not needed"}
                </div>
                {shipAirArrivalDate && shipOrderAir>0 && (
                  <div style={{fontSize:10,color:t.text3,marginTop:4,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
                    Arrives {fmtDate(shipAirArrivalDate)}
                  </div>
                )}
              </div>
            )}
            <div style={{padding:"12px 14px",borderRadius:8,background:t.surface2,border:`1px solid ${t.border}`}}>
              <div style={{fontSize:12,color:t.text3,marginBottom:6}}>🚢 Sea — full cycle target</div>
              <div style={{fontSize:20,fontWeight:800,fontFamily:"'Instrument Sans',system-ui,sans-serif",color:t.text}}>
                {fmt(shipOrderSea)} units
              </div>
              <div style={{fontSize:10,color:t.text3,marginTop:4,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
                Arrives {fmtDate(shipSeaArrivalDate)}
              </div>
            </div>
          </div>

          {/* Reorder-by line */}
          {shipReorderDate && (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${t.border}`,paddingTop:10,fontSize:11}}>
              <span style={{color:t.text3}}>Reorder by (sea)</span>
              <span style={{fontWeight:600,color:shipReorderPast?t.red:shipReorderSoon?t.yellow:t.green,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
                {shipReorderPast&&"⚠ "}{fmtDate(shipReorderDate)}{shipReorderPast?" — past due":""}
              </span>
            </div>
          )}

          {/* No LT data nudge */}
          {effectiveLT === 0 && !hasAir && (
            <div style={{marginTop:8,fontSize:10,color:t.text3,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
              Upload Leadtime CSV to enable air/sea calculations.
            </div>
          )}
        </div>
      )}
    </div>

    {/* Recommended Actions */}
    <div className="card" id="sec-recommended-actions" style={{marginBottom:10}}>
      <div className="ch">Recommended Actions</div>
      {/* Live DOI / Stockout Date / Still Need to Order — repeated here (not duplicating
          the Gross Requirement tile below) so edits to Purchased Units / Priority Demand /
          Add Inbound further down are visible without scrolling back up. */}
      <div className="d4 d3" style={{marginBottom:10}}>
        {[
          {l:"Days of Inventory",v:isFinite(displayDoi)?`${fmt(displayDoi,1)}d`:"∞",col:displayDoi<7?t.red:displayDoi<21?t.yellow:t.green},
          {l:"Stockout Date",v:fmtDate(displayStockoutDate),col:displayDoi<7?t.red:displayDoi<21?t.yellow:t.text},
          {l:"Still Need to Order",v:localSuggestedPurchase>0?fmt(localSuggestedPurchase):"✓ Covered",col:localSuggestedPurchase>0?t.accent:t.green},
        ].map(k=>(
          <div key={k.l} className="kc">
            <div className="kl">{k.l}</div>
            <div className="kv" style={{color:k.col}}>{k.v}</div>
          </div>
        ))}
      </div>
      <div className="acs">
        {[{l:"Reorder Date",v:shipReorderDate?fmtDate(shipReorderDate):"—",col:shipReorderPast?t.red:shipReorderSoon?t.yellow:t.green},
          {l:"FBA Replenishment Qty",v:fmt(pl.replenishQty),col:pl.replenishQty>0?t.yellow:t.green},
          {l:"Target Stock Level",v:fmt(pl.requiredStock,0),col:t.text}].map(k=>(
          <div key={k.l} className="ac">
            <div className="acl">{k.l}</div>
            <div className="acv" style={{color:k.col}}>{k.v}</div>
          </div>
        ))}
      </div>
      {/* Purchased Units field */}
      <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"6px 10px",marginTop:10,padding:"8px 10px",background:t.surface2,borderRadius:7,border:`1px solid ${t.border}`}}>
        <span style={{fontSize:13,fontWeight:600,color:t.text2,whiteSpace:"nowrap"}}>Purchased Units (PO Placed)</span>
        <input
          type="number" min={0} placeholder="0"
          value={currentPoUnits||""}
          onChange={e=>setPoUnits(sku.asin, e.target.value)}
          style={{width:80,background:"transparent",border:`1px solid ${t.border}`,
            borderRadius:4,color:t.green,padding:"3px 7px",fontSize:13,
            textAlign:"right",outline:"none",fontFamily:"'Instrument Sans',system-ui,sans-serif",fontWeight:700}}
        />
        {currentPoUnits>0&&(
          <button onClick={()=>setPoUnits(sku.asin,"")} title="Reset to 0"
            style={{fontSize:9,padding:"3px 8px",background:t.surface,border:`1px solid ${t.border}`,borderRadius:4,color:t.text3,cursor:"pointer"}}>
            ↺ Reset
          </button>
        )}
        {currentPoUnits>0&&!poGateOn&&<span style={{fontSize:10,color:t.text3}}>Include PO (forecast) is off — no effect</span>}
        <span style={{marginLeft:"auto",fontSize:13,fontWeight:700,fontFamily:"'Instrument Sans',system-ui,sans-serif",color:localSuggestedPurchase>0?t.accent:t.green}}>
          Still need: {localSuggestedPurchase>0?fmt(localSuggestedPurchase)+" units":"✓ Covered"}
        </span>
      </div>

      {/* Priority Demand override field */}
      <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"6px 10px",marginTop:8,padding:"8px 10px",background:t.surface2,borderRadius:7,border:`1px solid ${t.border}`}}>
        <span style={{fontSize:13,fontWeight:600,color:t.text2,whiteSpace:"nowrap"}} title="Overrides the weighted-average demand used for purchase qty, replenishment qty, DOI and stockout date — use for SKUs whose recent sales were suppressed by a stockout, or to plan against a known future demand. Can raise or lower demand vs. the computed average.">
          Priority Demand (units/day)
        </span>
        <input
          type="number" min={0} step="0.1" placeholder="auto"
          value={skuCfg?.[sku.asin]?.priorityDemand ?? ""}
          onChange={e=>{
            const raw=e.target.value;
            const cur=skuCfg?.[sku.asin]||{active:true};
            const val=parseFloat(raw);
            const next={...cur};
            if(raw===""||isNaN(val)||val<=0) delete next.priorityDemand; else next.priorityDemand=val;
            setSkuCfg({...skuCfg,[sku.asin]:next});
          }}
          style={{width:80,background:"transparent",border:`1px solid ${t.border}`,
            borderRadius:4,color:t.accent,padding:"3px 7px",fontSize:13,
            textAlign:"right",outline:"none",fontFamily:"'Instrument Sans',system-ui,sans-serif",fontWeight:700}}
        />
        {sku.priorityDemand>0&&(
          <button onClick={()=>{const cur=skuCfg?.[sku.asin]||{active:true};const next={...cur};delete next.priorityDemand;setSkuCfg({...skuCfg,[sku.asin]:next});}}
            title="Reset to weighted average (default)"
            style={{fontSize:9,padding:"3px 8px",background:t.surface,border:`1px solid ${t.border}`,borderRadius:4,color:t.text3,cursor:"pointer"}}>
            ↺ Reset
          </button>
        )}
        {sku.priorityDemand>0&&(
          <span style={{fontSize:10,color:t.text3}}>
            using <span style={{color:t.accent,fontWeight:700}}>{fmt(sku.effectiveDemand,1)}/day</span>
            {" "}(weighted avg is {fmt(vel.demand,1)}/day)
          </span>
        )}
      </div>

      {/* Add Inbound field */}
      <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"6px 10px",marginTop:8,padding:"8px 10px",background:t.surface2,borderRadius:7,border:`1px solid ${t.border}`}}>
        <span style={{fontSize:13,fontWeight:600,color:t.text2,whiteSpace:"nowrap"}} title="Manually adds units into planning stock (DOI / stockout / forecast). Independent of the 'Include Inbound' checkbox — this always applies, even when Include Inbound is off, so you can drop the file's inbound and hand-enter the real planned qty.">
          Add Inbound
        </span>
        <input
          type="number" min={0} placeholder="0"
          value={extraInbound?.[sku.asin] ?? ""}
          onChange={e=>setExtraInbound(sku.asin, e.target.value)}
          style={{width:80,background:"transparent",border:`1px solid ${t.border}`,
            borderRadius:4,color:t.accent,padding:"3px 7px",fontSize:13,
            textAlign:"right",outline:"none",fontFamily:"'Instrument Sans',system-ui,sans-serif",fontWeight:700}}
        />
        {(extraInbound?.[sku.asin]??0)>0&&(
          <button onClick={()=>setExtraInbound(sku.asin,"")} title="Reset to 0"
            style={{fontSize:9,padding:"3px 8px",background:t.surface,border:`1px solid ${t.border}`,borderRadius:4,color:t.text3,cursor:"pointer"}}>
            ↺ Reset
          </button>
        )}
        <span style={{fontSize:10,color:t.text3}}>
          {(extraInbound?.[sku.asin]??0)>0
            ? <><span style={{color:t.accent,fontWeight:700}}>+{fmt(extraInbound[sku.asin])}</span> units into planning stock{settings.inclInbound===false&&<> (file Inbound excluded)</>}</>
            : <>folds into planning stock — applies even if Include Inbound is off</>}
        </span>
      </div>

      {/* ── PO Deduction Tip ── */}
      {totalOpenPoQty > 0 && !poGateOn && (
        <div style={{
          marginTop:8,padding:"9px 12px",borderRadius:7,fontSize:11,
          background:t.surface2,border:`1px solid ${t.border}`,color:t.text3,
          fontFamily:"'Instrument Sans',system-ui,sans-serif",
        }}>
          {fmt(totalOpenPoQty)} units across {skuPoRows.filter(p=>p.included).length} open PO{skuPoRows.filter(p=>p.included).length!==1?"s":""} in the sheet — not applied. Enable <strong style={{color:t.text2}}>Include PO (forecast)</strong> above to fold them in.
        </div>
      )}
      {totalOpenPoQty > 0 && poGateOn && (
        <div style={{
          marginTop:8,padding:"9px 12px",borderRadius:7,fontSize:11,
          background: fullyCoveredByPos ? t.green+"18" : t.accent+"14",
          border:`1px solid ${fullyCoveredByPos ? t.green+"44" : t.accent+"44"}`,
          fontFamily:"'Instrument Sans',system-ui,sans-serif",
        }}>
          {fullyCoveredByPos ? (
            <span style={{color:t.green,fontWeight:700}}>
              ✅ Fully covered by open POs — no new order needed.
              &nbsp;<span style={{fontWeight:400,color:t.text3}}>
                ({skuPoRows.filter(p=>p.included).length} included PO{skuPoRows.filter(p=>p.included).length!==1?"s":""} · {fmt(totalOpenPoQty)} units in pipeline)
              </span>
            </span>
          ) : (
            <span style={{color:t.accent}}>
              💡 <strong>{fmt(totalOpenPoQty)} units</strong> across {skuPoRows.filter(p=>p.included).length} included PO{skuPoRows.filter(p=>p.included).length!==1?"s":""} deducted from gross requirement of <strong>{fmt(localSuggestedPurchaseRaw)} units</strong>.
              &nbsp;<span style={{color:t.text3}}>Still need to order: <strong style={{color:t.accent}}>{fmt(localSuggestedPurchase)} units</strong>.</span>
            </span>
          )}
        </div>
      )}
      {/* Sea/Air split now lives once, in the Shipment Plan card above — no duplicate here */}
    </div>

    {/* Purchase plan chart — candle-style shipment split */}
    <PurchasePlanChart key={sku.asin}
      stock0={getStartStock(sku.effectiveStock ?? sku.currentStock)}
      placedPos={poGateOn ? [
        ...(currentPoUnits>0 ? [{id:"manual",label:"Purchased units",units:currentPoUnits,etaDay:null}] : []),
        ...skuPoRows.filter(pr=>pr.included&&pr.qty>0).map(pr=>{
          const str = s(pr.row,makeGet([pr.row]),"Estimated Date of Delivery","estimated_date_of_delivery","Estimated Delivery Date","Expected Date of Delivery","Expected Delivery Date","Date of Delivery","date_of_delivery","Delivery Date","delivery_date","ETA");
          const dt = str ? parseSheetDate(str) : null;
          const a0 = sku._anchor||new Date(); // compare calendar days, not clock times
          const raw = dt && !isNaN(dt.getTime()) ? Math.round((new Date(dt.getFullYear(),dt.getMonth(),dt.getDate()).getTime()-new Date(a0.getFullYear(),a0.getMonth(),a0.getDate()).getTime())/86400000) : null;
          return {id:pr.poNo,label:pr.poNo,units:pr.qty,etaDay:raw==null?null:Math.max(0,raw),overdue:raw!=null&&raw<0};
        }),
      ] : []} d0={demand}
      r={trendRatio(vel.avg7, vel.avg30)}
      LT={effectiveLT} airLT={effectiveAirLT||0} hasAir={hasAir}
      S={settings.safetyDays}
      anchor={sku._anchor||new Date()} t={t}/>

    {/* FC Detail */}
    {hasFCData&&fcPlanning&&<div className="card" id="sec-fc-breakdown" style={{marginBottom:10}}>
      <div className="ch">FC Breakdown</div>
      <div className="tw ts" style={{maxHeight:250,overflowY:"auto"}}>
        <table>
          <thead><tr>
            <th>FC Location</th><th>Sellable</th><th>Demand/Day</th>
            <th>FC DOI</th><th>In Transit</th><th>Unsellable</th>
            <th style={{textAlign:"right"}}>Inbound</th><th>Status</th>
          </tr></thead>
          <tbody>{fcPlanning.fcs.map(fc=>(
            <tr key={fc.fc}>
              <td style={{color:t.text,fontSize:12}}>{fc.label}</td>
              <td>{fmt(fc.stock)}</td>
              <td>{fc.demand>0?fmt(fc.demand,2):"—"}</td>
              <td>{fc.demand>0?(isFinite(fc.doi)?<span style={{color:FC_STATUS_COLOR[fc.status],fontWeight:700}}>{fmt(fc.doi,1)}d</span>:<span style={{color:t.green}}>∞</span>):"—"}</td>
              <td>{fc.inTransit>0?<span style={{color:t.accent}}>{fmt(fc.inTransit)}</span>:"—"}</td>
              <td>{fc.unsellable>0?<span style={{color:t.yellow}}>{fmt(fc.unsellable)}</span>:"—"}</td>
              <td style={{textAlign:"right"}}>
                <input
                  type="number"
                  min={0}
                  placeholder="—"
                  value={fcInbound[`${sku.asin}::${fc.fc}`]??''}
                  onChange={e=>setFcInboundVal(sku.asin, fc.fc, e.target.value)}
                  onClick={e=>e.stopPropagation()}
                  style={{
                    width:58,background:"transparent",border:`1px solid ${t.border}`,
                    borderRadius:4,color:t.accent,padding:"2px 5px",
                    fontSize:11,textAlign:"right",outline:"none",
                    fontFamily:"'Instrument Sans',system-ui,sans-serif",
                  }}
                />
              </td>
              <td><span className={`badge${fc.status==="stockout"?" solid":""}`} style={{["--bc" as any]:FC_STATUS_COLOR[fc.status]}}>{sentence(fc.status)}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {fcPlanning.recommendations.length>0&&<div style={{marginTop:10}}>
        <div style={{fontSize:13,fontWeight:600,color:t.text2,marginBottom:8}}>Send-Stock Recommendations</div>
        {fcPlanning.recommendations.map(r=>{
          const inboundOffset = fcInbound[`${sku.asin}::${r.fc}`]||0;
          const finalNeeded = Math.max(0, r.needed - inboundOffset);
          return(
          <div key={r.fc} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:t.surface2,borderRadius:7,border:`1px solid ${t.border}`,marginBottom:5,fontSize:11}}>
            <span className={`badge${r.status==="stockout"?" solid":""}`} style={{["--bc" as any]:FC_STATUS_COLOR[r.status]}}>{sentence(r.status)}</span>
            <span style={{flex:1,color:t.text}}>{r.label}</span>
            <span style={{color:t.text3}}>DOI: {isFinite(r.doi)?fmt(r.doi,1)+"d":"∞"}</span>
            {inboundOffset>0&&<span style={{color:t.text3,fontSize:10,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>−{fmt(inboundOffset)} inbound</span>}
            <span style={{color:finalNeeded>0?t.accent:t.green,fontWeight:700,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
              {finalNeeded>0?`Send: ${fmt(finalNeeded)} units`:"✓ Covered"}
            </span>
          </div>
          );
        })}
      </div>}
    </div>}
    {!hasFCData&&<div className="alert ab" style={{marginBottom:10}}>ℹ No ledger data — FC-level analysis unavailable.</div>}

    {/* ── FBA REPLENISHMENT RECOMMENDATION ── */}
    {clusterDemandRows.length>0&&(
      <div className="card" id="sec-fba-replenishment" style={{marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
          <div className="ch" style={{marginBottom:0}}>FBA Replenishment Recommendation</div>
          <div style={{display:"flex",gap:4,fontSize:10,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
            <span style={{color:t.text3,alignSelf:"center",marginRight:2}}>Sort by</span>
            {[["recommendation","Recommendation"],["demand","Demand"]].map(([key,label])=>(
              <button key={key} onClick={()=>setClusterSortBy(key)} style={{
                padding:"4px 10px",borderRadius:6,cursor:"pointer",fontWeight:600,
                background:clusterSortBy===key?t.accent:t.surface2,
                color:clusterSortBy===key?t.onInk:t.text3,
                border:`1px solid ${clusterSortBy===key?t.accent:t.border}`,
                fontFamily:"'Instrument Sans',system-ui,sans-serif",
              }}>{label}</button>
            ))}
          </div>
        </div>
        {sortedClusterRows.map(r=>(
          <div key={r.clusterKey} style={{padding:"10px 12px",background:t.surface2,borderRadius:7,border:`1px solid ${t.border}`,marginBottom:8,fontSize:11}}>
            <div style={{color:t.text,fontWeight:600,marginBottom:2}}>{r.label}</div>
            <div style={{fontSize:11,color:t.text2,fontFamily:"'Instrument Sans',system-ui,sans-serif",marginBottom:2}}>
              covers {r.statesCovered.map(stateCodeToName).join(", ")}
            </div>
            <div style={{fontSize:11,fontWeight:600,color:t.accent,fontFamily:"'Instrument Sans',system-ui,sans-serif",marginBottom:6}}>
              {r.pctOfDemand.toFixed(1)}% of this SKU's demand · {fmt(r.dailyDemand,2)} units/day
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
              {r.fcs.map(fc=>{
                const fcStk=((fcPlanning?.fcs||[]).find((x:any)=>x.fc===fc)?.stock)||0, has=fcStk>0;
                return(
                  <span key={fc} className="badge" title={has?`${fmt(fcStk)} units in stock`:"No stock here"} style={{["--bc" as any]:has?t.green:t.text3,opacity:has?1:.6,fontSize:12,height:24,padding:"0 10px"}}>{fc}</span>
                );
              })}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
              <div>
                <div style={{fontSize:9,color:t.text3,textTransform:"uppercase",letterSpacing:".3px",marginBottom:3}} title="Units already in this cluster's FCs, from the Ledger">Current stock</div>
                <div style={{fontSize:14,fontWeight:700,color:t.text,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>{fmt(r.currentStock)}</div>
              </div>
              <div>
                <div style={{fontSize:9,color:t.text3,textTransform:"uppercase",letterSpacing:".3px",marginBottom:3}} title="Days of inventory = Current stock ÷ units/day demand in this cluster">DOI (days)</div>
                <div style={{fontSize:14,fontWeight:700,color:t.text,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>{r.dailyDemand>0?fmt(r.currentStock/r.dailyDemand,0):"—"}</div>
              </div>
              <div>
                <div style={{fontSize:9,color:t.text3,textTransform:"uppercase",letterSpacing:".3px",marginBottom:3}} title="Target = demand here × FBA Cover Days">Target stock</div>
                <div style={{fontSize:14,fontWeight:700,color:t.text,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>{fmt(r.target)}</div>
              </div>
              <div>
                <div style={{fontSize:9,color:t.text3,textTransform:"uppercase",letterSpacing:".3px",marginBottom:3}} title="Optional: note units already on the way that aren't reflected in Current Stock yet">Already inbound</div>
                <input
                  type="number" min={0} placeholder="0"
                  value={groupInbound[`${sku.asin}::${r.clusterKey}`]??''}
                  onChange={e=>setGroupInboundVal(sku.asin, r.clusterKey, e.target.value)}
                  onClick={e=>e.stopPropagation()}
                  style={{
                    width:"100%",background:"transparent",border:`1px solid ${t.border}`,
                    borderRadius:4,color:t.accent,padding:"3px 6px",
                    fontSize:13,fontWeight:700,textAlign:"left",outline:"none",
                    fontFamily:"'Instrument Sans',system-ui,sans-serif",
                  }}
                />
              </div>
              <div>
                <div style={{fontSize:9,color:t.text3,textTransform:"uppercase",letterSpacing:".3px",marginBottom:3}} title="Target − Current Stock − Already Inbound">Recommended send</div>
                <div style={{fontSize:14,fontWeight:700,fontFamily:"'Instrument Sans',system-ui,sans-serif",color:r.needed>0?t.accent:t.green}}>
                  {r.needed>0?`${fmt(r.needed)} units`:"✓ Covered"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}

    {/* ── TOP CITIES ── */}
    <div className="card" id="sec-top-cities" style={{marginBottom:10}}>
      <div className="ch">Top Cities by Demand</div>
      <TopCities citySales={citySales} t={t}/>
    </div>

    {/* ── 30-DAY SALES TREND ── */}
    {salesHistory&&salesHistory.length>1&&(
    <div className="card" id="sec-sales-30d" style={{marginBottom:10}}>
      <div className="ch">Sales — Last 30 Days</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={salesHistory} margin={{top:8,right:16,left:0,bottom:0}}>
          <CartesianGrid stroke={t.border} strokeDasharray="3 3" vertical={false}/>
          <XAxis dataKey="date" tickFormatter={dt=>{const p=dt.split("-");return `${p[2]}/${p[1]}`;}}
            tick={{fill:t.text3,fontSize:11,fontFamily:"'Instrument Sans',system-ui,sans-serif"}} axisLine={false} tickLine={false}
            interval={Math.max(0,Math.floor(salesHistory.length/8)-1)}/>
          <YAxis tick={{fill:t.text3,fontSize:11,fontFamily:"'Instrument Sans',system-ui,sans-serif"}} axisLine={false} tickLine={false} width={36}/>
          <Tooltip
            labelFormatter={dt=>{const p=dt.split("-");return `${p[2]}/${p[1]}/${p[0]}`;}}
            formatter={v=>[fmt(v),"Units sold"]}
            labelStyle={{color:t.text,fontWeight:600}} itemStyle={{color:t.text2}} contentStyle={{color:t.text,background:t.tooltipBg,border:`1px solid ${t.border}`,borderRadius:8,fontSize:12,fontFamily:"'Instrument Sans',system-ui,sans-serif",boxShadow:"0 4px 12px rgba(0,0,0,.08)"}}
            labelStyle={{color:t.text2}} itemStyle={{color:t.accent}}/>
          <Line type="monotone" dataKey="units" stroke={t.accent} strokeWidth={2} dot={false} activeDot={{r:4}}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
    )}

    {/* ── INDIA REGIONAL HEATMAP ── */}
    <div className="card" id="sec-india-heatmap" style={{marginBottom:10}}>
      <div className="ch">India Regional Demand & Stock Heatmap</div>
      <div className="hm-grid">
        <Suspense fallback={<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:240,color:t.text3,fontSize:11}}>Loading map…</div>}>
          <FCMap t={t}/>
        </Suspense>
        <IndiaHeatmap regionalSales={regionalSales} fcPlanning={fcPlanning} settings={settings} velocity={vel} t={t}/>
      </div>
    </div>

    {/* ── 70-DAY FORECAST with Reorder Line ── */}
    <div className="card" id="sec-70d-forecast">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div className="ch" style={{marginBottom:0}}>70-Day Inventory Forecast</div>
        <div style={{display:"flex",gap:14,alignItems:"center",fontSize:9,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
          <span style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{width:14,height:2,background:t.accent,display:"inline-block",borderRadius:1}}/>
            <span style={{color:t.text3}}>Stock</span>
          </span>
          {reorderStock>0&&<span style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{width:14,height:2,background:t.yellow,display:"inline-block",borderRadius:1,opacity:.8,borderTop:"2px dashed "+t.yellow}}/>
            <span style={{color:t.yellow}}>Reorder level ({fmt(reorderStock)} units)</span>
          </span>}
          {soi>0&&<span style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{width:2,height:10,background:t.red,display:"inline-block"}}/>
            <span style={{color:t.red}}>Stockout</span>
          </span>}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={forecast} margin={{top:24,right:60,left:0,bottom:4}}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.border}/>
          <XAxis dataKey="date" tick={{fill:t.text3,fontSize:11}} interval={Math.ceil(forecast.length/10)}/>
          <YAxis tick={{fill:t.text3,fontSize:10}}
            domain={[0, Math.ceil(Math.max(stockEff, reorderStock) * 1.12)]}/>
          <Tooltip contentStyle={{background:t.tooltipBg,border:`1px solid ${t.border}`,borderRadius:8,fontSize:12,color:t.text}}
            itemStyle={{color:t.text2}} labelStyle={{color:t.text,fontWeight:600}}/>
          {/* Reorder level horizontal line — always visible since Y-axis scales to include it */}
          {reorderStock>0&&(
            <ReferenceLine y={reorderStock} stroke={t.yellow} strokeDasharray="6 3" strokeWidth={1.5}
              label={{value:`Reorder: ${fmt(reorderStock)}`,fill:t.yellow,fontSize:9,position:"insideTopLeft",offset:4}}/>
          )}
          {/* Stockout date vertical line — label pushed inside left so it doesn't clip */}
          {soi>0&&(
            <ReferenceLine x={forecast[soi]?.date} stroke={t.red} strokeDasharray="4 2" strokeWidth={1.5}
              label={{value:"Stockout",fill:t.red,fontSize:9,position:"insideTopLeft"}}/>
          )}
          <Line type="monotone" dataKey="stock" stroke={t.accent} strokeWidth={2} dot={false}/>
        </LineChart>
      </ResponsiveContainer>
      {soi>0&&<div style={{marginTop:6,fontSize:9,color:t.red,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
        ⚠ Projected stockout in ~{soi} days ({fmtDate(new Date((sku._anchor||getToday()).getTime()+soi*86400000))})
      </div>}
      {reorderStock>0&&stockEff<=reorderStock&&<div style={{marginTop:4,fontSize:9,color:t.yellow,fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
        ⚡ Current stock is at or below the reorder level — purchase recommended
      </div>}
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   SKU MANAGER
═══════════════════════════════════════════════════════════════ */
const CATEGORY_OPTIONS = [
  "Active","Paused","Discontinued","Seasonal","New Launch",
  "Low Priority","High Priority","Pending Restock","Under Review"
];

function SKUManager({skuCfg,setSkuCfg,data,settings,setSettings,t}){
  const[search,setSearch]=useState("");
  const[filterStatus,setFilterStatus]=useState("all");
  const[editingNote,setEditingNote]=useState(null);
  const[noteValue,setNoteValue]=useState("");
  const[selected,setSelected]=useState(new Set());

  const allAsins=Object.keys(SKU_MAP);
  const rows=allAsins.map(asin=>{
    const cfg=skuCfg[asin]||{active:true,note:"",category:"Active"};
    const liveData=data?.[asin];
    return{
      asin,finalName:SKU_MAP[asin].finalName,sellerSku:SKU_MAP[asin].sellerSku,
      active:cfg.active!==false,note:cfg.note||"",
      category:cfg.category||(cfg.active===false?"Paused":"Active"),
      demand:liveData?.velocity?.demand??null,doi:liveData?.planning?.doi??null,
      stock:liveData?.currentStock??null,action:liveData?.planning?.action??null,
      priority:liveData?.planning?.priority??null,hasLiveData:!!liveData,
      priorityDemand:cfg.priorityDemand??null,
    };
  });

  const filtered=rows
    .filter(r=>filterStatus==="active"?r.active:filterStatus==="inactive"?!r.active:true)
    .filter(r=>!search||r.finalName.toLowerCase().includes(search.toLowerCase())||r.asin.includes(search)||r.sellerSku.toLowerCase().includes(search.toLowerCase())||r.note.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{if(a.active!==b.active)return a.active?1:-1;return a.finalName.localeCompare(b.finalName);});

  const activeCount=rows.filter(r=>r.active).length;
  const inactiveCount=rows.filter(r=>!r.active).length;

  function toggle(asin){
    const cur=skuCfg[asin]||{active:true};
    const nowActive=cur.active!==false;
    setSkuCfg({...skuCfg,[asin]:{...cur,active:!nowActive,category:!nowActive?"Active":(cur.category||"Paused")}});
  }
  function setNote(asin,note){
    const cur=skuCfg[asin]||{active:true};
    setSkuCfg({...skuCfg,[asin]:{...cur,note}});
    setEditingNote(null);
  }
  function setCategory(asin,category){
    const cur=skuCfg[asin]||{active:true};
    setSkuCfg({...skuCfg,[asin]:{...cur,category}});
  }
  function setPriorityDemand(asin,raw){
    const cur=skuCfg[asin]||{active:true};
    const val=parseFloat(raw);
    const next={...cur};
    if(raw===""||isNaN(val)||val<=0) delete next.priorityDemand; else next.priorityDemand=val;
    setSkuCfg({...skuCfg,[asin]:next});
  }
  function toggleSelect(asin){const next=new Set(selected);next.has(asin)?next.delete(asin):next.add(asin);setSelected(next);}
  function selectAll(){setSelected(new Set(filtered.map(r=>r.asin)));}
  function clearSelect(){setSelected(new Set());}
  function bulkSetActive(active){
    const updates={};
    selected.forEach(asin=>{const cur=skuCfg[asin]||{active:true};updates[asin]={...cur,active,category:active?"Active":(cur.category==="Active"?"Paused":cur.category)};});
    setSkuCfg({...skuCfg,...updates});setSelected(new Set());
  }
  function bulkSetCategory(category){
    const updates={};
    selected.forEach(asin=>{const cur=skuCfg[asin]||{active:true};updates[asin]={...cur,category};});
    setSkuCfg({...skuCfg,...updates});setSelected(new Set());
  }
  const[confirmDefaults,setConfirmDefaults]=useState(false);
  function resetAll(){setConfirmDefaults(true);}
  const doiColor=(doi)=>{if(!isFinite(doi)||doi>999)return t.green;if(doi<7)return t.red;if(doi<21)return t.yellow;return t.green;};

  return(<div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14,gap:12,flexWrap:"wrap"}}>
      <div style={{fontSize:13.5,color:t.text3,maxWidth:640,lineHeight:1.5}}>
        Switch SKUs on or off, add notes and set categories. Inactive SKUs are left out of every view and calculation. Changes apply instantly and are stored in this browser.
      </div>
      <button className="btn bs" onClick={resetAll}>↺ Reset defaults</button>
      <ConfirmDialog open={confirmDefaults} title="Reset SKU settings?" message="Every SKU goes back to its default active state and category." confirmLabel="Reset to defaults" danger onCancel={()=>setConfirmDefaults(false)} onConfirm={()=>{setConfirmDefaults(false);setSkuCfg({...DEFAULT_SKU_CONFIG});}}/>
    </div>
    <div className="kg" style={{marginBottom:12}}>
      {[{l:"Total SKUs",v:allAsins.length,c:""},{l:"Active",v:activeCount,c:"g",sub:"In calculations"},{l:"Inactive",v:inactiveCount,c:"r",sub:"Excluded"},{l:"In calculations",v:data?Object.keys(data).length:"—",c:"",sub:"Currently loaded"}].map(k=>(
        <div key={k.l} className="kc">
          <div className="kl">{k.l}</div>
          <div className="kv" style={{color:k.c==="r"?t.red:k.c==="g"?t.green:t.text}}>{k.v}</div>
          {k.sub&&<div className="ks">{k.sub}</div>}
        </div>
      ))}
    </div>
    <div className="srow" style={{marginBottom:12}}>
      <div className="sbox"><span style={{color:t.text3}}>⌕</span><input placeholder="Search name, ASIN, SKU, note…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <Select className="sel" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
        <option value="all">All SKUs ({rows.length})</option>
        <option value="active">Active ({activeCount})</option>
        <option value="inactive">Inactive ({inactiveCount})</option>
      </Select>
      {selected.size>0&&(
        <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:4}}>
          <span style={{fontSize:13,fontWeight:600,color:t.text}}>{selected.size} selected</span>
          <button className="btn bp" onClick={()=>bulkSetActive(true)}>✓ Activate</button>
          <button className="btn bdl" onClick={()=>bulkSetActive(false)}>✕ Deactivate</button>
          <Select className="sel sel-sm" defaultValue="" onChange={e=>{if(e.target.value)bulkSetCategory(e.target.value);}}>
            <option value="">Set category…</option>
            {CATEGORY_OPTIONS.map(c=><option key={c} value={c}>{c}</option>)}
          </Select>
          <button className="btn bs" onClick={clearSelect}>Clear</button>
        </div>
      )}
      {selected.size===0&&<button className="btn bs" onClick={selectAll}>Select all</button>}
      <span style={{marginLeft:"auto",fontSize:12.5,color:t.text3}}>{filtered.length} SKUs shown</span>
    </div>
    <div className="card" style={{padding:0,overflow:"hidden"}}>
      <div className="tw ts">
        <table>
          <thead><tr>
            <th style={{width:32}}><input type="checkbox" checked={selected.size===filtered.length&&filtered.length>0} onChange={e=>e.target.checked?selectAll():clearSelect()} style={{cursor:"pointer"}}/></th>
            <th style={{textAlign:"left"}}>Status</th><th style={{textAlign:"left"}}>SKU name</th><th style={{textAlign:"left"}}>ASIN</th><th style={{textAlign:"left"}}>Seller SKU</th><th style={{textAlign:"left"}}>Category</th><th style={{textAlign:"left"}}>Note</th><th title="Overrides computed demand — never lowers it, only raises">Priority demand</th>
            {data&&<><th>DOI</th><th>Stock</th><th>Demand/day</th><th style={{textAlign:"left"}}>Action</th></>}
          </tr></thead>
          <tbody>{filtered.map(r=>(
            <tr key={r.asin} style={{opacity:r.active?1:.55}}>
              <td><input type="checkbox" checked={selected.has(r.asin)} onChange={()=>toggleSelect(r.asin)} style={{cursor:"pointer"}}/></td>
              <td style={{textAlign:"left"}}>
                <button type="button" className="badge" title="Click to switch" onClick={()=>toggle(r.asin)} style={{["--bc" as any]:r.active?t.green:t.text3,cursor:"pointer"}}>
                  {r.active?"Active":"Inactive"}
                </button>
              </td>
              <td style={{textAlign:"left"}}><div className="tn" style={{maxWidth:200}} title={r.finalName}>{r.finalName}</div></td>
              <td style={{textAlign:"left"}}><span className="ta">{r.asin}</span></td>
              <td style={{textAlign:"left"}}><span className="ta" style={{color:t.text2}}>{r.sellerSku}</span></td>
              <td style={{textAlign:"left"}}>
                <Select className="sel sel-sm" value={r.category} onChange={e=>setCategory(r.asin,e.target.value)}>
                  {CATEGORY_OPTIONS.map(c=><option key={c} value={c}>{c}</option>)}
                </Select>
              </td>
              <td style={{minWidth:200,textAlign:"left"}}>
                {editingNote===r.asin?(
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    <input autoFocus value={noteValue} onChange={e=>setNoteValue(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")setNote(r.asin,noteValue);if(e.key==="Escape")setEditingNote(null);}}
                      style={{flex:1,height:32,padding:"0 10px",background:t.bg,border:`1px solid ${t.border2}`,borderRadius:8,color:t.text,fontSize:13,fontFamily:"inherit",outline:"none"}}
                      placeholder="Add note…"/>
                    <span style={{cursor:"pointer",color:t.green,fontSize:14}} onClick={()=>setNote(r.asin,noteValue)}>✓</span>
                    <span style={{cursor:"pointer",color:t.text3,fontSize:14}} onClick={()=>setEditingNote(null)}>✕</span>
                  </div>
                ):(
                  <div onClick={()=>{setEditingNote(r.asin);setNoteValue(r.note);}} className="dash-row" style={{cursor:"pointer",fontSize:13,fontFamily:"'Instrument Sans',system-ui,sans-serif",color:r.note?t.text2:t.text3,padding:"6px 8px",margin:"0 -8px",borderRadius:8,minWidth:120}} title="Click to edit">
                    {r.note||<span style={{opacity:.7}}>Add a note</span>}
                  </div>
                )}
              </td>
              <td>
                <input type="number" min={0} step="0.1" placeholder="auto" defaultValue={r.priorityDemand??""}
                  onBlur={e=>setPriorityDemand(r.asin,e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")e.target.blur();}}
                  style={{width:72,height:32,padding:"0 10px",background:t.bg,border:`1px solid ${t.border2}`,borderRadius:8,color:t.text,fontSize:13,textAlign:"right",fontFamily:"inherit",fontWeight:700,outline:"none"}}/>
              </td>
              {data&&<>
                <td>{r.hasLiveData?<span style={{color:doiColor(r.doi),fontWeight:700}}>{isFinite(r.doi)&&r.doi<999?fmt(r.doi,1)+"d":"∞"}</span>:<span style={{color:t.text3,fontSize:12}}>inactive</span>}</td>
                <td>{r.hasLiveData?fmt(r.stock):"—"}</td>
                <td>{r.hasLiveData?fmt(r.demand,2):"—"}</td>
                <td style={{textAlign:"left"}}>{r.hasLiveData?<PBadge action={r.action} priority={r.priority} purchasePct={r.purchasePct||0} replenishPct={r.replenishPct||0} t={t}/>:<span className="badge bgr">Excluded</span>}</td>
              </>}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
    <div style={{marginTop:12,display:"flex",gap:8,alignItems:"center"}}>
      <button className="btn bs" onClick={()=>{
        const blob=new Blob([JSON.stringify(skuCfg,null,2)],{type:"application/json"});
        const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="sku_config.json";a.click();URL.revokeObjectURL(url);
      }}>↓ Export config</button>
      <span style={{fontSize:12.5,color:t.text3}}>Saves the config to a file. To hard-code it, paste it into DEFAULT_SKU_CONFIG.</span>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   AUTH GATE (front-end only — credentials read from "Users" sheet tab)
   Sheet columns: email | password  (password = plaintext OR SHA-256 hex)
═══════════════════════════════════════════════════════════════ */
const AUTH_SHEET_ID="1Va-jdWfO2dmO6R-QCnkg9S2YqIWacx9pKfkW3Th-RGw";
const AUTH_KEY="fba_auth";
// Login backend: the Apps Script web app in apps-script/auth.gs (bound to the PRIVATE auth sheet).
// Paste its /exec URL here. While this is empty the app uses the old public "Users" tab instead.
const AUTH_URL="https://script.google.com/macros/s/AKfycbzZ1XsKGGT8c3rmDHCTU8Zu5s0bKze2JDjD__eYw9MtHdQzEaj_0DD4fb2wWusDBDrV/exec";
async function authCall(body){
  const r=await fetch(AUTH_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body)});
  if(!r.ok) throw new Error(`Login service error (HTTP ${r.status})`);
  return r.json();
}
async function sha256Hex(s){
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function fetchUsers(){
  const r=await fetch(`https://docs.google.com/spreadsheets/d/${AUTH_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Users`);
  if(!r.ok) throw new Error(`Users tab not accessible (HTTP ${r.status})`);
  const txt=await r.text();
  if(txt.trim().startsWith("<!")) throw new Error('"Users" tab missing or sheet not public');
  return parseCSV(txt);
}
// returns the matching row's stored password if creds valid, else null
async function checkCreds(rows,email,pass){
  const e=email.trim().toLowerCase();
  const h=await sha256Hex(pass);
  for(const row of rows){
    const keys=Object.keys(row);
    const ek=keys.find(k=>k.trim().toLowerCase()==="email");
    const pk=keys.find(k=>k.trim().toLowerCase()==="password");
    if(!ek||!pk) continue;
    if(String(row[ek]).trim().toLowerCase()!==e) continue;
    const stored=String(row[pk]).trim();
    if(stored===pass||stored.toLowerCase()===h) return stored;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   LOGIN — split screen: ink brand panel + form. Follows the OS light/dark setting.
═══════════════════════════════════════════════════════════════ */
function LoginView({email,setEmail,pass,setPass,err,busy,onSubmit}:any){
  const[dark,setDark]=useState(()=>{try{return window.matchMedia("(prefers-color-scheme: dark)").matches;}catch(_){return false;}});
  const[show,setShow]=useState(false);
  const[caps,setCaps]=useState(false);
  const t=dark?DARK:LIGHT;
  const css=`
@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
html,body{background:${t.bg}!important}
.au{text-align:left;min-height:100vh;display:grid;grid-template-columns:minmax(320px,5fr) minmax(360px,6fr);background:${t.bg};color:${t.text};font-family:'Instrument Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.au *{box-sizing:border-box}
.au-brand{position:relative;background:${dark?"#0a0c0f":"#12161c"};color:#eceff3;padding:40px 56px;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;border-right:1px solid ${t.border}}
.au-logo{position:absolute;top:40px;left:56px;color:#eceff3}
.au-mark{width:36px;height:36px;border-radius:8px;background:#eceff3;color:#12161c;display:flex;align-items:center;justify-content:center}
.au-claim{font-size:38px;line-height:1.1;font-weight:600;letter-spacing:-.8px;max-width:360px;text-align:left}
.au-sub{margin-top:14px;font-size:16px;line-height:1.5;color:#9099a6;max-width:400px}
.au-stats{display:flex;gap:28px;font-family:'IBM Plex Mono',monospace}
.au-stat b{display:block;font-size:22px;font-weight:500;color:#eceff3}
.au-stat span{font-family:'Instrument Sans',sans-serif;font-size:13px;color:#9099a6}
.au-main{display:flex;align-items:center;justify-content:flex-start;padding:32px 56px;position:relative}
.au-theme{position:absolute;top:20px;right:20px;width:40px;height:40px;border-radius:8px;border:1px solid ${dark?"#6b7480":"#8b94a0"};background:${t.surface};color:${t.text};cursor:pointer;display:flex;align-items:center;justify-content:center}
.au-form{width:100%;max-width:380px;display:flex;flex-direction:column;gap:16px;text-align:left}
.au-form h1{color:${t.text};font-size:28px;font-weight:600;letter-spacing:-.4px;line-height:1.2}
.au-form p.lead{font-size:15px;color:${t.text3};margin-top:-8px}
.au-field{display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:500;color:${t.text2}}
.au-wrap{position:relative}
.au-in{width:100%;height:44px;padding:0 12px;border-radius:8px;border:1px solid ${dark?"#6b7480":"#8b94a0"};background:${t.surface};color:${t.text};font-size:16px;font-family:inherit;outline:none}
.au-in:focus{border-color:${t.text};outline:2px solid ${t.focus};outline-offset:1px}
.au-eye{position:absolute;right:4px;top:4px;height:36px;padding:0 10px;border:0;background:transparent;color:${t.text3};font-size:13px;font-weight:500;cursor:pointer;border-radius:6px;font-family:inherit}
.au-eye:hover{color:${t.text}}
.au-btn{height:44px;border-radius:8px;border:1px solid ${t.text};background:${t.text};color:${t.bg};font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:10px}
.au-btn:disabled{opacity:.6;cursor:wait}
.au-btn:hover:not(:disabled){opacity:.9}
.au-err{display:flex;gap:8px;padding:10px 12px;border-radius:8px;border:1px solid ${t.red};color:${t.red};font-size:14px;background:${t.surface}}
.au-hint{font-size:13px;color:${t.text3}}
.au-spin{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;animation:auspin .8s linear infinite}
@keyframes auspin{to{transform:rotate(360deg)}}
.au button:focus-visible{outline:2px solid ${t.focus};outline-offset:2px}
@media(max-width:860px){.au{grid-template-columns:1fr;grid-template-rows:auto 1fr}.au-brand{padding:16px 20px;flex-direction:row;align-items:center;justify-content:flex-start;border-right:0;border-bottom:1px solid ${t.border}}.au-logo{position:static}.au-claim,.au-sub,.au-stats{display:none}.au-main{align-items:flex-start;justify-content:center;padding:28px 20px}.au-theme{top:12px;right:16px}.au-form{padding-top:44px}}
@media(prefers-reduced-motion:reduce){.au-spin{animation-duration:2s}}`;
  return(
    <div className="au">
      <style>{css}</style>
      <aside className="au-brand">
        <div className="au-logo"><Logo size={40}/></div>
        <div>
          <div className="au-claim">Know what to ship before it runs out.</div>
        </div>
      </aside>
      <main className="au-main">
        <button type="button" className="au-theme" aria-label={dark?"Switch to light theme":"Switch to dark theme"} onClick={()=>setDark(d=>!d)}>
          {dark?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>}
        </button>
        <form className="au-form" onSubmit={onSubmit} noValidate>
          <h1>Sign in</h1>
          <p className="lead">Use the email and password your admin added.</p>
          <label className="au-field">Email
            <input className="au-in" type="email" autoComplete="username" autoFocus value={email} onChange={e=>setEmail(e.target.value)} aria-invalid={!!err}/>
          </label>
          <label className="au-field">Password
            <div className="au-wrap">
              <input className="au-in" style={{paddingRight:64}} type={show?"text":"password"} autoComplete="current-password" value={pass}
                onChange={e=>setPass(e.target.value)} onKeyUp={e=>setCaps(e.getModifierState&&e.getModifierState("CapsLock"))} aria-invalid={!!err}/>
              <button type="button" className="au-eye" onClick={()=>setShow(v=>!v)} aria-pressed={show}>{show?"Hide":"Show"}</button>
            </div>
            {caps&&<span className="au-hint">Caps Lock is on.</span>}
          </label>
          {err&&<div className="au-err" role="alert">{err}</div>}
          <button type="submit" className="au-btn" disabled={busy}>{busy&&<span className="au-spin"/>}{busy?"Checking…":"Sign in"}</button>
          <div className="au-hint">No access yet? Ask your admin to add your email to the Users sheet.</div>
        </form>
      </main>
    </div>
  );
}
export default function FBAPlanner(){
  const[state,setState]=useState("checking"); // checking | out | in
  const[email,setEmail]=useState("");
  const[pass,setPass]=useState("");
  const[err,setErr]=useState(null);
  const[busy,setBusy]=useState(false);

  // On load: a saved token opens the app immediately; it is re-checked in the background
  // (removed users are signed out within about a minute). Offline / service down -> stay signed in.
  useEffect(()=>{
    let saved=null;
    try{ saved=JSON.parse(localStorage.getItem(AUTH_KEY)||"null"); }catch(_){}
    const dropLogin=()=>{ try{localStorage.removeItem(AUTH_KEY);}catch(_){} setState("out"); };

    if(AUTH_URL){
      if(!saved||!saved.token||!(saved.exp>Date.now())){ if(saved) dropLogin(); else setState("out"); return; }
      setState("in");
      authCall({action:"verify",token:saved.token})
        .then(r=>{ if(r&&r.ok===false) dropLogin(); })
        .catch(()=>{});
      return;
    }

    // Legacy: public Users sheet tab
    if(!saved||!saved.email||!saved.stored){ setState("out"); return; }
    (async()=>{
      try{
        const rows=await fetchUsers();
        const ok=rows.some(row=>{
          const keys=Object.keys(row);
          const ek=keys.find(k=>k.trim().toLowerCase()==="email");
          const pk=keys.find(k=>k.trim().toLowerCase()==="password");
          return ek&&pk&&String(row[ek]).trim().toLowerCase()===saved.email&&String(row[pk]).trim()===saved.stored;
        });
        if(ok) setState("in");
        else dropLogin();
      }catch(_){ setState("in"); }
    })();
  },[]);

  async function doLogin(ev){
    ev.preventDefault();
    if(!email.trim()||!pass){ setErr("Enter email and password"); return; }
    setBusy(true); setErr(null);
    try{
      if(AUTH_URL){
        const r=await authCall({action:"login",email:email.trim(),password:pass});
        if(!r.ok){ setErr(r.error||"Wrong email or password"); }
        else{
          try{localStorage.setItem(AUTH_KEY,JSON.stringify({email:r.email,token:r.token,exp:r.exp}));}catch(_){}
          setPass(""); setState("in");
        }
      }else{
        const rows=await fetchUsers();
        const stored=await checkCreds(rows,email,pass);
        if(stored===null){ setErr("Wrong email or password"); }
        else{
          try{localStorage.setItem(AUTH_KEY,JSON.stringify({email:email.trim().toLowerCase(),stored}));}catch(_){}
          setPass(""); setState("in");
        }
      }
    }catch(e){ setErr("Login error: "+e.message); }
    finally{ setBusy(false); }
  }
  function logout(){
    try{localStorage.removeItem(AUTH_KEY);}catch(_){}
    setEmail(""); setPass(""); setState("out");
  }

  if(state==="checking") return <div style={{minHeight:"100vh",background:"#0e1114"}}/>;
  if(state==="out") return <LoginView email={email} setEmail={setEmail} pass={pass} setPass={setPass} err={err} busy={busy} onSubmit={doLogin}/>;
  let authEmail="";
  try{ authEmail=JSON.parse(localStorage.getItem(AUTH_KEY)||"{}").email||""; }catch(_){}
  return <FBAPlannerApp onLogout={logout} authEmail={authEmail}/>;
}

/* App-styled confirmation (replaces the browser's window.confirm). Esc / backdrop cancel;
   focus starts on Cancel so Enter never confirms by accident. */
function ConfirmDialog({open,title,message,confirmLabel,danger,onConfirm,onCancel}:any){
  const cancelRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const prev=document.activeElement as HTMLElement|null;
    cancelRef.current?.focus();
    const onKey=(e:KeyboardEvent)=>{ if(e.key==="Escape"){e.stopPropagation();onCancel();} };
    document.addEventListener("keydown",onKey,true);
    return()=>{document.removeEventListener("keydown",onKey,true);prev?.focus?.();};
  },[open]);
  if(!open)return null;
  return createPortal(
    <div className="cfm-wrap" onMouseDown={e=>{if(e.target===e.currentTarget)onCancel();}}>
      <div className="cfm" role="alertdialog" aria-modal="true" aria-labelledby="cfm-t" aria-describedby="cfm-m">
        <h2 id="cfm-t" className="cfm-t">{title}</h2>
        <p id="cfm-m" className="cfm-m">{message}</p>
        <div className="cfm-b">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className={`btn ${danger?"bd":"bp"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>,document.body);
}

/* Logo lockup: stepped-blocks mark + two-line wordmark as one unit. Uses currentColor. */
function Logo({size=28}:{size?:number}){
  const fs=Math.round(size*0.5);
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:Math.round(size*0.34),color:"inherit",lineHeight:1}} aria-label="Inventory Forecast" role="img">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" style={{flexShrink:0}}>
        <rect x="1" y="1" width="8" height="8" rx="1.6" fill="currentColor" opacity="1"/>
        <rect x="1" y="11" width="8" height="8" rx="1.6" fill="currentColor" opacity="1"/>
        <rect x="11" y="11" width="8" height="8" rx="1.6" fill="currentColor" opacity="0.85"/>
        <rect x="1" y="21" width="8" height="8" rx="1.6" fill="currentColor" opacity="1"/>
        <rect x="11" y="21" width="8" height="8" rx="1.6" fill="currentColor" opacity="0.85"/>
        <rect x="21" y="21" width="8" height="8" rx="1.6" fill="currentColor" opacity="0.65"/>
        <rect x="1" y="31" width="8" height="8" rx="1.6" fill="currentColor" opacity="1"/>
        <rect x="11" y="31" width="8" height="8" rx="1.6" fill="currentColor" opacity="0.85"/>
        <rect x="21" y="31" width="8" height="8" rx="1.6" fill="currentColor" opacity="0.65"/>
        <rect x="31" y="31" width="8" height="8" rx="1.6" fill="currentColor" opacity="0.45"/>
      </svg>
      <span aria-hidden="true" style={{display:"flex",flexDirection:"column",fontWeight:700,fontSize:fs,letterSpacing:"-.02em",lineHeight:.98,textAlign:"left",whiteSpace:"nowrap"}}>
        <span>Inventory</span><span style={{opacity:.72}}>Forecast</span>
      </span>
    </span>
  );
}

/* Mounts its chart a beat after the page has painted (staggered per chart) so the
   first screen stays responsive; a same-height placeholder holds the space. */
function DeferredChart({h,delay=0,children}:any){
  const[ready,setReady]=useState(false);
  useEffect(()=>{
    let t:any, raf=requestAnimationFrame(()=>{ t=setTimeout(()=>setReady(true),150+delay); });
    return()=>{cancelAnimationFrame(raf);clearTimeout(t);};
  },[delay]);
  if(!ready) return <div className="chart-skel" style={{height:h}} aria-busy="true"/>;
  return <div className="chart-reveal">{children}</div>;
}

/* ═══════════════════════════════════════════════════════════════
   SELECT — the one dropdown used everywhere (replaces native <select>).
   Drop-in: takes <option> children, value/defaultValue, onChange({target:{value}}).
   Keyboard: Enter/Space/Arrows open · Up/Down/Home/End move · Enter picks ·
   Esc closes and returns focus · type-ahead. Search box when 8+ options.
═══════════════════════════════════════════════════════════════ */
function Select({value,defaultValue,onChange,children,className="sel",style,"aria-label":ariaLabel}:any){
  const opts=Children.toArray(children).filter(isValidElement).map((c:any)=>({
    value:String(c.props.value??Children.toArray(c.props.children).join("")),
    label:Children.toArray(c.props.children).join(""),
  }));
  const[inner,setInner]=useState(String(defaultValue??opts[0]?.value??""));
  const cur=value!==undefined?String(value):inner;
  const[open,setOpen]=useState(false);
  const[q,setQ]=useState("");
  const[hl,setHl]=useState(0);
  const[pos,setPos]=useState<any>(null);
  const trigRef=useRef<HTMLButtonElement>(null);
  const menuRef=useRef<HTMLDivElement>(null);
  const searchRef=useRef<HTMLInputElement>(null);
  const typed=useRef({s:"",t:0 as any});
  const searchable=opts.length>=8;
  const shown=searchable&&q?opts.filter(o=>o.label.toLowerCase().includes(q.toLowerCase())):opts;
  const curLabel=opts.find(o=>o.value===cur)?.label??"";

  function openMenu(){
    const r=trigRef.current!.getBoundingClientRect();
    const need=Math.min(280,opts.length*40+(searchable?44:0)+8);
    const below=window.innerHeight-r.bottom;
    const up=below<need&&r.top>below;
    setPos({left:r.left,minWidth:r.width,...(up?{bottom:window.innerHeight-r.top+4}:{top:r.bottom+4}),maxH:Math.max(120,Math.min(280,(up?r.top:below)-12))});
    setQ("");setHl(Math.max(0,opts.findIndex(o=>o.value===cur)));setOpen(true);
  }
  function close(refocus=true){setOpen(false);if(refocus)trigRef.current?.focus();}
  function pick(o:{value:string}){
    if(value===undefined)setInner(o.value);
    onChange?.({target:{value:o.value}});
    close();
  }
  useEffect(()=>{
    if(!open)return;
    if(searchable)searchRef.current?.focus();
    const down=(e:MouseEvent)=>{
      const n=e.target as Node;
      if(menuRef.current?.contains(n)||trigRef.current?.contains(n))return;
      setOpen(false);
    };
    const away=(e:Event)=>{ if(menuRef.current?.contains(e.target as Node))return; setOpen(false); };
    document.addEventListener("mousedown",down);
    window.addEventListener("scroll",away,true);
    window.addEventListener("resize",away);
    return()=>{document.removeEventListener("mousedown",down);window.removeEventListener("scroll",away,true);window.removeEventListener("resize",away);};
  },[open,searchable]);
  useEffect(()=>{
    if(open)menuRef.current?.querySelector(".sel-opt.hl")?.scrollIntoView({block:"nearest"});
  },[hl,open]);

  function onKey(e:any){
    const k=e.key;
    if(!open){
      if(k==="Enter"||k===" "||k==="ArrowDown"||k==="ArrowUp"){e.preventDefault();openMenu();}
      return;
    }
    if(k==="ArrowDown"){e.preventDefault();setHl(h=>Math.min(shown.length-1,h+1));}
    else if(k==="ArrowUp"){e.preventDefault();setHl(h=>Math.max(0,h-1));}
    else if(k==="Home"&&!searchable){e.preventDefault();setHl(0);}
    else if(k==="End"&&!searchable){e.preventDefault();setHl(shown.length-1);}
    else if(k==="Enter"){e.preventDefault();if(shown[hl])pick(shown[hl]);}
    else if(k==="Escape"){e.preventDefault();e.stopPropagation();close();}
    else if(k==="Tab"){setOpen(false);}
    else if(!searchable&&k.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
      clearTimeout(typed.current.t);
      typed.current.s+=k.toLowerCase();
      typed.current.t=setTimeout(()=>{typed.current.s="";},600);
      const i=shown.findIndex(o=>o.label.toLowerCase().startsWith(typed.current.s));
      if(i>=0)setHl(i);
    }
  }

  return(<>
    <button ref={trigRef} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
      className={className} style={style} onClick={()=>open?close(false):openMenu()} onKeyDown={onKey}>
      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{curLabel}</span>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flexShrink:0}}><polyline points="3,5 7,9 11,5"/></svg>
    </button>
    {open&&pos&&createPortal(
      <div ref={menuRef} className="sel-menu" role="listbox" style={{left:pos.left,minWidth:pos.minWidth,top:pos.top,bottom:pos.bottom,maxHeight:pos.maxH}}>
        {searchable&&<input ref={searchRef} className="sel-search" placeholder="Search" aria-label="Search options" value={q} onChange={e=>{setQ(e.target.value);setHl(0);}} onKeyDown={onKey}/>}
        {shown.length===0&&<div style={{padding:"10px",fontSize:14,opacity:.7}}>No matches</div>}
        {shown.map((o,i)=>(
          <div key={o.value} role="option" aria-selected={o.value===cur}
            className={`sel-opt${i===hl?" hl":""}${o.value===cur?" on":""}`}
            onMouseEnter={()=>setHl(i)} onMouseDown={e=>e.preventDefault()} onClick={()=>pick(o)}>
            <span>{o.label}</span>
            {o.value===cur&&<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="2.5,7.5 5.5,10.5 11.5,3.5"/></svg>}
          </div>
        ))}
      </div>,document.body)}
  </>);
}

function FBAPlannerApp({onLogout,authEmail}:{onLogout?:()=>void;authEmail?:string}){
  const dataInputRef=useRef(null);
  const[dark,setDark]=useState(true);
  const[parseDebug,setParseDebug]=useState(null);
  const t=dark?DARK:LIGHT;
  const[tab,setTab]=useState("input");
  const[menuOpen,setMenuOpen]=useState(false);
  const[confirmKind,setConfirmKind]=useState<null|"signout"|"reset">(null);
  const[rawData,setRawData]=useState(null);
  const[data,setData]=useState(null);
  const[warnings,setWarnings]=useState([]);
  const[loading,setLoading]=useState(false);
  const[selSku,setSelSku]=useState(null);
  const[settings,setSettings]=useState({totalLeadTime:0,safetyDays:30,fbaCoverDays:30,inclFBA:true,inclFC:true,inclInbound:true,inclTransfer:true,inclPO:false});
  const[skuCfg,setSkuCfgRaw]=useState(()=>loadSkuConfig());
  const setSkuCfg=cfg=>{setSkuCfgRaw(cfg);saveSkuConfig(cfg);};
  const[poUnits,setPoUnitsRaw]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("fba_po_units")||"{}");}catch(_){return {};}
  });
  const setPoUnits=(asin,val)=>{
    setPoUnitsRaw(prev=>{
      const next={...prev};
      const n=parseInt(val,10);
      if(!val||isNaN(n)||n<=0) delete next[asin]; else next[asin]=n;
      try{localStorage.setItem("fba_po_units",JSON.stringify(next));}catch(_){}
      return next;
    });
  };
  const[extraInbound,setExtraInboundRaw]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("fba_extra_inbound")||"{}");}catch(_){return {};}
  });
  const setExtraInbound=(asin,val)=>{
    setExtraInboundRaw(prev=>{
      const next={...prev};
      const n=parseInt(val,10);
      if(!val||isNaN(n)||n<=0) delete next[asin]; else next[asin]=n;
      try{localStorage.setItem("fba_extra_inbound",JSON.stringify(next));}catch(_){}
      return next;
    });
  };
  // Reset every SKU's Purchased Units, Priority Demand and Add Inbound back to default (unset/auto).
  function resetManualValues(){
    setPoUnitsRaw({});
    try{localStorage.removeItem("fba_po_units");}catch(_){}
    setExtraInboundRaw({});
    try{localStorage.removeItem("fba_extra_inbound");}catch(_){}
    setSkuCfgRaw(prev=>{
      const next={};
      Object.keys(prev).forEach(asin=>{
        const {priorityDemand, ...rest}=prev[asin];
        next[asin]=rest;
      });
      saveSkuConfig(next);
      return next;
    });
  }
  // Per-PO include/exclude selection — { [asin]: { [rowKey]: false } }, opt-out model
  // (a PO counts unless explicitly unchecked), so default behavior is unchanged.
  // Keyed by row position (1,2,3,...), not PO Number text — see buildOpenPoMap for why.
  const[poSelection,setPoSelectionRaw]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("fba_po_selection")||"{}");}catch(_){return {};}
  });
  const togglePoSelection=(asin,rowKey)=>{
    setPoSelectionRaw(prev=>{
      const cur=prev[asin]||{};
      const wasIncluded=cur[rowKey]!==false;
      const nextForAsin={...cur,[rowKey]:!wasIncluded};
      if(nextForAsin[rowKey]===true) delete nextForAsin[rowKey]; // true is the default, no need to store it
      const next={...prev};
      if(Object.keys(nextForAsin).length===0) delete next[asin]; else next[asin]=nextForAsin;
      try{localStorage.setItem("fba_po_selection",JSON.stringify(next));}catch(_){}
      return next;
    });
  };

  // Clear any stale adjustment multipliers from previous sessions
  useEffect(()=>{ try { localStorage.removeItem("fba_sales_adj"); } catch(_) {} },[]);

  const onLoaded=useCallback(({invRows,ordRows,ledRows,ltRows,purchRows,fbaInvRows,debug})=>{
    const{inv,warnings:iw}=processInventory(invRows,fbaInvRows);
    const{salesByAsinDay,salesByAsinDayChart,warnings:ow,maxDate,minSalesDate,regionalSales,citySales,lastOrderDate}=processOrders(ordRows);
    const{fcData,ledgerDate}=processLedger(ledRows||[]);
    const ltData=processLeadtime(ltRows||[]);
    setWarnings([...iw,...ow]);
    setParseDebug(debug||null);
    setRawData({inv,salesByAsinDay,salesByAsinDayChart,fcData,ltData,purchRows:purchRows||[],maxDate,minSalesDate,ledgerDate,regionalSales,citySales,lastOrderDate});
  },[]);

  // Recomputed whenever the purchase file or the per-PO selection changes,
  // so unchecking a PO in SKU Detail is reflected everywhere without a reload.
  const openPoMap=useMemo(()=>buildOpenPoMap(rawData?.purchRows||[],poSelection),[rawData?.purchRows,poSelection]);

  useEffect(()=>{
    if(!rawData) return;
    const activeInv={};
    Object.keys(rawData.inv).forEach(asin=>{
      if(isActive(skuCfg,asin)) activeInv[asin]=rawData.inv[asin];
    });
    setData(computeAll(activeInv,rawData.salesByAsinDay,rawData.fcData,settings,rawData.maxDate,rawData.regionalSales,rawData.citySales,rawData.ltData,poUnits,rawData.lastOrderDate,rawData.salesByAsinDayChart,openPoMap,skuCfg,extraInbound));
    if(tab==="input") setTab("dashboard");
  },[rawData,settings,skuCfg,poUnits,extraInbound,openPoMap]);

  // Launch screen: stay on a loader until data is fetched, computed and the first view has painted.
  const[booted,setBooted]=useState(false);
  const sawLoading=useRef(false);
  useEffect(()=>{ if(loading) sawLoading.current=true; },[loading]);
  useEffect(()=>{
    if(booted) return;
    if(data){
      let r2=0;
      const r1=requestAnimationFrame(()=>{ r2=requestAnimationFrame(()=>setBooted(true)); });
      return()=>{ cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    if(sawLoading.current&&!loading) setBooted(true); // load failed / no data: reveal Data Input with its error
  },[data,loading,booted]);

  const wc=warnings.filter(w=>w.type.includes("unmapped")).length;
  const fcCrit=data?Object.values(data).filter(d=>
    d.fcPlanning?.fcs?.some(f=>f.status==="stockout"||f.status==="critical")
  ).length:0;
  const critCount=data?Object.values(data).reduce((s,d)=>
    s+(d.fcPlanning?.fcs?.filter(f=>f.status==="stockout"||f.status==="critical").length||0),0
  ):0;
  const inactiveCount=Object.values(skuCfg).filter(c=>c.active===false).length;

  const procCrit=data?Object.values(data).filter(d=>{
    if(!rawData?.ltData) return false;
    const lt=rawData.ltData[d.asin];
    if(!lt) return false;
    const wfAds=d.velocity.demand;
    const totalInv=(d.fbaAvailable||0)+(d.fcSellable||0);
    const doh=wfAds>0?totalInv/wfAds:Infinity;
    return wfAds>0&&(totalInv===0||(lt.air?.total&&doh<lt.air.total)||(lt.sea?.total&&doh<lt.sea.total));
  }).length:0;

  const TITLES={input:"Data Input",dashboard:"Dashboard",allskus:"All SKUs",
    fc:"FC View",cover:"Stock Cover",lis:"LIS — Send Stock",procurement:"Procurement Forecast",
    skumgr:"SKU Manager",warnings:"Data Quality"};
  const pageTitle = tab==="detail"&&selSku&&data?.[selSku]
    ? data[selSku].finalName
    : (TITLES[tab]||"Dashboard");

  const TABS=[
    {id:"input",ic:"IN",l:"Data Input"},
    {id:"dashboard",ic:"DB",l:"Dashboard"},
    {id:"allskus",ic:"SKU",l:"All SKUs"},
    {id:"fc",ic:"FC",l:"FC View",badge:fcCrit,bc:"b"},
    {id:"cover",ic:"CV",l:"Stock Cover"},
    {id:"lis",ic:"LIS",l:"LIS",badge:critCount||null,bc:"r"},
    {id:"procurement",ic:"PR",l:"Procurement",badge:procCrit,bc:""},
    {id:"skumgr",ic:"MG",l:"SKU Manager",badge:inactiveCount||null,bc:"y"},
    {id:"warnings",ic:"DQ",l:"Data Quality",badge:wc},
  ];

  const goSku=asin=>{setSelSku(asin);setTab("detail");};

  // Anchor date for display
  const anchorLabel = rawData?.maxDate ? `Data: ${fmtDate(rawData.maxDate)}` : fmtDate(getToday());

  const firstName=(authEmail||"").split("@")[0].split(/[._-]/)[0].replace(/^./,c=>c.toUpperCase())||"Account";
  // Theme switch: gradual cross-dissolve between the old and new theme via the
  // View Transitions API; browsers without it (or with reduced motion) just switch.
  function toggleTheme(){
    const doc:any=document;
    const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(!doc.startViewTransition||reduce){ setDark(d=>!d); return; }
    const vt=doc.startViewTransition(()=>{ flushSync(()=>setDark(d=>!d)); });
    vt.ready.then(()=>{
      document.documentElement.animate(
        {opacity:[0,1]},
        {duration:800,easing:"cubic-bezier(.45,0,.25,1)",pseudoElement:"::view-transition-new(root)"}
      );
    }).catch(()=>{});
  }
  const goTab=(id:string)=>{setSelSku(null);setTab(id);setMenuOpen(false);};
  const isOn=(id:string)=>tab===id||(tab==="detail"&&id==="allskus");
  const isDisabled=(id:string)=>id!=="input"&&!data&&id!=="warnings";
  const TAB_BAR=["dashboard","allskus","fc","lis"];
  const signOut=()=>{setMenuOpen(false);setConfirmKind("signout");};
  const askReset=()=>{setMenuOpen(false);setConfirmKind("reset");};

  function navItems(){
    return TABS.map(tb=>(
      <button key={tb.id} type="button" disabled={isDisabled(tb.id)}
        className={`ni${isOn(tb.id)?" on":""}${isDisabled(tb.id)?" disabled":""}`}
        aria-current={isOn(tb.id)?"page":undefined} onClick={()=>goTab(tb.id)}>
        <span className="ni-ic">{NAV_ICONS[tb.id]}</span>
        <span className="ni-txt">{tb.l}</span>
        {tb.badge>0&&<span className={`nb${tb.bc==="r"?" r":""}`}>{tb.badge}</span>}
      </button>
    ));
  }

  return(<>
    <style>{makeCSS(t)}</style>
    <div id="fba-root">
      {/* SIDEBAR: fixed 240px on laptops; phones get the top bar + tab bar instead */}
      <div className={`sb-bg${menuOpen?" open":""}`} onClick={()=>setMenuOpen(false)}/>
      <nav className={`sb${menuOpen?" open":""}`} aria-label="Main" aria-hidden={!menuOpen} onKeyDown={e=>{if(e.key==="Escape")setMenuOpen(false);}}>
        <div className="sb-logo"><Logo size={30}/></div>
        <div className="sb-nav">{navItems()}</div>
        <div className="sb-user">
          <div className="sb-user-name"><b>{firstName}</b>{authEmail}</div>
          {onLogout&&<button type="button" className="btn btn-signout" onClick={signOut}>Sign out</button>}
        </div>
      </nav>

      {/* PHONE: bottom tab bar + menu sheet */}
      <nav className="tabbar" aria-label="Main">
        {TAB_BAR.map(id=>{const tb=TABS.find(x=>x.id===id);return(
          <button key={id} type="button" className={`tab${isOn(id)?" on":""}${isDisabled(id)?" disabled":""}`} aria-current={isOn(id)?"page":undefined} onClick={()=>goTab(id)}>
            <span className="tab-ic">{NAV_ICONS[id]}</span><span>{id==="procurement"?"Procure":tb.l}</span>
          </button>);})}
      </nav>
      <div className={`msheet-wrap${menuOpen?" open":""}`} aria-hidden={!menuOpen}>
        <div className="msheet-bg" onClick={()=>setMenuOpen(false)}/>
        <div className="msheet" role="dialog" aria-label="Menu" onKeyDown={e=>{if(e.key==="Escape")setMenuOpen(false);}}>
          <div className="msheet-hd">
            <div className="sb-user-name"><b>{firstName}</b>{authEmail}</div>
            <button type="button" className="mbar-btn" aria-label="Close menu" onClick={()=>setMenuOpen(false)}>✕</button>
          </div>
          <div>{navItems()}</div>
          <div className="msheet-actions" aria-label="Actions">
            <button type="button" className="btn" disabled={loading} onClick={()=>{dataInputRef.current?.refreshSheets();setMenuOpen(false);}}>{loading?"Refreshing…":"Refresh data"}</button>
            <button type="button" className="btn bdl" onClick={askReset}>Reset values</button>
            <button type="button" className="btn" onClick={toggleTheme}>{dark?"Switch to light theme":"Switch to dark theme"}</button>
          </div>
          {onLogout&&<button type="button" className="btn btn-signout" style={{width:"100%",marginTop:12}} onClick={signOut}>Sign out</button>}
        </div>
      </div>

      {/* MAIN */}
      <div className="main" style={{position:"relative"}}>
        {!booted&&<div role="status" aria-live="polite" style={{position:"absolute",inset:0,zIndex:60,background:t.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
          <div className="sp"/>
          <div style={{fontSize:14,fontWeight:600,color:t.text}}>Loading inventory data…</div>
          <div style={{fontSize:12,color:t.text3}}>Fetching sheets and calculating</div>
        </div>}
        <div className="mbar">
          <div className="mbar-brand"><Logo size={28}/></div>
          <div className="mbar-r"><button type="button" className="mbar-btn" aria-label="Open menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}>☰</button></div>
        </div>
        <div className="topbar">
          <button type="button" className="tb-menu" aria-label="Open navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}>☰</button>
          <div style={{overflow:"hidden",minWidth:0}}>
            <div className="tb-title">{pageTitle}</div>
            {data&&<div className="tb-sub">
              {tab==="detail"&&selSku&&data[selSku]
                ? <>{data[selSku].sellerSku} · {data[selSku].asin}</>
                : <>{Object.keys(data).length} SKUs · Safety {settings.safetyDays}d · +{settings.totalLeadTime}d delay · {anchorLabel}</>}
            </div>}
          </div>
          <div className="tb-r">
            {rawData?.minSalesDate&&rawData?.maxDate&&(
              <span className="tb-meta">
                Sales {rawData.minSalesDate.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})} – {rawData.maxDate.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}
                {rawData?.ledgerDate&&<> · Ledger {rawData.ledgerDate.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</>}
              </span>
            )}
            <div className="tb-group">
            <button className="tb-btn pri" onClick={()=>dataInputRef.current?.refreshSheets()} disabled={loading} title="Re-fetch data from Google Sheets">{loading?"Refreshing…":"⟳ Refresh"}</button>
            <button className="tb-btn danger" onClick={askReset} title="Reset Purchased Units, Priority Demand and Add Inbound for every SKU back to default">↺ Reset Values</button>
            <button className="tb-btn tb-icon" onClick={toggleTheme} aria-label={dark?"Switch to light theme":"Switch to dark theme"} title={dark?"Light theme":"Dark theme"}>{dark?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>}</button>
            </div>
          </div>
        </div>
        <div className="content">
          <div style={{display:tab==="input"?"block":"none"}}>
            {loading&&!rawData&&(
              <div className="ld" style={{height:"60vh"}}>
                <div className="sp"/>
                <div style={{fontSize:13,color:t.text2,fontWeight:600}}>Loading your inventory data…</div>
                <div style={{fontSize:11,color:t.text3}}>Fetching Inventory, Sales, Ledger and Leadtime from Google Sheets</div>
              </div>
            )}
            <div style={{display:loading&&!rawData?"none":"block"}}>
              <DataInput ref={dataInputRef} onLoaded={onLoaded} loading={loading} setLoading={setLoading} t={t} parseDebug={parseDebug}/>
              {loading&&<div className="ld"><div className="sp"/><div style={{fontSize:11,color:t.text3}}>Processing data…</div></div>}
            </div>
          </div>
          {data&&<div style={{display:tab==="allskus"?"block":"none"}}><AllSKUs data={data} settings={settings} setSettings={setSettings} onSku={goSku} t={t} setPoUnits={setPoUnits} setExtraInbound={setExtraInbound} skuCfg={skuCfg} setSkuCfg={setSkuCfg}/></div>}
          {tab==="dashboard"&&data&&booted&&<Dashboard data={data} settings={settings} setSettings={setSettings} onSku={goSku} t={t} purchRows={rawData?.purchRows||[]}/>}
          {tab==="fc"&&data&&<FCView data={data} settings={settings} setSettings={setSettings} onSku={goSku} t={t}/>}
          {tab==="cover"&&data&&<StockCoverView data={data} settings={settings} setSettings={setSettings} onSku={goSku} t={t}/>}
          {tab==="lis"&&data&&<LISView data={data} settings={settings} setSettings={setSettings} onSku={goSku} t={t}/>}
          {tab==="procurement"&&data&&<ProcurementForecast data={data} ltData={rawData?.ltData} anchorDate={rawData?.maxDate} openPoMap={openPoMap||{}} settings={settings} t={t}/>}
          {tab==="skumgr"&&<SKUManager skuCfg={skuCfg} setSkuCfg={setSkuCfg} data={data} settings={settings} setSettings={setSettings} t={t}/>}
          {tab==="warnings"&&<WarningsPage warnings={warnings} t={t}/>}
          {tab==="detail"&&data&&selSku&&(
            <SKUDetail
              sku={data[selSku]}
              onBack={()=>setTab("allskus")}
              settings={settings}
              setSettings={setSettings}
              t={t}
              poUnits={poUnits}
              setPoUnits={setPoUnits}
              purchRows={rawData?.purchRows||[]}
              skuCfg={skuCfg}
              setSkuCfg={setSkuCfg}
              extraInbound={extraInbound}
              setExtraInbound={setExtraInbound}
              poSelection={poSelection}
              togglePoSelection={togglePoSelection}
            />
          )}
          {!data&&tab!=="input"&&tab!=="warnings"&&(
            <div className="empty">
              <div className="empty-ic">📊</div>
              <h3>No Data Loaded</h3>
              <p>Go to Data Input to upload CSVs<br/>or connect your Google Sheets.</p>
            </div>
          )}
        </div>
      </div>
    </div>
    <ConfirmDialog open={confirmKind==="signout"} title="Sign out?" message="You will need your email and password to sign in again on this device."
      confirmLabel="Sign out" danger onCancel={()=>setConfirmKind(null)} onConfirm={()=>{setConfirmKind(null);onLogout&&onLogout();}}/>
    <ConfirmDialog open={confirmKind==="reset"} title="Reset all manual values?" message="Purchased Units, Priority Demand and Add Inbound go back to their defaults for every SKU. This can't be undone."
      confirmLabel="Reset values" danger onCancel={()=>setConfirmKind(null)} onConfirm={()=>{setConfirmKind(null);resetManualValues();}}/>
  </>);
}
