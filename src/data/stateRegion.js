/* ═══════════════════════════════════════════════════════════════
   STATE → REGION MAPPING
   Handles full names + 2-letter ISO codes + Amazon's abbrevs
═══════════════════════════════════════════════════════════════ */
export const STATE_TO_REGION = {
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
