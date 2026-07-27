/* ═══════════════════════════════════════════════════════════════
   FC CITY MAPPING
═══════════════════════════════════════════════════════════════ */
export const FC_CITY = {
  AMD2:"Ahmedabad", BLR4:"Bangalore", BLR5:"Bangalore", BLR7:"Bangalore", BLR8:"Bangalore",
  BOM5:"Mumbai", BOM7:"Mumbai", CCX1:"West Bengal", CCX2:"West Bengal", CJB1:"Coimbatore",
  DED4:"Haryana", DEL4:"Haryana", DEL5:"Haryana", DEX3:"Delhi", HYD3:"Hyderabad", HYD8:"Hyderabad",
  LKO1:"Lucknow", MAA4:"Chennai", PAX1:"Patna, Bihar", PNQ2:"Pune", PNQ3:"Pune", SBLL:"Hubballi, Karnataka"
};
export function fcLabel(code) {
  return FC_CITY[code] ? `${code} (${FC_CITY[code]})` : code;
}

/* ═══════════════════════════════════════════════════════════════
   FC → REGION MAPPING (for stock heatmap)
═══════════════════════════════════════════════════════════════ */
export const FC_REGION = {
  AMD2:"West",  BLR4:"South", BLR5:"South", BLR7:"South",  BLR8:"South",
  BOM5:"West",  BOM7:"West",  CCX1:"East",  CCX2:"East",   CJB1:"South",
  DED4:"North", DEL4:"North", DEL5:"North", DEX3:"North",  HYD3:"South", HYD8:"South",
  LKO1:"North", MAA4:"South", PAX1:"East",  PNQ2:"West",   PNQ3:"West",  SBLL:"South"
};
