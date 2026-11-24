import { useEffect, useMemo, useRef, useState } from "react";
import {
  PP_MAXH, buildCum, splitUnits, planShipments, recommendTotal, autoShipmentCount,
  unitsForEndDay, unitsForAirEndDay, dayLabel, type PlanInput,
} from "./planLogic";

/* Purchase Plan — horizontal candle chart.
   Row 1 is the current (enabled) stock stretched over the days it lasts. Orders already placed
   start on their sheet ETA (no ETA: where the stock above enters safety); every new purchase
   order arrives where the layer above enters its safety stretch (hatched).
   Click a new bar to type its units, drag its end handle to resize it, drag the bar itself to
   move its arrival earlier or later (what-if only, never written to the sheet).
   Inputs come from SKU Detail; all maths lives in planLogic.ts. */

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
const AXIS_CAP = 720; // widest the time axis can grow (days)

export default function PurchasePlanChart({ stock0, placedPos, d0, r, LT, airLT, hasAir, S, anchor, t }: any) {
  const dark = t.mode === "dark";
  const P = dark
    ? { stock: "#a78bfa", stockTx: "#1e1b4b", po: "#8b5cf6", poTx: "#ffffff", tail: "#c4b5fd", air: "#ddd6fe", airTx: "#2e1065", wick: "#a78bfa" }
    : { stock: "#8b5cf6", stockTx: "#ffffff", po: "#6d28d9", poTx: "#ffffff", tail: "#8b5cf6", air: "#c4b5fd", airTx: "#2e1065", wick: "#5b21b6" };

  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [nOv, setNOv] = useState<number | null>(null);
  const [totOv, setTotOv] = useState<number | null>(null);
  const [man, setMan] = useState<number[]>([]);
  const [airOv, setAirOv] = useState<number | null>(null);
  const [follow, setFollow] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; head: string; lines: string[] } | null>(null);
  const [edit, setEdit] = useState<{ kind: "po" | "air"; k: number; x: number; y: number; val: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<any>(null);
  const planRef = useRef<any>(null);
  const inpRef = useRef<any>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [boost, setBoost] = useState(0); // axis width while dragging past the right edge
  const [dragInfo, setDragInfo] = useState<{ day: number; text: string } | null>(null);
  const [moves, setMoves] = useState<Record<string, number>>({}); // layer id → arrival day (what-if)
  const ctxRef = useRef<any>({});
  const maxDayRef = useRef(200);

  const rEff = follow ? r : 1;
  const ppKey = JSON.stringify(placedPos || []); // parent builds a fresh array each render
  const inp: PlanInput = useMemo(() => ({ stock0, d0, r: rEff, LT, airLT, hasAir, S, placedPos: JSON.parse(ppKey) }), [stock0, d0, rEff, LT, airLT, hasAir, S, ppKey]);
  const cum = useMemo(() => buildCum(d0, rEff), [d0, rEff]);
  const sys = useMemo(() => recommendTotal(inp, cum), [inp, cum]);

  const total = mode === "manual" ? man.reduce((a, b) => a + b, 0) : (totOv ?? sys);
  const nAuto = useMemo(() => autoShipmentCount(cum, total), [cum, total]);
  const n = mode === "manual" ? man.length : (nOv ?? nAuto);
  const units = mode === "manual" ? man : splitUnits(total, Math.max(1, n));
  const unitsKey = units.join(",");
  const plan = useMemo(() => planShipments(inp, units, cum, airOv, moves), [inp, cum, unitsKey, airOv, moves]);

  planRef.current = plan; inpRef.current = inp; // latest values for the drag timer
  ctxRef.current = { cum, airOv, moves };
  const lastEnd = Math.max(plan.stockRow.tZero, ...plan.placed.map(p => p.tZero), ...plan.bars.map(b => b.tZero));
  const maxDay = Math.min(AXIS_CAP, Math.max(200, boost, Math.ceil(Math.min(lastEnd, PP_MAXH) + 10)));
  maxDayRef.current = maxDay;
  const W = 1000, padL = 78, padR = 64, plotW = W - padL - padR;
  const x = (d: number) => padL + Math.max(0, Math.min(d, maxDay)) / maxDay * plotW;
  const axisH = 30, rowH = 40;
  const placed = plan.placed;
  const nMoved = Object.keys(moves).length;
  const rows = 1 + placed.length + (plan.air ? 1 : 0) + plan.bars.length;
  // drop moves whose layer no longer exists (PO list, Include PO or shipment count changed)
  const layerKey = [...placed.map(p => p.id), ...plan.bars.map(b => b.id)].join("|");
  useEffect(() => {
    const ids = new Set(layerKey.split("|"));
    setMoves(m => (Object.keys(m).every(k => ids.has(k)) ? m : Object.fromEntries(Object.entries(m).filter(([k]) => ids.has(k)))));
  }, [layerKey]);
  const newFloor = hasAir && airLT > 0 && airLT < LT ? airLT : LT; // earliest a new order can arrive
  const H = axisH + rows * rowH + 10;
  const tickStep = maxDay > 400 ? 60 : 30;
  const ticks: number[] = []; for (let d = 0; d <= maxDay; d += tickStep) ticks.push(d);
  const trendPct = Math.round((r - 1) * 100);
  const dirty = mode === "manual" || totOv !== null || nOv !== null || airOv !== null || nMoved > 0 || follow;
  const sr = plan.stockRow;
  const flatDays = d0 > 0 ? Math.floor(stock0 / d0) : 0;

  function resetAll() { setMode("auto"); setTotOv(null); setNOv(null); setAirOv(null); setMoves({}); setFollow(false); setEdit(null); setTip(null); }
  function toManual() { setMan(units.slice()); setMode("manual"); }
  function toAuto() { setTotOv(total); setNOv(null); setMode("auto"); }
  function onTotal(raw: string) {
    const v = Math.max(0, Math.round(parseFloat(raw) || 0));
    if (mode === "manual") {
      const cur = man.reduce((a, b) => a + b, 0);
      if (cur > 0) {
        const sc = v / cur;
        const m = man.map(u => Math.round(u * sc));
        m[m.length - 1] = Math.max(0, m[m.length - 1] + (v - m.reduce((a, b) => a + b, 0)));
        setMan(m);
      } else setMan(splitUnits(v, Math.max(1, man.length)));
    } else setTotOv(v);
  }
  function onN(raw: string) {
    const v = Math.max(1, Math.min(8, Math.round(parseFloat(raw) || 1)));
    if (mode === "manual") setMan(splitUnits(total, v)); else setNOv(v);
  }
  function onAir(raw: string) {
    if (raw === "") { setAirOv(null); return; }
    setAirOv(Math.max(0, Math.round(parseFloat(raw) || 0)));
  }

  // ── drag a PO's end handle ──
  // k >= 0 → purchase order k, k = -2 → air bridge. Like trimming a clip: drag the white edge.
  function onDown(e: any, k: number, startDay: number, startOf: number, label: string) {
    e.preventDefault();
    setTip(null); setEdit(null);
    drag.current = { k, maxDay, units: units.slice(), startOf, label, vx: 0, edge: false, timer: null };
    // dragging into the right edge keeps widening the axis, like auto-scroll in a video editor
    drag.current.timer = window.setInterval(() => {
      const dg = drag.current; if (!dg || !dg.edge || dg.maxDay >= AXIS_CAP) return;
      dg.maxDay = Math.min(AXIS_CAP, dg.maxDay + 12);
      setBoost(dg.maxDay);
      applyDrag(dg.vx);
    }, 80);
    setDragInfo({ day: startDay, text: k === -2 ? `Covered to ${dayLabel(anchor, startDay)}` : `${dayLabel(anchor, startDay)} · covers ${Math.max(0, startDay - startOf)}d` });
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch (_) {}
  }
  // Drag the bar itself: move its arrival earlier or later, like sliding a clip on a timeline.
  // Touch only moves from the small grip so the page can still scroll.
  function onMoveDown(e: any, id: string, arrival: number, floor: number, label: string, editInfo: { k: number; units: number } | null, grip = false) {
    if (e.pointerType === "touch" && !grip) return;
    if (e.button > 0) return;
    e.preventDefault();
    setTip(null); setEdit(null);
    const rect = svgRef.current!.getBoundingClientRect();
    const vx = (e.clientX - rect.left) / rect.width * W;
    const grab = (vx - padL) / plotW * maxDayRef.current - arrival; // where inside the bar it was grabbed, in days
    drag.current = { mode: "move", id, floor, label, grab, moved: false, edit: editInfo, ev: rel(e), vx, startArr: arrival, edge: false, timer: null };
    setDragInfo({ day: arrival, text: `${label} arrives ${dayLabel(anchor, arrival)}` });
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch (_) {}
  }
  function applyDrag(vx: number) {
    const dg = drag.current; if (!dg) return;
    if (dg.mode === "move") {
      if (!dg.moved && Math.abs(vx - dg.vx) < 4) return;
      dg.moved = true;
      const md = maxDayRef.current;
      const d = Math.round(Math.max(dg.floor, Math.min(md, (vx - padL) / plotW * md - dg.grab)));
      setMoves(m => (m[dg.id] === d ? m : { ...m, [dg.id]: d }));
      setDragInfo({ day: d, text: `${dg.label} arrives ${dayLabel(anchor, d)}${d !== dg.startArr ? ` (${Math.abs(d - dg.startArr)}d ${d < dg.startArr ? "earlier" : "later"})` : ""}` });
      return;
    }
    const day = Math.max(0, Math.min(dg.maxDay, (vx - padL) / plotW * dg.maxDay));
    const dayR = Math.round(day);
    const { cum: cm, airOv: ao, moves: mv } = ctxRef.current;
    if (dg.k === -2) {
      setDragInfo({ day: dayR, text: `Covered to ${dayLabel(anchor, dayR)}` });
      setAirOv(unitsForAirEndDay(inpRef.current, dg.units, day, cm, mv)); return;
    }
    setDragInfo({ day: dayR, text: `${dayLabel(anchor, dayR)} · covers ${Math.max(0, dayR - dg.startOf)}d` });
    const next = dg.units.slice();
    next[dg.k] = unitsForEndDay(inpRef.current, dg.units, dg.k, day, cm, ao, mv);
    dg.units = next;
    setMan(next); setMode("manual");
  }
  function onMove(e: any) {
    const dg = drag.current; if (!dg || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const vx = (e.clientX - rect.left) / rect.width * W;
    if (dg.mode !== "move") { dg.vx = vx; dg.edge = (vx - padL) / plotW > 0.93; }
    applyDrag(vx);
  }
  function onUp() {
    const dg = drag.current;
    if (dg?.timer) window.clearInterval(dg.timer);
    drag.current = null; setDragInfo(null); setBoost(0);
    // a press on a new order that never moved is a click: open the units editor
    if (dg?.mode === "move" && !dg.moved && dg.edit) setEdit({ kind: "po", k: dg.edit.k, ...dg.ev, val: String(Math.round(dg.edit.units)) });
  }

  // ── themed tooltip + click-to-edit ──
  const rel = (e: any) => {
    const b = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const tipOn = (head: string, lines: string[]) => ({
    onMouseMove: (e: any) => { if (!drag.current && !edit) setTip({ ...rel(e), head, lines }); },
    onMouseLeave: () => setTip(null),
  });
  function openEdit(e: any, kind: "po" | "air", k: number, cur: number) {
    if (drag.current) return;
    setTip(null);
    setEdit({ kind, k, ...rel(e), val: String(Math.round(cur)) });
  }
  function applyEdit() {
    if (!edit) return;
    const v = Math.max(0, Math.round(parseFloat(edit.val) || 0));
    if (edit.kind === "air") setAirOv(v);
    else { const next = units.slice(); next[edit.k] = v; setMan(next); setMode("manual"); }
    setEdit(null);
  }

  const seg = (on: boolean) => ({ height: 32, padding: "0 14px", border: `1px solid ${on ? P.po : t.border2}`, background: on ? P.po : "transparent", color: on ? "#fff" : t.text2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" } as any);
  // purple outline = a value you set; plain = automatic
  const fld = (set: boolean, w = 88) => ({ width: w, background: t.bg, border: `1px solid ${set ? P.po : t.border2}`, borderRadius: 8, color: t.text, padding: "0 10px", fontSize: 14, fontWeight: 700, textAlign: "right", outline: "none", fontFamily: "inherit", height: 32 } as any);
  const fld0 = fld(false);
  const lbl = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: t.text } as any;
  const rowLabel = { fontSize: 13, fontWeight: 600, fill: t.text, fontFamily: "inherit" } as any;
  const clickable = { cursor: "pointer" } as any;

  const stockDays = Math.max(0, sr.tZero);
  const gap = Math.max(0, sr.gapEnd - sr.gapStart);
  const wrapW = wrapRef.current?.clientWidth ?? 800;
  const wrapH = wrapRef.current?.clientHeight ?? 300;

  // Quick-decision facts, read straight off the plan
  const nextPo = plan.bars.find(b => b.units > 0) ?? plan.bars[0];
  // Everything already on hand or ordered, before any air or new order: where the chain would end
  const placedEnd = Math.max(sr.tZero, ...placed.map(p => p.tZero));
  const airAdds = (() => { // days of sales the air units feed
    if (!plan.air) return 0;
    const a = plan.air.arrive, c = plan.cum, base = c[Math.min(a, PP_MAXH)];
    let dd = 0; while (a + dd < PP_MAXH && c[a + dd + 1] - base <= plan.air.u) dd++;
    return dd;
  })();
  const afterAirEnd = plan.air ? Math.max(placedEnd, plan.air.tEnd) : placedEnd;      // end date once air is counted
  const prevEnd = (k: number) => (k === 0 ? afterAirEnd : plan.bars[k - 1].tZero);   // end date before new PO k
  const coveredTo = Math.max(sr.tZero, ...placed.map(p => p.tZero), ...plan.bars.filter(b => b.units > 0).map(b => b.tZero), plan.air?.tEnd ?? 0);
  const placedLabel = (p: any) => (p.etaDay != null ? `ETA ${dayLabel(anchor, p.etaDay)}` : "Placed");
  const overdueOf = (p: any) => (inp.placedPos || []).some((q: any) => q.overdue && q.etaDay === p.etaDay);
  const airTooSlow = hasAir && !plan.air && airOv === null && gap > 0;
  const facts: { k: string; v: string; bad?: boolean }[] = [
    { k: "Stock lasts", v: `${stockDays}d · ${dayLabel(anchor, sr.tZero)}` },
    ...placed.map(p => ({ k: p.etaDay != null ? `PO ETA ${dayLabel(anchor, p.etaDay)}` : "Placed PO", v: `${fmt(p.units)} u · arrives ${dayLabel(anchor, p.arrival)}${p.moved ? " (moved)" : ""} · lasts to ${dayLabel(anchor, p.tZero)}` })),
    ...(plan.air ? [{ k: plan.air.reason === "manual" ? "Air" : "Air recommended", v: `${fmt(plan.air.u)} u · arrives ${dayLabel(anchor, plan.air.arrive)} · ${plan.air.reason === "gap" ? "bridges the gap before the first delivery" : plan.air.reason === "late" ? "bridges the wait for sea" : `feeds ${airAdds}d of sales`}` }] : []),
    ...(airTooSlow ? [{ k: "Air too slow", v: `takes ${airLT}d, the first delivery arrives in ${sr.gapEnd}d`, bad: true }] : []),
    ...(nextPo && nextPo.units > 0 ? [{ k: "Next order", v: nextPo.late > 0 ? `today (${nextPo.late}d late) · arrives ${dayLabel(anchor, nextPo.arrival)}` : `by ${dayLabel(anchor, nextPo.order)} · arrives ${dayLabel(anchor, nextPo.arrival)}`, bad: nextPo.late > 0 }]
      : nextPo ? [{ k: "Next order", v: `by ${dayLabel(anchor, nextPo.order)} (arrives ${dayLabel(anchor, nextPo.arrival)})` }] : []),
    { k: "Covered to", v: `${dayLabel(anchor, coveredTo)} (${coveredTo}d)` },
    ...(gap > 0 ? [{ k: "No stock", v: `${gap}d before the first delivery`, bad: true }] : []),
    ...(placed.some(overdueOf) ? [{ k: "ETA passed", v: "counted as arriving today", bad: true }] : []),
    ...(nMoved > 0 ? [{ k: "What-if", v: `${nMoved} moved · not saved to the sheet` }] : []),
  ];

  // Tips shown under the ⓘ button, grouped
  const infoSections: { h: string; items: string[] }[] = [
    { h: "This plan", items: [
      `Stock ${fmt(stock0)} u lasts ${stockDays} days${follow && trendPct !== 0 ? `, with the ${trendPct >= 0 ? "+" : ""}${trendPct}% trend (${flatDays}d at flat demand, the Days of Inventory basis)` : ""}.`,
      `Demand ${d0.toFixed(1)}/day · Sea ${LT}d${hasAir ? ` · Air ${airLT}d` : ""} · Safety ${S}d.`,
      ...(placed.length ? [`${fmt(placed.reduce((a, p) => a + p.units, 0))} u already ordered. A PO with an ETA in the sheet starts on that date, one without starts where the stock above enters its safety stretch.`] : []),
      ...(gap > 0 ? [`${gap} days with no stock before the first delivery arrives.${plan.air ? " The air bridge is sized to cover it." : ""}`] : []),
    ] },
    { h: "Reading the bars", items: [
      `Solid part is cover you can sell. The hatched end is the last ${S} days, kept as safety.`,
      "The bold number after a bar: for Stock, days until it runs out; for a PO, days you are covered from its arrival (safety included); for Air, +N is the days it adds.",
      "Each order arrives just as the bar above it enters its safety stretch. The thin line before a bar is shipping time, with the order date above it.",
      "The Air bar is stock flown in to cover the gap until a sea order arrives.",
    ] },
    { h: "Editing", items: [
      "Click a new order to type its units.",
      "Drag a bar's white edge to extend or shorten it. Hold at the right edge to widen the timeline (up to 720 days).",
      "Drag the bar itself to move its arrival earlier or later (on touch, use the small grip on its left). Orders below it re-line up behind it.",
      "An order moved earlier than the sea lead time is split: the early part is air freight (light purple).",
      "Moves are a what-if only. Nothing is saved to the sheet. Reset puts everything back.",
      "Fields outlined in purple are values you set. The rest are automatic.",
    ] },
  ];

  // "62d" tag at the end of a bar: the bar's total cover in days, safety included
  const endTag = (xe: number, cy: number, days: number, extra: number, prefix = "") => (
    <text x={xe + extra} y={cy + 4} fontSize="12" fontWeight="700" fill={t.text} fontFamily="inherit" pointerEvents="none">{prefix}{Math.max(0, Math.round(days))}d</text>
  );

  // White "trim" edge, like a clip handle in a video editor (hit area is wider than the pill)
  const trim = (cx: number, cy: number, down: (e: any) => void, hint: string) => (
    <g className="pp-trim" style={{ cursor: "ew-resize", touchAction: "none" }} onPointerDown={down} {...tipOn("Resize", [hint])}>
      <rect x={cx - 9} y={cy - 12} width="18" height="24" fill="transparent" />
      <rect x={cx - 3.5} y={cy - 9} width="7" height="18" rx="3.5" fill="#ffffff" stroke={P.po} strokeWidth="1.5" />
      <line x1={cx} x2={cx} y1={cy - 4} y2={cy + 4} stroke={P.po} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );

  // Small grip on a bar's left end: the only place a touch drag moves it (so the page still scrolls)
  const grip = (cx: number, cy: number, down: (e: any) => void) => (
    <g style={{ cursor: "grab", touchAction: "none" }} onPointerDown={down}>
      <rect x={cx} y={cy - 10} width="14" height="20" fill="transparent" />
      <line x1={cx + 5} x2={cx + 5} y1={cy - 4} y2={cy + 4} stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity=".8" pointerEvents="none" />
      <line x1={cx + 8.5} x2={cx + 8.5} y1={cy - 4} y2={cy + 4} stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity=".8" pointerEvents="none" />
    </g>
  );

  // One rounded bar per layer: the safety stretch is the hatched end of the SAME bar (clipped inside it)
  const candle = (id: string, x0: number, xs: number, x1: number, cy: number, fill: string, o: any = {}) => {
    const airW = o.airTo != null ? Math.max(0, Math.min(o.airTo, x1) - x0) : 0; // early part flown in by air
    xs = Math.max(xs, x0 + airW); // the safety stretch only starts once the sea part begins
    const w = Math.max(2, x1 - x0), hatchW = Math.max(0, x1 - xs), cid = `pp-c-${id}`;
    return (
      <g className={o.onClick || o.onDown ? "pp-bar" : undefined} style={o.onDown ? { cursor: "grab" } : o.onClick ? clickable : undefined} onClick={o.onClick} onPointerDown={o.onDown} {...(o.tp || {})}>
        <clipPath id={cid}><rect x={x0} y={cy - 10} width={w} height="20" rx="5" /></clipPath>
        <g clipPath={`url(#${cid})`}>
          <rect x={x0} y={cy - 10} width={w} height="20" fill={fill} />
          {airW > 0.5 && <rect x={x0} y={cy - 10} width={airW} height="20" fill={P.air} />}
          {airW > 0.5 && airW < w - 0.5 && <line x1={x0 + airW} x2={x0 + airW} y1={cy - 10} y2={cy + 10} stroke={P.po} strokeWidth="1.5" strokeDasharray="3 2" />}
          {hatchW > 0.5 && <rect x={xs} y={cy - 10} width={hatchW} height="20" fill="url(#pp-hatch)" />}
          {hatchW > 0.5 && xs - x0 > 0.5 && <line x1={xs} x2={xs} y1={cy - 10} y2={cy + 10} stroke={P.tail} strokeWidth="1" opacity=".7" />}
        </g>
        <rect x={x0} y={cy - 10} width={w} height="20" rx="5" fill="none" stroke={o.stroke || P.tail} strokeWidth={o.dashed ? 1.5 : 1} strokeDasharray={o.dashed ? "4 3" : undefined} />
        {hatchW > 84 && (() => {
          const lab = `${S}d safety`, w2 = lab.length * 6.3 + 14;
          return (
            <g pointerEvents="none">
              {!o.safetyTx && <rect x={xs + 6} y={cy - 8} width={w2} height="16" rx="8" fill="rgba(18,12,48,.42)" />}
              <text x={xs + 13} y={cy + 4} fontSize="11" fontWeight="600" fill={o.safetyTx || P.poTx} fontFamily="inherit">{lab}</text>
            </g>
          );
        })()}
      </g>
    );
  };

  return (
    <div className="card" id="sec-purchase-plan" style={{ marginBottom: 10, overflow: "visible" }}>
      <div className="ch" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        Purchase Plan — shipment split
        <span style={{ position: "relative", display: "inline-flex" }}
          onMouseEnter={() => setInfoOpen(true)} onMouseLeave={() => setInfoOpen(false)}>
          <button type="button" aria-label="How to read this chart" aria-expanded={infoOpen}
            onClick={() => setInfoOpen(v => !v)} onFocus={() => setInfoOpen(true)} onBlur={() => setInfoOpen(false)}
            style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${t.border2}`, background: "transparent", color: t.text2, fontSize: 12, fontWeight: 700, fontStyle: "italic", fontFamily: "Georgia, serif", cursor: "help", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}>i</button>
          {infoOpen && (
            <div role="tooltip" style={{ position: "absolute", left: 0, top: 30, zIndex: 40, width: 400, maxWidth: "80vw", padding: "12px 14px", borderRadius: 10, background: t.tooltipBg, border: `1px solid ${t.border2}`, boxShadow: "0 10px 28px rgba(0,0,0,.32)", color: t.text, fontSize: 13, fontWeight: 400, lineHeight: 1.45, textAlign: "left" }}>
              {infoSections.map(sec => (
                <div key={sec.h} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: t.text }}>{sec.h}</div>
                  <ul style={{ margin: 0, paddingLeft: 16, color: t.text2 }}>
                    {sec.items.map((it, i) => <li key={i} style={{ marginBottom: 3 }}>{it}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </span>
      </div>
      {d0 <= 0 ? <div style={{ fontSize: 13, color: t.text3 }}>No demand data for this SKU, nothing to plan.</div> : <>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 18px", padding: "10px 14px", marginBottom: 12, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10 }}>
          <label style={lbl} title="Units to buy by sea. Starts at the system recommendation; type a number to plan a different total.">
            Total to buy
            <input type="number" min={0} value={total} onChange={e => onTotal(e.target.value)} style={fld(mode === "manual" || totOv !== null)} />
          </label>
          <label style={lbl} title="Number of purchase orders. Auto picks about one per 90 days of cover.">
            Shipments
            <input type="number" min={1} max={8} value={n} onChange={e => onN(e.target.value)} style={fld(mode === "manual" || nOv !== null, 60)} />
          </label>
          {hasAir && (
            <label style={lbl} title="Units flown in to cover the gap until a sea order arrives. Type 0 for no air.">
              Air units
              <input type="number" min={0} value={airOv === null ? (plan.air?.u ?? 0) : airOv} onChange={e => onAir(e.target.value)} style={fld(airOv !== null)} />
            </label>
          )}
          <span style={{ width: 1, height: 22, background: t.border2 }} aria-hidden="true" />
          <div style={{ display: "inline-flex" }} role="group" aria-label="Split mode">
            <button type="button" onClick={mode === "manual" ? toAuto : undefined} style={{ ...seg(mode === "auto"), borderRadius: "999px 0 0 999px" }}>Auto</button>
            <button type="button" onClick={mode === "auto" ? toManual : undefined} style={{ ...seg(mode === "manual"), borderRadius: "0 999px 999px 0", borderLeftWidth: 0 }}>Manual</button>
          </div>
          <label style={{ ...lbl, cursor: "pointer" }} title="On: demand moves to the 7d/30d trend over 30 days. Off: flat demand, the same basis as Days of Inventory.">
            <input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)} />
            Follow trend
          </label>
          <button type="button" onClick={resetAll} disabled={!dirty} title="Put everything back to the default plan: system total, auto split, no moves, no air override" style={{ marginLeft: "auto", height: 32, padding: "0 16px", fontSize: 13, fontWeight: 600, background: dirty ? "#ffffff" : t.surface, border: `1px solid ${dirty ? "#ffffff" : t.border2}`, borderRadius: 999, color: dirty ? "#0f172a" : t.text, cursor: dirty ? "pointer" : "default", opacity: dirty ? 1 : .45, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>↺ Reset</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {facts.map(f => (
            <span key={f.k} style={{ display: "inline-flex", gap: 8, alignItems: "baseline", padding: "5px 12px", borderRadius: 999, fontSize: 13, border: `1px solid ${f.bad ? t.redBdr : t.border2}`, background: f.bad ? t.redBg : t.surface, color: f.bad ? t.red : t.text }}>
              <span style={{ color: f.bad ? t.red : t.text3, fontWeight: 500 }}>{f.k}</span><strong style={{ fontWeight: 700 }}>{f.v}</strong>
            </span>
          ))}
        </div>
        <div ref={wrapRef} style={{ position: "relative" }}>
          <div style={{ overflowX: "auto" }}>
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560, display: "block" }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} role="img" aria-label="Purchase plan: current stock and purchase orders over time">
              <defs>
                <pattern id="pp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill={P.tail} opacity=".28" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke={P.tail} strokeWidth="2.2" />
                </pattern>
              </defs>
              {ticks.map(d => (
                <g key={d}>
                  <line x1={x(d)} x2={x(d)} y1={axisH - 4} y2={axisH + rows * rowH} stroke={t.border} strokeWidth="1" opacity={d === 0 ? 1 : .6} />
                  <text x={x(d)} y={11} fontSize="11" fill={t.text3} textAnchor={d === 0 ? "start" : "middle"} fontFamily="inherit">{d === 0 ? "Today" : `${d}d`}</text>
                  <text x={x(d)} y={24} fontSize="10" fill={t.text3} opacity=".8" textAnchor={d === 0 ? "start" : "middle"} fontFamily="inherit">{dayLabel(anchor, d)}</text>
                </g>
              ))}

              {/* Row 1 — current stock */}
              {(() => {
                const cy = axisH + rowH / 2;
                const bodyW = x(sr.tSafe) - x(0), tailW = x(sr.tZero) - x(sr.tSafe);
                const tp = tipOn("Current stock", [
                  `${fmt(stock0)} units`,
                  `Lasts ${stockDays} days${follow && trendPct !== 0 ? ` (${flatDays}d at flat demand)` : ""}`,
                  `Runs out ${dayLabel(anchor, sr.tZero)}`,
                  `Safety stretch from ${dayLabel(anchor, sr.tSafe)}`,
                ]);
                return (
                  <g>
                    <text x={6} y={cy + 4} {...rowLabel}>Stock</text>
                    {sr.tZero > 0 && candle("stock", x(0), x(sr.tSafe), x(sr.tZero), cy, P.stock, { tp, safetyTx: P.stockTx })}
                    {bodyW > 70 && <text x={x(0) + 8} y={cy + 4} fontSize="11" fontWeight="600" fill={P.stockTx} fontFamily="inherit" pointerEvents="none">{fmt(stock0)} u</text>}
                    {sr.tZero > 0 && endTag(x(sr.tZero), cy, sr.tZero, 8)}
                    {gap > 0 && <>
                      <line x1={x(sr.gapStart)} x2={x(sr.gapEnd)} y1={cy} y2={cy} stroke={t.red} strokeWidth="2" strokeDasharray="4 3" />
                      <rect x={x(sr.gapStart)} y={cy - 10} width={Math.max(2, x(sr.gapEnd) - x(sr.gapStart))} height="20" fill="transparent" {...tipOn("No stock", [`${gap} days with nothing on the shelf`, `From ${dayLabel(anchor, sr.gapStart)} until the first delivery arrives on ${dayLabel(anchor, sr.gapEnd)}`])} />
                      <text x={x(sr.gapStart) + 6} y={cy - 8} fontSize="10.5" fontWeight="600" fill={t.red} fontFamily="inherit" pointerEvents="none">no stock for {gap}d</text>
                    </>}
                  </g>
                );
              })()}

              {/* Orders already placed: start on the sheet ETA (no ETA: where the stock above enters safety) */}
              {placed.map((pb, i) => {
                const cy = axisH + (1 + i) * rowH + rowH / 2;
                const bodyW = x(pb.tSafe) - x(pb.arrival);
                const cover = Math.max(0, pb.tZero - pb.arrival);
                const od = overdueOf(pb), n = pb.count || 1;
                const tooFast = hasAir && airLT > 0 && pb.arrival < airLT && pb.moved;
                const lines = [
                  pb.etaDay != null
                    ? `The sheet says it arrives ${dayLabel(anchor, pb.etaDay)}${od ? " (that date has passed, so it is counted as arriving today)" : ` (day ${pb.etaDay})`}`
                    : `No arrival date in the sheet, so it is assumed to arrive ${dayLabel(anchor, pb.plannedDay ?? pb.arrival)}, when your stock reaches its safety stretch`,
                  ...(pb.moved ? [`You moved it from ${dayLabel(anchor, pb.plannedDay ?? pb.arrival)} to ${dayLabel(anchor, pb.arrival)} (${Math.abs(pb.arrival - (pb.plannedDay ?? pb.arrival))} days ${pb.arrival < (pb.plannedDay ?? pb.arrival) ? "earlier" : "later"}). What-if only, the sheet is unchanged`] : []),
                  ...(tooFast ? [`Air takes ${airLT} days, so this would need an even faster shipment`] : []),
                  ...(n > 1 ? [`${n} orders with the same date are shown together`] : []),
                  `Covers ${cover} days of demand, until ${dayLabel(anchor, pb.tZero)}`,
                  `The last ${S} days (from ${dayLabel(anchor, pb.tSafe)}) are safety stock`,
                  "Drag to move it earlier or later",
                ];
                const tp = tipOn(`${n > 1 ? `${n} POs` : "PO"} placed · ${fmt(pb.units)} units`, lines);
                const mv = (e: any, g = false) => onMoveDown(e, pb.id as string, pb.arrival, 0, placedLabel(pb), null, g);
                return (
                  <g key={pb.id}>
                    <text x={6} y={cy + 4} {...rowLabel}>{placedLabel(pb)}</text>
                    {candle(`pl${i}`, x(pb.arrival), x(pb.tSafe), x(pb.tZero), cy, P.po, { tp, dashed: true, onDown: mv })}
                    {bodyW > 90 && <text x={x(pb.arrival) + 20} y={cy + 4} fontSize="11" fontWeight="600" fill={P.poTx} fontFamily="inherit" pointerEvents="none">{fmt(pb.units)} / sea</text>}
                    {grip(x(pb.arrival), cy, e => mv(e, true))}
                    {endTag(x(pb.tZero), cy, cover, 8)}
                  </g>
                );
              })}

              {/* Air bridge */}
              {plan.air && (() => {
                const cy = axisH + (1 + placed.length) * rowH + rowH / 2, a = plan.air;
                const seaGap = a.until - a.tEnd;
                const lines = [
                  `${fmt(a.u)} units flown in${airOv !== null ? " (set by you)" : ""}`,
                  `Order today, they arrive ${dayLabel(anchor, a.arrive)} (day ${a.arrive})`,
                  a.reason === "gap" ? "Recommended: your stock runs out before the next delivery, and air can get here first"
                    : a.reason === "late" ? "Recommended: a sea order placed today arrives after your stock runs out, so air fills the wait" : "You set this amount",
                  `They cover about ${airAdds} days of sales`,
                  `The next delivery after the air arrives ${dayLabel(anchor, a.until)} (day ${a.until})${seaGap > 0 ? `, ${seaGap} day${seaGap === 1 ? "" : "s"} after the air runs out, so you would be without stock` : ""}`,
                  "Click to edit the units · drag the white edge to cover more days",
                ];
                const tp = tipOn("Air bridge", lines);
                return (
                  <g>
                    <text x={6} y={cy + 4} {...rowLabel}>Air</text>
                    <line x1={x(0)} x2={x(a.arrive)} y1={cy} y2={cy} stroke={P.wick} strokeWidth="2" opacity=".6" />
                    <circle cx={x(0)} cy={cy} r="3.5" fill={P.wick} />
                    <text x={x(0) + 8} y={cy - 9} fontSize="10" fill={t.text3} fontFamily="inherit">order today</text>
                    <rect x={x(a.arrive)} y={cy - 10} width={Math.max(2, x(a.tEnd) - x(a.arrive))} height="20" rx="5" fill={P.air} stroke={P.po} strokeWidth="1" className="pp-bar" style={clickable} onClick={e => openEdit(e, "air", 0, a.u)} {...tp} />
                    <text x={x(a.arrive) + 6} y={cy + 4} fontSize="11" fontWeight="600" fill={P.airTx} fontFamily="inherit" pointerEvents="none">{fmt(a.u)} / air</text>
                    {endTag(x(a.tEnd), cy, airAdds, 16, "+")}
                    {trim(x(a.tEnd), cy, e => onDown(e, -2, a.tEnd, a.arrive, `Air · ${fmt(a.u)} u`), "Drag to extend the air bridge")}
                  </g>
                );
              })()}

              {/* New purchase orders */}
              {plan.bars.map((b, i) => {
                const ri = 1 + placed.length + (plan.air ? 1 : 0) + i, cy = axisH + ri * rowH + rowH / 2;
                const bodyW = x(b.tSafe) - x(b.arrival);
                const cover = Math.max(0, b.tZero - b.arrival);
                const pe = prevEnd(b.k), added = Math.max(0, b.tZero - pe);
                const airDays = b.airUntil ? b.airUntil - b.arrival : 0;
                const airU = airDays > 0 ? Math.min(b.units, Math.round(plan.cum[Math.min(b.airUntil as number, PP_MAXH)] - plan.cum[Math.min(b.arrival, PP_MAXH)])) : 0; // units flown to cover the early days
                const seaU = b.units - airU;
                const tp = tipOn(`PO ${b.k + 1} · ${fmt(b.units)} units`, [
                  b.late > 0
                    ? `Order today. That is ${b.late} days later than ideal${plan.air ? ", so the air bridge covers the gap" : ""}`
                    : `Place the order on ${dayLabel(anchor, b.order)} (day ${b.order})`,
                  `It arrives ${dayLabel(anchor, b.arrival)} (day ${b.arrival}), ${Math.max(0, b.arrival - b.order)} days after ordering`,
                  ...(b.moved && b.plannedDay !== b.arrival ? [`You moved it from ${dayLabel(anchor, b.plannedDay ?? b.arrival)} to ${dayLabel(anchor, b.arrival)}. What-if only`] : []),
                  ...(airDays > 0 ? [`Sea takes ${LT} days, so the first ${airDays} days (light purple) would have to go by air`, `Split: about ${fmt(airU)} units by air + ${fmt(seaU)} units by sea`] : []),
                  `It adds ${added} days: everything on hand runs out ${dayLabel(anchor, pe)} without it, ${dayLabel(anchor, b.tZero)} with it`,
                  `From its arrival you are covered ${cover} days, until ${dayLabel(anchor, b.tZero)}`,
                  `The last ${S} days (from ${dayLabel(anchor, b.tSafe)}) are your safety stock`,
                  "Click to edit the units · drag the bar to move it · drag the white edge to cover more days",
                ]);
                const mv = (e: any, g = false) => onMoveDown(e, b.id as string, b.arrival, newFloor, `PO ${b.k + 1}`, { k: b.k, units: b.units }, g);
                return (
                  <g key={b.k}>
                    <text x={6} y={cy + 4} {...rowLabel}>{`PO ${b.k + 1}`}</text>
                    <line x1={x(b.order)} x2={x(b.arrival)} y1={cy} y2={cy} stroke={P.wick} strokeWidth="2" opacity=".6" />
                    <circle cx={x(b.order)} cy={cy} r="3.5" fill={b.late > 0 ? t.red : P.wick} />
                    <text x={x(b.order) + 8} y={cy - 9} fontSize="10.5" fontWeight={b.late > 0 ? 600 : 400} fill={b.late > 0 ? t.red : t.text3} fontFamily="inherit">
                      {b.late > 0 ? `order ${b.late}d late${plan.air ? " — air bridges" : ""}` : `order ${dayLabel(anchor, b.order)}`}
                    </text>
                    {b.units > 0 && candle(`po${b.k}`, x(b.arrival), x(b.tSafe), x(b.tZero), cy, P.po, { tp, onDown: mv, airTo: b.airUntil != null ? x(b.airUntil) : undefined })}
                    {bodyW > 70 && <text x={x(b.arrival) + (airDays > 0 && airDays > 0 ? Math.max(20, x(b.airUntil as number) - x(b.arrival) + 8) : 14)} y={cy + 4} fontSize="11" fontWeight="600" fill={P.poTx} fontFamily="inherit" pointerEvents="none">{airDays > 0 ? (x(b.airUntil as number) - x(b.arrival) > `${fmt(airU)} / air`.length * 6.2 + 24 ? `${fmt(seaU)} / sea` : `${fmt(airU)} / air · ${fmt(seaU)} / sea`) : `${fmt(b.units)} / sea`}</text>}
                    {airDays > 0 && x(b.airUntil as number) - x(b.arrival) > `${fmt(airU)} / air`.length * 6.2 + 24 && <text x={x(b.arrival) + 20} y={cy + 4} fontSize="11" fontWeight="700" fill={P.airTx} fontFamily="inherit" pointerEvents="none">{fmt(airU)} / air</text>}
                    {b.units > 0 && grip(x(b.arrival), cy, e => mv(e, true))}
                    {b.units > 0 && endTag(x(b.tZero), cy, cover, 16)}
                    {trim(x(b.tZero), cy, e => onDown(e, b.k, b.tZero, b.arrival, `PO ${b.k + 1} · ${fmt(b.units)} u`), "Drag to extend or shorten this order")}
                  </g>
                );
              })}

              {dragInfo && (() => {
                const lx = x(dragInfo.day), txt = dragInfo.text;
                const pw = Math.max(110, txt.length * 6.4 + 18);
                const px = Math.max(padL, Math.min(lx - pw / 2, W - padR - pw));
                return (
                  <g pointerEvents="none">
                    <line x1={lx} x2={lx} y1={axisH - 4} y2={axisH + rows * rowH} stroke={t.text} strokeWidth="1.5" opacity=".85" />
                    <rect x={px} y={0} width={pw} height="20" rx="10" fill={t.text} />
                    <text x={px + pw / 2} y={14} fontSize="11" fontWeight="700" fill={t.bg} textAnchor="middle" fontFamily="inherit">{txt}</text>
                  </g>
                );
              })()}

            </svg>
          </div>

          {tip && !edit && (
            <div role="tooltip" style={{
              position: "absolute", left: Math.max(4, Math.min(tip.x + 14, wrapW - 330)), zIndex: 20, pointerEvents: "none",
              ...(tip.y > wrapH * 0.5 ? { top: tip.y - 14, transform: "translateY(-100%)" } : { top: tip.y + 16 }),
              maxWidth: 320, padding: "8px 10px", borderRadius: 8, background: t.tooltipBg, border: `1px solid ${t.border2}`,
              boxShadow: "0 6px 20px rgba(0,0,0,.28)", color: t.text, fontSize: 12, lineHeight: 1.4,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>{tip.head}</div>
              {tip.lines.map((l, i) => <div key={i} style={{ color: i === tip.lines.length - 1 && /^Click|^Drag/.test(l) ? t.text3 : t.text2 }}>{l}</div>)}
            </div>
          )}

          {edit && (
            <div style={{
              position: "absolute", left: Math.max(4, Math.min(edit.x - 20, wrapW - 330)),
              ...(edit.y > wrapH * 0.5 ? { top: edit.y - 12, transform: "translateY(-100%)" } : { top: edit.y + 12 }), zIndex: 30,
              padding: "10px 12px", borderRadius: 10, background: t.tooltipBg, border: `1px solid ${t.border2}`,
              boxShadow: "0 8px 24px rgba(0,0,0,.32)", display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: t.text2 }}>{edit.kind === "air" ? "Air units" : `PO ${edit.k + 1} units`}</span>
              <input autoFocus type="number" min={0} value={edit.val}
                onChange={e => setEdit({ ...edit, val: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") applyEdit(); if (e.key === "Escape") setEdit(null); }}
                style={fld(true)} />
              <button type="button" onClick={applyEdit} style={{ height: 30, padding: "0 12px", borderRadius: 999, border: "none", background: P.po, color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Apply</button>
              <button type="button" onClick={() => setEdit(null)} aria-label="Cancel" style={{ background: "transparent", border: "none", color: t.text3, cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 10, fontSize: 12.5, color: t.text2 }}>
          {[
            ["current stock", { background: P.stock }],
            ["purchase order", { background: P.po }],
            ...(placed.length ? [["PO already placed", { background: P.po, border: `1.5px dashed ${P.tail}` }]] : []),
            ["safety stretch", { background: `repeating-linear-gradient(135deg, ${P.tail} 0 2px, transparent 2px 5px), ${P.po}`, opacity: .85 }],
            ...(hasAir ? [["air bridge", { background: P.air, border: `1px solid ${P.po}` }]] : []),
          ].map(([label, sw]: any) => (
            <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 16, height: 10, borderRadius: 3, display: "inline-block", ...sw }} />{label}
            </span>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 7, height: 14, borderRadius: 4, background: "#fff", border: `1.5px solid ${P.po}`, display: "inline-block" }} />drag edge to extend
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 16, height: 10, borderRadius: 3, background: P.po, display: "inline-block", cursor: "grab" }} />drag bar to move
          </span>
        </div>
      </>}
    </div>
  );
}
