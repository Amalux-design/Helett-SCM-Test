/* ═══════════════════════════════════════════════════════════════
   FC → STATE → SERVING CLUSTER
   Goal: ~300km coverage. Every FC is grouped into a "cluster" by the
   state it actually sits in (per the seller's own FC list — not a
   guess). States without their own FC are assigned to the nearest
   cluster. Delhi + Haryana FCs are merged into one "NCR" cluster since
   they cover the same north-central India catchment and any of them
   can fulfill an order there.

   FC list as provided (2026):
   AMD2-GJ  BLR4/5/7/8-KA  BOM5/7-MH  CCX1/2-WB  CJB1-TN
   DED1-DL  DED4/5-HR  DEL4/5/8-HR  DEX3/8-DL  HYD3/8-TG
   JPX1/2-RJ  LKO1-UP  MAA4-TN  PAX1-BR  PNQ2-DL  PNQ3-MH  SBLL-KA
═══════════════════════════════════════════════════════════════ */

// Every FC's home state (2-letter code)
export const FC_STATE = {
  AMD2:"GJ",
  BLR4:"KA", BLR5:"KA", BLR7:"KA", BLR8:"KA", SBLL:"KA",
  BOM5:"MH", BOM7:"MH", PNQ3:"MH",
  CCX1:"WB", CCX2:"WB",
  CJB1:"TN", MAA4:"TN",
  DED1:"DL", DEX3:"DL", DEX8:"DL", PNQ2:"DL",
  DED4:"HR", DED5:"HR", DEL4:"HR", DEL5:"HR", DEL8:"HR",
  HYD3:"TG", HYD8:"TG",
  JPX1:"RJ", JPX2:"RJ",
  LKO1:"UP",
  PAX1:"BR",
};

// Clusters — Delhi(DL) + Haryana(HR) merge into one NCR pool; every
// other state-with-an-FC is its own single-state cluster.
export const CLUSTERS = {
  NCR:{label:"Delhi NCR (Delhi + Haryana)", states:["DL","HR"], fcs:["DED1","DED4","DED5","DEL4","DEL5","DEL8","DEX3","DEX8","PNQ2"]},
  UP:{label:"Uttar Pradesh", states:["UP"], fcs:["LKO1"]},
  GJ:{label:"Gujarat", states:["GJ"], fcs:["AMD2"]},
  MH:{label:"Maharashtra", states:["MH"], fcs:["BOM5","BOM7","PNQ3"]},
  WB:{label:"West Bengal", states:["WB"], fcs:["CCX1","CCX2"]},
  TN:{label:"Tamil Nadu", states:["TN"], fcs:["CJB1","MAA4"]},
  TG:{label:"Telangana", states:["TG"], fcs:["HYD3","HYD8"]},
  RJ:{label:"Rajasthan", states:["RJ"], fcs:["JPX1","JPX2"]},
  BR:{label:"Bihar", states:["BR"], fcs:["PAX1"]},
  KA:{label:"Karnataka", states:["KA"], fcs:["BLR4","BLR5","BLR7","BLR8","SBLL"]},
};

// Every Indian state/UT → nearest cluster. States that host their own
// FC map to that cluster; the rest are assigned to the closest one.
// Best-effort geography — correct freely if you have better data.
export const STATE_TO_CLUSTER = {
  DL:"NCR", HR:"NCR", PB:"NCR", HP:"NCR", JK:"NCR", LA:"NCR", CH:"NCR", UK:"NCR",
  UP:"UP",
  GJ:"GJ", DN:"GJ",
  MH:"MH", GA:"MH", MP:"MH",
  WB:"WB", JH:"WB", OD:"WB", AS:"WB", SK:"WB",
  MN:"WB", ML:"WB", MZ:"WB", NL:"WB", TR:"WB", AR:"WB", // Northeast — no nearby FC, WB is least-bad fallback
  TN:"TN", KL:"TN", PY:"TN", AN:"TN", LD:"TN", // Kerala confirmed served by CJB1
  TG:"TG", AP:"TG", CT:"TG",
  RJ:"RJ",
  BR:"BR",
  KA:"KA",
};

// Normalize raw ship-state text (same variants as STATE_TO_REGION) → 2-letter code
export const STATE_NAME_TO_CODE = {
  "DELHI":"DL","NCT OF DELHI":"DL","NEW DELHI":"DL","DL":"DL",
  "HARYANA":"HR","HR":"HR",
  "HIMACHAL PRADESH":"HP","HP":"HP",
  "JAMMU AND KASHMIR":"JK","JAMMU & KASHMIR":"JK","JK":"JK",
  "LADAKH":"LA","LA":"LA",
  "PUNJAB":"PB","PB":"PB",
  "RAJASTHAN":"RJ","RJ":"RJ",
  "UTTARAKHAND":"UK","UTTARANCHAL":"UK","UK":"UK",
  "UTTAR PRADESH":"UP","UP":"UP",
  "CHANDIGARH":"CH","CH":"CH",
  "ANDHRA PRADESH":"AP","AP":"AP","A P":"AP",
  "KARNATAKA":"KA","KA":"KA",
  "KERALA":"KL","KL":"KL",
  "TAMIL NADU":"TN","TN":"TN",
  "TELANGANA":"TG","TELANGANA STATE":"TG","TG":"TG","TS":"TG",
  "PUDUCHERRY":"PY","PONDICHERRY":"PY","PY":"PY",
  "ANDAMAN AND NICOBAR ISLANDS":"AN","ANDAMAN & NICOBAR ISLANDS":"AN","ANDAMAN & NICOBAR":"AN","AN":"AN",
  "LAKSHADWEEP":"LD","LD":"LD",
  "BIHAR":"BR","BR":"BR",
  "JHARKHAND":"JH","JH":"JH",
  "ODISHA":"OD","ORISSA":"OD","OR":"OD","OD":"OD",
  "WEST BENGAL":"WB","WB":"WB",
  "ASSAM":"AS","AS":"AS",
  "MANIPUR":"MN","MN":"MN",
  "MEGHALAYA":"ML","ML":"ML",
  "MIZORAM":"MZ","MZ":"MZ",
  "NAGALAND":"NL","NL":"NL",
  "SIKKIM":"SK","SK":"SK",
  "TRIPURA":"TR","TR":"TR",
  "ARUNACHAL PRADESH":"AR","AR":"AR",
  "GOA":"GA","GA":"GA",
  "GUJARAT":"GJ","GJ":"GJ",
  "MAHARASHTRA":"MH","MH":"MH",
  "DADRA AND NAGAR HAVELI":"DN","DADRA & NAGAR HAVELI":"DN",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU":"DN","DN":"DN",
  "DAMAN AND DIU":"DN","DAMAN & DIU":"DN","DD":"DN",
  "CHHATTISGARH":"CT","CT":"CT","CG":"CT",
  "MADHYA PRADESH":"MP","MP":"MP",
};

// Readable full name for each 2-letter code (for display — codes are internal only)
export const STATE_CODE_TO_NAME = {
  DL:"Delhi", HR:"Haryana", PB:"Punjab", HP:"Himachal Pradesh", JK:"Jammu & Kashmir",
  LA:"Ladakh", CH:"Chandigarh", UK:"Uttarakhand", UP:"Uttar Pradesh",
  GJ:"Gujarat", DN:"Dadra & Nagar Haveli and Daman & Diu",
  MH:"Maharashtra", GA:"Goa", MP:"Madhya Pradesh",
  WB:"West Bengal", JH:"Jharkhand", OD:"Odisha", AS:"Assam", SK:"Sikkim",
  MN:"Manipur", ML:"Meghalaya", MZ:"Mizoram", NL:"Nagaland", TR:"Tripura", AR:"Arunachal Pradesh",
  TN:"Tamil Nadu", KL:"Kerala", PY:"Puducherry", AN:"Andaman & Nicobar", LD:"Lakshadweep",
  TG:"Telangana", AP:"Andhra Pradesh", CT:"Chhattisgarh",
  RJ:"Rajasthan",
  BR:"Bihar",
  KA:"Karnataka",
};

export function stateCodeToName(code) {
  return STATE_CODE_TO_NAME[code] || code;
}

export function stateNameToCode(raw) {
  if (!raw) return null;
  return STATE_NAME_TO_CODE[String(raw).toUpperCase().trim()] || null;
}

export function clusterForState(raw) {
  const code = stateNameToCode(raw);
  if (!code) return null;
  const clusterKey = STATE_TO_CLUSTER[code];
  return clusterKey || null;
}
