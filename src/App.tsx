import { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from "recharts";
import { SKU_MAP } from "./data/skuMap.js";
import { FC_CITY, fcLabel, FC_REGION } from "./data/fcMapping.js";
import { STATE_TO_REGION } from "./data/stateRegion.js";
import { CITY_ALIAS, normalizeCity } from "./data/cityNormalizer.js";
import { DARK, LIGHT } from "./data/themes.js";
import { LOGO_ICON, NAV_ICONS } from "./data/icons.jsx";
import { makeCSS } from "./data/makeCSS.js";


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
    const onh  = n(r,get,"On Hand","on hand","OnHand") || (fba + fct);
    const cost = n(r,get,"Unit Cost (₹)","Unit Cost","unit cost");
    inv[asin]={
      asin, csvSku, finalName:SKU_MAP[asin].finalName, sellerSku:SKU_MAP[asin].sellerSku,
      fcSellable:fc, fcUnsellable:fcU, fbaAvailable:fba, fbaUnsellable:fbaU,
      inbound:inb, processing:proc, fcTransfer:fct, onHand:onh,
      currentStock: onh + fc + inb,
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
    // "Add Inbound" manual field — extra units the user adds on top of the file's
    // Inbound figure; gated by the same "Include Inbound" checkbox, not a separate one.
    const manualInboundQty = extraInbound?.[asin] ?? 0;
    const inboundUnits = (d.inbound||0) + (d.processing||0)*0.8 + manualInboundQty;
    // On Hand = FBA Available + FC Transfer; toggle FC Transfer in/out
    const fbaStock      = inclFBA      ? (d.fbaAvailable||0) : 0;
    const transferStock = inclTransfer ? (d.fcTransfer||0)   : 0;
    const fcStock    = inclFC      ? (d.fcSellable||0) : 0;
    const inbStock   = inclInbound ? inboundUnits : 0;
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
      _poUnits: manualPoQty,
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
    const pWord=<span style={{color:pctColor(purchasePct)}}>Purchase</span>;
    const rWord=<span style={{color:pctColor(replenishPct)}}>Replenish</span>;
    const title=`Purchase: ${purchasePct}% · Replenish: ${replenishPct}%`;
    return(
      <span className={`badge ${containerC}`} title={title} style={{color:"inherit",gap:0}}>
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
  return<span className={`badge ${containerC}`}><span className={`dot ${dotC}`}></span><span style={textColor?{color:textColor}:{}}>{action||"OK"}</span></span>;
}
function DOI({doi,t}){
  if(!isFinite(doi)||doi>999)return<span style={{color:t.green}}>∞</span>;
  const col=doi<7?t.red:doi<21?t.yellow:t.green;
  return<span style={{color:col,fontFamily:"'Inter',system-ui,sans-serif"}}>{fmt(doi,1)}d</span>;
}
function TrendBadge({avg7,avg30,t}){
  const trend=calcTrend(avg7,avg30);
  if(trend==="—") return<span style={{color:t.text3,fontSize:10,fontFamily:"'Inter',system-ui,sans-serif"}}>—</span>;
  return<span style={{fontSize:10,color:trendColor(trend,t),fontFamily:"'Inter',system-ui,sans-serif",whiteSpace:"nowrap"}}>{trend}</span>;
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
      <div style={{fontSize:11,fontFamily:"'Inter',system-ui,sans-serif",color:"inherit",marginBottom:6,opacity:.6}}>Upload</div>
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
      <div style={{padding:"18px 0",textAlign:"center",fontSize:11,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>
        No regional data — ship-state column not found in orders CSV
      </div>
    );
  }

  /* Status palette — solid, no transparency */
  const STATUS = {
    STOCKOUT: { label:"Stockout", icon:"", c:t.red, bg:t.surface, border:t.border },
    CRITICAL: { label:"Critical", icon:"", c:t.red, bg:t.surface, border:t.border },
    LOW:      { label:"At Risk",  icon:"", c:t.yellow, bg:t.surface, border:t.border },
    HEALTHY:  { label:"Healthy",  icon:"", c:t.green, bg:t.surface, border:t.border },
    SURPLUS:  { label:"Surplus",  icon:"⬆",  c:t.purple, bg:t.surface, border:t.border },
    NONE:     { label:"No Data",  icon:"—",  c:t.text3,    bg:t.surface, border:t.border },
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

    return (
      <div style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderLeft: `3px solid ${st.c}`,
        borderRadius: 12,
        padding: "16px 18px",
        display:"flex",
        flexDirection:"column",
        gap:0,
      }}>

        {/* ── Header: region name + status badge ── */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <span style={{
            fontSize:14,fontWeight:600,
            color:t.text,fontFamily:"'Inter',system-ui,sans-serif",
          }}>{region}</span>
          <span style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:500,color:st.c}}>
            <span className="dot" style={{background:st.c}}></span>{st.icon} {st.label}
          </span>
        </div>

        {/* ── Demand number ── */}
        <div style={{marginBottom:8}}>
          <span style={{
            fontSize:28,fontWeight:800,fontFamily:"'Inter',system-ui,sans-serif",
            color:t.text,lineHeight:1,
          }}>{fmt(demand30)}</span>
          <span style={{fontSize:10,color:t.text3,marginLeft:8}}>demand · {p}% of total</span>
        </div>

        {/* ── Stock vs target line ── */}
        {hasStock && (
          <div style={{
            fontSize:11,fontFamily:"'Inter',system-ui,sans-serif",
            marginBottom:10,color:t.text2,
          }}>
            <span style={{color:stock>0?st.c:"#e05252",fontWeight:700}}>{fmt(stock)}</span>
            <span style={{color:t.text3}}> in stock</span>
            {targetStock > 0 && <>
              <span style={{color:t.text3}}>  /  target </span>
              <span style={{color:t.text,fontWeight:600}}>{fmt(targetStock)}</span>
            </>}
            {doi !== null && <span style={{color:t.text3}}> · {fmt(doi,1)}d cover</span>}
          </div>
        )}

        {/* ── Progress bar ── */}
        {hasStock && targetStock > 0 && (
          <div style={{marginBottom:10}}>
            <div style={{
              height:6,background:t.surface2,borderRadius:4,
              overflow:"hidden",marginBottom:6,
            }}>
              <div style={{
                height:"100%",width:barFill+"%",
                background:st.c,borderRadius:4,
                transition:"width .4s ease",
              }}/>
            </div>
            <span style={{
              fontSize:9,color:st.c,fontFamily:"'Inter',system-ui,sans-serif",fontWeight:600,
            }}>
              {coveragePct}% of target reached
            </span>
          </div>
        )}

        {/* ── Action line ── */}
        {hasBothData && gap !== null && (
          <div style={{
            display:"flex",
            alignItems:"center",
            justifyContent: gap <= 0 ? "flex-end" : "space-between",
            padding:"7px 10px",
            borderRadius:6,
            background:st.c+"14",
            border:`1px solid ${st.c}30`,
            marginTop:"auto",
          }}>
            {gap > 0 && (
              <span style={{
                fontSize:12,fontWeight:600,color:st.c,
              }}>⚠ Shortfall</span>
            )}
            <span style={{
              fontSize:12,fontWeight:700,
              fontFamily:"'Inter',system-ui,sans-serif",color:st.c,
            }}>
              {gap > 0
                ? `Send ${fmt(gap)} units`
                : `${fmt(Math.abs(gap))} units excess`}
            </span>
          </div>
        )}

        {/* No stock — nudge to upload ledger */}
        {!hasStock && demand30 > 0 && (
          <div style={{
            fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif",
            marginTop:4,padding:"5px 8px",background:t.surface,borderRadius:6,
          }}>
            Upload Ledger CSV to see FC stock & gap
          </div>
        )}
      </div>
    );
  }

  /* ── Legend ── */
  const legendItems = [
    {label:"Stockout / Critical",c:"#e05252"},
    {label:"At Risk  60–90%",   c:"#d4912b"},
    {label:"Healthy  90–130%",  c:"#27ae60"},
    {label:"Surplus  >130%",    c:"#7c63d4"},
  ];

  return (
    <div>
      {/* Status legend */}
      <div style={{display:"flex",gap:14,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        {legendItems.map(l=>(
          <div key={l.label} style={{display:"flex",alignItems:"center",gap:5,fontSize:9,
            fontFamily:"'Inter',system-ui,sans-serif",color:t.text3}}>
            <div style={{width:8,height:8,borderRadius:2,background:l.c,flexShrink:0}}/>
            {l.label}
          </div>
        ))}
        <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>
          target = demand/day × <strong style={{color:t.text}}>{coverDays}d</strong> cover
        </span>
      </div>

      {/* North — full width */}
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8,marginBottom:8}}>
        <RegBlock region="North"/>
      </div>
      {/* West | Central | East — 3 col */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
        <RegBlock region="West"/>
        <RegBlock region="Central"/>
        <RegBlock region="East"/>
      </div>
      {/* South — full width */}
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8}}>
        <RegBlock region="South"/>
      </div>

      {/* Footer info */}
      <div style={{marginTop:8,fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif",
        display:"flex",gap:12,flexWrap:"wrap"}}>
        <span>Total demand: {fmt(totalUnits)} units (30d)</span>
        {unknownUnits > 0 && <span>· Unclassified: {fmt(unknownUnits)} units</span>}
        {!hasStock && <span style={{color:t.yellow}}>· Upload Ledger to enable stock & gap analysis</span>}
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
      const ft=async(tab,required=true)=>{
        const r=await fetch(base+encodeURIComponent(tab));
        if(!r.ok){if(!required)return[];throw new Error(`Tab "${tab}" not accessible (HTTP ${r.status})`);}
        const txt=await r.text();
        if(txt.trim().startsWith("<!")){if(!required)return[];throw new Error(`Tab "${tab}" returned HTML — ensure sheet is public`);}
        return parseCSV(txt);
      };
      const[ir,or,lr,ltr,purchr,fir]=await Promise.all([ft("Inventory",true),ft("Sales",true),ft("Ledger",false),ft("Leadtime",false),ft("Purchases",false),ft("FBA_Inv",false)]);
      const debug={
        invCols:ir[0]?Object.keys(ir[0]):[],
        ordCols:or[0]?Object.keys(or[0]):[],
        ledCols:lr[0]?Object.keys(lr[0]):[],
        ltCols:ltr[0]?Object.keys(ltr[0]):[],
        invRows:ir.length,ordRows:or.length,ledRows:lr.length,ltRows:ltr.length,
        source:"sheets",
      };
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
        <div style={{fontSize:10,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>
          Upload CSVs or connect a public Google Sheets document with tabs: Inventory, Sales, Ledger
        </div>
      </div>
      <div className="alert ab" style={{marginBottom:12}}>
        <span>✓</span>
        <span><strong>sales logic:</strong> Counts all orders except Cancelled + Returns · Anchor = latest date in dataset · Pending orders included · </span>
      </div>
      <div className="card" style={{marginBottom:18}}>
        <div className="ch">Google Sheets — Live Connection</div>
        <div style={{fontSize:10,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif",marginBottom:11}}>
          Sheet must be public. Tabs: <strong>Inventory</strong> · <strong>Sales</strong> · <strong>Ledger</strong> (optional) · <strong>Leadtime</strong> (optional)
        </div>
        <div style={{display:"flex",gap:8,marginBottom:9}}>
          <input className="ti" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..."/>
          <button className="btn bp" onClick={loadSheets} disabled={loading}>{loading?"Fetching…":"Connect"}</button>
        </div>
        {extractSheetId(url)&&<div style={{fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>Sheet ID: {extractSheetId(url)}</div>}
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
                ?<span style={{fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>No data / not loaded</span>
                :cols.map(c=>{
                  const important=["ASIN","FBA Available","FC Sellable","Inbound","order-status","purchase-date","asin","quantity","Location","Disposition","Ending Warehouse Balance","ship-state","ship-city","Mode of shipment","Lead Time (Days)","Shipping Time (Days)","Customs (Days)","Safety Stock (Days)"].includes(c);
                  return<span key={c} style={{fontSize:9,padding:"2px 6px",borderRadius:4,fontFamily:"'Inter',system-ui,sans-serif",
                    background:important?t.greenBg:t.surface2,color:important?t.green:t.text3,
                    border:`1px solid ${important?t.greenBdr:t.border}`}}>{c}</span>;
                })
              }
            </div>
          </div>
        ))}
        <div style={{fontSize:9,color:t.text3,marginTop:4,fontFamily:"'Inter',system-ui,sans-serif"}}>
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
    <div className={`sbar${isTop?" sbar-top":""}`}>
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
        &nbsp;&nbsp;
        <label style={{cursor:"pointer",userSelect:"none",display:"inline-flex",alignItems:"center"}}>
          <input type="checkbox"
            checked={local.inclTransfer!==false}
            onChange={e=>{const v=e.target.checked;onMove("inclTransfer",v);onRelease("inclTransfer",v);}}
            style={{marginRight:4,accentColor:"currentColor"}}
          />Include FC Transfer
        </label>
        &nbsp;&nbsp;
        <label style={{cursor:"pointer",userSelect:"none",display:"inline-flex",alignItems:"center"}}>
          <input type="checkbox"
            checked={local.inclFC!==false}
            onChange={e=>{const v=e.target.checked;onMove("inclFC",v);onRelease("inclFC",v);}}
            style={{marginRight:4,accentColor:"currentColor"}}
          />Include FC
        </label>
        &nbsp;&nbsp;
        <label style={{cursor:"pointer",userSelect:"none",display:"inline-flex",alignItems:"center"}}>
          <input type="checkbox"
            checked={local.inclInbound!==false}
            onChange={e=>{const v=e.target.checked;onMove("inclInbound",v);onRelease("inclInbound",v);}}
            style={{marginRight:4,accentColor:"currentColor"}}
          />Include Inbound
        </label>
        &nbsp;&nbsp;
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
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" margin={{top:4,right:50,left:0,bottom:4}}>
          <CartesianGrid strokeDasharray="2 4" stroke={t.border} horizontal={false}/>
          <XAxis type="number" tick={{fill:t.text3,fontSize:11}} axisLine={false} tickLine={false}/>
          <YAxis type="category" dataKey="label" width={90} tick={{fill:t.text2,fontSize:11,fontFamily:"'Inter',system-ui,sans-serif"}} axisLine={false} tickLine={false}/>
          <Tooltip
            contentStyle={{background:t.tooltipBg,border:`1px solid ${t.border}`,borderRadius:8,fontSize:12,fontFamily:"'Inter',system-ui,sans-serif",boxShadow:"0 4px 12px rgba(0,0,0,.08)"}}
            formatter={(v,_,{payload})=>[`${v} SKUs (${Math.round(v/total*100)}%)`,payload.label]}
            cursor={{fill:`${t.accent}08`}}
          />
          <Bar dataKey="count" radius={[0,4,4,0]} maxBarSize={20}>
            {data.map((d,i)=><Cell key={i} fill={d.color} fillOpacity={.82}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:4}}>
        {data.map(d=>(
          <span key={d.label} style={{display:"flex",alignItems:"center",gap:4,fontSize:9,fontFamily:"'Inter',system-ui,sans-serif",color:t.text3}}>
            <span style={{width:7,height:7,borderRadius:2,background:d.color,display:"inline-block",opacity:.85}}/>
            {d.label} <strong style={{color:d.color}}>{d.count}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function Dashboard({data,settings,setSettings,onSku,t,purchRows}){
  const skus=Object.values(data);
  const crit=skus.filter(d=>d.planning.priority==="critical").length;
  const high=skus.filter(d=>d.planning.priority==="high").length;
  const over=skus.filter(d=>d.planning.action==="OVERSTOCK").length;
  const totalStock=skus.reduce((s,d)=>s+d.currentStock,0);
  const totalDemand=skus.reduce((s,d)=>s+d.velocity.demand,0);
  const withFC=skus.filter(d=>d.hasFCData).length;
  const openPoCount=useMemo(()=>{
    if(!purchRows||!purchRows.length) return 0;
    const get=makeGet(purchRows);
    return purchRows.filter(r=>s(r,get,"Status","status").toLowerCase().trim()!=="delivered").length;
  },[purchRows]);

  const [alertSort,setAlertSort]=useState({col:"score",dir:"desc"});

  const alerts=useMemo(()=>{
    const base=skus.filter(d=>d.planning.priority==="critical"||d.planning.priority==="high");
    const {col,dir}=alertSort;
    const m=dir==="asc"?1:-1;
    return base.sort((a,b)=>{
      if(col==="sku") return m*(a.finalName.localeCompare(b.finalName));
      if(col==="doi") return m*((isFinite(a.planning.doi)?a.planning.doi:9999)-(isFinite(b.planning.doi)?b.planning.doi:9999));
      if(col==="stock") return m*(a.currentStock-b.currentStock);
      if(col==="demand") return m*(a.velocity.demand-b.velocity.demand);
      return m*(b.planning.displayScore-a.planning.displayScore); // score default
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

  const topD=useMemo(()=>skus.filter(d=>d.velocity.demand>0)
    .sort((a,b)=>b.velocity.demand-a.velocity.demand).slice(0,8)
    .map(d=>({name:d.finalName.substring(0,14)+(d.finalName.length>14?"…":""),demand:+d.velocity.demand.toFixed(2),asin:d.asin})),[skus]);

  const atRisk=useMemo(()=>skus
    .filter(d=>d.velocity.demand>0&&isFinite(d.planning.doi)&&d.planning.doi<9999)
    .sort((a,b)=>a.planning.doi-b.planning.doi).slice(0,10)
    .map(d=>({
      name:d.finalName.substring(0,18)+(d.finalName.length>18?"…":""),
      doi:+d.planning.doi.toFixed(1),
      asin:d.asin,
      priority:d.planning.priority,
    })),[skus]);

  function doiBarColor(priority) {
    return priority==="critical"?t.red:priority==="high"?t.yellow:t.green;
  }

  return(<div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>

    {/* KPI cards */}
    <div className="kg" style={{marginBottom:12}}>
      {[
        {l:"Total SKUs",    v:skus.length,        s:"Mapped & active",    c:""},
        {l:"Total Stock",   v:fmt(totalStock),     s:"FC + FBA + Inbound", c:""},
        {l:"Daily Demand",  v:fmt(totalDemand,0),  s:"Weighted avg/day",   c:""},
        {l:"Critical",      v:crit,                s:"Immediate action",   c:"r"},
        {l:"High Priority", v:high,                s:"Purchase required",  c:"y"},
        {l:"Overstock",     v:over,                s:"Excess inventory",   c:"p"},
        {l:"FC Coverage",   v:withFC,              s:"ASINs with ledger",  c:"b"},
        {l:"Open PO's",     v:openPoCount,         s:"Not yet delivered",  c:"b"},
      ].map(k=>(
        <div key={k.l} className={`kc ${k.c}`}>
          <div className="kl">{k.l}</div>
          <div className="kv" style={{color:k.c==="r"?t.red:k.c==="y"?t.yellow:k.c==="p"?t.purple:k.c==="b"?t.accent:t.text}}>{k.v}</div>
          <div className="ks">{k.s}</div>
        </div>
      ))}
    </div>

    {/* Chart row 1: Inventory Health + Most at Risk */}
    <div className="d2" style={{marginBottom:10}}>
      <div className="card">
        <div className="ch">Inventory Health</div>
        <InventoryHealthBar skus={skus} t={t}/>
      </div>
      <div className="card">
        <div className="ch">Most at Risk — Lowest Days of Inventory</div>
        {atRisk.length>0?(
          <ResponsiveContainer width="100%" height={220}>
            <BarChart layout="vertical" data={atRisk} margin={{top:0,right:40,left:0,bottom:0}}
              onClick={e=>e?.activePayload&&onSku(e.activePayload[0]?.payload?.asin)}
              style={{cursor:"pointer"}}>
              <CartesianGrid strokeDasharray="2 4" stroke={t.border} horizontal={false}/>
              <XAxis type="number" tick={{fill:t.text3,fontSize:11}} unit="d" axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" width={130} tick={{fill:t.text2,fontSize:11,fontFamily:"'Inter',system-ui,sans-serif"}} axisLine={false} tickLine={false}/>
              <Tooltip
                contentStyle={{background:t.tooltipBg,border:`1px solid ${t.border}`,borderRadius:8,fontSize:12,fontFamily:"'Inter',system-ui,sans-serif",boxShadow:"0 4px 12px rgba(0,0,0,.08)"}}
                formatter={v=>[`${v}d`,`Days of Inventory`]}
                cursor={{fill:`${t.accent}08`}}
              />
              <Bar dataKey="doi" radius={[0,4,4,0]} maxBarSize={18}>
                {atRisk.map((e,i)=>(
                  <Cell key={i} fill={doiBarColor(e.priority)} fillOpacity={.8}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ):(
          <div style={{padding:"30px 0",textAlign:"center",fontSize:11,color:t.text3}}>No active SKUs with demand data</div>
        )}
      </div>
    </div>

    {/* Chart row 2: Top demand */}
    {topD.length>0&&<div className="card" style={{marginBottom:10}}>
      <div className="ch">Top 8 by Weighted Daily Demand</div>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={topD} margin={{top:4,right:12,left:0,bottom:50}}
          onClick={e=>e?.activePayload&&onSku(e.activePayload[0]?.payload?.asin)}
          style={{cursor:"pointer"}}>
          <CartesianGrid strokeDasharray="2 4" stroke={t.border} vertical={false}/>
          <XAxis dataKey="name" tick={{fill:t.text3,fontSize:9,fontFamily:"'Inter',system-ui,sans-serif"}} angle={-35} textAnchor="end" axisLine={false} tickLine={false}/>
          <YAxis tick={{fill:t.text3,fontSize:11}} axisLine={false} tickLine={false}/>
          <Tooltip
            contentStyle={{background:t.tooltipBg,border:`1px solid ${t.border}`,borderRadius:8,fontSize:12,fontFamily:"'Inter',system-ui,sans-serif",boxShadow:"0 4px 12px rgba(0,0,0,.08)"}}
            formatter={v=>[`${v} u/day`,"Demand"]}
            cursor={{fill:`${t.accent}08`}}
          />
          <Bar dataKey="demand" fill={t.accent} fillOpacity={.75} radius={[3,3,0,0]} maxBarSize={36}/>
        </BarChart>
      </ResponsiveContainer>
    </div>}

    {/* Priority Alerts table */}
    {alerts.length>0&&<div className="card">
      <div className="ch">Priority Alerts</div>
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
            <td><div className="tn">{d.finalName}</div><div className="ta">{d.sellerSku}</div></td>
            <td className="ta">{d.asin}</td>
            <td><DOI doi={d.planning.doi} t={t}/></td>
            <td>{fmt(d.currentStock)}</td>
            <td>{fmt(d.velocity.demand,2)}</td>
            <td style={{color:t.accent,fontWeight:700}}>{fmt(d.velocity.raw7)}</td>
            <td style={{color:t.red}}>{fmtDate(d.planning.stockoutDate)}</td>
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
function AllSKUs({data,settings,setSettings,onSku,t}){
  const[q,setQ]=useState(""),[fil,setFil]=useState("all");
  const[sort,setSort]=useState({col:"doi",dir:"asc"});
  const[picked,setPicked]=useState(()=>new Set());
  function togglePick(asin,e){e.stopPropagation();setPicked(prev=>{const nx=new Set(prev);nx.has(asin)?nx.delete(asin):nx.add(asin);return nx;});}

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

  const skus=useMemo(()=>{
    const base=Object.values(data)
      .filter(d=>fil==="critical"?d.planning.priority==="critical":fil==="high"?d.planning.priority==="high":fil==="over"?d.planning.action==="OVERSTOCK":fil==="ok"?d.planning.priority==="low":true)
      .filter(d=>!q||d.finalName.toLowerCase().includes(q.toLowerCase())||d.asin.includes(q)||d.sellerSku.toLowerCase().includes(q.toLowerCase()));
    const {col,dir}=sort;
    const m=dir==="asc"?1:-1;
    return base.sort((a,b)=>{
      if(col==="sku")    return m*a.finalName.localeCompare(b.finalName);
      if(col==="stock")  return m*(a.currentStock-b.currentStock);
      if(col==="fba")    return m*(a.fbaAvailable-b.fbaAvailable);
      if(col==="fc")     return m*(a.fcSellable-b.fcSellable);
      if(col==="demand") return m*(a.velocity.demand-b.velocity.demand);
      if(col==="doi")    return m*((isFinite(a.planning.doi)?a.planning.doi:99999)-(isFinite(b.planning.doi)?b.planning.doi:99999));
      if(col==="buy")    return m*(a.planning.suggestedPurchase-b.planning.suggestedPurchase);
      if(col==="replen") return m*(a.planning.replenishQty-b.planning.replenishQty);
      // default: priority score
      return m*(b.planning.displayScore-a.planning.displayScore);
    });
  },[data,q,sort,fil]);

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
    const headers = ["SKU Name","Seller SKU","ASIN","Trend","W.Demand/Day","Stock","FBA","FC","FC Transfer","Inbound","DOI (days)","Stockout Date","Buy Qty","Replenish Qty","Action","Priority"];
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
        isFinite(d.planning.doi) ? fmt(d.planning.doi,1) : "∞",
        fmtDate(d.planning.stockoutDate),
        d.planning.suggestedPurchase>0 ? fmt(d.planning.suggestedPurchase) : "-",
        d.planning.replenishQty>0 ? fmt(d.planning.replenishQty) : "-",
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
        <select className="sel" value={fil} onChange={e=>setFil(e.target.value)}>
          <option value="all">All SKUs</option><option value="critical">Critical</option>
          <option value="high">High Priority</option><option value="ok">OK</option><option value="over">Overstock</option>
        </select>
        <button className="btn bs" style={{fontSize:11}} onClick={exportCSV} title="Exports the rows currently shown, with columns reflecting the Include FBA/FC/Transfer/Inbound toggles above">
          ⬇ Export CSV
        </button>
        {picked.size>0&&<span style={{fontSize:9,color:t.accent,fontFamily:"'Inter',system-ui,sans-serif",fontWeight:700}}>{picked.size} selected</span>}
        {picked.size>0&&<button className="btn bs" style={{fontSize:10,padding:"4px 9px"}} onClick={()=>setPicked(new Set())}>Deselect All</button>}
        <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>{skus.length}/{Object.keys(data).length}</span>
      </div>
      {picked.size>0&&(
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",padding:"7px 10px",marginBottom:8,background:t.accentBg,border:`1px solid ${t.accentBdr}`,borderRadius:6}}>
          <span style={{fontSize:9,fontWeight:700,color:t.accent,fontFamily:"'Inter',system-ui,sans-serif"}}>Selected:</span>
          {skus.filter(d=>picked.has(d.asin)).map(d=>(
            <span key={d.asin} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,color:t.text,background:t.surface,border:`1px solid ${t.border2}`,borderRadius:4,padding:"2px 7px",fontFamily:"'Inter',system-ui,sans-serif"}}>
              {d.finalName}
              <span style={{cursor:"pointer",color:t.text3}} onClick={()=>setPicked(prev=>{const nx=new Set(prev);nx.delete(d.asin);return nx;})}>✕</span>
            </span>
          ))}
        </div>
      )}
      <div className="tw ts"><table style={{fontSize:11}}>
        <thead><tr>
          <th style={{width:28}}></th>
          <SortTh col="sku" label="SKU Name" style={{textAlign:"left"}}/>
          <th style={{textAlign:"left"}}>ASIN</th>
          <th>Trend</th>
          <SortTh col="demand" label="W.Demand"/>
          <SortTh col="stock" label="Stock"/>
          <SortTh col="fba" label="FBA"/>
          <SortTh col="fc" label="FC"/>
          <th>Inbound</th>
          <SortTh col="doi" label="DOI"/>
          <th>Stockout</th>
          <SortTh col="buy" label="Buy Qty"/>
          <SortTh col="replen" label="Replenish"/>
          <th>Status</th>
        </tr></thead>
        <tbody>{skus.map(d=>(
          <tr key={d.asin} className="cr" onClick={()=>onSku(d.asin)} style={picked.has(d.asin)?{background:t.accentBg}:undefined}>
            <td onClick={e=>togglePick(d.asin,e)}><input type="checkbox" checked={picked.has(d.asin)} onChange={()=>{}} style={{cursor:"pointer"}}/></td>
            <td style={{textAlign:"left"}}><div className="tn">{d.finalName}</div><div className="ta">{d.sellerSku}</div></td>
            <td style={{textAlign:"left"}} className="ta">{d.asin}</td>
            <td><span style={{fontSize:10,color:trendColor(calcTrend(d.velocity.avg7,d.velocity.avg30),t),fontFamily:"'Inter',system-ui,sans-serif",whiteSpace:"nowrap"}}>{calcTrend(d.velocity.avg7,d.velocity.avg30)}</span></td>
            <td style={{fontWeight:700,color:t.text}}>{fmt(d.velocity.demand,2)}</td>
            <td>{fmt(d.currentStock)}</td><td>{fmt(d.fbaAvailable)}</td><td>{fmt(d.fcSellable)}</td><td>{fmt(d.inbound)}</td>
            <td><DOI doi={d.planning.doi} t={t}/></td>
            <td style={{color:d.planning.doi<30?t.red:t.text3}}>{fmtDate(d.planning.stockoutDate)}</td>
            <td style={{color:t.accent,fontWeight:700}}>{d.planning.suggestedPurchase>0?fmt(d.planning.suggestedPurchase):"—"}</td>
            <td style={{color:t.yellow,fontWeight:700}}>{d.planning.replenishQty>0?fmt(d.planning.replenishQty):"—"}</td>
            <td><PBadge action={d.planning.action} priority={d.planning.priority} purchasePct={d.planning.purchasePct||0} replenishPct={d.planning.replenishPct||0} t={t}/></td>
          </tr>
        ))}</tbody>
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

  const FC_STATUS_COLOR={stockout:t.red,critical:t.red,low:t.yellow,ok:t.green,surplus:t.purple};
  const FC_STATUS_LABEL={stockout:"STOCKOUT",critical:"CRITICAL",low:"LOW",ok:"OK",surplus:"SURPLUS"};
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

  function toggleCollapse(code){
    setExpanded(prev=>{const next=new Set(prev);next.has(code)?next.delete(code):next.add(code);return next;});
  }

  return(<div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>

    <div className="kg" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:12}}>
      {[
        {l:"Fulfilment Centres",v:warehouses.length,s:"With ledger data",c:"b"},
        {l:"Critical FCs",v:critWH,s:"Near stockout",c:"r"},
        {l:"Low Stock FCs",v:lowWH,s:"Below cover target",c:"y"},
        {l:"Total FC Stock",v:fmt(totalStockAll),s:"Units across all FCs",c:""},
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
        <input placeholder="FC code or city…" value={q} onChange={e=>setQ(e.target.value)}/>
      </div>
      <select className="sel" value={fil} onChange={e=>setFil(e.target.value)}>
        <option value="all">All Warehouses ({warehouses.length})</option>
        <option value="critical">Critical / Stockout ({critWH})</option>
        <option value="low">Low Stock ({lowWH})</option>
      </select>
      <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>
        {filtered.length} of {warehouses.length} warehouses
      </span>
    </div>

    {warehouses.length===0&&(
      <div className="empty">
        <div className="empty-ic">🏭</div>
        <h3>No Ledger Data</h3>
        <p>Upload a Ledger CSV or add a Ledger tab to your Google Sheet<br/>to see per-warehouse stock levels.</p>
      </div>
    )}

    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {filtered.map(wh=>{
        const wc=FC_STATUS_COLOR[wh.worstStatus]||t.green;
        const isOpen=expanded.has(wh.code);
        return(
          <div key={wh.code} className="fc-card" style={{borderLeft:`2px solid ${wc}`}}>

            {/* ── Warehouse header ── */}
            <div className="fc-card-hdr" style={{cursor:"pointer"}} onClick={()=>toggleCollapse(wh.code)}>
              {/* Status dot */}
              <div style={{
                width:7,height:7,borderRadius:"50%",background:wc,flexShrink:0,
              }}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:t.text,letterSpacing:"-.1px"}}>{wh.label}</div>
                <div style={{fontSize:12,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif",marginTop:3}}>
                  {wh.code}
                  &nbsp;·&nbsp;{wh.skus.length} SKU{wh.skus.length!==1?"s":""}
                  &nbsp;·&nbsp;<span style={{color:t.text2}}>{fmt(wh.totalStock)} sellable</span>
                  {wh.totalUnsellable>0&&<>&nbsp;·&nbsp;<span style={{color:t.yellow}}>{fmt(wh.totalUnsellable)} unsellable</span></>}
                  {wh.totalInTransit>0&&<>&nbsp;·&nbsp;<span style={{color:t.accent}}>{fmt(wh.totalInTransit)} in-transit</span></>}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                {wh.critCount>0&&(
                  <span style={{fontSize:12,fontWeight:600,color:t.red,display:"flex",alignItems:"center",gap:5}}>
                    <span className="dot r"></span>{wh.critCount} critical
                  </span>
                )}
                {wh.lowCount>0&&wh.critCount===0&&(
                  <span style={{fontSize:12,fontWeight:600,color:t.yellow,display:"flex",alignItems:"center",gap:5}}>
                    <span className="dot y"></span>{wh.lowCount} low
                  </span>
                )}
                <span style={{fontSize:12,fontWeight:500,color:wc,display:"flex",alignItems:"center",gap:5}}>
                  <span className="dot" style={{background:wc}}></span>{FC_STATUS_LABEL[wh.worstStatus]}
                </span>
                <span style={{
                  fontSize:11,color:t.text3,lineHeight:1,
                  display:"inline-block",
                  transform:isOpen?"rotate(0deg)":"rotate(-90deg)",
                  transition:"transform .18s",
                }}>▾</span>
              </div>
            </div>

            {/* ── SKU table (collapsible) ── */}
            {isOpen&&(
              <div className="tw" style={{maxHeight:340,overflowY:"auto"}}>
                <table>
                  <thead><tr>
                    <th style={{minWidth:180}}>SKU</th>
                    <th style={{textAlign:"right"}}>Sellable</th>
                    <th style={{textAlign:"right"}}>Demand / d</th>
                    <th style={{textAlign:"right"}}>DOI</th>
                    <th style={{textAlign:"right"}}>Unsellable</th>
                    <th style={{textAlign:"right"}}>In-Transit</th>
                    <th>Status</th>
                  </tr></thead>
                  <tbody>
                    {wh.skus.map(sku=>{
                      const sc=FC_STATUS_COLOR[sku.status]||t.green;
                      return(
                        <tr key={sku.asin} className="cr" onClick={e=>{e.stopPropagation();onSku(sku.asin);}}>
                          <td>
                            <div style={{fontWeight:600,color:t.text,fontSize:12,
                              maxWidth:210,overflow:"hidden",textOverflow:"ellipsis"}}>{sku.name}</div>
                            <div style={{fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif",marginTop:2}}>{sku.asin}</div>
                          </td>
                          <td style={{textAlign:"right",fontWeight:700,
                            color:sku.stock>0?t.text:t.red}}>{fmt(sku.stock)}</td>
                          <td style={{textAlign:"right",color:t.text2}}>
                            {sku.demand>0?fmt(sku.demand,2):"—"}
                          </td>
                          <td style={{textAlign:"right"}}>
                            {sku.demand>0
                              ?<span style={{color:sc,fontWeight:700}}>
                                {isFinite(sku.doi)?fmt(sku.doi,1)+"d":"∞"}
                              </span>
                              :<span style={{color:t.text3}}>—</span>}
                          </td>
                          <td style={{textAlign:"right",color:sku.unsellable>0?t.yellow:t.text3}}>
                            {sku.unsellable>0?fmt(sku.unsellable):"—"}
                          </td>
                          <td style={{textAlign:"right",color:sku.inTransit>0?t.accent:t.text3}}>
                            {sku.inTransit>0?fmt(sku.inTransit):"—"}
                          </td>
                          <td>
                            <span style={{fontSize:12,fontWeight:500,color:sc,display:"inline-flex",alignItems:"center",gap:5}}>
                              <span className="dot" style={{background:sc}}></span>{FC_STATUS_LABEL[sku.status]}
                            </span>
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
   LIS — Send-Stock Recommendation List
   Flat list of SKU × FC, sourced from fcPlanning.recommendations
   Same logic as SKUDetail send-stock section. Sorted by DOI asc.
═══════════════════════════════════════════════════════════════ */
function LISView({data, settings, setSettings, onSku, t}) {
  const [q, setQ]           = useState("");
  const [filSt, setFilSt]   = useState("actionable");
  const [sortCol, setSortCol] = useState("status");
  const [sortDir, setSortDir] = useState(1); // 1=asc, -1=desc

  const FC_STATUS_COLOR = {stockout:t.red,critical:t.red,low:t.yellow,ok:t.green,surplus:t.purple};
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

  const TD = {padding:"0 12px",height:54,borderBottom:`1px solid ${t.border}`,verticalAlign:"middle"};

  return (
    <div>
      <SBar settings={settings} setSettings={setSettings} t={t}/>

      <div className="kg" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:12}}>
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
        <select className="sel" value={filSt} onChange={e=>setFilSt(e.target.value)}>
          <option value="actionable">Critical + Low ({critCount+lowCount})</option>
          <option value="all">All ({rows.length})</option>
        </select>
        <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>
          {filtered.length} rows · click header to sort
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
                    style={{background:i%2===0?"transparent":t.surface+"18"}}
                    onClick={()=>onSku(r.asin)}>
                    <td style={TD}>
                      <div style={{fontWeight:600,color:t.text,fontSize:12,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
                      <div style={{fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif",marginTop:2}}>{r.asin}</div>
                    </td>
                    <td style={TD}>
                      <div style={{fontWeight:700,color:t.accent,fontSize:11,fontFamily:"'Inter',system-ui,sans-serif"}}>{r.fc}</div>
                      <div style={{fontSize:9,color:t.text3,marginTop:2}}>{r.fcLabel}</div>
                    </td>
                    <td style={{...TD,fontFamily:"'Inter',system-ui,sans-serif",color:t.text2}}>
                      {r.demand>0?fmt(r.demand,2):<span style={{color:t.text3}}>—</span>}
                    </td>
                    <td style={{...TD,fontFamily:"'Inter',system-ui,sans-serif",fontWeight:700,color:r.fcStock>0?t.text:t.red}}>
                      {fmt(r.fcStock)}
                    </td>
                    <td style={TD}>
                      <span style={{color:sc,fontWeight:700,fontFamily:"'Inter',system-ui,sans-serif"}}>
                        {isFinite(r.doi)?fmt(r.doi,1)+"d":"∞"}
                      </span>
                    </td>
                    <td style={TD}>
                      <span style={{color:tc,fontFamily:"'Inter',system-ui,sans-serif",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>
                        {r.trend||"—"}
                      </span>
                    </td>
                    <td style={TD}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:500,color:sc,fontFamily:"'Inter',system-ui,sans-serif"}}>
                        <span className="dot" style={{background:sc}}></span>{r.status}
                      </span>
                    </td>
                    <td style={TD}>
                      <span style={{color:t.accent,fontFamily:"'Inter',system-ui,sans-serif",fontWeight:700,fontSize:12}}>
                        Send {fmt(r.sendQty)} units to {r.fc}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{marginTop:10,padding:"7px 12px",background:t.surface2,border:`1px solid ${t.border}`,
        borderRadius:6,fontSize:10,fontFamily:"'Inter',system-ui,sans-serif",color:t.text3,
        display:"flex",gap:20,flexWrap:"wrap"}}>
        <span>Cover target = FBA Cover Days slider · Same formula as SKU Detail send-stock</span>
        <span style={{marginLeft:"auto"}}>Click any row → SKU Detail</span>
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
      color:t.purple,fontFamily:"'Inter',system-ui,sans-serif",
    }}><span className="dot p"></span>{fmt(Math.abs(rounded))} surplus</span>
  );
  return <span style={{color:t.accent,fontWeight:700,fontFamily:"'Inter',system-ui,sans-serif"}}>{fmt(rounded)}</span>;
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
        <div style={{fontSize:10,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>
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
      <div className="kg" style={{gridTemplateColumns:"repeat(5,1fr)",marginBottom:12}}>
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
        <select className="sel" value={fil} onChange={e=>setFil(e.target.value)}>
          <option value="all">All SKUs</option>
          <option value="critical">🔴 Critical Only</option>
          <option value="urgent">🟠 Urgent (Critical + Gap)</option>
          <option value="soon">🟡 Order Soon</option>
          <option value="has_lt">Has Leadtime Data</option>
        </select>
        <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>{filtered.length} / {skus.length} SKUs</span>
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
                <th style={{...TH,background:t.accentBg,borderTop:`2px solid ${t.accent}22`}}>FBA Avail</th>
                <th style={{...TH,background:t.accentBg,borderTop:`2px solid ${t.accent}22`}}>Local WH</th>
                <th style={{...TH,background:t.accentBg,borderTop:`2px solid ${t.accent}22`,color:t.accent}}>
                  Upcoming ✎
                </th>
                <th style={{...TH,background:t.accentBg,borderTop:`2px solid ${t.accent}22`,fontWeight:800}}>Total Inv</th>

                {/* DOH / Stockout */}
                <th style={TH}>Days in Hand</th>
                <th style={TH}>Est. Stockout</th>

                {/* AIR group */}
                <th style={{...TH,background:t.orangeBg,borderTop:`2px solid ${t.orange}55`}}>AIR Days</th>
                <th style={{...TH,background:t.orangeBg,borderTop:`2px solid ${t.orange}55`}}>Order AIR</th>
                <th style={{...TH,background:t.orangeBg,borderTop:`2px solid ${t.orange}55`}}>AIR Arrival</th>

                {/* SEA group */}
                <th style={{...TH,background:t.greenBg,borderTop:`2px solid ${t.green}55`}}>SEA Days</th>
                <th style={{...TH,background:t.greenBg,borderTop:`2px solid ${t.green}55`}}>Open POs</th>
                <th style={{...TH,background:t.greenBg,borderTop:`2px solid ${t.green}55`}}>Order SEA</th>
                <th style={{...TH,background:t.greenBg,borderTop:`2px solid ${t.green}55`}}>SEA Arrival</th>
                <th style={{...TH,background:t.greenBg,borderTop:`2px solid ${t.green}55`}}>Reorder by (SEA)</th>

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
                      <div style={{fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif",marginTop:2}}>{d.asin}</div>
                    </td>
                    {/* WF ADS */}
                    <td style={TD}>
                      <span style={{fontWeight:700,fontFamily:"'Inter',system-ui,sans-serif",color:t.text}}>{fmt(d.wfAds,2)}</span>
                      <span style={{fontSize:9,color:t.text3,marginLeft:3}}>u/d</span>
                    </td>
                    {/* Trend */}
                    <td style={TD}>
                      <span style={{fontSize:10,color:trendColor(d.trend,t),fontFamily:"'Inter',system-ui,sans-serif"}}>{d.trend}</span>
                    </td>

                    {/* Inventory group */}
                    <td style={{...TD,background:t.accentBg}}>{fmt(d.fba)}</td>
                    <td style={{...TD,background:t.accentBg}}>{fmt(d.localWH)}</td>
                    {/* Upcoming — editable */}
                    <td style={{...TD,background:t.accentBg,cursor:"pointer",userSelect:"none"}}
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
                            fontFamily:"'Inter',system-ui,sans-serif",outline:"none",
                          }}
                        />
                      ) : (
                        <span style={{
                          display:"inline-flex",alignItems:"center",gap:5,
                          padding:"2px 8px",borderRadius:4,
                          background: d.upcomingQty > 0 ? t.accentBg : t.surface2,
                          border: `1px solid ${d.upcomingQty > 0 ? t.accentBdr : t.border}`,
                          color: d.upcomingQty > 0 ? t.accent : t.text3,
                          fontFamily:"'Inter',system-ui,sans-serif",fontSize:11,
                        }}>
                          {fmt(d.upcomingQty)}<span style={{fontSize:8,opacity:.5}}>✎</span>
                        </span>
                      )}
                    </td>
                    {/* Total Inv */}
                    <td style={{...TD,background:t.accentBg,fontWeight:700,color:t.text,fontFamily:"'Inter',system-ui,sans-serif"}}>
                      {fmt(d.totalInv)}
                    </td>

                    {/* Days in Hand */}
                    <td style={TD}>
                      <span style={{
                        fontWeight:700,fontFamily:"'Inter',system-ui,sans-serif",
                        color: !isFinite(d.doh) ? t.green
                             : d.doh < 30 ? t.red
                             : d.doh < 60 ? t.yellow : t.green,
                      }}>
                        {isFinite(d.doh) ? fmt(d.doh,1)+"d" : "∞"}
                      </span>
                    </td>
                    {/* Est. Stockout */}
                    <td style={TD}>
                      <span style={{fontSize:11,color:d.stockoutDate?t.text2:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>
                        {d.stockoutDate ? fmtDate(d.stockoutDate) : "—"}
                      </span>
                    </td>

                    {/* AIR group */}
                    <td style={{...TD,background:t.orangeBg}}>
                      {d.airTotal !== null
                        ? <span style={{color:t.orange,fontFamily:"'Inter',system-ui,sans-serif",fontWeight:600}}>{d.airTotal}d</span>
                        : <span style={{color:t.text3}}>—</span>}
                    </td>
                    <td style={{...TD,background:t.orangeBg}}>
                      <OrderQtyCell qty={d.orderAir} t={t}/>
                    </td>
                    <td style={{...TD,background:t.orangeBg}}>
                      {d.airArrivalDate
                        ? <span style={{fontSize:11,color:t.orange,fontFamily:"'Inter',system-ui,sans-serif"}}>{fmtDate(d.airArrivalDate)}</span>
                        : <span style={{color:t.text3}}>—</span>}
                    </td>

                    {/* SEA group */}
                    <td style={{...TD,background:t.greenBg}}>
                      {d.seaTotal !== null
                        ? <span style={{color:t.green,fontFamily:"'Inter',system-ui,sans-serif",fontWeight:600}}>{d.seaTotal}d</span>
                        : <span style={{color:t.text3}}>—</span>}
                    </td>
                    {/* Open POs */}
                    <td style={{...TD,background:t.greenBg}}>
                      {d.openPoQty > 0
                        ? <span style={{
                            display:"inline-block",padding:"2px 8px",borderRadius:4,
                            background:t.accentBg,border:`1px solid ${t.accentBdr}`,
                            color:t.accent,fontFamily:"'Inter',system-ui,sans-serif",fontWeight:700,fontSize:11,
                          }}>{fmt(d.openPoQty)}</span>
                        : <span style={{color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>—</span>}
                    </td>
                    <td style={{...TD,background:t.greenBg}}>
                      <OrderQtyCell qty={d.orderSea} t={t}/>
                    </td>
                    {/* SEA Arrival */}
                    <td style={{...TD,background:t.greenBg}}>
                      {d.seaArrivalDate
                        ? <span style={{fontSize:11,color:t.green,fontFamily:"'Inter',system-ui,sans-serif"}}>{fmtDate(d.seaArrivalDate)}</span>
                        : <span style={{color:t.text3}}>—</span>}
                    </td>
                    {/* Reorder by (SEA) — last safe date */}
                    <td style={{...TD,background:t.greenBg}}>
                      {d.reorderSeaDate ? (
                        <span style={{
                          fontSize:11,fontFamily:"'Inter',system-ui,sans-serif",fontWeight:reorderPast?700:400,
                          color: reorderPast ? t.red : reorderSoon ? t.yellow : t.green,
                        }}>
                          {reorderPast && "⚠ "}{fmtDate(d.reorderSeaDate)}
                        </span>
                      ) : <span style={{color:t.text3}}>—</span>}
                    </td>

                    {/* Status badge */}
                    <td style={TD}>
                      <span style={{
                        display:"inline-flex",alignItems:"center",gap:6,fontSize:12,
                        fontWeight:500,color:sc.color,whiteSpace:"nowrap",
                      }}>
                        <span className="dot" style={{background:sc.color}}></span>{d.statusLabel.replace(/^[⬜🔴🟠🟡🟢]\s*/,"")}
                      </span>
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
          borderRadius:8,display:"flex",gap:20,flexWrap:"wrap",alignItems:"center",
          fontSize:10,fontFamily:"'Inter',system-ui,sans-serif",
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
      <div style={{marginTop:8,display:"flex",gap:14,flexWrap:"wrap",fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>
        <span>🔴 DOH &lt; AIR lead time — order air now</span>
        <span>🟠 DOH &lt; SEA lead time — need SEA + gap air</span>
        <span>🟡 DOH &lt; SEA × 1.3 — place SEA soon</span>
        <span>🟢 Stock OK — schedule routine SEA</span>
        <span>· Upcoming ✎ = click to edit · Open POs auto-fetched from Purchases sheet · AIR = gap coverage only · SEA target = ADS × (SEA days + safety stock) − (Inv + Open POs)</span>
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
            <td style={{color:t.red,fontFamily:"'Inter',system-ui,sans-serif",fontSize:11}}>{w.asin}</td>
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
            <td style={{fontFamily:"'Inter',system-ui,sans-serif",fontSize:11}}>{w.asin}</td>
            <td style={{color:t.red,fontSize:11,fontFamily:"'Inter',system-ui,sans-serif"}}>{w.csvSku}</td>
            <td style={{color:t.green,fontSize:11,fontFamily:"'Inter',system-ui,sans-serif"}}>{w.mapSku}</td>
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
      <div style={{padding:"14px 0",textAlign:"center",fontSize:11,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>
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
          fontFamily:"'Inter',system-ui,sans-serif",
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
          <div style={{fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>{row.stateLabel}</div>
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
          <span style={{fontSize:11,fontWeight:700,fontFamily:"'Inter',system-ui,sans-serif",color:isOther?t.text3:t.text}}>{fmt(row.qty)}</span>
          <span style={{fontSize:9,color:t.text3,marginLeft:4}}>{pct.toFixed(1)}%</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div style={{fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif",marginBottom:10}}>
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

function SKUDetail({sku, onBack, settings, setSettings, t, poUnits, setPoUnits, purchRows, skuCfg, setSkuCfg, extraInbound, setExtraInbound, poSelection, togglePoSelection}){
  if(!sku) return null;
  const {velocity:vel, planning:pl, forecast:baseForecast, forecastWithPO, fcPlanning, hasFCData, regionalSales, citySales, salesHistory} = sku;
  // "Include PO (forecast)" toggle — display-only swap, all underlying purchase/replenish logic untouched
  const poIncluded = settings.inclPO===true && (pl.poStockQty||0)>0;
  const forecast = poIncluded ? (forecastWithPO||baseForecast) : baseForecast;
  const displayDoi = poIncluded ? pl.doiWithPO : pl.doi;
  const displayStockoutDate = poIncluded ? pl.stockoutDateWithPO : pl.stockoutDate;

  const [bkVisible,setBkVisible]=useState(true);
  useEffect(()=>{
    const scroller=document.querySelector(".content");
    if(!scroller)return;
    let lastY=scroller.scrollTop;
    const onScroll=()=>{
      const y=scroller.scrollTop;
      setBkVisible(y<=lastY||y<40);
      lastY=y;
    };
    scroller.addEventListener("scroll",onScroll,{passive:true});
    return()=>scroller.removeEventListener("scroll",onScroll);
  },[]);

  // Per-SKU lead time from file; Additional Lead Time slider = extra buffer on top
  const seaLTBase = sku.skuSeaLT ?? null;
  const airLTBase = sku.skuAirLT ?? null;
  const defaultLT = seaLTBase ?? settings.totalLeadTime;
  const [ltAdj, setLtAdj] = useState(0);
  const effectiveLT = seaLTBase != null ? (defaultLT + ltAdj + settings.totalLeadTime) : (defaultLT + ltAdj);
  const effectiveAirLT = airLTBase != null ? airLTBase + ltAdj + settings.totalLeadTime : null;

  // Recompute local planning values with per-SKU LTs + adjustment.
  // Uses sku.effectiveDemand (weighted avg, or the Priority Demand override if one is
  // set) — the SAME demand basis the KPI tiles/planning engine use above. Previously
  // this recompute used the raw weighted average (vel.demand) regardless of any
  // Priority Demand override, which could make this section (and Shipment Plan below)
  // show "stock OK" while the KPI tiles above correctly showed real urgency.
  const demand = sku.effectiveDemand;
  const localReorderStock = Math.round(demand * (effectiveLT + settings.safetyDays));
  const localDoi = demand > 0 ? (sku.currentStock / demand) : Infinity;
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
  const totalPoDeduction = currentPoUnits + totalOpenPoQty;
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
  const shipAvailableStock = sku.currentStock + totalPoDeduction;
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
  if (demand === 0 && sku.currentStock === 0) { shipStatusLabel = "No sales data"; shipStatusTier = "none"; }
  else if (sku.currentStock === 0 && demand > 0) { shipStatusLabel = "Stocked out — order air"; shipStatusTier = "critical"; }
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
    <div className="bk" onClick={onBack} style={{
      position:"sticky",top:8,zIndex:20,
      transform:bkVisible?"translateY(0)":"translateY(-140%)",
      opacity:bkVisible?1:0,
      transition:"transform .22s ease,opacity .22s ease",
      boxShadow:"0 4px 12px rgba(0,0,0,.18)",
    }}>← Back</div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>

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
        <div style={{display:"flex",gap:10,alignItems:"center",fontSize:11,fontFamily:"'Inter',system-ui,sans-serif",flexWrap:"wrap"}}>
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
      <div>
        <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:2}}>{sku.finalName}</div>
        <div style={{fontSize:10,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>{sku.sellerSku} · {sku.asin}</div>
      </div>
      <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
        <PBadge action={pl.action} priority={pl.priority} purchasePct={pl.purchasePct||0} replenishPct={pl.replenishPct||0} t={t}/>
      </div>
    </div>

    {/* KPI row */}
    {poIncluded&&(
      <div style={{fontSize:9,color:t.accent,marginBottom:6,fontFamily:"'Inter',system-ui,sans-serif"}}>
        ⓘ Including {fmt(pl.poStockQty)} PO units in stock for the figures below (forecast-only — purchase/replenish qty unaffected)
      </div>
    )}
    <div className="d4" style={{marginBottom:10,gridTemplateColumns:"repeat(4,1fr)"}}>
      {[
        {l:"Days of Inventory",v:isFinite(displayDoi)?`${fmt(displayDoi,1)}d`:"∞",col:displayDoi<7?t.red:displayDoi<21?t.yellow:t.green},
        {l:"Stockout Date",v:fmtDate(displayStockoutDate),col:displayDoi<7?t.red:displayDoi<21?t.yellow:t.text},
        {l:"Weighted Demand",v:fmt(vel.demand,2)+"/day",col:t.accent},
        {l:"FBA Replenishment Qty",v:fmt(pl.replenishQty),col:pl.replenishQty>0?t.yellow:t.green},
      ].map(k=>(
        <div key={k.l} className="kc">
          <div className="kl">{k.l}</div>
          <div className="kv" style={{fontSize:16,color:k.col}}>{k.v}</div>
        </div>
      ))}
    </div>

    {/* Inventory + Velocity */}
    <div className="d2" style={{marginBottom:10}}>
      <div className="card">
        <div className="ch">Inventory Breakdown</div>
        {[["FBA Available",fmt(sku.fbaAvailable)],["FBA Unsellable",fmt(sku.fbaUnsellable)],
          ["FC Transfer",fmt(sku.fcTransfer||0)],["On Hand (FBA + FC Transfer)",fmt(sku.onHand||(sku.fbaAvailable+sku.fcTransfer)||0)],
          ["FC Sellable",fmt(sku.fcSellable)],["FC Unsellable",fmt(sku.fcUnsellable)],
          ["Inbound",fmt(sku.inbound)],
          ["Total Current Stock",fmt(sku.currentStock)],["Unit Cost",sku.unitCost?`₹${fmt(sku.unitCost,2)}`:"—"]].map(([k,v])=>(
          <div key={k} className="sr"><span className="sk">{k}</span><span className="sv">{v}</span></div>
        ))}
      </div>
      <div className="card">
        <div className="ch">Sales Velocity (Net — Excl. Cancelled & Returns)</div>
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
        "in production": "#5BA8E0",
        "production completed": "#9C7FE0",
        "in transit":    t.yellow,
        "ordered":       t.text2,
        "open":          t.green,
        "pending":       t.text3,
        "partially shipped": t.orange,
      };
      function statusColor(st){ return STATUS_COLORS[st.toLowerCase()] || t.text2; }
      return (
        <div className="card" style={{marginBottom:10}}>
          <div className="ch">Active Purchase Orders</div>
          {poRows.length === 0 ? (
            <div style={{fontSize:11,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif",padding:"6px 0"}}>
              No active POs for this SKU
            </div>
          ) : (
            <>
              <div style={{fontSize:9,color:t.text3,marginBottom:6,fontFamily:"'Inter',system-ui,sans-serif"}}>
                Uncheck a PO to exclude it from purchase/replenishment/DOI/stockout calculations everywhere in the app.
              </div>
              <div className="tw" style={{marginBottom:8}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr>
                      <th style={{width:32,padding:"0 12px",height:36,background:t.surface,borderBottom:`1px solid ${t.border}`}}></th>
                      {["PO Number","Status","Ordered Qty","Date","Del. Date"].map(h=>(
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
                      const date = s(r,get,"Date","date","Created Date","created_date","Order Date");
                      const del  = s(r,get,"Date of Delivery","date_of_delivery","Delivery Date","delivery_date","Date of Completion","date_of_completion");
                      const sc   = statusColor(st);
                      return (
                        <tr key={i} style={{borderBottom:`1px solid ${t.border}`,opacity:pr.included?1:.45}}>
                          <td style={{padding:"7px 10px"}}>
                            <input type="checkbox" checked={pr.included} onChange={()=>togglePoSelection(sku.asin,pr.rowKey)}
                              title={pr.included?"Included in calculations":"Excluded from calculations"}
                              style={{cursor:"pointer"}}/>
                          </td>
                          <td style={{padding:"7px 10px",fontSize:11,fontFamily:"'Inter',system-ui,sans-serif",color:t.text,fontWeight:600,textAlign:"left"}}>{poNo}</td>
                          <td style={{padding:"7px 10px",textAlign:"left"}}>
                            <span style={{
                              display:"inline-block",padding:"3px 9px",borderRadius:5,fontSize:11,
                              fontWeight:600,background:sc+"22",color:sc,
                              border:`1px solid ${sc}44`,fontFamily:"'Inter',system-ui,sans-serif",whiteSpace:"nowrap",
                            }}>{st||"—"}</span>
                          </td>
                          <td style={{padding:"7px 10px",fontFamily:"'Inter',system-ui,sans-serif",fontSize:12,fontWeight:700,color:t.accent,textAlign:"left"}}>{qty>0?fmt(qty):"—"}</td>
                          <td style={{padding:"7px 10px",fontSize:11,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif",textAlign:"left"}}>{date||"—"}</td>
                          <td style={{padding:"7px 10px",fontSize:11,fontFamily:"'Inter',system-ui,sans-serif",color:del?t.green:t.text3,fontWeight:del?600:400,textAlign:"left"}}>{del||"—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{
                padding:"7px 12px",background:t.accentBg,border:`1px solid ${t.accentBdr}`,
                borderRadius:6,display:"flex",alignItems:"center",justifyContent:"space-between",
                fontSize:11,fontFamily:"'Inter',system-ui,sans-serif",
              }}>
                <span style={{color:t.text3,fontSize:9,textTransform:"uppercase",letterSpacing:".5px"}}>
                  Total Open PO Qty ({poRows.filter(p=>p.included).length}/{poRows.length} PO{poRows.length!==1?"s":""} included)
                </span>
                <span style={{fontWeight:800,fontSize:15,color:t.accent}}>{fmt(totalOpenQty)} units</span>
              </div>
            </>
          )}
        </div>
      );
    })()}

    {/* Shipment Plan — adapted from Procurement Forecast's air/sea logic */}
    <div className="card" style={{marginBottom:10}}>
      <div className="ch">Shipment Plan</div>
      {demand === 0 ? (
        <div style={{fontSize:11,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif",padding:"6px 0"}}>No demand — not applicable</div>
      ) : (
        <div>
          {/* Single status line */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:shipStatusColor(shipStatusTier),display:"inline-block",flexShrink:0}}></span>
            <span style={{fontSize:14,fontWeight:700,color:shipStatusColor(shipStatusTier),fontFamily:"'Inter',system-ui,sans-serif"}}>{shipStatusLabel}</span>
          </div>

          <div style={{display:"grid",gridTemplateColumns:hasAir?"1fr 1fr":"1fr",gap:10,marginBottom:10}}>
            {hasAir && (
              <div style={{padding:"12px 14px",borderRadius:8,background:t.surface2,border:`1px solid ${t.border}`}}>
                <div style={{fontSize:12,color:t.text3,marginBottom:6}}>✈ Air — bridge the gap</div>
                <div style={{fontSize:20,fontWeight:800,fontFamily:"'Inter',system-ui,sans-serif",color:shipOrderAir>0?t.accent:t.text3}}>
                  {shipOrderAir>0?fmt(shipOrderAir)+" units":"Not needed"}
                </div>
                {shipAirArrivalDate && shipOrderAir>0 && (
                  <div style={{fontSize:10,color:t.text3,marginTop:4,fontFamily:"'Inter',system-ui,sans-serif"}}>
                    Arrives {fmtDate(shipAirArrivalDate)}
                  </div>
                )}
              </div>
            )}
            <div style={{padding:"12px 14px",borderRadius:8,background:t.surface2,border:`1px solid ${t.border}`}}>
              <div style={{fontSize:12,color:t.text3,marginBottom:6}}>🚢 Sea — full cycle target</div>
              <div style={{fontSize:20,fontWeight:800,fontFamily:"'Inter',system-ui,sans-serif",color:t.text}}>
                {fmt(shipOrderSea)} units
              </div>
              <div style={{fontSize:10,color:t.text3,marginTop:4,fontFamily:"'Inter',system-ui,sans-serif"}}>
                Arrives {fmtDate(shipSeaArrivalDate)}
              </div>
            </div>
          </div>

          {/* Reorder-by line */}
          {shipReorderDate && (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${t.border}`,paddingTop:10,fontSize:11}}>
              <span style={{color:t.text3}}>Reorder by (sea)</span>
              <span style={{fontWeight:600,color:shipReorderPast?t.red:shipReorderSoon?t.yellow:t.green,fontFamily:"'Inter',system-ui,sans-serif"}}>
                {shipReorderPast&&"⚠ "}{fmtDate(shipReorderDate)}{shipReorderPast?" — past due":""}
              </span>
            </div>
          )}

          {/* No LT data nudge */}
          {effectiveLT === 0 && !hasAir && (
            <div style={{marginTop:8,fontSize:10,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>
              Upload Leadtime CSV to enable air/sea calculations.
            </div>
          )}
        </div>
      )}
    </div>

    {/* Recommended Actions */}
    <div className="card" style={{marginBottom:10}}>
      <div className="ch">Recommended Actions</div>
      {/* Live DOI / Stockout Date / Still Need to Order — repeated here (not duplicating
          the Gross Requirement tile below) so edits to Purchased Units / Priority Demand /
          Add Inbound further down are visible without scrolling back up. */}
      <div className="d4" style={{marginBottom:10,gridTemplateColumns:"repeat(3,1fr)"}}>
        {[
          {l:"Days of Inventory",v:isFinite(displayDoi)?`${fmt(displayDoi,1)}d`:"∞",col:displayDoi<7?t.red:displayDoi<21?t.yellow:t.green},
          {l:"Stockout Date",v:fmtDate(displayStockoutDate),col:displayDoi<7?t.red:displayDoi<21?t.yellow:t.text},
          {l:"Still Need to Order",v:localSuggestedPurchase>0?fmt(localSuggestedPurchase):"✓ Covered",col:localSuggestedPurchase>0?t.accent:t.green},
        ].map(k=>(
          <div key={k.l} className="kc">
            <div className="kl">{k.l}</div>
            <div className="kv" style={{fontSize:16,color:k.col}}>{k.v}</div>
          </div>
        ))}
      </div>
      <div className="acs">
        {[{l:"Gross Requirement",v:fmt(localSuggestedPurchaseRaw),col:localSuggestedPurchaseRaw>0?t.red:t.green},
          {l:"FBA Replenishment Qty",v:fmt(pl.replenishQty),col:pl.replenishQty>0?t.yellow:t.green},
          {l:"Target Stock Level",v:fmt(pl.requiredStock,0),col:t.text}].map(k=>(
          <div key={k.l} className="ac">
            <div className="acl">{k.l}</div>
            <div className="acv" style={{color:k.col}}>{k.v}</div>
          </div>
        ))}
      </div>
      {/* Purchased Units field */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10,padding:"8px 10px",background:t.surface2,borderRadius:7,border:`1px solid ${t.border}`}}>
        <span style={{fontSize:13,fontWeight:600,color:t.text2,whiteSpace:"nowrap"}}>Purchased Units (PO Placed)</span>
        <input
          type="number" min={0} placeholder="0"
          value={currentPoUnits||""}
          onChange={e=>setPoUnits(sku.asin, e.target.value)}
          style={{width:80,background:"transparent",border:`1px solid ${t.border}`,
            borderRadius:4,color:t.green,padding:"3px 7px",fontSize:13,
            textAlign:"right",outline:"none",fontFamily:"'Inter',system-ui,sans-serif",fontWeight:700}}
        />
        {currentPoUnits>0&&(
          <button onClick={()=>setPoUnits(sku.asin,"")} title="Reset to 0"
            style={{fontSize:9,padding:"3px 8px",background:t.surface,border:`1px solid ${t.border}`,borderRadius:4,color:t.text3,cursor:"pointer"}}>
            ↺ Reset
          </button>
        )}
        {currentPoUnits>0&&<span style={{fontSize:10,color:t.text3}}>deducting <span style={{color:t.green,fontWeight:700}}>{fmt(currentPoUnits)}</span> units on order</span>}
        <span style={{marginLeft:"auto",fontSize:13,fontWeight:700,fontFamily:"'Inter',system-ui,sans-serif",color:localSuggestedPurchase>0?t.accent:t.green}}>
          Still need: {localSuggestedPurchase>0?fmt(localSuggestedPurchase)+" units":"✓ Covered"}
        </span>
      </div>

      {/* Priority Demand override field */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8,padding:"8px 10px",background:t.surface2,borderRadius:7,border:`1px solid ${t.border}`}}>
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
            textAlign:"right",outline:"none",fontFamily:"'Inter',system-ui,sans-serif",fontWeight:700}}
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
      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8,padding:"8px 10px",background:t.surface2,borderRadius:7,border:`1px solid ${t.border}`}}>
        <span style={{fontSize:13,fontWeight:600,color:t.text2,whiteSpace:"nowrap"}} title="Manually adds extra units on top of the file's Inbound figure. Gated by the same 'Include Inbound' checkbox in the settings bar above — turn that off and this has no effect.">
          Add Inbound
        </span>
        <input
          type="number" min={0} placeholder="0"
          value={extraInbound?.[sku.asin] ?? ""}
          onChange={e=>setExtraInbound(sku.asin, e.target.value)}
          style={{width:80,background:"transparent",border:`1px solid ${t.border}`,
            borderRadius:4,color:t.accent,padding:"3px 7px",fontSize:13,
            textAlign:"right",outline:"none",fontFamily:"'Inter',system-ui,sans-serif",fontWeight:700}}
        />
        {(extraInbound?.[sku.asin]??0)>0&&(
          <button onClick={()=>setExtraInbound(sku.asin,"")} title="Reset to 0"
            style={{fontSize:9,padding:"3px 8px",background:t.surface,border:`1px solid ${t.border}`,borderRadius:4,color:t.text3,cursor:"pointer"}}>
            ↺ Reset
          </button>
        )}
        <span style={{fontSize:10,color:t.text3}}>
          {settings.inclInbound!==false
            ? <>added to Inbound{(extraInbound?.[sku.asin]??0)>0&&<> — <span style={{color:t.accent,fontWeight:700}}>+{fmt(extraInbound[sku.asin])}</span> units</>}</>
            : <>Include Inbound is off — no effect</>}
        </span>
      </div>

      {/* ── PO Deduction Tip ── */}
      {totalOpenPoQty > 0 && (
        <div style={{
          marginTop:8,padding:"9px 12px",borderRadius:7,fontSize:11,
          background: fullyCoveredByPos ? t.green+"18" : t.accent+"14",
          border:`1px solid ${fullyCoveredByPos ? t.green+"44" : t.accent+"44"}`,
          fontFamily:"'Inter',system-ui,sans-serif",
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

    {/* FC Detail */}
    {hasFCData&&fcPlanning&&<div className="card" style={{marginBottom:10}}>
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
                    fontFamily:"'Inter',system-ui,sans-serif",
                  }}
                />
              </td>
              <td><span className="badge" style={{background:`${FC_STATUS_COLOR[fc.status]}18`,color:FC_STATUS_COLOR[fc.status],border:`1px solid ${FC_STATUS_COLOR[fc.status]}40`}}>{fc.status.toUpperCase()}</span></td>
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
            <span className="badge" style={{background:`${FC_STATUS_COLOR[r.status]}18`,color:FC_STATUS_COLOR[r.status],border:`1px solid ${FC_STATUS_COLOR[r.status]}40`}}>{r.status.toUpperCase()}</span>
            <span style={{flex:1,color:t.text}}>{r.label}</span>
            <span style={{color:t.text3}}>DOI: {isFinite(r.doi)?fmt(r.doi,1)+"d":"∞"}</span>
            {inboundOffset>0&&<span style={{color:t.text3,fontSize:10,fontFamily:"'Inter',system-ui,sans-serif"}}>−{fmt(inboundOffset)} inbound</span>}
            <span style={{color:finalNeeded>0?t.accent:t.green,fontWeight:700,fontFamily:"'Inter',system-ui,sans-serif"}}>
              {finalNeeded>0?`Send: ${fmt(finalNeeded)} units`:"✓ Covered"}
            </span>
          </div>
          );
        })}
      </div>}
    </div>}
    {!hasFCData&&<div className="alert ab" style={{marginBottom:10}}>ℹ No ledger data — FC-level analysis unavailable.</div>}

    {/* ── TOP CITIES ── */}
    <div className="card" style={{marginBottom:10}}>
      <div className="ch">Top Cities by Demand</div>
      <TopCities citySales={citySales} t={t}/>
    </div>

    {/* ── 30-DAY SALES TREND ── */}
    {salesHistory&&salesHistory.length>1&&(
    <div className="card" style={{marginBottom:10}}>
      <div className="ch">Sales — Last 30 Days</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={salesHistory} margin={{top:8,right:16,left:0,bottom:0}}>
          <CartesianGrid stroke={t.border} strokeDasharray="3 3" vertical={false}/>
          <XAxis dataKey="date" tickFormatter={dt=>{const p=dt.split("-");return `${p[2]}/${p[1]}`;}}
            tick={{fill:t.text3,fontSize:11,fontFamily:"'Inter',system-ui,sans-serif"}} axisLine={false} tickLine={false}
            interval={Math.max(0,Math.floor(salesHistory.length/8)-1)}/>
          <YAxis tick={{fill:t.text3,fontSize:11,fontFamily:"'Inter',system-ui,sans-serif"}} axisLine={false} tickLine={false} width={36}/>
          <Tooltip
            labelFormatter={dt=>{const p=dt.split("-");return `${p[2]}/${p[1]}/${p[0]}`;}}
            formatter={v=>[fmt(v),"Units sold"]}
            contentStyle={{background:t.tooltipBg,border:`1px solid ${t.border}`,borderRadius:8,fontSize:12,fontFamily:"'Inter',system-ui,sans-serif",boxShadow:"0 4px 12px rgba(0,0,0,.08)"}}
            labelStyle={{color:t.text2}} itemStyle={{color:t.accent}}/>
          <Line type="monotone" dataKey="units" stroke={t.accent} strokeWidth={2} dot={false} activeDot={{r:4}}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
    )}

    {/* ── INDIA REGIONAL HEATMAP ── */}
    <div className="card" style={{marginBottom:10}}>
      <div className="ch">India Regional Demand & Stock Heatmap</div>
      <IndiaHeatmap regionalSales={regionalSales} fcPlanning={fcPlanning} settings={settings} velocity={vel} t={t}/>
    </div>

    {/* ── 70-DAY FORECAST with Reorder Line ── */}
    <div className="card">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div className="ch" style={{marginBottom:0}}>70-Day Inventory Forecast</div>
        <div style={{display:"flex",gap:14,alignItems:"center",fontSize:9,fontFamily:"'Inter',system-ui,sans-serif"}}>
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
            domain={[0, Math.ceil(Math.max(sku.currentStock, reorderStock) * 1.12)]}/>
          <Tooltip contentStyle={{background:"#1f2937",border:"1px solid #374151",borderRadius:8,fontSize:11}}
            itemStyle={{color:"#f9fafb"}} labelStyle={{color:"#d1d5db"}}/>
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
      {soi>0&&<div style={{marginTop:6,fontSize:9,color:t.red,fontFamily:"'Inter',system-ui,sans-serif"}}>
        ⚠ Projected stockout in ~{soi} days ({fmtDate(new Date((sku._anchor||getToday()).getTime()+soi*86400000))})
      </div>}
      {reorderStock>0&&sku.currentStock<=reorderStock&&<div style={{marginTop:4,fontSize:9,color:t.yellow,fontFamily:"'Inter',system-ui,sans-serif"}}>
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
  function resetAll(){if(window.confirm("Reset all SKU config to defaults?"))setSkuCfg({...DEFAULT_SKU_CONFIG});}
  const doiColor=(doi)=>{if(!isFinite(doi)||doi>999)return t.green;if(doi<7)return t.red;if(doi<21)return t.yellow;return t.green;};

  return(<div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14,gap:12,flexWrap:"wrap"}}>
      <div>
        <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:4}}>SKU Manager</div>
        <div style={{fontSize:10,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>
          Toggle SKUs active/inactive · Add notes · Set categories · Changes apply instantly
        </div>
      </div>
      <button className="btn bs" onClick={resetAll} style={{fontSize:11}}>↺ Reset Defaults</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
      {[{l:"Total SKUs",v:allAsins.length,c:""},{l:"Active",v:activeCount,c:"g",sub:"In calculations"},{l:"Inactive",v:inactiveCount,c:"r",sub:"Excluded"},{l:"In Calculations",v:data?Object.keys(data).length:"—",c:"",sub:"Currently loaded"}].map(k=>(
        <div key={k.l} className={`kc ${k.c}`}>
          <div className="kl">{k.l}</div>
          <div className="kv" style={{color:k.c==="r"?t.red:k.c==="g"?t.green:t.text}}>{k.v}</div>
          {k.sub&&<div className="ks">{k.sub}</div>}
        </div>
      ))}
    </div>
    <div className="alert ab" style={{marginBottom:12}}>
      <span>ℹ</span><span>Inactive SKUs are <strong>completely excluded</strong> from all views and calculations. Stored in localStorage.</span>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
      <div className="sbox"><span style={{color:t.text3}}>⌕</span><input placeholder="Search name, ASIN, SKU, note…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <select className="sel" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
        <option value="all">All SKUs ({rows.length})</option>
        <option value="active">Active ({activeCount})</option>
        <option value="inactive">Inactive ({inactiveCount})</option>
      </select>
      {selected.size>0&&(
        <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:4}}>
          <span style={{fontSize:10,color:t.accent,fontFamily:"'Inter',system-ui,sans-serif"}}>{selected.size} selected</span>
          <button className="btn bp" style={{fontSize:10,padding:"4px 9px"}} onClick={()=>bulkSetActive(true)}>✓ Activate</button>
          <button className="btn" style={{fontSize:10,padding:"4px 9px",background:t.redBg,color:t.red,border:`1px solid ${t.redBdr}`}} onClick={()=>bulkSetActive(false)}>✕ Deactivate</button>
          <select className="sel" style={{fontSize:10}} defaultValue="" onChange={e=>{if(e.target.value)bulkSetCategory(e.target.value);}}>
            <option value="">Set category…</option>
            {CATEGORY_OPTIONS.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn bs" style={{fontSize:10,padding:"4px 9px"}} onClick={clearSelect}>Clear</button>
        </div>
      )}
      {selected.size===0&&<button className="btn bs" style={{fontSize:10,padding:"4px 9px",marginLeft:4}} onClick={selectAll}>Select All</button>}
      <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>{filtered.length} SKUs shown</span>
    </div>
    <div className="card" style={{padding:0,overflow:"hidden"}}>
      <div className="tw ts">
        <table>
          <thead><tr>
            <th style={{width:32}}><input type="checkbox" checked={selected.size===filtered.length&&filtered.length>0} onChange={e=>e.target.checked?selectAll():clearSelect()} style={{cursor:"pointer"}}/></th>
            <th>Status</th><th>SKU Name</th><th>ASIN</th><th>Seller SKU</th><th>Category</th><th>Note</th><th title="Overrides computed demand — never lowers it, only raises">Priority Demand</th>
            {data&&<><th>DOI</th><th>Stock</th><th>Demand/Day</th><th>Action</th></>}
          </tr></thead>
          <tbody>{filtered.map(r=>(
            <tr key={r.asin} style={{opacity:r.active?1:.55}}>
              <td><input type="checkbox" checked={selected.has(r.asin)} onChange={()=>toggleSelect(r.asin)} style={{cursor:"pointer"}}/></td>
              <td>
                <button onClick={()=>toggle(r.asin)} style={{padding:"4px 12px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:500,fontFamily:"'Inter',system-ui,sans-serif",background:r.active?t.greenBg:t.redBg,color:r.active?t.green:t.red,border:`1px solid ${r.active?t.greenBdr:t.redBdr}`,transition:"all .15s"}}>
                  {r.active?"● ACTIVE":"○ INACTIVE"}
                </button>
              </td>
              <td><div className="tn" style={{maxWidth:180}}>{r.finalName}</div></td>
              <td><span style={{fontSize:10,fontFamily:"'Inter',system-ui,sans-serif",color:t.text3}}>{r.asin}</span></td>
              <td><span style={{fontSize:10,color:t.text2,fontFamily:"'Inter',system-ui,sans-serif"}}>{r.sellerSku}</span></td>
              <td>
                <select value={r.category} onChange={e=>setCategory(r.asin,e.target.value)} style={{padding:"3px 6px",background:t.surface2,border:`1px solid ${t.border}`,borderRadius:6,color:t.text2,fontSize:10,cursor:"pointer",fontFamily:"'Inter',system-ui,sans-serif",outline:"none"}}>
                  {CATEGORY_OPTIONS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td style={{minWidth:180}}>
                {editingNote===r.asin?(
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    <input autoFocus value={noteValue} onChange={e=>setNoteValue(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")setNote(r.asin,noteValue);if(e.key==="Escape")setEditingNote(null);}}
                      style={{flex:1,padding:"3px 7px",background:t.surface2,border:`1px solid ${t.accent}`,borderRadius:5,color:t.text,fontSize:11,fontFamily:"'Inter',system-ui,sans-serif",outline:"none"}}
                      placeholder="Add note…"/>
                    <span style={{cursor:"pointer",color:t.green,fontSize:14}} onClick={()=>setNote(r.asin,noteValue)}>✓</span>
                    <span style={{cursor:"pointer",color:t.text3,fontSize:14}} onClick={()=>setEditingNote(null)}>✕</span>
                  </div>
                ):(
                  <div onClick={()=>{setEditingNote(r.asin);setNoteValue(r.note);}} style={{cursor:"pointer",fontSize:10,color:r.note?t.text2:t.text3,fontFamily:"'Inter',system-ui,sans-serif",padding:"3px 0",borderBottom:`1px dashed ${t.border2}`,minWidth:120}} title="Click to edit">
                    {r.note||<span style={{opacity:.4}}>click to add note…</span>}
                  </div>
                )}
              </td>
              <td>
                <input type="number" min={0} step="0.1" placeholder="auto" defaultValue={r.priorityDemand??""}
                  onBlur={e=>setPriorityDemand(r.asin,e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")e.target.blur();}}
                  style={{width:64,padding:"3px 6px",background:t.surface2,border:`1px solid ${t.border}`,borderRadius:5,color:t.accent,fontSize:10,textAlign:"right",fontFamily:"'Inter',system-ui,sans-serif",fontWeight:700,outline:"none"}}/>
              </td>
              {data&&<>
                <td>{r.hasLiveData?<span style={{color:doiColor(r.doi),fontWeight:700}}>{isFinite(r.doi)&&r.doi<999?fmt(r.doi,1)+"d":"∞"}</span>:<span style={{color:t.text3,fontSize:9}}>inactive</span>}</td>
                <td>{r.hasLiveData?fmt(r.stock):"—"}</td>
                <td>{r.hasLiveData?fmt(r.demand,2):"—"}</td>
                <td>{r.hasLiveData?<PBadge action={r.action} priority={r.priority} purchasePct={r.purchasePct||0} replenishPct={r.replenishPct||0} t={t}/>:<span className="badge bgr"><span className="dot gr"></span>excluded</span>}</td>
              </>}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
    <div style={{marginTop:12,display:"flex",gap:8,alignItems:"center"}}>
      <button className="btn bs" style={{fontSize:11}} onClick={()=>{
        const blob=new Blob([JSON.stringify(skuCfg,null,2)],{type:"application/json"});
        const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="sku_config.json";a.click();URL.revokeObjectURL(url);
      }}>↓ Export Config JSON</button>
      <span style={{fontSize:9,color:t.text3,fontFamily:"'Inter',system-ui,sans-serif"}}>Save config to file. To hard-code, paste into DEFAULT_SKU_CONFIG.</span>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════ */
export default function FBAPlanner(){
  const dataInputRef=useRef(null);
  const[dark,setDark]=useState(true);
  const[parseDebug,setParseDebug]=useState(null);
  const t=dark?DARK:LIGHT;
  const[tab,setTab]=useState("input");
  const[col,setCol]=useState(false);
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
    fc:"FC View",lis:"LIS — Send Stock",procurement:"Procurement Forecast",
    skumgr:"SKU Manager",warnings:"Data Quality"};
  const pageTitle = tab==="detail"&&selSku&&data?.[selSku]
    ? data[selSku].finalName
    : (TITLES[tab]||"Dashboard");

  const TABS=[
    {id:"input",ic:"IN",l:"Data Input"},
    {id:"dashboard",ic:"DB",l:"Dashboard"},
    {id:"allskus",ic:"SKU",l:"All SKUs"},
    {id:"fc",ic:"FC",l:"FC View",badge:fcCrit,bc:"b"},
    {id:"lis",ic:"LIS",l:"LIS",badge:critCount||null,bc:"r"},
    {id:"procurement",ic:"PR",l:"Procurement",badge:procCrit,bc:""},
    {id:"skumgr",ic:"MG",l:"SKU Manager",badge:inactiveCount||null,bc:"y"},
    {id:"warnings",ic:"DQ",l:"Data Quality",badge:wc},
  ];

  const goSku=asin=>{setSelSku(asin);setTab("detail");};

  // Anchor date for display
  const anchorLabel = rawData?.maxDate ? `Data: ${fmtDate(rawData.maxDate)}` : fmtDate(getToday());

  return(<>
    <style>{makeCSS(t)}</style>
    <div id="fba-root">
      {/* SIDEBAR */}
      <div className={`sb${col?" col":""}`}>
        <div className="sb-logo">
          {LOGO_ICON}
          <div className="sb-txt"><h1>Inventory Forecast</h1></div>
        </div>
        <div className="sb-nav">
          <div className="sb-sec">
            <div className="sb-lbl">Navigation</div>
            {TABS.map(tb=>{
              const disabled=tb.id!=="input"&&!data&&tb.id!=="warnings";
              return(
                <div key={tb.id}
                  className={`ni${tab===tb.id||(tab==="detail"&&tb.id==="allskus")?" on":""}${disabled?" disabled":""}`}
                  onClick={()=>{if(disabled)return;setSelSku(null);setTab(tb.id);}}>
                  <span className="ni-ic">{NAV_ICONS[tb.id]}</span>
                  <span className="ni-txt">{tb.l}</span>
                  {tb.badge>0&&<span className={`nb${tb.bc?" "+tb.bc:""}`}>{tb.badge}</span>}
                </div>
              );
            })}
          </div>
          {data&&!col&&<div className="sb-sec">
            <div
  style={{
    padding:"5px 8px",
    marginTop:12,
    paddingTop:8,
    borderTop:"1px solid rgba(255,255,255,.06)",
    color:"rgba(186, 170, 255, 0.28)",
    fontSize:8,
    letterSpacing:1.4,
    fontFamily:"'Inter',system-ui,sans-serif",
  }}
>
    Designed for Helett
</div>
          </div>}
        </div>
        <div className="sb-foot" onClick={()=>setCol(c=>!c)}>
          <svg className="sb-foot-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {col?<polyline points="11,5 7,9 11,13"/>:<polyline points="7,5 11,9 7,13"/>}
          </svg>
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          <div style={{overflow:"hidden",minWidth:0}}>
            <div className="tb-title">{pageTitle}</div>
            {data&&<div className="tb-sub">
              {Object.keys(data).length} SKUs · Safety {settings.safetyDays}d · +{settings.totalLeadTime}d delay · {anchorLabel}
            </div>}
          </div>
          <div className="tb-r">
            {rawData?.minSalesDate&&rawData?.maxDate&&(
              <span className="tb-badge" style={{
                fontSize:9,background:t.surface2,border:`1px solid ${t.border}`,
                color:t.text3,fontFamily:"'Inter',system-ui,sans-serif",padding:"3px 8px",borderRadius:5,
              }}>
                Sales {rawData.minSalesDate.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})} – {rawData.maxDate.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}
              </span>
            )}
            {rawData?.ledgerDate&&(
              <span className="tb-badge" style={{
                fontSize:9,background:t.surface2,border:`1px solid ${t.border}`,
                color:t.text3,fontFamily:"'Inter',system-ui,sans-serif",padding:"3px 8px",borderRadius:5,
              }}>
                Ledger {rawData.ledgerDate.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
              </span>
            )}
            
            <button className="tb-btn" onClick={()=>dataInputRef.current?.refreshSheets()} disabled={loading} title="Re-fetch data from Google Sheets">{loading?"Refreshing…":"⟳ Refresh"}</button>
            <button className="tb-btn-accent" onClick={()=>setDark(d=>!d)}>{dark?"Light":"Dark"}</button>
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
          {data&&<div style={{display:tab==="allskus"?"block":"none"}}><AllSKUs data={data} settings={settings} setSettings={setSettings} onSku={goSku} t={t}/></div>}
          {tab==="dashboard"&&data&&<Dashboard data={data} settings={settings} setSettings={setSettings} onSku={goSku} t={t} purchRows={rawData?.purchRows||[]}/>}
          {tab==="fc"&&data&&<FCView data={data} settings={settings} setSettings={setSettings} onSku={goSku} t={t}/>}
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
  </>);
}
