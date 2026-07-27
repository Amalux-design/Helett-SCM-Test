/* ═══════════════════════════════════════════════════════════════
   CSS GENERATOR
═══════════════════════════════════════════════════════════════ */
export function makeCSS(t){return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{height:100%;font-size:13px;overflow:hidden}
body{height:100%;overflow:hidden;background:${t.bg};color:${t.text};font-family:'Inter',system-ui,sans-serif;line-height:1.45;-webkit-font-smoothing:antialiased}
#fba-root{display:flex;height:100vh;width:100%;overflow:hidden;position:fixed;top:0;left:0;right:0;bottom:0;text-align:left}
.content,.topbar,.tb-title,.tb-sub,.ch,.card,.kc,h1,h2,h3,p,div{text-align:left}
.sb{width:240px;flex:0 0 240px;background:${t.sidebar};border-right:1px solid ${t.sbBorder};display:flex;flex-direction:column;transition:width .2s ease,flex-basis .2s ease;overflow:hidden}
.sb.col{width:52px;flex-basis:52px}
.sb-logo{padding:16px 16px 14px;border-bottom:1px solid ${t.sbBorder};display:flex;align-items:center;gap:9px;min-height:54px;flex-shrink:0}
.sb-icon{width:30px;height:30px;background:${t.accent};border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sb-icon-svg{width:16px;height:16px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.sb-txt{overflow:hidden;min-width:0}
.sb-txt h1{font-size:19px;font-weight:700;color:#fff;white-space:nowrap;letter-spacing:-.3px}
.sb-txt p{font-size:10px;color:${t.sbMuted};font-family:'Inter',system-ui,sans-serif;margin-top:1px;white-space:nowrap}
.sb.col .sb-txt{display:none}
.sb-nav{flex:1;padding:14px 10px;overflow-y:auto;overflow-x:hidden}
.sb-sec{margin-bottom:18px}
.sb-lbl{font-size:9px;font-weight:600;color:${t.sbMuted};letter-spacing:1px;text-transform:uppercase;padding:0 8px;margin-bottom:6px;white-space:nowrap}
.sb.col .sb-lbl{opacity:0}
.ni{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:500;color:${t.sbItem};transition:background .15s,color .15s;margin-bottom:3px;white-space:nowrap;overflow:hidden;position:relative;min-height:38px;letter-spacing:-.1px}
.ni:hover{background:${t.sbHover};color:${t.sbItemHover}}
.ni.on{background:${t.sbActive};color:${t.sbActiveText};font-weight:600;box-shadow:inset 2.5px 0 0 0 ${t.accent}}
.ni.disabled{opacity:.25;cursor:not-allowed;pointer-events:none}
.ni-ic{width:22px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;opacity:.65;flex-shrink:0}
.ni.on .ni-ic{opacity:1;color:${t.sbActiveText}}
.ni-txt{overflow:hidden;text-overflow:ellipsis}
.sb.col .ni-txt{display:none}
.nb{margin-left:8px;font-size:10px;font-weight:600;padding:1px 7px;border-radius:10px;font-family:'Inter',system-ui,sans-serif;flex-shrink:0;line-height:16px;background:rgba(255,255,255,.10);color:${t.sbItemHover};border:1px solid rgba(255,255,255,.08)}
.nb.y,.nb.b{background:rgba(255,255,255,.10);color:${t.sbItemHover};border:1px solid rgba(255,255,255,.08)}
.sb.col .nb{position:absolute;top:4px;right:4px;font-size:8px;padding:0 4px;line-height:14px;margin-left:0}
.sb-foot{padding:10px 8px;border-top:1px solid ${t.sbBorder};display:flex;justify-content:center;cursor:pointer;color:${t.sbMuted};transition:color .12s;user-select:none;flex-shrink:0}
.sb-foot:hover{color:${t.sbItemHover}}
.sb-foot-icon{width:18px;height:18px;display:block}
.main{flex:1;min-width:0;overflow:hidden;display:flex;flex-direction:column;background:${t.bg}}
.topbar{height:50px;min-height:50px;background:${t.surface};border-bottom:1px solid ${t.border};display:flex;align-items:center;padding:0 18px;gap:12px;flex-shrink:0;min-width:0;overflow:hidden}
.tb-title{font-size:14px;font-weight:600;color:${t.text};white-space:nowrap;letter-spacing:-.2px;overflow:hidden;text-overflow:ellipsis;max-width:340px}
.tb-sub{font-size:10px;color:${t.text3};font-family:'Inter',system-ui,sans-serif;white-space:nowrap}
.tb-r{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0;overflow:hidden}
.tb-btn{padding:5px 11px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;background:#ffffffbb;border:1px solid #ffffff;color:#111;transition:all .12s;font-family:'Inter',system-ui,sans-serif;white-space:nowrap;letter-spacing:-.1px}
.tb-btn-accent{padding:5px 11px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:500;background:rgb(0, 0, 0);border:1px solid ${t.accent};color:${t.text2};transition:all .12s;font-family:'Inter',system-ui,sans-serif;white-space:nowrap;letter-spacing:-.1px}
.tb-btn:hover{opacity:.88}
.tb-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:600;font-family:'Inter',system-ui,sans-serif;white-space:nowrap}
.content{flex:1;overflow-y:auto;overflow-x:hidden;padding:24px 32px 32px}
.card{background:${t.surface};border:1px solid ${t.border};border-radius:12px;padding:20px;min-width:0;overflow:hidden;width:100%;box-sizing:border-box;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.ch{font-size:13px;font-weight:600;color:${t.text2};margin-bottom:14px}
.kg{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:16px;width:100%}
.kc{background:${t.surface};border:1px solid ${t.border};border-radius:16px;padding:16px 18px 18px;position:relative;overflow:hidden;min-width:0;box-shadow:0 1px 3px rgba(0,0,0,.05);transition:transform .12s,box-shadow .12s}
.kc:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.07)}
.kc::after{display:none}
.kc.r::after{background:${t.red}}.kc.y::after{background:${t.yellow}}
.kc.g::after{background:${t.green}}.kc.p::after{background:${t.purple}}.kc.b::after{background:${t.accent}}
.kl{font-size:13px;color:${t.text2};font-weight:500;margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;justify-content:space-between}
.kl::after{content:'↗';font-size:12px;color:${t.text3};opacity:.5}
.kv{font-size:28px;font-weight:700;color:${t.text};line-height:1;font-family:'Inter',system-ui,sans-serif;letter-spacing:-.3px;font-feature-settings:"tnum" 1}
.ks{font-size:12px;color:${t.text3};margin-top:6px;font-family:'Inter',system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw{overflow-x:auto;width:100%;max-width:100%;-webkit-overflow-scrolling:touch}
.ts{overflow-y:auto;max-height:calc(100vh - 280px)}
table{width:100%;border-collapse:collapse;table-layout:auto}
th{padding:0 12px;height:40px;text-align:center;font-size:12px;font-weight:600;color:${t.text3};border-bottom:1px solid ${t.border};white-space:nowrap;background:${t.surface};position:sticky;top:0;z-index:2}
td{padding:0 12px;height:54px;border-bottom:1px solid ${t.border};color:${t.text2};font-family:'Inter',system-ui,sans-serif;font-size:13px;white-space:nowrap;font-feature-settings:"tnum" 1;text-align:center}
tr:last-child td{border-bottom:none}
tr:hover td{background:${t.rowHover};transition:background .12s}
tr.cr{cursor:pointer}
.tn{font-family:'Inter',system-ui,sans-serif;font-size:13px;font-weight:500;color:${t.text};overflow:hidden;text-overflow:ellipsis;max-width:200px;text-align:left}
.ta{font-size:9px;color:${t.text3};font-family:'Inter',system-ui,sans-serif;margin-top:1px;text-align:left}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:500;font-family:'Inter',system-ui,sans-serif;white-space:nowrap;border:none!important;background:transparent!important}
.dot{width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0}
.dot.r{background:${t.red}}.dot.y{background:${t.yellow}}.dot.g{background:${t.green}}.dot.b{background:${t.accent}}.dot.gr{background:${t.text3}}.dot.p{background:${t.orange}}
.br{background:${t.redBg};color:${t.red};border:1px solid ${t.redBdr}}
.by{background:${t.yellowBg};color:${t.yellow};border:1px solid ${t.yellowBdr}}
.bg{background:${t.greenBg};color:${t.green};border:1px solid ${t.greenBdr}}
.bb{background:${t.accentBg};color:${t.accent};border:1px solid ${t.accentBdr}}
.bgr{background:${t.surface2};color:${t.text3};border:1px solid ${t.border}}
.bpr{background:${t.orangeBg};color:${t.orange};border:1px solid ${t.orange}55;font-weight:700}

/* ── STICKY SETTINGS BAR ── */
.sbar{background:${t.surface};border:1px solid ${t.border};border-radius:16px;padding:18px 20px;margin-bottom:16px;min-width:0;overflow:hidden;width:100%;position:sticky;top:0;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.sbar-top{border-radius:16px}

.sg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;min-width:0;width:100%}
.slg{min-width:0;padding:0 24px;border-right:1px solid ${t.border}}
.slg:first-child{padding-left:0}
.slg:last-child{border-right:none;padding-right:0}
.slg label{font-size:12px;color:${t.text2};font-weight:500;display:flex;justify-content:space-between;margin-bottom:11px;user-select:none;letter-spacing:-.1px}
.slg label span{color:${t.text};font-family:'Inter',system-ui,sans-serif;font-weight:700;font-size:13px}
input[type=range]{width:100%;max-width:100%;appearance:none;height:2px;background:${t.border};border-radius:2px;outline:none;cursor:pointer;display:block}
input[type=range]::-webkit-slider-thumb{appearance:none;width:12px;height:12px;border-radius:50%;background:#fff;cursor:pointer;border:none;box-shadow:none;transition:transform .1s}
input[type=range]:active::-webkit-slider-thumb{transform:scale(1.15)}
input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#fff;cursor:pointer;border:none;box-shadow:none}
.sbar-info{margin-top:14px;padding-top:12px;border-top:1px solid ${t.border};font-size:10px;color:${t.text3};font-family:'Inter',system-ui,sans-serif;line-height:1.6}
.sbar-info strong{color:${t.text2}}
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid transparent;font-family:'Inter',system-ui,sans-serif;transition:all .12s;letter-spacing:-.1px}
.bp{background:${t.accent};color:#fff;border-color:${t.accent}}.bp:hover{opacity:.88}.bp:active{opacity:.75;transform:scale(.98)}
.bs{background:${t.surface2};color:${t.text2};border-color:${t.border}}.bs:hover{color:${t.text};border-color:${t.border2}}.bs:active{background:${t.border}}
.btn:disabled{opacity:.4;cursor:not-allowed}
.ti{padding:8px 10px;background:${t.surface2};border:1px solid ${t.border};border-radius:6px;color:${t.text};font-size:12px;font-family:'Inter',system-ui,sans-serif;outline:none;width:100%;transition:border-color .12s}
.ti:focus{border-color:${t.accent}}
.ti::placeholder{color:${t.text3}}
.fdrop{border:1px dashed ${t.border2};border-radius:8px;padding:14px;text-align:center;cursor:pointer;transition:all .12s;font-size:11px;color:${t.text3}}
.fdrop:hover,.fdrop.drag{border-color:${t.accent};color:${t.accent};background:${t.accentBg}}
.floaded{background:${t.greenBg};border:1px solid ${t.greenBdr};border-radius:6px;padding:8px 11px;font-size:11px;color:${t.green};display:flex;align-items:center;gap:7px;font-family:'Inter',system-ui,sans-serif}
.igrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
.ic{background:${t.surface};border:1px solid ${t.border};border-radius:9px;padding:12px}
.icl{font-size:11px;font-weight:600;color:${t.text};margin-bottom:2px;letter-spacing:-.1px}
.ics{font-size:9px;color:${t.text3};margin-bottom:9px;font-family:'Inter',system-ui,sans-serif}
.srow{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;min-width:0;width:100%}
.sbox{display:flex;align-items:center;gap:6px;background:${t.surface2};border:1px solid ${t.border};border-radius:6px;padding:0 9px;height:32px}
.sbox input{background:none;border:none;outline:none;color:${t.text};font-size:11px;font-family:'Inter',system-ui,sans-serif;width:160px}
.sbox input::placeholder{color:${t.text3}}
.sel{padding:6px 9px;background:${t.surface2};border:1px solid ${t.border};border-radius:6px;color:${t.text2};font-size:11px;cursor:pointer;outline:none;font-family:'Inter',system-ui,sans-serif;height:32px}
.sel:focus{border-color:${t.accent}}
.sr{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid ${t.border}}
.sr:last-child{border-bottom:none}
.sk{font-size:11px;color:${t.text3};font-weight:400}
.sv{font-size:11px;font-weight:600;color:${t.text};font-family:'Inter',system-ui,sans-serif}
.alert{display:flex;align-items:flex-start;gap:8px;padding:9px 12px;border-radius:7px;margin-bottom:8px;font-size:11px;line-height:1.5}
.ar{background:${t.redBg};border:1px solid ${t.redBdr};color:${t.red}}
.ay{background:${t.yellowBg};border:1px solid ${t.yellowBdr};color:${t.yellow}}
.ab{background:${t.accentBg};border:1px solid ${t.accentBdr};color:${t.accent}}
.ag{background:${t.greenBg};border:1px solid ${t.greenBdr};color:${t.green}}
.fc-card{background:${t.surface};border:1px solid ${t.border};border-radius:12px;overflow:hidden;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.fc-card-hdr{padding:14px 16px;background:${t.surface};border-bottom:1px solid ${t.border};display:flex;align-items:center;gap:12px}
.fc-no-data{padding:14px;text-align:center;font-size:11px;color:${t.text3};font-family:'Inter',system-ui,sans-serif}
.fc-rec-list{padding:10px 14px;display:flex;flex-direction:column;gap:5px}
.fc-rec-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:${t.surface};border-radius:8px;border:1px solid ${t.border};font-size:13px}
.ld{display:flex;align-items:center;justify-content:center;height:120px;flex-direction:column;gap:9px;color:${t.text3}}
.sp{width:20px;height:20px;border:2px solid ${t.border2};border-top-color:${t.accent};border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.empty{text-align:center;padding:50px 20px;color:${t.text3}}
.empty-ic{font-size:28px;margin-bottom:10px;opacity:.25}
.empty h3{font-size:14px;font-weight:600;color:${t.text2};margin-bottom:5px;letter-spacing:-.2px}
.empty p{font-size:11px;line-height:1.7;color:${t.text3}}
.d2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.d4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.bk{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;color:#111;background:#fff;border:1px solid #fff;transition:all .12s;margin-bottom:12px;letter-spacing:-.1px}
.bk:hover{opacity:.88}
.ac{padding:11px;background:${t.surface2};border-radius:7px;border:1px solid ${t.border}}
.acl{font-size:11px;color:${t.text3};margin-bottom:4px;font-weight:500}
.acv{font-size:20px;font-weight:700;font-family:'Inter',system-ui,sans-serif;letter-spacing:-.5px}
.acs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.wsec{background:${t.surface};border:1px solid ${t.border};border-radius:12px;padding:18px;margin-bottom:12px}
.wh{font-size:13px;font-weight:600;color:${t.text2};margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid ${t.border}}

/* ── INDIA HEATMAP ── */
.hm-grid{display:grid;gap:6px}
.hm-region{border-radius:8px;padding:10px 14px;position:relative;overflow:hidden;transition:transform .1s}
.hm-region:hover{transform:scale(1.01)}
.hm-name{font-size:10px;font-weight:700;margin-bottom:5px;letter-spacing:.3px;text-transform:uppercase}
.hm-vals{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.hm-units{font-size:20px;font-weight:700;font-family:'Inter',system-ui,sans-serif;line-height:1}
.hm-pct{font-size:9px;color:${t.text3};font-family:'Inter',system-ui,sans-serif;align-self:flex-end;margin-bottom:2px}
.hm-stock{font-size:9px;font-family:'Inter',system-ui,sans-serif;margin-left:auto;padding:2px 7px;border-radius:12px}
.hm-bar{position:absolute;bottom:0;left:0;height:3px;border-radius:0 2px 0 8px;transition:width .4s ease}

/* ── ADJ CARD ── */
.adj-card{background:${t.surface2};border:1px solid ${t.border};border-radius:9px;padding:12px 14px;margin-bottom:10px}
.adj-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.adj-sub{font-size:9px;color:${t.text3};font-family:'Inter',system-ui,sans-serif;margin-top:3px}

@media(max-width:900px){.d4{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){.sb{display:none}.content{padding:10px 12px 20px}.igrid{grid-template-columns:1fr}.sg{grid-template-columns:1fr}.kg{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.d2{grid-template-columns:1fr}.acs{grid-template-columns:1fr}.d4{grid-template-columns:1fr 1fr}.adj-grid{grid-template-columns:1fr}}
@media(max-width:480px){.kg{grid-template-columns:repeat(2,1fr)}}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${t.border2};border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:${t.text3}}
`;}
