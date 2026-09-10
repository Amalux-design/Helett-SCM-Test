import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from "recharts";

/* ═══════════════════════════════════════════════════════════════
   SKU MAP
═══════════════════════════════════════════════════════════════ */
const SKU_MAP = {
  "B0GV4K1P7L":{"sellerSku":"HL96 Hair Dryer","finalName":"HL96 Hair Dryer"},
  "B0DZGPV245":{"sellerSku":"HE480 30C Pro Old","finalName":"HE480 30C Pro Old"},
  "B0GPCQ9KLN":{"sellerSku":"Logic View Monitor HLT550","finalName":"HLT550 Video Monitor"},
  "B0F5Q4RV2R":{"sellerSku":"Helett 2D Barcode Scanner Fba","finalName":"Helett 2D Barcode Scanner"},
  "B0C8JRN652":{"sellerSku":"UY16 UHF Wireless mic","finalName":"UY16 Wireless Mic"},
  "B0CN1153M4":{"sellerSku":"Helett HT35 Dual UHF Mic","finalName":"HT35 Dual UHF Mic"},
  "B0BRXX6HMR":{"sellerSku":"Wifi Dongle FBA","finalName":"Wifi Dongle FBA"},
  "B0G1YY4MJK":{"sellerSku":"Helett travel-Fi 4G","finalName":"travelfi 4G Hotspot"},
  "B0BYZVNPL4":{"sellerSku":"UNIY UY 35 Mini led Projector","finalName":"UY35 Mini Projector"},
  "B0C9CVWLL3":{"sellerSku":"Uniy S11 FBA","finalName":"Uniy S11 FBA"},
  "B0FLK7RSCV":{"sellerSku":"Helett HLT550 Portable Monitor","finalName":"HLT550 Portable Monitor"},
  "B0DL5PXZ65":{"sellerSku":"Helett H55C Thermal Label Printer","finalName":"H30c pro old (HE480)"},
  "B0FZSJRV5F":{"sellerSku":"Helett H65C Label Printer","finalName":"H65C Mini Printer (New Blue)"},
  "B0D4F7Y3NZ":{"sellerSku":"Helett H29 Wireless Drama Mic","finalName":"H29 Wireless Drama Mic"},
  "B0DKXD4N4R":{"sellerSku":"Helett A4L Pro Thermal Printer","finalName":"A4L Pro Thermal Printer"},
  "B0CN11FZW5":{"sellerSku":"T10 Projector FBA","finalName":"T10 Projector FBA"},
  "B0888WZ411":{"sellerSku":"Helett TV","finalName":"Helett TV"},
  "B0C8TW9ZR6":{"sellerSku":"I5-Z3IP-OQGJ","finalName":"I5-Z3IP-OQGJ"},
  "B0CL4GVKSN":{"sellerSku":"UNIY T10 Mini Projector","finalName":"T10 Mini Projector"},
  "B0BFRS5BLT":{"sellerSku":"UY8401 Smart Digital Door Lock FBA","finalName":"UY8401 Door Lock"},
  "B0CB1DDNV7":{"sellerSku":"UY20 Streaming mic","finalName":"UY20 Streaming Mic"},
  "B0CJVGCB4K":{"sellerSku":"H30c printer (White)","finalName":"H30c Printer (New)"},
  "B0CRB2KDC6":{"sellerSku":"HT320 Digital Door MFN","finalName":"HT320 Smart Lock"},
  "B01G46PYPO":{"sellerSku":"UC46 New Projector 12","finalName":"UC46 Projector 12"},
  "B0BZ8HF4WL":{"sellerSku":"UNIY UY410 Barcode Scanner","finalName":"UY410 Barcode Scanner"},
  "B07TW7QMBN":{"sellerSku":"YUNTAB 3G Tablet","finalName":"YUNTAB 3G Tablet"},
  "B07TD94GPJ":{"sellerSku":"Proscan PLT8990-K","finalName":"Proscan PLT8990-K"},
  "B0BFFW365Y":{"sellerSku":"UNIY UY610 Smart Door Lock FBA","finalName":"UY610 Door Lock"},
  "B0BPHT9WY9":{"sellerSku":"UY40 Projector FBA","finalName":"UY40 Projector"},
  "B0CLYLNCZD":{"sellerSku":"810 App Door Lock FBA","finalName":"810 App Door Lock"},
  "B0CFHRLWM2":{"sellerSku":"helett HT 75W car power inverter","finalName":"HT 75W Power Inverter"},
  "B0B5VQYGW6":{"sellerSku":"UNIY Smart Life Security Camera","finalName":"Smart Life Camera"},
  "B0CQ24C7DX":{"sellerSku":"V0-FM48-RT2B","finalName":"V0-FM48-RT2B"},
  "B0DGF32QRT":{"sellerSku":"Helett AC1200 Dual Band Wifi Router","finalName":"AC1200 Wifi Router"},
  "B0DD7LH58C":{"sellerSku":"Helett JH1200","finalName":"Helett JH1200"},
  "B0FZL52KY4":{"sellerSku":"Helett infiStick Tv Stick","finalName":"infiStick TV Stick"},
  "B0CQTJH6WX":{"sellerSku":"Car-Jumper-Black","finalName":"Car Jumper Black"},
  "B0D39NNN57":{"sellerSku":"Helett HT15 wired desktop scanner","finalName":"HT15 Wired Scanner"},
  "B0D4F12NJT":{"sellerSku":"Uniy U01 Rfid Card","finalName":"U01 RFID Card"},
  "B0CD7YNMRM":{"sellerSku":"XP-H1UH-2R9U","finalName":"XP-H1UH-2R9U"},
  "B07QLRJGDJ":{"sellerSku":"4 UC46 Projector","finalName":"UC46 Projector (4)"},
  "B0DXKWKBWQ":{"sellerSku":"Helett 2x1.5 Thermal Label","finalName":"65C Label Roll"},
  "B0CHFQPZMK":{"sellerSku":"helett HT200 Soundbar","finalName":"HT200 Soundbar"},
  "B0CB8YRRZ4":{"sellerSku":"helett HU1 kids GPS Tracking watch","finalName":"HU1 GPS Kids Watch"},
  "B0CBC9G7W2":{"sellerSku":"HT410 wired Barcode scanner FBA","finalName":"HT410 Barcode (Blue)"},
  "B0DLKM4N5G":{"sellerSku":"Helett Z567 Tyre Inflator","finalName":"Z567 Tyre Inflator"},
  "B0DGGPBX97":{"sellerSku":"Helett travel-Fi 4g Hotspot","finalName":"travelFi 4G Hotspot v2"},
  "B0DPCRLRNJ":{"sellerSku":"HT20pro Wirelss Barcode Scanner","finalName":"HT20 Pro Barcode"},
  "B0CQNM753Q":{"sellerSku":"Helett H92i Android Tv Stick","finalName":"H92i Android TV Stick"},
  "B0C72FSCFM":{"sellerSku":"U19 wireless Training Mic","finalName":"U19 Training Mic"},
  "B0F1KF6P4J":{"sellerSku":"Helett HT-M318 Desktop Barcode Scanner","finalName":"HT-M318 Desktop Scanner"},
  "B07XP99KF8":{"sellerSku":"UC46 0 Projector","finalName":"UC46 Projector (0)"},
  "B0CXPX968F":{"sellerSku":"H89i","finalName":"H89i"},
  "B0C999P5KB":{"sellerSku":"HT210 galaxy projector kid","finalName":"HT210 Galaxy Projector"},
  "B09FGVPBHK":{"sellerSku":"Led Projector","finalName":"LED Projector"},
  "B0BPPNNVT5":{"sellerSku":"UNIY UY (310) 4G Wi-Fi Hotspot Dongle","finalName":"UY310 4G Hotspot"},
  "B0DXC17SSS":{"sellerSku":"HE24 Thermal Label 15x30","finalName":"HE24 Label 15x30"},
  "B0BDFLDDKR":{"sellerSku":"UNIY UY8300 FBA","finalName":"UY8300 FBA"},
  "B0BJC4WGDK":{"sellerSku":"UY 12 UHF Dual wireless MIC","finalName":"UY12 Dual Wireless Mic"},
  "B0CBXG8CLB":{"sellerSku":"HT210 Door lock","finalName":"HT210 Door Lock"},
  "B084TQMCLN":{"sellerSku":"UC 200 Projector","finalName":"UC200 Projector"},
  "B016DGF0ZY":{"sellerSku":"UNIC UC40 Projector 1080p","finalName":"UC40 Projector 1080p"},
  "B0BLNLYVFQ":{"sellerSku":"G5-MA5V-WDTH","finalName":"G5-MA5V-WDTH"},
  "B0DD6WNP26":{"sellerSku":"Helett HW10 wifi extender","finalName":"HW10 Wifi Extender"},
  "B08LQ1G624":{"sellerSku":"UC46 projector","finalName":"UC46 Projector"},
  "B0DPJ8BWCG":{"sellerSku":"Helett H92 TV Stick","finalName":"H92 TV Stick"},
  "B0CXN44J7J":{"sellerSku":"helett H58i Bluetooth Printer FBA","finalName":"H58i Mini Printer"},
  "B0CNLW386T":{"sellerSku":"Helett HT15 wired Barcode Scanner FBA","finalName":"HT15 Wired Scanner FBA"},
  "B0D9LS2P2F":{"sellerSku":"Helett HL96 Hair Dryer FBA","finalName":"HL96 Hair Dryer"},
  "B0DW8DX2M9":{"sellerSku":"Helett H30CLite Printer","finalName":"H30C Lite Printer"},
  "B013JYPTA4":{"sellerSku":"UC 40+ Projector 1325","finalName":"UC40+ Projector"},
  "B0BRKVYG8X":{"sellerSku":"2D-B2X1-4D6F","finalName":"2D-B2X1-4D6F"},
  "B07TB4DZTK":{"sellerSku":"RD-801 Projector","finalName":"RD-801 Projector"},
  "B0FSSL1Q2X":{"sellerSku":"Helett H30C Printer New FBA","finalName":"H30C Printer (Old)"},
  "B0F8QKDJN3":{"sellerSku":"Helett Ht15e Desktop Barcode Scanner FBA","finalName":"HT15E Scanner"},
  "B0DJK3GNCY":{"sellerSku":"helett WS5","finalName":"Helett WS5"},
  "B01DYJ8R4O":{"sellerSku":"UNIC UC30 PROJECTOR","finalName":"UC30 Projector"},
  "B0DW8PCP6D":{"sellerSku":"Helett 4x6 Thermal Label","finalName":"4x6 Thermal Label"},
  "B0D9KKFVT6":{"sellerSku":"UNIY UY720 Smart Door Lock FBA","finalName":"UY720 Door Lock"},
  "B0BL3LJHRB":{"sellerSku":"UY46 old","finalName":"UY46 (Old)"},
  "B08FC23JD7":{"sellerSku":"UC20 projector","finalName":"UC20 Projector"},
  "B0CZ99K438":{"sellerSku":"H80i Autocut Thermal Printer","finalName":"H80i Autocut Printer"},
  "B07T2VZMSG":{"sellerSku":"HTPHT580BLACK","finalName":"HTPHT580 Black"},
  "B0DDL3TR1L":{"sellerSku":"helett HE24 Label Printer","finalName":"HE24 Mini Printer"},
  "B0CPDPTHVN":{"sellerSku":"Helett Ht20 Barcode Scanner","finalName":"HT20 Barcode"},
  "B0D9KJJ7WF":{"sellerSku":"D8-ZNA6-NT4M","finalName":"D8-ZNA6-NT4M"},
  "B07FDG8GQT":{"sellerSku":"1UC46Projector","finalName":"UC46 Projector (1)"},
  "B01H35Y352":{"sellerSku":"UC 30 Project 3","finalName":"UC30 Project 3"},
  "B07MK547MK":{"sellerSku":"UC46 90","finalName":"UC46 (90)"},
  "B0GSZRF4M5":{"sellerSku":"Helett Z567 Tyre Inflator NEW","finalName":"Z567 Tyre Inflator NEW"},
  "B0C3HZDJ5C":{"sellerSku":"ZT-NKSW-TLDE","finalName":"ZT-NKSW-TLDE"},
  "B0FL2VFCT9":{"sellerSku":"HE24 Thermal Label 12x50","finalName":"HE24 Label Roll 12x50"},
  "B0C96F68YL":{"sellerSku":"helett HT8400 car power inverter","finalName":"HT8400 Power Inverter"},
  "B0D1P7SC46":{"sellerSku":"Helett H65C 2in1 Thermal Printer","finalName":"H65C 2in1 Printer"},
  "B0BRXVQ85M":{"sellerSku":"UNIY UY20+ Mini Led projector","finalName":"UY20+ Mini Projector"},
  "B0DTNVQ34H":{"sellerSku":"HE24 Label Tape","finalName":"HE24 Label Tape 12x30"},
  "B0FLV3V1W4":{"sellerSku":"Helett H65Clite Printer","finalName":"H65C Lite Printer"},
  "B0FZSCW83R":{"sellerSku":"Helett H75C Printer","finalName":"H65C Mini Printer (New)"},
  "B0BD9191XX":{"sellerSku":"UY400 mini Led Projector","finalName":"UY400 Mini Projector"},
  "B0FGCT1MWB":{"sellerSku":"Helett Ht15 Desktop Barcode Scanner","finalName":"HT15 Desktop Scanner"},
  "B0DQGSMG4N":{"sellerSku":"Helett Label Paper 4x6","finalName":"Label Paper 4x6"},
  "B091TCSG4D":{"sellerSku":"UNIY UY200","finalName":"UNIY UY200"},
  "B0CR75SMCQ":{"sellerSku":"H41","finalName":"H41 Cabinet Lock"},
  "B07T85LWH7":{"sellerSku":"Yuntab 7 inch 3G Unlocked","finalName":"Yuntab 7\" 3G"},
  "B09TY1SZP6":{"sellerSku":"New UY46 FBA","finalName":"UY46 (New)"},
  "B0DTQ3ZCBH":{"sellerSku":"HE24 Thermal Label Tape","finalName":"HE24 Label 15x50"},
  "B0DRL8ZDWX":{"sellerSku":"Helett H30C Lite Printer","finalName":"H30C Lite Printer v2"},
  "B086ZFW6HD":{"sellerSku":"FILPO Soap Dispenser","finalName":"FILPO Soap Dispenser"},
  "B0BJMLX4RR":{"sellerSku":"UY10 Wired Mic","finalName":"UY10 Wired Mic"},
  "B0CQTK12SW":{"sellerSku":"Rice-Cooker-Black","finalName":"Rice Cooker Black"},
  "B0DQGQY98X":{"sellerSku":"Helett HE760 Mobile Printer","finalName":"HE760 Mobile Printer"},
  "B09K4M1JSN":{"sellerSku":"UNIY UY 46 Projector","finalName":"UY46 Projector"},
  "B0D9T8R3W8":{"sellerSku":"Helett H01 Label Holder FBA","finalName":"H01 Label Holder"},
  "B09TWLRXZ3":{"sellerSku":"UNIY A1 128 GB SdCard","finalName":"A1 128GB SD Card"},
  "B0FKZPDH66":{"sellerSku":"Helett H30C Pro Printer","finalName":"H30C Pro (Aiyin)"},
  "B07Q5PC3SV":{"sellerSku":"UC 40+ Projector","finalName":"UC40+ Projector v2"},
  "B0F6MXY655":{"sellerSku":"HT20proL Wirelss Barcode Scanner MFN","finalName":"HT20proL Scanner MFN"},
  "B0BRN9ZGL1":{"sellerSku":"UY-TTH9-BCAS","finalName":"UY-TTH9-BCAS"},
  "B0BLV54ZQK":{"sellerSku":"UY 14 UHF Wireless MIC","finalName":"UY14 Wireless Mic"},
  "B0CC8ZFPRX":{"sellerSku":"HT510 Barcode Scanner","finalName":"HT510 Scanner"},
  "B0DD7RS56N":{"sellerSku":"Helett Z567 Tyre Inflator FBA","finalName":"Z567 Tyre Inflator FBA"},
  "B0CB8X5RCN":{"sellerSku":"UNIY UY85 kids smart watch","finalName":"UY85 Kids Smart Watch"},
  "B0C8NNB48Z":{"sellerSku":"UY510 Barcode Scanner","finalName":"UY510 Scanner"},
  "B08PSLZYZV":{"sellerSku":"UC20 mini projector","finalName":"UC20 Mini Projector"},
  "B0DBCW1PS4":{"sellerSku":"UNIY UY720 Smartdoor Lock FBA","finalName":"UY720 Door Lock v2"},
  "B0CQM5THV3":{"sellerSku":"ECO- D3-BT","finalName":"BT Soundbar"},
  "B0GDKY6QHN":{"sellerSku":"Helett infiStick android stick","finalName":"infiStick Android"},
  "B0FGTMFZFM":{"sellerSku":"MO-DT5V-SO2M","finalName":"MO-DT5V-SO2M"},
  "B0DGCG6MN4":{"sellerSku":"Helett HE760 Receipt Printer FBA","finalName":"HE760 Receipt Printer"},
  "B0CR7JGRYJ":{"sellerSku":"SKU: OFFICE_LOCK_BLACK_30-100","finalName":"Office Lock Black"},
  "B0FHQSL9DH":{"sellerSku":"Helett H30CPro Printer","finalName":"H30C Pro Printer"},
  "B0CMMMJ5WY":{"sellerSku":"Helett HT35 Dual microphone","finalName":"HT35 Dual Mic"},
};

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
   FC CITY MAPPING
═══════════════════════════════════════════════════════════════ */
const FC_CITY = {
  AMD2:"Ahmedabad", BLR4:"Bangalore", BLR5:"Bangalore", BLR7:"Bangalore", BLR8:"Bangalore",
  BOM5:"Mumbai", BOM7:"Mumbai", CCX1:"West Bengal", CCX2:"West Bengal", CJB1:"Coimbatore",
  DED4:"Haryana", DEL4:"Haryana", DEL5:"Haryana", DEX3:"Delhi", HYD3:"Hyderabad", HYD8:"Hyderabad",
  LKO1:"Lucknow", MAA4:"Chennai", PAX1:"Patna, Bihar", PNQ2:"Pune", PNQ3:"Pune", SBLL:"Hubballi, Karnataka"
};
function fcLabel(code) {
  return FC_CITY[code] ? `${code} (${FC_CITY[code]})` : code;
}

/* ═══════════════════════════════════════════════════════════════
   FC → REGION MAPPING (for stock heatmap)
═══════════════════════════════════════════════════════════════ */
const FC_REGION = {
  AMD2:"West",  BLR4:"South", BLR5:"South", BLR7:"South",  BLR8:"South",
  BOM5:"West",  BOM7:"West",  CCX1:"East",  CCX2:"East",   CJB1:"South",
  DED4:"North", DEL4:"North", DEL5:"North", DEX3:"North",  HYD3:"South", HYD8:"South",
  LKO1:"North", MAA4:"South", PAX1:"East",  PNQ2:"West",   PNQ3:"West",  SBLL:"South"
};

/* ═══════════════════════════════════════════════════════════════
   STATE → REGION MAPPING
   Handles full names + 2-letter ISO codes + Amazon's abbrevs
═══════════════════════════════════════════════════════════════ */
const STATE_TO_REGION = {
  // ── North ──
  "DELHI":"North","NCT OF DELHI":"North","NEW DELHI":"North","DL":"North",
  "HARYANA":"North","HR":"North",
  "HIMACHAL PRADESH":"North","HP":"North",
  "JAMMU AND KASHMIR":"North","JAMMU & KASHMIR":"North","JK":"North",
  "LADAKH":"North","LA":"North",
  "PUNJAB":"North","PB":"North",
  "RAJASTHAN":"North","RJ":"North",
  "UTTARAKHAND":"North","UTTARANCHAL":"North","UK":"North","UT":"North",
  "UTTAR PRADESH":"North","UP":"North",
  "CHANDIGARH":"North","CH":"North",
  // ── South ──
  "ANDHRA PRADESH":"South","AP":"South","A P":"South",
  "KARNATAKA":"South","KA":"South",
  "KERALA":"South","KL":"South",
  "TAMIL NADU":"South","TN":"South",
  "TELANGANA":"South","TELANGANA STATE":"South","TG":"South","TS":"South",
  "PUDUCHERRY":"South","PONDICHERRY":"South","PY":"South",
  "ANDAMAN AND NICOBAR ISLANDS":"South","ANDAMAN & NICOBAR ISLANDS":"South","ANDAMAN & NICOBAR":"South","AN":"South",
  "LAKSHADWEEP":"South","LD":"South",
  // ── East ──
  "BIHAR":"East","BR":"East",
  "JHARKHAND":"East","JH":"East",
  "ODISHA":"East","ORISSA":"East","OR":"East","OD":"East",
  "WEST BENGAL":"East","WB":"East",
  "ASSAM":"East","AS":"East",
  "MANIPUR":"East","MN":"East",
  "MEGHALAYA":"East","ML":"East",
  "MIZORAM":"East","MZ":"East",
  "NAGALAND":"East","NL":"East",
  "SIKKIM":"East","SK":"East",
  "TRIPURA":"East","TR":"East",
  "ARUNACHAL PRADESH":"East","AR":"East",
  // ── West ──
  "GOA":"West","GA":"West",
  "GUJARAT":"West","GJ":"West",
  "MAHARASHTRA":"West","MH":"West",
  "DADRA AND NAGAR HAVELI":"West","DADRA & NAGAR HAVELI":"West",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU":"West","DN":"West",
  "DAMAN AND DIU":"West","DAMAN & DIU":"West","DD":"West",
  // ── Central ──
  "CHHATTISGARH":"Central","CT":"Central","CG":"Central",
  "MADHYA PRADESH":"Central","MP":"Central",
};

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
function processInventory(rows) {
  const inv={}, warnings=[];
  if (!rows||!rows.length) return {inv,warnings};
  const get=makeGet(rows);
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
    const cost = n(r,get,"Unit Cost (₹)","Unit Cost","unit cost");
    inv[asin]={
      asin, csvSku, finalName:SKU_MAP[asin].finalName, sellerSku:SKU_MAP[asin].sellerSku,
      fcSellable:fc, fcUnsellable:fcU, fbaAvailable:fba, fbaUnsellable:fbaU,
      inbound:inb, processing:proc,
      currentStock: fc + fba + inb + proc*0.8,
      unitCost:cost,
      statusFlags: s(r,get,"Status Flags","StatusFlags","status flags"),
    };
  });
  return {inv,warnings};
}

/* ═══════════════════════════════════════════════════════════════
   CITY NORMALIZER
═══════════════════════════════════════════════════════════════ */
const CITY_ALIAS = {
  "BENGALURU":"BANGALORE","BENGALORE":"BANGALORE","BANGLAORE":"BANGALORE","BANGLORE":"BANGALORE",
  "BOMBAY":"MUMBAI","CALCUTTA":"KOLKATA","MADRAS":"CHENNAI",
  "NEW DELHI":"DELHI","N DELHI":"DELHI","NEWDELHI":"DELHI",
  "THIRUVANANTHAPURAM":"TRIVANDRUM","THIRUVANATHAPURAM":"TRIVANDRUM","THIRUVANANTHAPURA":"TRIVANDRUM",
  "COCHIN":"KOCHI","ERNAKULAM":"KOCHI","KAKKANAD":"KOCHI","EDAPALLY":"KOCHI",
  "CALICUT":"KOZHIKODE","KOZHICODE":"KOZHIKODE",
  "SECUNDRABAD":"HYDERABAD","SECUNDERABAD":"HYDERABAD","HYDERBAD":"HYDERABAD",
  "GURGAON":"GURUGRAM","GURGOAN":"GURUGRAM",
  "NAVIMUMBAI":"NAVI MUMBAI","NEW MUMBAI":"NAVI MUMBAI",
  "VISAKHAPATNAM":"VIZAG","VISHAKHAPATNAM":"VIZAG","VISHAKAPATNAM":"VIZAG",
  "AHEMDABAD":"AHMEDABAD","AHMADABAD":"AHMEDABAD","AHAMADABAD":"AHMEDABAD",
  "POONA":"PUNE","PUNA":"PUNE",
  "COIMBATOIRE":"COIMBATORE","COVAI":"COIMBATORE",
  "TRICHUR":"THRISSUR","TRICHOOR":"THRISSUR",
  "LAKHNOU":"LUCKNOW","LUCKNAO":"LUCKNOW",
  "SUART":"SURAT",
};
function normalizeCity(raw) {
  if (!raw) return "";
  let c = raw.toUpperCase().trim();
  c = c.replace(/\s+(CITY|DISTRICT|DIST|TALUK|TEHSIL|MANDAL|URBAN|RURAL|CANTT|CANTONMENT|CORPORATION|MUNICIPAL)$/, "");
  c = c.replace(/\s+/g, " ").trim();
  return CITY_ALIAS[c] || c;
}

/* ═══════════════════════════════════════════════════════════════
   ORDERS PROCESSOR — FIXED
   • Date anchor = MAX(purchase-date in dataset), matching Excel's MAX(AI:AI)
   • Status logic = exclude Cancelled + Returns only (matches Excel SUMPRODUCT)
   • Counts Pending + Shipped with qty > 0 (Excel counts these)
   • Tracks regional demand per ASIN via ship-state
   • Tracks city demand per ASIN via ship-city + ship-state
═══════════════════════════════════════════════════════════════ */
function processOrders(rows) {
  const warnings=[], salesByAsinDay={}, regionalSales={}, citySales={}, seenU=new Set(), seenM=new Set();
  let maxDate = null, minSalesDate = null;
  if (!rows||!rows.length) return {salesByAsinDay,warnings,maxDate,minSalesDate,regionalSales,citySales};
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
    const dateRaw = s(r,get,"purchase-date","purchase_date","Date","date");
    if (!asin||!dateRaw) return;
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

  return {salesByAsinDay,warnings,maxDate,minSalesDate,regionalSales,citySales};
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
    const total   = lead + ship + customs + safety + depart;
    if (!lt[asin]) lt[asin] = { cost: 0 };
    if (cost > 0) lt[asin].cost = cost;
    const modeData = { lead, ship, customs, safety, depart, total };
    if (mode.includes("air")) lt[asin].air = modeData;
    else if (mode.includes("sea")) lt[asin].sea = modeData;
  });
  return lt;
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
  const {totalLeadTime:tlt, safetyDays:saf, fbaCoverDays:fcd} = settings;
  const {demand} = vel;
  const cs = inv.currentStock;
  const inb = inv.inbound || 0;
  const doi = demand>0 ? cs/demand : Infinity;
  const anchor = inv._anchor || getToday();
  const stockoutDate = demand>0 ? new Date(anchor.getTime()+doi*86400000) : null;
 const required = demand*tlt;
const gap = Math.max(0, tlt-doi);
const airQty = gap*demand;
const netReq = required+airQty;
const suggestedBuy = Math.round(netReq);
  const targetFBA = demand*fcd;
  const replenishQty = Math.max(0, Math.ceil(targetFBA-inv.fbaAvailable));
  const urgency = doi<0?2:doi<tlt?1.5:1;
  const rawPriority = Math.min(9999,Math.max(0,(tlt-doi))*demand*urgency);
  let action="OK", priority="low";
  if(demand>0&&cs<=0){action="STOCKOUT";priority="critical";}
  else if(doi<tlt*0.25){action="REPLENISH FBA";priority="critical";}
  else if(doi<tlt){action="PURCHASE REQUIRED";priority="high";}
  else if(inb>required*0.6&&doi>tlt){action="HOLD";priority="low";}
  else if(doi>tlt*3&&tlt>0){action="OVERSTOCK";priority="low";}
  // Independent urgency % for each signal (0–100)
  const purchasePct = (demand>0 && doi<tlt && tlt>0)
    ? Math.min(100, Math.round((tlt-Math.max(0,doi))/tlt*100)) : 0;
  const replenishPct = (targetFBA>0 && replenishQty>0)
    ? Math.min(100, Math.round(replenishQty/targetFBA*100)) : 0;
  return {doi,stockoutDate,requiredStock:required,netRequirement:netReq,
    suggestedPurchase:suggestedBuy,replenishQty,targetFBA,reorderStock:required,
    action,priority,rawPriority,displayScore:0,purchasePct,replenishPct};
}

/* ═══════════════════════════════════════════════════════════════
   FC PLANNING
═══════════════════════════════════════════════════════════════ */
function calcFCPlanning(asin, fcData, vel, settings) {
  if (!fcData||!fcData[asin]) return null;
  const {fcStock,fcDemand,fcUnsellable,fcInTransit}=fcData[asin];
  const allFCs=[...new Set([...Object.keys(fcStock),...Object.keys(fcDemand)])].sort();
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
function computeAll(inv, salesByAsinDay, fcData, settings, anchorDate, regionalSales, citySales){
  const res={};
  // Stock inclusion flags
  const inclFBA = settings.inclFBA !== false;
  const inclFC  = settings.inclFC  !== false;
  Object.keys(inv).forEach(asin=>{
    const d = inv[asin];
    const vel = calcVelocity(asin, salesByAsinDay, anchorDate);
    // Centralized effective stock — only affects planning/DOI/forecast, not FC breakdown
    const fbaStock = (d.fbaAvailable||0) + (d.inbound||0) + (d.processing||0)*0.8;
    const fcStock  = d.fcSellable||0;
    let effectiveStock;
    if      ( inclFBA &&  inclFC) effectiveStock = d.currentStock;  // both → original
    else if ( inclFBA && !inclFC) effectiveStock = fbaStock;         // FBA only
    else if (!inclFBA &&  inclFC) effectiveStock = fcStock;          // FC only
    else                           effectiveStock = d.currentStock;  // neither → fallback
    // Inject anchor + effectiveStock into inv for planning
    // Also override fbaAvailable so replenishQty uses the correct stock pool
    const effectiveFBA = inclFBA
      ? (d.fbaAvailable||0)
      : (inclFC ? effectiveStock : (d.fbaAvailable||0));
    const invWithAnchor = { ...d, _anchor: anchorDate, currentStock: effectiveStock, fbaAvailable: effectiveFBA };
    const planning = calcPlanning(invWithAnchor, vel, settings);
    const forecast = buildForecast(effectiveStock, vel.demand, anchorDate);
    const fcPlanning = calcFCPlanning(asin, fcData, vel, settings);
    res[asin]={
      ...inv[asin], velocity:vel, planning, forecast, fcPlanning,
      hasFCData:!!fcData[asin],
      regionalSales: regionalSales?.[asin] || {},
      citySales: citySales?.[asin] || {},
    };
  });
  const maxRaw=Object.values(res).reduce((m,d)=>Math.max(m,d.planning.rawPriority),0);
  Object.values(res).forEach(d=>{
    d.planning.displayScore=maxRaw>0?Math.round((d.planning.rawPriority/maxRaw)*100):0;
  });
  return res;
}

/* ═══════════════════════════════════════════════════════════════
   THEMES
═══════════════════════════════════════════════════════════════ */
const DARK={
  bg:"#090c12",surface:"#0f1319",surface2:"#141b26",
  border:"#1b2333",border2:"#233049",
  text:"#e2e8f4",text2:"#8e9baf",text3:"#616c7c",
  accent:"#607ed4",accentBg:"rgba(96,126,212,.09)",accentBdr:"rgba(96,126,212,.22)",
  red:"#c96060",redBg:"rgba(201,96,96,.09)",redBdr:"rgba(201,96,96,.22)",
  yellow:"#c48b2a",yellowBg:"rgba(196,139,42,.09)",yellowBdr:"rgba(196,139,42,.22)",yellowText:"#0a0c10",
  green:"#338f68",greenBg:"rgba(51,143,104,.09)",greenBdr:"rgba(51,143,104,.22)",
  purple:"#7060c8",purpleBg:"rgba(112,96,200,.09)",
  orange:"#c86a2a",orangeBg:"rgba(200,106,42,.09)",
  rowHover:"rgba(255,255,255,.028)",
  sidebar:"#080b11",sbBorder:"rgba(255,255,255,.048)",sbMuted:"rgba(255,255,255,.18)",
  sbItem:"rgba(255,255,255,.4)",sbItemHover:"rgba(255,255,255,.82)",
  sbHover:"rgba(255,255,255,.042)",sbActive:"rgba(96,126,212,.13)",sbActiveText:"#8aabf0",
  tooltipBg:"#141b26",
};
const LIGHT={
  bg:"#eef1f7",surface:"#ffffff",surface2:"#f3f5f9",
  border:"#dde3ee",border2:"#c8d0e0",
  text:"#0f172a",text2:"#4a5568",text3:"#94a3b8",
  accent:"#2563eb",accentBg:"rgba(37,99,235,.07)",accentBdr:"rgba(37,99,235,.16)",
  red:"#c0392b",redBg:"rgba(192,57,43,.07)",redBdr:"rgba(192,57,43,.16)",
  yellow:"#b45309",yellowBg:"rgba(180,83,9,.07)",yellowBdr:"rgba(180,83,9,.16)",yellowText:"#fff",
  green:"#166534",greenBg:"rgba(22,101,52,.07)",greenBdr:"rgba(22,101,52,.14)",
  purple:"#5b21b6",purpleBg:"rgba(91,33,182,.07)",
  orange:"#9a3412",orangeBg:"rgba(154,52,18,.07)",
  rowHover:"rgba(0,0,0,.018)",
  sidebar:"#1a2540",sbBorder:"rgba(255,255,255,.055)",sbMuted:"rgba(255,255,255,.22)",
  sbItem:"rgba(255,255,255,.48)",sbItemHover:"rgba(255,255,255,.88)",
  sbHover:"rgba(255,255,255,.055)",sbActive:"rgba(255,255,255,.11)",sbActiveText:"#fff",
  tooltipBg:"#1a2540",
};

/* ═══════════════════════════════════════════════════════════════
   CSS GENERATOR
═══════════════════════════════════════════════════════════════ */
function makeCSS(t){return `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{height:100%;font-size:13px;overflow:hidden}
body{height:100%;overflow:hidden;background:${t.bg};color:${t.text};font-family:'Plus Jakarta Sans',sans-serif;line-height:1.45;-webkit-font-smoothing:antialiased}
#fba-root{display:flex;height:100vh;width:100%;overflow:hidden;position:fixed;top:0;left:0;right:0;bottom:0}
.sb{width:220px;flex:0 0 220px;background:${t.sidebar};border-right:1px solid ${t.sbBorder};display:flex;flex-direction:column;transition:width .2s ease,flex-basis .2s ease;overflow:hidden}
.sb.col{width:52px;flex-basis:52px}
.sb-logo{padding:14px 14px 12px;border-bottom:1px solid ${t.sbBorder};display:flex;align-items:center;gap:10px;min-height:50px;flex-shrink:0}
.sb-icon{width:30px;height:30px;background:${t.accent};border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sb-icon-svg{width:16px;height:16px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.sb-txt{overflow:hidden;min-width:0}
.sb-txt h1{font-size:13px;font-weight:700;color:#fff;white-space:nowrap;letter-spacing:-.2px}
.sb-txt p{font-size:10px;color:${t.sbMuted};font-family:'JetBrains Mono',monospace;margin-top:1px;white-space:nowrap}
.sb.col .sb-txt{display:none}
.sb-nav{flex:1;padding:10px 8px;overflow-y:auto;overflow-x:hidden}
.sb-sec{margin-bottom:18px}
.sb-lbl{font-size:9px;font-weight:600;color:${t.sbMuted};letter-spacing:1px;text-transform:uppercase;padding:0 8px;margin-bottom:4px;white-space:nowrap}
.sb.col .sb-lbl{opacity:0}
.ni{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;color:${t.sbItem};transition:background .12s,color .12s;margin-bottom:1px;white-space:nowrap;overflow:hidden;position:relative;min-height:34px;letter-spacing:-.1px}
.ni:hover{background:${t.sbHover};color:${t.sbItemHover}}
.ni.on{background:${t.sbActive};color:${t.sbActiveText};font-weight:600;box-shadow:inset 2px 0 0 0 ${t.accent}}
.ni.disabled{opacity:.25;cursor:not-allowed;pointer-events:none}
.ni-ic{width:18px;text-align:center;flex-shrink:0;display:flex;align-items:center;justify-content:center;opacity:.7}
.ni.on .ni-ic{opacity:1}
.ni-txt{flex:1;overflow:hidden;text-overflow:ellipsis}
.sb.col .ni-txt{display:none}
.nb{margin-left:auto;font-size:9px;font-weight:600;padding:1px 6px;border-radius:10px;font-family:'JetBrains Mono',monospace;flex-shrink:0;line-height:16px;background:rgba(201,96,96,.14);color:${t.red};border:1px solid rgba(201,96,96,.28)}
.nb.y{background:rgba(196,139,42,.14);color:${t.yellow};border:1px solid rgba(196,139,42,.28)}
.nb.b{background:rgba(96,126,212,.14);color:${t.accent};border:1px solid rgba(96,126,212,.28)}
.sb.col .nb{position:absolute;top:4px;right:4px;font-size:8px;padding:0 4px;line-height:14px}
.sb-foot{padding:10px 8px;border-top:1px solid ${t.sbBorder};display:flex;justify-content:center;cursor:pointer;color:${t.sbMuted};transition:color .12s;user-select:none;flex-shrink:0}
.sb-foot:hover{color:${t.sbItemHover}}
.sb-foot-icon{width:18px;height:18px;display:block}
.main{flex:1;min-width:0;overflow:hidden;display:flex;flex-direction:column;background:${t.bg}}
.topbar{height:50px;min-height:50px;background:${t.surface};border-bottom:1px solid ${t.border};display:flex;align-items:center;padding:0 18px;gap:12px;flex-shrink:0;min-width:0;overflow:hidden}
.tb-title{font-size:14px;font-weight:600;color:${t.text};white-space:nowrap;letter-spacing:-.2px;overflow:hidden;text-overflow:ellipsis;max-width:340px}
.tb-sub{font-size:10px;color:${t.text3};font-family:'JetBrains Mono',monospace;white-space:nowrap}
.tb-r{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0;overflow:hidden}
.tb-btn{padding:5px 11px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:500;background:${t.surface2};border:1px solid ${t.border};color:${t.text2};transition:all .12s;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap;letter-spacing:-.1px}
.tb-btn:hover{color:${t.text};border-color:${t.border2}}
.tb-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:600;font-family:'JetBrains Mono',monospace;white-space:nowrap}
.content{flex:1;overflow-y:auto;overflow-x:hidden;padding:16px 18px 24px}
.card{background:${t.surface};border:1px solid ${t.border};border-radius:10px;padding:16px;min-width:0;overflow:hidden;width:100%;box-sizing:border-box;box-shadow:0 1px 3px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.08)}
.ch{font-size:9px;font-weight:700;color:${t.text3};text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
.kg{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:12px;width:100%}
.kc{background:${t.surface};border:1px solid ${t.border};border-radius:9px;padding:12px 14px;position:relative;overflow:hidden;min-width:0;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.kc::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:${t.border2};border-radius:9px 9px 0 0}
.kc.r::after{background:${t.red}}.kc.y::after{background:${t.yellow}}
.kc.g::after{background:${t.green}}.kc.p::after{background:${t.purple}}.kc.b::after{background:${t.accent}}
.kl{font-size:9px;color:${t.text3};font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kv{font-size:22px;font-weight:700;color:${t.text};line-height:1;font-family:'JetBrains Mono',monospace;letter-spacing:-.5px;font-feature-settings:"tnum" 1}
.ks{font-size:9px;color:${t.text3};margin-top:4px;font-family:'JetBrains Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw{overflow-x:auto;width:100%;max-width:100%;-webkit-overflow-scrolling:touch}
.ts{overflow-y:auto;max-height:calc(100vh - 280px)}
table{width:100%;border-collapse:collapse;table-layout:auto}
th{padding:7px 10px;text-align:center;font-size:9px;font-weight:600;color:${t.text3};text-transform:uppercase;letter-spacing:.7px;border-bottom:1px solid ${t.border2};white-space:nowrap;background:${t.surface2};position:sticky;top:0;z-index:2}
td{padding:8px 10px;border-bottom:1px solid ${t.border};color:${t.text2};font-family:'JetBrains Mono',monospace;font-size:11px;white-space:nowrap;font-feature-settings:"tnum" 1;text-align:center}
tr:last-child td{border-bottom:none}
tr:hover td{background:${t.rowHover}}
tr.cr{cursor:pointer}
.tn{font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:500;color:${t.text};overflow:hidden;text-overflow:ellipsis;max-width:200px;text-align:left}
.ta{font-size:9px;color:${t.text3};font-family:'JetBrains Mono',monospace;margin-top:1px;text-align:left}
.score-bar-wrap{display:flex;align-items:center;gap:5px}
.score-bar{height:3px;border-radius:2px;flex:1;background:${t.border2};overflow:hidden;min-width:40px}
.score-bar-fill{height:100%;border-radius:2px}
.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:5px;font-size:9px;font-weight:600;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap}
.br{background:${t.redBg};color:${t.red};border:1px solid ${t.redBdr}}
.by{background:${t.yellowBg};color:${t.yellow};border:1px solid ${t.yellowBdr}}
.bg{background:${t.greenBg};color:${t.green};border:1px solid ${t.greenBdr}}
.bb{background:${t.accentBg};color:${t.accent};border:1px solid ${t.accentBdr}}
.bgr{background:${t.surface2};color:${t.text3};border:1px solid ${t.border}}
.bpr{background:${t.orangeBg};color:${t.orange};border:1px solid ${t.orange}55;font-weight:700}

/* ── STICKY SETTINGS BAR ── */
.sbar{background:${t.surface};border:1px solid ${t.border};border-radius:0 0 10px 10px;padding:13px 16px;margin-bottom:12px;min-width:0;overflow:hidden;width:100%;position:sticky;top:0;z-index:10;box-shadow:0 6px 20px rgba(0,0,0,.22),0 1px 4px rgba(0,0,0,.14)}
.sbar-top{border-radius:10px}

.sg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;min-width:0;width:100%}
.slg{min-width:0}.slg label{font-size:10px;color:${t.text2};font-weight:500;display:flex;justify-content:space-between;margin-bottom:6px;user-select:none;letter-spacing:-.1px}
.slg label span{color:${t.accent};font-family:'JetBrains Mono',monospace;font-weight:600}
input[type=range]{width:100%;max-width:100%;appearance:none;height:2px;background:${t.border2};border-radius:2px;outline:none;cursor:pointer;display:block}
input[type=range]::-webkit-slider-thumb{appearance:none;width:14px;height:14px;border-radius:50%;background:${t.accent};cursor:pointer;border:2px solid ${t.surface};box-shadow:0 0 0 1px ${t.accent};transition:transform .1s}
input[type=range]:active::-webkit-slider-thumb{transform:scale(1.15)}
.sbar-info{margin-top:9px;font-size:9px;color:${t.text3};font-family:'JetBrains Mono',monospace;line-height:1.6}
.sbar-info strong{color:${t.text2}}
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid transparent;font-family:'Plus Jakarta Sans',sans-serif;transition:all .12s;letter-spacing:-.1px}
.bp{background:${t.accent};color:#fff;border-color:${t.accent}}.bp:hover{opacity:.88}.bp:active{opacity:.75;transform:scale(.98)}
.bs{background:${t.surface2};color:${t.text2};border-color:${t.border}}.bs:hover{color:${t.text};border-color:${t.border2}}.bs:active{background:${t.border}}
.btn:disabled{opacity:.4;cursor:not-allowed}
.ti{padding:8px 10px;background:${t.surface2};border:1px solid ${t.border};border-radius:6px;color:${t.text};font-size:12px;font-family:'JetBrains Mono',monospace;outline:none;width:100%;transition:border-color .12s}
.ti:focus{border-color:${t.accent}}
.ti::placeholder{color:${t.text3}}
.fdrop{border:1px dashed ${t.border2};border-radius:8px;padding:14px;text-align:center;cursor:pointer;transition:all .12s;font-size:11px;color:${t.text3}}
.fdrop:hover,.fdrop.drag{border-color:${t.accent};color:${t.accent};background:${t.accentBg}}
.floaded{background:${t.greenBg};border:1px solid ${t.greenBdr};border-radius:6px;padding:8px 11px;font-size:11px;color:${t.green};display:flex;align-items:center;gap:7px;font-family:'JetBrains Mono',monospace}
.mtabs{display:flex;gap:2px;margin-bottom:12px;background:${t.surface2};padding:3px;border-radius:8px;border:1px solid ${t.border};width:fit-content}
.mtab{padding:6px 14px;border-radius:6px;font-size:11px;font-weight:500;cursor:pointer;color:${t.text3};transition:all .12s;white-space:nowrap}
.mtab.on{background:${t.surface};color:${t.text};box-shadow:0 1px 3px rgba(0,0,0,.15);font-weight:600}
.igrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
.ic{background:${t.surface};border:1px solid ${t.border};border-radius:9px;padding:12px}
.icl{font-size:11px;font-weight:600;color:${t.text};margin-bottom:2px;letter-spacing:-.1px}
.ics{font-size:9px;color:${t.text3};margin-bottom:9px;font-family:'JetBrains Mono',monospace}
.srow{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;min-width:0;width:100%}
.sbox{display:flex;align-items:center;gap:6px;background:${t.surface2};border:1px solid ${t.border};border-radius:6px;padding:0 9px;height:32px}
.sbox input{background:none;border:none;outline:none;color:${t.text};font-size:11px;font-family:'JetBrains Mono',monospace;width:160px}
.sbox input::placeholder{color:${t.text3}}
.sel{padding:6px 9px;background:${t.surface2};border:1px solid ${t.border};border-radius:6px;color:${t.text2};font-size:11px;cursor:pointer;outline:none;font-family:'JetBrains Mono',monospace;height:32px}
.sel:focus{border-color:${t.accent}}
.sr{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid ${t.border}}
.sr:last-child{border-bottom:none}
.sk{font-size:11px;color:${t.text3};font-weight:400}
.sv{font-size:11px;font-weight:600;color:${t.text};font-family:'JetBrains Mono',monospace}
.alert{display:flex;align-items:flex-start;gap:8px;padding:9px 12px;border-radius:7px;margin-bottom:8px;font-size:11px;line-height:1.5}
.ar{background:${t.redBg};border:1px solid ${t.redBdr};color:${t.red}}
.ay{background:${t.yellowBg};border:1px solid ${t.yellowBdr};color:${t.yellow}}
.ab{background:${t.accentBg};border:1px solid ${t.accentBdr};color:${t.accent}}
.ag{background:${t.greenBg};border:1px solid ${t.greenBdr};color:${t.green}}
.fc-card{background:${t.surface};border:1px solid ${t.border};border-radius:10px;overflow:hidden;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.fc-card-hdr{padding:10px 14px;background:${t.surface2};border-bottom:1px solid ${t.border};display:flex;align-items:center;gap:10px}
.fc-no-data{padding:14px;text-align:center;font-size:11px;color:${t.text3};font-family:'JetBrains Mono',monospace}
.fc-rec-list{padding:10px 14px;display:flex;flex-direction:column;gap:5px}
.fc-rec-item{display:flex;align-items:center;gap:8px;padding:7px 10px;background:${t.surface2};border-radius:6px;border:1px solid ${t.border};font-size:11px}
.ld{display:flex;align-items:center;justify-content:center;height:120px;flex-direction:column;gap:9px;color:${t.text3}}
.sp{width:20px;height:20px;border:2px solid ${t.border2};border-top-color:${t.accent};border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.empty{text-align:center;padding:50px 20px;color:${t.text3}}
.empty-ic{font-size:28px;margin-bottom:10px;opacity:.25}
.empty h3{font-size:14px;font-weight:600;color:${t.text2};margin-bottom:5px;letter-spacing:-.2px}
.empty p{font-size:11px;line-height:1.7;color:${t.text3}}
.d2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.d4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.bk{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:500;cursor:pointer;color:${t.text3};background:${t.surface};border:1px solid ${t.border};transition:all .12s;margin-bottom:12px;letter-spacing:-.1px}
.bk:hover{color:${t.text};border-color:${t.border2}}
.ac{padding:11px;background:${t.surface2};border-radius:7px;border:1px solid ${t.border}}
.acl{font-size:9px;color:${t.text3};margin-bottom:3px;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
.acv{font-size:20px;font-weight:700;font-family:'JetBrains Mono',monospace;letter-spacing:-.5px}
.acs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.wsec{background:${t.surface};border:1px solid ${t.border};border-radius:10px;padding:14px;margin-bottom:10px}
.wh{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:9px;padding-bottom:8px;border-bottom:1px solid ${t.border}}

/* ── INDIA HEATMAP ── */
.hm-grid{display:grid;gap:6px}
.hm-region{border-radius:8px;padding:10px 14px;position:relative;overflow:hidden;transition:transform .1s}
.hm-region:hover{transform:scale(1.01)}
.hm-name{font-size:10px;font-weight:700;margin-bottom:5px;letter-spacing:.3px;text-transform:uppercase}
.hm-vals{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.hm-units{font-size:20px;font-weight:700;font-family:'JetBrains Mono',monospace;line-height:1}
.hm-pct{font-size:9px;color:${t.text3};font-family:'JetBrains Mono',monospace;align-self:flex-end;margin-bottom:2px}
.hm-stock{font-size:9px;font-family:'JetBrains Mono',monospace;margin-left:auto;padding:2px 7px;border-radius:12px}
.hm-bar{position:absolute;bottom:0;left:0;height:3px;border-radius:0 2px 0 8px;transition:width .4s ease}

/* ── ADJ CARD ── */
.adj-card{background:${t.surface2};border:1px solid ${t.border};border-radius:9px;padding:12px 14px;margin-bottom:10px}
.adj-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.adj-sub{font-size:9px;color:${t.text3};font-family:'JetBrains Mono',monospace;margin-top:3px}

@media(max-width:900px){.d4{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){.sb{display:none}.content{padding:10px 12px 20px}.igrid{grid-template-columns:1fr}.sg{grid-template-columns:1fr}.kg{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.d2{grid-template-columns:1fr}.acs{grid-template-columns:1fr}.d4{grid-template-columns:1fr 1fr}.adj-grid{grid-template-columns:1fr}}
@media(max-width:480px){.kg{grid-template-columns:repeat(2,1fr)}}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${t.border2};border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:${t.text3}}
`;}

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
  return<span className={`badge ${containerC}`}><span style={textColor?{color:textColor}:{}}>{action||"OK"}</span></span>;
}
function DOI({doi,t}){
  if(!isFinite(doi)||doi>999)return<span style={{color:t.green}}>∞</span>;
  const col=doi<7?t.red:doi<21?t.yellow:t.green;
  return<span style={{color:col,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(doi,1)}d</span>;
}
function TrendBadge({avg7,avg30,t}){
  const trend=calcTrend(avg7,avg30);
  if(trend==="—") return<span style={{color:t.text3,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>—</span>;
  return<span style={{fontSize:10,color:trendColor(trend,t),fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap"}}>{trend}</span>;
}
function ScoreBar({score,t}){
  const col=score>=70?t.red:score>=40?t.yellow:t.green;
  return(
    <div className="score-bar-wrap">
      <div className="score-bar"><div className="score-bar-fill" style={{width:score+"%",background:col}}/></div>
      <span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:col,width:28,flexShrink:0}}>{score}</span>
    </div>
  );
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
      <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:"inherit",marginBottom:6,opacity:.6}}>Upload</div>
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
      <div style={{padding:"18px 0",textAlign:"center",fontSize:11,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>
        No regional data — ship-state column not found in orders CSV
      </div>
    );
  }

  /* Status palette — solid, no transparency */
  const STATUS = {
    STOCKOUT: { label:"STOCKOUT", icon:"", c:"#e05252", bg:"#2a1010", border:"#e0525244" },
    CRITICAL: { label:"CRITICAL", icon:"", c:"#e05252", bg:"#2a1010", border:"#e0525244" },
    LOW:      { label:"AT RISK",  icon:"", c:"#d4912b", bg:"#261e0d", border:"#d4912b44" },
    HEALTHY:  { label:"HEALTHY",  icon:"", c:"#27ae60", bg:"#0d2318", border:"#27ae6044" },
    SURPLUS:  { label:"SURPLUS",  icon:"⬆",  c:"#7c63d4", bg:"#180f30", border:"#7c63d444" },
    NONE:     { label:"NO DATA",  icon:"—",  c:"#555",    bg:"transparent", border:"transparent" },
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
        background: st.bg,
        border: `1px solid ${st.border}`,
        borderLeft: `3px solid ${st.c}`,
        borderRadius: 10,
        padding: "14px 16px",
        display:"flex",
        flexDirection:"column",
        gap:0,
      }}>

        {/* ── Header: region name + status badge ── */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <span style={{
            fontSize:11,fontWeight:800,letterSpacing:"1px",
            color:st.c,fontFamily:"'JetBrains Mono',monospace",
          }}>{region.toUpperCase()}</span>
          <span style={{
            fontSize:9,fontWeight:700,padding:"3px 9px",borderRadius:4,letterSpacing:".5px",
            background:st.c+"22", color:st.c, border:`1px solid ${st.c}55`,
          }}>{st.icon} {st.label}</span>
        </div>

        {/* ── Demand number ── */}
        <div style={{marginBottom:8}}>
          <span style={{
            fontSize:28,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",
            color:t.text,lineHeight:1,
          }}>{fmt(demand30)}</span>
          <span style={{fontSize:10,color:t.text3,marginLeft:8}}>demand · {p}% of total</span>
        </div>

        {/* ── Stock vs target line ── */}
        {hasStock && (
          <div style={{
            fontSize:11,fontFamily:"'JetBrains Mono',monospace",
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
              height:7,background:t.surface,borderRadius:4,
              overflow:"hidden",marginBottom:5,
            }}>
              <div style={{
                height:"100%",width:barFill+"%",
                background:st.c,borderRadius:4,
                transition:"width .4s ease",
              }}/>
            </div>
            <span style={{
              fontSize:9,color:st.c,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,
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
                fontSize:9,fontWeight:700,color:st.c,
                letterSpacing:".5px",textTransform:"uppercase",
              }}>⚠ Shortfall</span>
            )}
            <span style={{
              fontSize:12,fontWeight:700,
              fontFamily:"'JetBrains Mono',monospace",color:st.c,
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
            fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace",
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
            fontFamily:"'JetBrains Mono',monospace",color:t.text3}}>
            <div style={{width:8,height:8,borderRadius:2,background:l.c,flexShrink:0}}/>
            {l.label}
          </div>
        ))}
        <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>
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
      <div style={{marginTop:8,fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace",
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
function DataInput({onLoaded,loading,setLoading,t,parseDebug}){
  const[mode,setMode]=useState("csv");
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
      const debug={
        invCols:ir[0]?Object.keys(ir[0]):[],
        ordCols:or[0]?Object.keys(or[0]):[],
        ledCols:lr[0]?Object.keys(lr[0]):[],
        ltCols:ltr[0]?Object.keys(ltr[0]):[],
        invRows:ir.length,ordRows:or.length,ledRows:lr.length,ltRows:ltr.length,
      };
      onLoaded({invRows:ir,ordRows:or,ledRows:lr,ltRows:ltr,debug});
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
      const[ir,or,lr,ltr]=await Promise.all([ft("Inventory",true),ft("Sales",true),ft("Ledger",false),ft("Leadtime",false)]);
      const debug={
        invCols:ir[0]?Object.keys(ir[0]):[],
        ordCols:or[0]?Object.keys(or[0]):[],
        ledCols:lr[0]?Object.keys(lr[0]):[],
        ltCols:ltr[0]?Object.keys(ltr[0]):[],
        invRows:ir.length,ordRows:or.length,ledRows:lr.length,ltRows:ltr.length,
        source:"sheets",
      };
      onLoaded({invRows:ir,ordRows:or,ledRows:lr,ltRows:ltr,debug});
    }catch(e){setErr("Sheets error: "+e.message);}finally{setLoading(false);}
  };

  return(
    <div style={{maxWidth:900}}>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:3}}>Load Inventory Data</div>
        <div style={{fontSize:10,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>
          Upload CSVs or connect a public Google Sheets document with tabs: Inventory, Sales, Ledger
        </div>
      </div>
      <div className="alert ab" style={{marginBottom:12}}>
        <span>✓</span>
        <span><strong>sales logic:</strong> Counts all orders except Cancelled + Returns · Anchor = latest date in dataset · Pending orders included · </span>
      </div>
      <div className="mtabs">
        {[["csv","CSV Upload"],["sheets","Google Sheets"]].map(([id,l])=>(
          <div key={id} className={`mtab${mode===id?" on":""}`} onClick={()=>setMode(id)}>{l}</div>
        ))}
      </div>
      {mode==="csv"&&<>
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
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button className="btn bp" onClick={loadCSV} disabled={loading||!files.inventory||!files.orders}>
            {loading?"Processing…":"▶ Load & Calculate"}</button>
          {(!files.inventory||!files.orders)&&<span style={{fontSize:10,color:t.text3}}>Inventory + Orders required</span>}
        </div>
      </>}
      {mode==="sheets"&&<div className="card">
        <div className="ch">Google Sheets — Live Connection</div>
        <div style={{fontSize:10,color:t.text3,fontFamily:"'JetBrains Mono',monospace",marginBottom:11}}>
          Sheet must be public. Tabs: <strong>Inventory</strong> · <strong>Sales</strong> · <strong>Ledger</strong> (optional) · <strong>Leadtime</strong> (optional)
        </div>
        <div style={{display:"flex",gap:8,marginBottom:9}}>
          <input className="ti" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..."/>
          <button className="btn bp" onClick={loadSheets} disabled={loading}>{loading?"Fetching…":"Connect"}</button>
        </div>
        {extractSheetId(url)&&<div style={{fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>Sheet ID: {extractSheetId(url)}</div>}
      </div>}
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
                ?<span style={{fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>No data / not loaded</span>
                :cols.map(c=>{
                  const important=["ASIN","FBA Available","FC Sellable","Inbound","order-status","purchase-date","asin","quantity","Location","Disposition","Ending Warehouse Balance","ship-state","ship-city","Mode of shipment","Lead Time (Days)","Shipping Time (Days)","Customs (Days)","Safety Stock (Days)"].includes(c);
                  return<span key={c} style={{fontSize:9,padding:"2px 6px",borderRadius:4,fontFamily:"'JetBrains Mono',monospace",
                    background:important?t.greenBg:t.surface2,color:important?t.green:t.text3,
                    border:`1px solid ${important?t.greenBdr:t.border}`}}>{c}</span>;
                })
              }
            </div>
          </div>
        ))}
        <div style={{fontSize:9,color:t.text3,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>
          Green = key columns. <strong>ship-state</strong> + <strong>ship-city</strong> needed for regional heatmap &amp; city breakdown. <strong>Leadtime</strong> tab needed for Procurement Forecast.
        </div>
      </div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS BAR — sticky, recalculates on mouse release
═══════════════════════════════════════════════════════════════ */
function SBar({settings,setSettings,t,isTop}){
  const[local,setLocal]=useState(settings);
  useEffect(()=>setLocal(settings),[settings]);
  const onMove=(k,v)=>setLocal(p=>({...p,[k]:v}));
  const onRelease=(k,v)=>setSettings(p=>({...p,[k]:v}));
  const sliders=[
    ["totalLeadTime","Total Lead Time",0,100,"d","Time from PO to FC arrival"],
    ["safetyDays","Safety Stock",0,100,"d","Extra buffer days on top of lead time"],
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
      <div className="sbar-info">
        Reorder Point: <strong>{local.totalLeadTime+local.safetyDays}d stock</strong>
        &nbsp;·&nbsp; Target FBA: <strong>{local.fbaCoverDays}d cover</strong>
        &nbsp;·&nbsp; Demand: weighted avg (7d×0.5 + 14d×0.3 + 30d×0.2)
        &nbsp;·&nbsp;
        <label style={{cursor:"pointer",userSelect:"none"}}>
          <input type="checkbox"
            checked={local.inclFBA!==false}
            onChange={e=>{const v=e.target.checked;onMove("inclFBA",v);onRelease("inclFBA",v);}}
            style={{marginRight:4,accentColor:"currentColor"}}
          />Include FBA
        </label>
        &nbsp;&nbsp;
        <label style={{cursor:"pointer",userSelect:"none"}}>
          <input type="checkbox"
            checked={local.inclFC!==false}
            onChange={e=>{const v=e.target.checked;onMove("inclFC",v);onRelease("inclFC",v);}}
            style={{marginRight:4,accentColor:"currentColor"}}
          />Include FC
        </label>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════ */
function HealthDonut({skus, t}) {
  const counts = {
    critical: skus.filter(d=>d.planning.priority==="critical").length,
    high:     skus.filter(d=>d.planning.priority==="high"&&d.planning.action!=="OVERSTOCK").length,
    ok:       skus.filter(d=>d.planning.priority==="low"&&d.planning.action!=="OVERSTOCK"&&d.velocity.demand>0).length,
    overstock:skus.filter(d=>d.planning.action==="OVERSTOCK").length,
    nodemand: skus.filter(d=>d.velocity.demand===0).length,
  };
  const total = Object.values(counts).reduce((s,v)=>s+v,0);
  const segs = [
    {key:"critical", label:"Critical",      color:t.red,    count:counts.critical},
    {key:"high",     label:"High Priority", color:t.yellow, count:counts.high},
    {key:"ok",       label:"Healthy",       color:t.green,  count:counts.ok},
    {key:"overstock",label:"Overstock",     color:t.purple, count:counts.overstock},
    {key:"nodemand", label:"No Demand",     color:t.text3,  count:counts.nodemand},
  ].filter(s=>s.count>0);

  const R=52, r=32, cx=65, cy=65;
  let sa=-Math.PI/2;
  const paths=segs.map(seg=>{
    const frac=seg.count/total;
    const ang=frac*2*Math.PI;
    const ea=sa+ang;
    const lg=ang>Math.PI?1:0;
    const d=[
      `M ${(cx+R*Math.cos(sa)).toFixed(2)} ${(cy+R*Math.sin(sa)).toFixed(2)}`,
      `A ${R} ${R} 0 ${lg} 1 ${(cx+R*Math.cos(ea)).toFixed(2)} ${(cy+R*Math.sin(ea)).toFixed(2)}`,
      `L ${(cx+r*Math.cos(ea)).toFixed(2)} ${(cy+r*Math.sin(ea)).toFixed(2)}`,
      `A ${r} ${r} 0 ${lg} 0 ${(cx+r*Math.cos(sa)).toFixed(2)} ${(cy+r*Math.sin(sa)).toFixed(2)}`,
      "Z"
    ].join(" ");
    sa=ea;
    return {...seg, d, frac};
  });

  return(
    <div style={{display:"flex",alignItems:"center",gap:20}}>
      <svg width={130} height={130} viewBox="0 0 130 130" style={{flexShrink:0}}>
        {paths.map((seg,i)=>(
          <path key={i} d={seg.d} fill={seg.color} opacity={.82}/>
        ))}
        <circle cx={cx} cy={cy} r={r-3} fill={t.surface}/>
        <text x={cx} y={cy-7} textAnchor="middle" fill={t.text} fontSize={20} fontWeight={700} fontFamily="'JetBrains Mono',monospace">{total}</text>
        <text x={cx} y={cy+9} textAnchor="middle" fill={t.text3} fontSize={8} fontFamily="'Plus Jakarta Sans',sans-serif" fontWeight={500} letterSpacing="1">SKUs</text>
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {segs.map(seg=>(
          <div key={seg.key} style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:7,height:7,borderRadius:2,background:seg.color,flexShrink:0,opacity:.85}}/>
            <span style={{color:t.text2,fontSize:11,minWidth:95,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{seg.label}</span>
            <span style={{color:t.text,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{seg.count}</span>
            <span style={{color:t.text3,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{Math.round(seg.frac*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({data,settings,setSettings,onSku,t}){
  const skus=Object.values(data);
  const crit=skus.filter(d=>d.planning.priority==="critical").length;
  const high=skus.filter(d=>d.planning.priority==="high").length;
  const over=skus.filter(d=>d.planning.action==="OVERSTOCK").length;
  const totalStock=skus.reduce((s,d)=>s+d.currentStock,0);
  const totalDemand=skus.reduce((s,d)=>s+d.velocity.demand,0);
  const withFC=skus.filter(d=>d.hasFCData).length;

  const alerts=useMemo(()=>skus
    .filter(d=>d.planning.priority==="critical"||d.planning.priority==="high")
    .sort((a,b)=>b.planning.displayScore-a.planning.displayScore)
    .slice(0,10),[skus]);

  const topD=useMemo(()=>skus.filter(d=>d.velocity.demand>0)
    .sort((a,b)=>b.velocity.demand-a.velocity.demand).slice(0,8)
    .map(d=>({name:d.finalName.substring(0,14)+(d.finalName.length>14?"…":""),demand:+d.velocity.demand.toFixed(2),asin:d.asin})),[skus]);

  // Most at Risk: lowest DOI with demand > 0
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
        <HealthDonut skus={skus} t={t}/>
      </div>
      <div className="card">
        <div className="ch">Most at Risk — Lowest Days of Inventory</div>
        {atRisk.length>0?(
          <ResponsiveContainer width="100%" height={220}>
            <BarChart layout="vertical" data={atRisk} margin={{top:0,right:40,left:0,bottom:0}}
              onClick={e=>e?.activePayload&&onSku(e.activePayload[0]?.payload?.asin)}
              style={{cursor:"pointer"}}>
              <CartesianGrid strokeDasharray="2 4" stroke={t.border} horizontal={false}/>
              <XAxis type="number" tick={{fill:t.text3,fontSize:9}} unit="d" axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" width={130} tick={{fill:t.text2,fontSize:10,fontFamily:"'Plus Jakarta Sans',sans-serif"}} axisLine={false} tickLine={false}/>
              <Tooltip
                contentStyle={{background:t.tooltipBg,border:`1px solid ${t.border}`,borderRadius:7,fontSize:11,fontFamily:"'Plus Jakarta Sans',sans-serif"}}
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
          <XAxis dataKey="name" tick={{fill:t.text3,fontSize:9,fontFamily:"'Plus Jakarta Sans',sans-serif"}} angle={-35} textAnchor="end" axisLine={false} tickLine={false}/>
          <YAxis tick={{fill:t.text3,fontSize:9}} axisLine={false} tickLine={false}/>
          <Tooltip
            contentStyle={{background:t.tooltipBg,border:`1px solid ${t.border}`,borderRadius:7,fontSize:11,fontFamily:"'Plus Jakarta Sans',sans-serif"}}
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
          <th>SKU</th><th>ASIN</th><th>Score</th><th>DOI</th><th>Stock</th>
          <th>Demand/Day</th><th>7D Total</th><th>Stockout</th><th>Action</th>
        </tr></thead>
        <tbody>{alerts.map(d=>(
          <tr key={d.asin} className="cr" onClick={()=>onSku(d.asin)}>
            <td><div className="tn">{d.finalName}</div><div className="ta">{d.sellerSku}</div></td>
            <td className="ta">{d.asin}</td>
            <td><ScoreBar score={d.planning.displayScore} t={t}/></td>
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
  const[q,setQ]=useState(""),[sort,setSort]=useState("score"),[fil,setFil]=useState("all");
  const skus=useMemo(()=>Object.values(data)
    .filter(d=>fil==="critical"?d.planning.priority==="critical":fil==="high"?d.planning.priority==="high":fil==="over"?d.planning.action==="OVERSTOCK":fil==="ok"?d.planning.priority==="low":true)
    .filter(d=>!q||d.finalName.toLowerCase().includes(q.toLowerCase())||d.asin.includes(q)||d.sellerSku.toLowerCase().includes(q.toLowerCase()))
    .sort((a,b)=>
      sort==="score"?b.planning.displayScore-a.planning.displayScore:
      sort==="doi"?(isFinite(a.planning.doi)?a.planning.doi:99999)-(isFinite(b.planning.doi)?b.planning.doi:99999):
      sort==="demand"?b.velocity.demand-a.velocity.demand:b.currentStock-a.currentStock)
  ,[data,q,sort,fil]);

  return(<div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>
    <div className="card">
      <div className="srow">
        <div className="sbox"><span style={{color:t.text3}}>⌕</span><input placeholder="Name, ASIN, SKU…" value={q} onChange={e=>setQ(e.target.value)}/></div>
        <select className="sel" value={fil} onChange={e=>setFil(e.target.value)}>
          <option value="all">All SKUs</option><option value="critical">Critical</option>
          <option value="high">High Priority</option><option value="ok">OK</option><option value="over">Overstock</option>
        </select>
        <select className="sel" value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="score">Sort: Priority Score ↓</option>
          <option value="doi">Sort: DOI ↑</option>
          <option value="demand">Sort: Demand ↓</option>
          <option value="stock">Sort: Stock ↓</option>
        </select>
        <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>{skus.length}/{Object.keys(data).length}</span>
      </div>
      <div className="tw ts"><table style={{fontSize:11}}>
        <thead><tr>
          <th style={{textAlign:"left"}}>SKU Name</th>
          <th style={{textAlign:"left"}}>ASIN</th>
          <th>Score</th><th>Trend</th><th>W.Demand</th>
          <th>Stock</th><th>FBA</th><th>FC</th><th>Inbound</th>
          <th>DOI</th><th>Stockout</th><th>Buy Qty</th><th>Status</th>
        </tr></thead>
        <tbody>{skus.map(d=>(
          <tr key={d.asin} className="cr" onClick={()=>onSku(d.asin)}>
            <td style={{textAlign:"left"}}><div className="tn">{d.finalName}</div><div className="ta">{d.sellerSku}</div></td>
            <td style={{textAlign:"left"}} className="ta">{d.asin}</td>
            <td style={{minWidth:80}}><ScoreBar score={d.planning.displayScore} t={t}/></td>
            <td><span style={{fontSize:10,color:trendColor(calcTrend(d.velocity.avg7,d.velocity.avg30),t),fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap"}}>{calcTrend(d.velocity.avg7,d.velocity.avg30)}</span></td>
            <td style={{fontWeight:700,color:t.text}}>{fmt(d.velocity.demand,2)}</td>
            <td>{fmt(d.currentStock)}</td><td>{fmt(d.fbaAvailable)}</td><td>{fmt(d.fcSellable)}</td><td>{fmt(d.inbound)}</td>
            <td><DOI doi={d.planning.doi} t={t}/></td>
            <td style={{color:d.planning.doi<30?t.red:t.text3}}>{fmtDate(d.planning.stockoutDate)}</td>
            <td style={{color:t.accent,fontWeight:700}}>{d.planning.suggestedPurchase>0?fmt(d.planning.suggestedPurchase):"—"}</td>
            <td><PBadge action={d.planning.action} priority={d.planning.priority} purchasePct={d.planning.purchasePct||0} replenishPct={d.planning.replenishPct||0} t={t}/></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   PURCHASE PLAN
═══════════════════════════════════════════════════════════════ */
function PurchasePlan({data,settings,setSettings,onSku,t}){
  const[q,setQ]=useState(""),[fil,setFil]=useState("required");
  const allReq=useMemo(()=>Object.values(data).filter(d=>d.planning.netRequirement>0),[data]);
  const skus=useMemo(()=>Object.values(data)
    .filter(d=>fil==="required"?d.planning.netRequirement>0:fil==="critical"?d.planning.priority==="critical":true)
    .filter(d=>!q||d.finalName.toLowerCase().includes(q.toLowerCase())||d.asin.includes(q))
    .sort((a,b)=>b.planning.displayScore-a.planning.displayScore)
  ,[data,q,fil]);

  return(<div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>
    <div className="kg" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
      {[
        {l:"Need Purchase",v:allReq.length,s:"SKUs with net requirement",c:"r"},
        {l:"Total Units to Buy",v:fmt(allReq.reduce((s,d)=>s+d.planning.suggestedPurchase,0)),s:"Suggested purchase qty",c:""},
        {l:"Critical SKUs",v:Object.values(data).filter(d=>d.planning.priority==="critical").length,s:"DOI < lead time",c:"y"},
      ].map(k=>(
        <div key={k.l} className={`kc ${k.c}`}>
          <div className="kl">{k.l}</div>
          <div className="kv" style={{color:k.c==="r"?t.red:k.c==="y"?t.yellow:t.text}}>{k.v}</div>
          <div className="ks">{k.s}</div>
        </div>
      ))}
    </div>
    <div className="card">
      <div className="srow">
        <div className="sbox"><span style={{color:t.text3}}>⌕</span><input placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/></div>
        <select className="sel" value={fil} onChange={e=>setFil(e.target.value)}>
          <option value="required">Purchase Required</option>
          <option value="critical">Critical Only</option>
          <option value="all">All SKUs</option>
        </select>
        <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>{skus.length} SKUs</span>
      </div>
      <div className="tw ts"><table>
        <thead><tr>
          <th>SKU</th><th>ASIN</th><th>Score</th><th>DOI</th>
          <th>Demand/Day</th><th>Stock</th><th>Required</th><th>Net Req</th><th>Buy Qty</th><th>Status</th>
        </tr></thead>
        <tbody>{skus.map(d=>(
          <tr key={d.asin} className="cr" onClick={()=>onSku(d.asin)}>
            <td><div className="tn">{d.finalName}</div><div className="ta">{d.sellerSku}</div></td>
            <td className="ta">{d.asin}</td>
            <td style={{minWidth:80}}><ScoreBar score={d.planning.displayScore} t={t}/></td>
            <td><DOI doi={d.planning.doi} t={t}/></td>
            <td>{fmt(d.velocity.demand,2)}</td>
            <td>{fmt(d.currentStock)}</td>
            <td>{fmt(d.planning.requiredStock,0)}</td>
            <td style={{color:d.planning.netRequirement>0?t.red:t.green,fontWeight:700}}>{fmt(d.planning.netRequirement)}</td>
            <td style={{color:t.accent,fontWeight:700}}>{d.planning.suggestedPurchase>0?fmt(d.planning.suggestedPurchase):"—"}</td>
            <td><PBadge action={d.planning.action} priority={d.planning.priority} purchasePct={d.planning.purchasePct||0} replenishPct={d.planning.replenishPct||0} t={t}/></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   REPLENISH FBA
═══════════════════════════════════════════════════════════════ */
function ReplenishFBA({data,settings,setSettings,onSku,t}){
  const[q,setQ]=useState("");
  const skus=useMemo(()=>Object.values(data).filter(d=>d.planning.replenishQty>0)
    .filter(d=>!q||d.finalName.toLowerCase().includes(q.toLowerCase())||d.asin.includes(q))
    .sort((a,b)=>b.planning.displayScore-a.planning.displayScore),[data,q]);

  return(<div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>
    <div className="alert ab" style={{marginBottom:10}}>
      ℹ FBA replenishment tops up FBA to <strong>{settings.fbaCoverDays}d</strong> of demand.
    </div>
    <div className="kg" style={{gridTemplateColumns:"repeat(2,1fr)"}}>
      {[
        {l:"SKUs to Replenish",v:skus.length,s:"FBA top-up needed",c:"r"},
        {l:"Total Units FC→FBA",v:fmt(skus.reduce((s,d)=>s+d.planning.replenishQty,0)),s:"Suggested transfer qty",c:""},
      ].map(k=>(
        <div key={k.l} className={`kc ${k.c}`}>
          <div className="kl">{k.l}</div>
          <div className="kv" style={{color:k.c==="r"?t.red:t.text}}>{k.v}</div>
          <div className="ks">{k.s}</div>
        </div>
      ))}
    </div>
    <div className="card">
      <div className="srow">
        <div className="sbox"><span style={{color:t.text3}}>⌕</span><input placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/></div>
        <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>{skus.length} SKUs</span>
      </div>
      <div className="tw ts"><table>
        <thead><tr>
          <th>SKU</th><th>ASIN</th><th>Score</th><th>DOI</th>
          <th>FBA Avail</th><th>FC Sellable</th><th>Demand/Day</th><th>Replenish Qty</th><th>Status</th>
        </tr></thead>
        <tbody>{skus.map(d=>(
          <tr key={d.asin} className="cr" onClick={()=>onSku(d.asin)}>
            <td><div className="tn">{d.finalName}</div><div className="ta">{d.sellerSku}</div></td>
            <td className="ta">{d.asin}</td>
            <td style={{minWidth:80}}><ScoreBar score={d.planning.displayScore} t={t}/></td>
            <td><DOI doi={d.planning.doi} t={t}/></td>
            <td>{fmt(d.fbaAvailable)}</td><td>{fmt(d.fcSellable)}</td>
            <td>{fmt(d.velocity.demand,2)}</td>
            <td style={{color:t.accent,fontWeight:700}}>{fmt(d.planning.replenishQty)}</td>
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
  const[collapsed,setCollapsed]=useState(new Set());

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
    setCollapsed(prev=>{const next=new Set(prev);next.has(code)?next.delete(code):next.add(code);return next;});
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
      <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>
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
        const isOpen=!collapsed.has(wh.code);
        return(
          <div key={wh.code} className="fc-card" style={{borderLeft:`2px solid ${wc}`}}>

            {/* ── Warehouse header ── */}
            <div className="fc-card-hdr" style={{cursor:"pointer"}} onClick={()=>toggleCollapse(wh.code)}>
              {/* Status dot */}
              <div style={{
                width:7,height:7,borderRadius:"50%",background:wc,flexShrink:0,
                boxShadow:`0 0 6px ${wc}55`,
              }}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:"-.2px"}}>{wh.label}</div>
                <div style={{fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>
                  {wh.code}
                  &nbsp;·&nbsp;{wh.skus.length} SKU{wh.skus.length!==1?"s":""}
                  &nbsp;·&nbsp;<span style={{color:t.text2}}>{fmt(wh.totalStock)} sellable</span>
                  {wh.totalUnsellable>0&&<>&nbsp;·&nbsp;<span style={{color:t.yellow}}>{fmt(wh.totalUnsellable)} unsellable</span></>}
                  {wh.totalInTransit>0&&<>&nbsp;·&nbsp;<span style={{color:t.accent}}>{fmt(wh.totalInTransit)} in-transit</span></>}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                {wh.critCount>0&&(
                  <span style={{fontSize:9,padding:"2px 8px",borderRadius:5,fontWeight:700,
                    fontFamily:"'JetBrains Mono',monospace",
                    background:t.redBg,color:t.red,border:`1px solid ${t.redBdr}`}}>
                    {wh.critCount} critical
                  </span>
                )}
                {wh.lowCount>0&&wh.critCount===0&&(
                  <span style={{fontSize:9,padding:"2px 8px",borderRadius:5,fontWeight:700,
                    fontFamily:"'JetBrains Mono',monospace",
                    background:t.yellowBg,color:t.yellow,border:`1px solid ${t.yellowBdr}`}}>
                    {wh.lowCount} low
                  </span>
                )}
                <span className="badge" style={{background:`${wc}14`,color:wc,border:`1px solid ${wc}38`}}>
                  {FC_STATUS_LABEL[wh.worstStatus]}
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
                            <div style={{fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{sku.asin}</div>
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
                            <span className="badge" style={{background:`${sc}14`,color:sc,border:`1px solid ${sc}38`}}>
                              {FC_STATUS_LABEL[sku.status]}
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
   ORDER QTY CELL — shows surplus in purple, order qty in accent
═══════════════════════════════════════════════════════════════ */
function OrderQtyCell({qty, t}) {
  if (qty === null) return <span style={{color:t.text3}}>—</span>;
  const rounded = Math.round(qty);
  if (rounded <= 0) return (
    <span style={{
      display:"inline-block",fontSize:10,padding:"2px 7px",borderRadius:4,
      background:t.purpleBg,color:t.purple,fontFamily:"'JetBrains Mono',monospace",
      border:`1px solid ${t.purple}28`,
    }}>↑ {fmt(Math.abs(rounded))} surplus</span>
  );
  return <span style={{color:t.accent,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(rounded)}</span>;
}

/* ═══════════════════════════════════════════════════════════════
   PROCUREMENT FORECAST
   • Reads per-ASIN lead times from ltData (Leadtime sheet)
   • Total Inventory = FBA Available + Local WH (FC Sellable) + Upcoming Goods (editable)
   • SEA is priority mode; AIR shown for urgency gap-fill
   • Reorder day for SEA = last safe date to place order before stockout
═══════════════════════════════════════════════════════════════ */
function ProcurementForecast({data, ltData, anchorDate, t}) {
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
    return Object.values(data).map(d => {
      const lt       = ltData?.[d.asin] || null;
      const wfAds    = d.velocity.demand;
      const fba      = d.fbaAvailable || 0;
      const localWH  = d.fcSellable || 0;           // FC Sellable = local warehouse
      const upcomingQty = upcoming[d.asin] || 0;
      const totalInv = fba + localWH + upcomingQty;
      const doh      = wfAds > 0 ? totalInv / wfAds : Infinity;
      const stockoutDate = wfAds > 0 && isFinite(doh)
        ? new Date(anchor.getTime() + doh * 86400000) : null;

      const airTotal = lt?.air?.total ?? null;
      const seaTotal = lt?.sea?.total ?? null;
      const cost     = lt?.cost || 0;

      // Order Qty = WF ADS × transit days − total inventory (negative = surplus)
      const orderAir = airTotal !== null ? wfAds * airTotal - totalInv : null;
      const orderSea = seaTotal !== null ? wfAds * seaTotal - totalInv : null;

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
        doh, stockoutDate, airTotal, seaTotal, orderAir, orderSea,
        reorderSeaDate, statusLabel, statusTier, trend, cost,
      };
    });
  }, [data, ltData, upcoming, anchor]);

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
    padding:"8px 10px", textAlign:"left", fontSize:9, fontWeight:700,
    color:t.text3, textTransform:"uppercase", letterSpacing:".7px",
    background:t.surface2, borderBottom:`2px solid ${t.border}`,
    whiteSpace:"nowrap", position:"sticky", top:0, zIndex:1,
  };
  const TD = {
    padding:"8px 10px", color:t.text2,
    fontSize:11, whiteSpace:"nowrap",
    borderBottom:`1px solid ${t.border}`,
  };

  return (
    <div>
      {/* Page header */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:3}}>Procurement Forecast</div>
        <div style={{fontSize:10,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>
          WF ADS = (30d×0.2)+(14d×0.3)+(7d×0.5) · Sea = priority mode · Air = gap-fill · Upcoming Goods = click any cell to edit (POs / supplier transit)
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
        <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>{filtered.length} / {skus.length} SKUs</span>
      </div>

      {/* Main table */}
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{minWidth:1400,width:"100%",borderCollapse:"collapse",fontSize:12}}>
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

                {/* SEA group */}
                <th style={{...TH,background:t.greenBg,borderTop:`2px solid ${t.green}55`}}>SEA Days</th>
                <th style={{...TH,background:t.greenBg,borderTop:`2px solid ${t.green}55`}}>Order SEA</th>
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
                      <div style={{fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{d.asin}</div>
                    </td>
                    {/* WF ADS */}
                    <td style={TD}>
                      <span style={{fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:t.text}}>{fmt(d.wfAds,2)}</span>
                      <span style={{fontSize:9,color:t.text3,marginLeft:3}}>u/d</span>
                    </td>
                    {/* Trend */}
                    <td style={TD}>
                      <span style={{fontSize:10,color:trendColor(d.trend,t),fontFamily:"'JetBrains Mono',monospace"}}>{d.trend}</span>
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
                            fontFamily:"'JetBrains Mono',monospace",outline:"none",
                          }}
                        />
                      ) : (
                        <span style={{
                          display:"inline-flex",alignItems:"center",gap:5,
                          padding:"2px 8px",borderRadius:4,
                          background: d.upcomingQty > 0 ? t.accentBg : t.surface2,
                          border: `1px solid ${d.upcomingQty > 0 ? t.accentBdr : t.border}`,
                          color: d.upcomingQty > 0 ? t.accent : t.text3,
                          fontFamily:"'JetBrains Mono',monospace",fontSize:11,
                        }}>
                          {fmt(d.upcomingQty)}<span style={{fontSize:8,opacity:.5}}>✎</span>
                        </span>
                      )}
                    </td>
                    {/* Total Inv */}
                    <td style={{...TD,background:t.accentBg,fontWeight:700,color:t.text,fontFamily:"'JetBrains Mono',monospace"}}>
                      {fmt(d.totalInv)}
                    </td>

                    {/* Days in Hand */}
                    <td style={TD}>
                      <span style={{
                        fontWeight:700,fontFamily:"'JetBrains Mono',monospace",
                        color: !isFinite(d.doh) ? t.green
                             : d.doh < 30 ? t.red
                             : d.doh < 60 ? t.yellow : t.green,
                      }}>
                        {isFinite(d.doh) ? fmt(d.doh,1)+"d" : "∞"}
                      </span>
                    </td>
                    {/* Est. Stockout */}
                    <td style={TD}>
                      <span style={{fontSize:11,color:d.stockoutDate?t.text2:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>
                        {d.stockoutDate ? fmtDate(d.stockoutDate) : "—"}
                      </span>
                    </td>

                    {/* AIR group */}
                    <td style={{...TD,background:t.orangeBg}}>
                      {d.airTotal !== null
                        ? <span style={{color:t.orange,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{d.airTotal}d</span>
                        : <span style={{color:t.text3}}>—</span>}
                    </td>
                    <td style={{...TD,background:t.orangeBg}}>
                      <OrderQtyCell qty={d.orderAir} t={t}/>
                    </td>

                    {/* SEA group */}
                    <td style={{...TD,background:t.greenBg}}>
                      {d.seaTotal !== null
                        ? <span style={{color:t.green,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{d.seaTotal}d</span>
                        : <span style={{color:t.text3}}>—</span>}
                    </td>
                    <td style={{...TD,background:t.greenBg}}>
                      <OrderQtyCell qty={d.orderSea} t={t}/>
                    </td>
                    {/* Reorder by (SEA) — last safe date */}
                    <td style={{...TD,background:t.greenBg}}>
                      {d.reorderSeaDate ? (
                        <span style={{
                          fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:reorderPast?700:400,
                          color: reorderPast ? t.red : reorderSoon ? t.yellow : t.green,
                        }}>
                          {reorderPast && "⚠ "}{fmtDate(d.reorderSeaDate)}
                        </span>
                      ) : <span style={{color:t.text3}}>—</span>}
                    </td>

                    {/* Status badge */}
                    <td style={TD}>
                      <span style={{
                        display:"inline-block",padding:"4px 10px",borderRadius:5,fontSize:10,
                        fontWeight:600,background:sc.bg,color:sc.color,
                        border:`1px solid ${sc.bdr}`,whiteSpace:"nowrap",
                      }}>
                        {d.statusLabel}
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
          fontSize:10,fontFamily:"'JetBrains Mono',monospace",
        }}>
          <span style={{fontWeight:700,color:t.text3,textTransform:"uppercase",letterSpacing:".5px"}}>Totals ({filtered.length} SKUs)</span>
          <span style={{color:t.text2}}>FBA: <strong style={{color:t.text}}>{fmt(filtered.reduce((s,d)=>s+d.fba,0))}</strong></span>
          <span style={{color:t.text2}}>Local WH: <strong style={{color:t.text}}>{fmt(filtered.reduce((s,d)=>s+d.localWH,0))}</strong></span>
          <span style={{color:t.accent}}>Upcoming: <strong>{fmt(filtered.reduce((s,d)=>s+d.upcomingQty,0))}</strong></span>
          <span style={{color:t.text2}}>Total Inv: <strong style={{color:t.text,fontWeight:800}}>{fmt(filtered.reduce((s,d)=>s+d.totalInv,0))}</strong></span>
          <span style={{color:t.orange}}>Order AIR: <strong>{fmt(Math.round(filtered.reduce((s,d)=>s+Math.max(0,d.orderAir??0),0)))}</strong></span>
          <span style={{color:t.green}}>Order SEA: <strong>{fmt(Math.round(filtered.reduce((s,d)=>s+Math.max(0,d.orderSea??0),0)))}</strong></span>
        </div>
      )}

      {/* Legend */}
      <div style={{marginTop:8,display:"flex",gap:14,flexWrap:"wrap",fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>
        <span>🔴 DOH &lt; AIR lead time — order air now</span>
        <span>🟠 DOH &lt; SEA lead time — need SEA + gap air</span>
        <span>🟡 DOH &lt; SEA × 1.3 — place SEA soon</span>
        <span>🟢 Stock OK — schedule routine SEA</span>
        <span>· Upcoming ✎ = click to edit · Reorder by = last safe date to place SEA order · Surplus in purple</span>
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
      <span className="badge bgr">{warnings.length} total</span>
    </div>
    {unmapped.length>0&&<div className="wsec">
      <div className="wh" style={{color:t.red}}>Unmapped ASINs — Excluded ({unmapped.length})</div>
      <div className="alert ar" style={{marginBottom:8}}>Not found in SKU Map. Excluded from all calculations.</div>
      <div className="tw ts"><table>
        <thead><tr><th>Source</th><th>ASIN</th><th>Context</th><th>Row</th></tr></thead>
        <tbody>{unmapped.map((w,i)=>(
          <tr key={i}>
            <td><span className={`badge ${w.type.includes("inv")?"bb":"bgr"}`}>{w.type.includes("inv")?"Inventory":"Orders"}</span></td>
            <td style={{color:t.red,fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{w.asin}</td>
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
            <td style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{w.asin}</td>
            <td style={{color:t.red,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{w.csvSku}</td>
            <td style={{color:t.green,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{w.mapSku}</td>
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
      <div style={{padding:"14px 0",textAlign:"center",fontSize:11,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>
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
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N);

  // Group rest by state → "Other [State]" buckets
  const otherByState = {};
  rest.forEach(e => {
    const k = "Other " + e.stateLabel;
    if (!otherByState[k]) otherByState[k] = { city: k, stateLabel: e.stateLabel, qty: 0, isOther: true };
    otherByState[k].qty += e.qty;
  });
  const otherRows = Object.values(otherByState).sort((a,b) => b.qty - a.qty);
  const hasRest = otherRows.length > 0;

  // Always show top 15; show "Other" groups only when expanded
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
          fontFamily:"'JetBrains Mono',monospace",
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
          <div style={{fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>{row.stateLabel}</div>
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
          <span style={{fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:isOther?t.text3:t.text}}>{fmt(row.qty)}</span>
          <span style={{fontSize:9,color:t.text3,marginLeft:4}}>{pct.toFixed(1)}%</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div style={{fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace",marginBottom:10}}>
        Top {top.length} cities · {hasRest ? `${otherRows.length} state group${otherRows.length>1?"s":""} collapsed below · ` : ""}total {fmt(totalQty)} units
      </div>

      {/* Top 15 rows — always visible */}
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {top.map((row, i) => <CityRow key={row.city+i} row={row} rank={i} isOther={false}/>)}
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
              {expanded ? "Hide" : "Show"} remaining {otherRows.length} state group{otherRows.length>1?"s":""} &nbsp;·&nbsp; {fmt(rest.reduce((s,e)=>s+e.qty,0))} units ({(rest.reduce((s,e)=>s+e.qty,0)/totalQty*100).toFixed(1)}% of demand)
            </span>
          </div>

          {expanded && (
            <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:6,
              paddingLeft:8, borderLeft:`2px solid ${t.border}`}}>
              {otherRows.map((row, i) => <CityRow key={row.city+i} row={row} rank={top.length+i} isOther={true}/>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SKUDetail({sku, onBack, settings, setSettings, t}){
  if(!sku) return null;
  const {velocity:vel, planning:pl, forecast, fcPlanning, hasFCData, regionalSales, citySales} = sku;

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

  // Stockout index in forecast
  const soi = forecast.findIndex(p=>p.stock===0);
  // Reorder stock level = what you need to trigger reorder at
  const reorderStock = Math.round(vel.demand * (settings.totalLeadTime + settings.safetyDays));

  const FC_STATUS_COLOR = {stockout:t.red,critical:t.red,low:t.yellow,ok:t.green,surplus:t.purple};

  return(<div>
    <div className="bk" onClick={onBack}>← Back to All SKUs</div>
    <SBar settings={settings} setSettings={setSettings} t={t}/>

    {/* Header */}
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
      <div>
        <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:2}}>{sku.finalName}</div>
        <div style={{fontSize:10,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>{sku.sellerSku} · {sku.asin}</div>
      </div>
      <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
        <ScoreBar score={pl.displayScore} t={t}/>
        <PBadge action={pl.action} priority={pl.priority} purchasePct={pl.purchasePct||0} replenishPct={pl.replenishPct||0} t={t}/>
      </div>
    </div>

    {/* KPI row */}
    <div className="d4" style={{marginBottom:10}}>
      {[
        {l:"Days of Inventory",v:isFinite(pl.doi)?`${fmt(pl.doi,1)}d`:"∞",col:pl.doi<7?t.red:pl.doi<21?t.yellow:t.green},
        {l:"Priority Score",v:pl.displayScore+"/100",col:pl.displayScore>=70?t.red:pl.displayScore>=40?t.yellow:t.green},
        {l:"Stockout Date",v:fmtDate(pl.stockoutDate),col:t.text},
        {l:"Net Requirement",v:fmt(pl.netRequirement),col:pl.netRequirement>0?t.red:t.green},
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
          ["FC Sellable",fmt(sku.fcSellable)],["FC Unsellable",fmt(sku.fcUnsellable)],
          ["Inbound",fmt(sku.inbound)],["Processing (×0.8)",fmt(sku.processing*0.8)],
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
          ["Reorder Stock Level",fmt(reorderStock)+" units"],
          ["Urgency","auto × demand"]].map(([k,v])=>(
          <div key={k} className="sr"><span className="sk">{k}</span>
            <span className="sv" style={k==="Weighted Demand"?{color:t.accent}:k==="Reorder Stock Level"?{color:t.yellow}:{}}>{v}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Recommended Actions */}
    <div className="card" style={{marginBottom:10}}>
      <div className="ch">Recommended Actions</div>
      <div className="acs">
        {[{l:"Suggested Purchase Qty",v:fmt(pl.suggestedPurchase),col:pl.suggestedPurchase>0?t.red:t.green},
          {l:"FBA Replenishment Qty",v:fmt(pl.replenishQty),col:pl.replenishQty>0?t.yellow:t.green},
          {l:"Required Stock",v:fmt(pl.requiredStock,0),col:t.text}].map(k=>(
          <div key={k.l} className="ac">
            <div className="acl">{k.l}</div>
            <div className="acv" style={{color:k.col}}>{k.v}</div>
          </div>
        ))}
      </div>
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
                    fontFamily:"'JetBrains Mono',monospace",
                  }}
                />
              </td>
              <td><span className="badge" style={{background:`${FC_STATUS_COLOR[fc.status]}18`,color:FC_STATUS_COLOR[fc.status],border:`1px solid ${FC_STATUS_COLOR[fc.status]}40`}}>{fc.status.toUpperCase()}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {fcPlanning.recommendations.length>0&&<div style={{marginTop:10}}>
        <div style={{fontSize:9,fontWeight:700,color:t.text3,textTransform:"uppercase",letterSpacing:".7px",marginBottom:6}}>Send-Stock Recommendations</div>
        {fcPlanning.recommendations.map(r=>{
          const inboundOffset = fcInbound[`${sku.asin}::${r.fc}`]||0;
          const finalNeeded = Math.max(0, r.needed - inboundOffset);
          return(
          <div key={r.fc} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:t.surface2,borderRadius:7,border:`1px solid ${t.border}`,marginBottom:5,fontSize:11}}>
            <span className="badge" style={{background:`${FC_STATUS_COLOR[r.status]}18`,color:FC_STATUS_COLOR[r.status],border:`1px solid ${FC_STATUS_COLOR[r.status]}40`}}>{r.status.toUpperCase()}</span>
            <span style={{flex:1,color:t.text}}>{r.label}</span>
            <span style={{color:t.text3}}>DOI: {isFinite(r.doi)?fmt(r.doi,1)+"d":"∞"}</span>
            {inboundOffset>0&&<span style={{color:t.text3,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>−{fmt(inboundOffset)} inbound</span>}
            <span style={{color:finalNeeded>0?t.accent:t.green,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>
              {finalNeeded>0?`Send: ${fmt(finalNeeded)} units`:"✓ Covered"}
            </span>
          </div>
          );
        })}
      </div>}
    </div>}
    {!hasFCData&&<div className="alert ab" style={{marginBottom:10}}>ℹ No ledger data — FC-level analysis unavailable.</div>}

    {/* ── INDIA REGIONAL HEATMAP ── */}
    <div className="card" style={{marginBottom:10}}>
      <div className="ch">India Regional Demand & Stock Heatmap</div>
      <IndiaHeatmap regionalSales={regionalSales} fcPlanning={fcPlanning} settings={settings} velocity={vel} t={t}/>
    </div>

    {/* ── TOP CITIES ── */}
    <div className="card" style={{marginBottom:10}}>
      <div className="ch">Top Cities by Demand</div>
      <TopCities citySales={citySales} t={t}/>
    </div>

    {/* ── 70-DAY FORECAST with Reorder Line ── */}
    <div className="card">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div className="ch" style={{marginBottom:0}}>70-Day Inventory Forecast</div>
        <div style={{display:"flex",gap:14,alignItems:"center",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>
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
          <XAxis dataKey="date" tick={{fill:t.text3,fontSize:9}} interval={Math.ceil(forecast.length/10)}/>
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
      {soi>0&&<div style={{marginTop:6,fontSize:9,color:t.red,fontFamily:"'JetBrains Mono',monospace"}}>
        ⚠ Projected stockout in ~{soi} days ({fmtDate(new Date((sku._anchor||getToday()).getTime()+soi*86400000))})
      </div>}
      {reorderStock>0&&sku.currentStock<=reorderStock&&<div style={{marginTop:4,fontSize:9,color:t.yellow,fontFamily:"'JetBrains Mono',monospace"}}>
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
        <div style={{fontSize:10,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>
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
          <span style={{fontSize:10,color:t.accent,fontFamily:"'JetBrains Mono',monospace"}}>{selected.size} selected</span>
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
      <span style={{marginLeft:"auto",fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>{filtered.length} SKUs shown</span>
    </div>
    <div className="card" style={{padding:0,overflow:"hidden"}}>
      <div className="tw ts">
        <table>
          <thead><tr>
            <th style={{width:32}}><input type="checkbox" checked={selected.size===filtered.length&&filtered.length>0} onChange={e=>e.target.checked?selectAll():clearSelect()} style={{cursor:"pointer"}}/></th>
            <th>Status</th><th>SKU Name</th><th>ASIN</th><th>Seller SKU</th><th>Category</th><th>Note</th>
            {data&&<><th>DOI</th><th>Stock</th><th>Demand/Day</th><th>Action</th></>}
          </tr></thead>
          <tbody>{filtered.map(r=>(
            <tr key={r.asin} style={{opacity:r.active?1:.55}}>
              <td><input type="checkbox" checked={selected.has(r.asin)} onChange={()=>toggleSelect(r.asin)} style={{cursor:"pointer"}}/></td>
              <td>
                <button onClick={()=>toggle(r.asin)} style={{padding:"3px 10px",borderRadius:20,cursor:"pointer",fontSize:9,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",border:"none",background:r.active?t.greenBg:t.redBg,color:r.active?t.green:t.red,border:`1px solid ${r.active?t.greenBdr:t.redBdr}`,transition:"all .15s"}}>
                  {r.active?"● ACTIVE":"○ INACTIVE"}
                </button>
              </td>
              <td><div className="tn" style={{maxWidth:180}}>{r.finalName}</div></td>
              <td><span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:t.text3}}>{r.asin}</span></td>
              <td><span style={{fontSize:10,color:t.text2,fontFamily:"'JetBrains Mono',monospace"}}>{r.sellerSku}</span></td>
              <td>
                <select value={r.category} onChange={e=>setCategory(r.asin,e.target.value)} style={{padding:"3px 6px",background:t.surface2,border:`1px solid ${t.border}`,borderRadius:6,color:t.text2,fontSize:10,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",outline:"none"}}>
                  {CATEGORY_OPTIONS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td style={{minWidth:180}}>
                {editingNote===r.asin?(
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    <input autoFocus value={noteValue} onChange={e=>setNoteValue(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")setNote(r.asin,noteValue);if(e.key==="Escape")setEditingNote(null);}}
                      style={{flex:1,padding:"3px 7px",background:t.surface2,border:`1px solid ${t.accent}`,borderRadius:5,color:t.text,fontSize:11,fontFamily:"'JetBrains Mono',monospace",outline:"none"}}
                      placeholder="Add note…"/>
                    <span style={{cursor:"pointer",color:t.green,fontSize:14}} onClick={()=>setNote(r.asin,noteValue)}>✓</span>
                    <span style={{cursor:"pointer",color:t.text3,fontSize:14}} onClick={()=>setEditingNote(null)}>✕</span>
                  </div>
                ):(
                  <div onClick={()=>{setEditingNote(r.asin);setNoteValue(r.note);}} style={{cursor:"pointer",fontSize:10,color:r.note?t.text2:t.text3,fontFamily:"'JetBrains Mono',monospace",padding:"3px 0",borderBottom:`1px dashed ${t.border2}`,minWidth:120}} title="Click to edit">
                    {r.note||<span style={{opacity:.4}}>click to add note…</span>}
                  </div>
                )}
              </td>
              {data&&<>
                <td>{r.hasLiveData?<span style={{color:doiColor(r.doi),fontWeight:700}}>{isFinite(r.doi)&&r.doi<999?fmt(r.doi,1)+"d":"∞"}</span>:<span style={{color:t.text3,fontSize:9}}>inactive</span>}</td>
                <td>{r.hasLiveData?fmt(r.stock):"—"}</td>
                <td>{r.hasLiveData?fmt(r.demand,2):"—"}</td>
                <td>{r.hasLiveData?<PBadge action={r.action} priority={r.priority} purchasePct={r.purchasePct||0} replenishPct={r.replenishPct||0} t={t}/>:<span className="badge bgr">excluded</span>}</td>
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
      <span style={{fontSize:9,color:t.text3,fontFamily:"'JetBrains Mono',monospace"}}>Save config to file. To hard-code, paste into DEFAULT_SKU_CONFIG.</span>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════ */
export default function FBAPlanner(){
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
  const[settings,setSettings]=useState({totalLeadTime:60,safetyDays:7,fbaCoverDays:30,inclFBA:true,inclFC:true});
  const[skuCfg,setSkuCfgRaw]=useState(()=>loadSkuConfig());
  const setSkuCfg=cfg=>{setSkuCfgRaw(cfg);saveSkuConfig(cfg);};

  // Clear any stale adjustment multipliers from previous sessions
  useEffect(()=>{ try { localStorage.removeItem("fba_sales_adj"); } catch(_) {} },[]);

  const onLoaded=useCallback(({invRows,ordRows,ledRows,ltRows,debug})=>{
    const{inv,warnings:iw}=processInventory(invRows);
    const{salesByAsinDay,warnings:ow,maxDate,minSalesDate,regionalSales,citySales}=processOrders(ordRows);
    const{fcData,ledgerDate}=processLedger(ledRows||[]);
    const ltData=processLeadtime(ltRows||[]);
    setWarnings([...iw,...ow]);
    setParseDebug(debug||null);
    setRawData({inv,salesByAsinDay,fcData,ltData,maxDate,minSalesDate,ledgerDate,regionalSales,citySales});
  },[]);

  useEffect(()=>{
    if(!rawData) return;
    const activeInv={};
    Object.keys(rawData.inv).forEach(asin=>{
      if(isActive(skuCfg,asin)) activeInv[asin]=rawData.inv[asin];
    });
    setData(computeAll(activeInv,rawData.salesByAsinDay,rawData.fcData,settings,rawData.maxDate,rawData.regionalSales,rawData.citySales));
    if(tab==="input") setTab("dashboard");
  },[rawData,settings,skuCfg]);

  const crit=data?Object.values(data).filter(d=>d.planning.priority==="critical").length:0;
  const high=data?Object.values(data).filter(d=>d.planning.priority==="high").length:0;
  const wc=warnings.filter(w=>w.type.includes("unmapped")).length;
  const fcCrit=data?Object.values(data).filter(d=>
    d.fcPlanning?.fcs?.some(f=>f.status==="stockout"||f.status==="critical")
  ).length:0;
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

  // Title: SKU name when in detail, otherwise tab name
  const TITLES={input:"Data Input",dashboard:"Dashboard",allskus:"All SKUs",
    purchase:"Purchase Plan",replenish:"Replenish FBA",fc:"FC View",
    procurement:"Procurement Forecast",
    skumgr:"SKU Manager",warnings:"Data Quality"};
  const pageTitle = tab==="detail"&&selSku&&data?.[selSku]
    ? data[selSku].finalName
    : (TITLES[tab]||"Dashboard");

  const TABS=[
    {id:"input",ic:"IN",l:"Data Input"},
    {id:"dashboard",ic:"DB",l:"Dashboard"},
    {id:"allskus",ic:"SKU",l:"All SKUs"},
    {id:"purchase",ic:"PO",l:"Purchase Plan",badge:crit},
    {id:"replenish",ic:"FB",l:"Replenish FBA",badge:high,bc:"y"},
    {id:"fc",ic:"FC",l:"FC View",badge:fcCrit,bc:"b"},
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
          <div className="sb-txt"><h1>Helett Inventory Planner</h1><p>Inventory Engine</p></div>
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
                  <span className="ni-ic" style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,letterSpacing:".5px",color:"inherit"}}>{tb.ic}</span>
                  <span className="ni-txt">{tb.l}</span>
                  {tb.badge>0&&<span className={`nb${tb.bc?" "+tb.bc:""}`}>{tb.badge}</span>}
                </div>
              );
            })}
          </div>
          {data&&!col&&<div className="sb-sec">
            <div className="sb-lbl">Status</div>
            <div
  style={{
    padding:"5px 8px",
    fontSize:9,
    color:"rgba(255,255,255,.25)",
    fontFamily:"'JetBrains Mono',monospace",
    lineHeight:2.1
  }}
>
  <div>● {Object.keys(data).length} SKUs active</div>

  <div>
    ● {Object.values(data).filter(d=>d.hasFCData).length} with FC data
  </div>

  {rawData?.minSalesDate&&rawData?.maxDate&&(
    <div style={{color:"rgba(255,255,255,.18)"}}>
      Sales:{" "}
      {rawData.minSalesDate.toLocaleDateString("en-IN",{
        day:"2-digit",
        month:"short"
      })}{" "}
      –{" "}
      {rawData.maxDate.toLocaleDateString("en-IN",{
        day:"2-digit",
        month:"short",
        year:"numeric"
      })}
    </div>
  )}

  {rawData?.ledgerDate&&(
    <div style={{color:"rgba(255,255,255,.18)"}}>
      Ledger:{" "}
      {rawData.ledgerDate.toLocaleDateString("en-IN",{
        day:"2-digit",
        month:"short",
        year:"numeric"
      })}
    </div>
  )}

  <div
    style={{
      marginTop:12,
      paddingTop:8,
      borderTop:"1px solid rgba(255,255,255,.06)",
      color:"rgba(186, 170, 255, 0.28)",
      fontSize:8,
      letterSpacing:1.4,
      fontFamily:"'JetBrains Mono', monospace",
      
    }}
  >
    Designed by Amal Helett
  </div>
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
              {Object.keys(data).length} SKUs · TLT {settings.totalLeadTime}d · {anchorLabel}
            </div>}
          </div>
          <div className="tb-r">
            {rawData?.minSalesDate&&rawData?.maxDate&&(
              <span className="tb-badge" style={{
                fontSize:9,background:t.surface2,border:`1px solid ${t.border}`,
                color:t.text3,fontFamily:"'JetBrains Mono',monospace",padding:"3px 8px",borderRadius:5,
              }}>
                Sales {rawData.minSalesDate.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})} – {rawData.maxDate.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}
              </span>
            )}
            {rawData?.ledgerDate&&(
              <span className="tb-badge" style={{
                fontSize:9,background:t.surface2,border:`1px solid ${t.border}`,
                color:t.text3,fontFamily:"'JetBrains Mono',monospace",padding:"3px 8px",borderRadius:5,
              }}>
                Ledger {rawData.ledgerDate.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
              </span>
            )}
            
            <button className="tb-btn" onClick={()=>setDark(d=>!d)}>{dark?"Light":"Dark"}</button>
          </div>
        </div>
        <div className="content">
          {tab==="input"&&<>
            <DataInput onLoaded={onLoaded} loading={loading} setLoading={setLoading} t={t} parseDebug={parseDebug}/>
            {loading&&<div className="ld"><div className="sp"/><div style={{fontSize:11,color:t.text3}}>Processing data…</div></div>}
          </>}
          {tab==="dashboard"&&data&&<Dashboard data={data} settings={settings} setSettings={setSettings} onSku={goSku} t={t}/>}
          {tab==="allskus"&&data&&<AllSKUs data={data} settings={settings} setSettings={setSettings} onSku={goSku} t={t}/>}
          {tab==="purchase"&&data&&<PurchasePlan data={data} settings={settings} setSettings={setSettings} onSku={goSku} t={t}/>}
          {tab==="replenish"&&data&&<ReplenishFBA data={data} settings={settings} setSettings={setSettings} onSku={goSku} t={t}/>}
          {tab==="fc"&&data&&<FCView data={data} settings={settings} setSettings={setSettings} onSku={goSku} t={t}/>}
          {tab==="procurement"&&data&&<ProcurementForecast data={data} ltData={rawData?.ltData} anchorDate={rawData?.maxDate} t={t}/>}
          {tab==="skumgr"&&<SKUManager skuCfg={skuCfg} setSkuCfg={setSkuCfg} data={data} settings={settings} setSettings={setSettings} t={t}/>}
          {tab==="warnings"&&<WarningsPage warnings={warnings} t={t}/>}
          {tab==="detail"&&data&&selSku&&(
            <SKUDetail
              sku={data[selSku]}
              onBack={()=>setTab("allskus")}
              settings={settings}
              setSettings={setSettings}
              t={t}
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