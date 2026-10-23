export const FALLBACK_FEATURES = [
  {
    "id": "case-rate-variance-summary",
    "title": "Case-rate variance summary",
    "description": "Expected vs paid variance, operational/financial only",
    "focusFields": [
      "paidAmount",
      "expectedAmount",
      "status"
    ],
    "dateField": "due_date"
  },
  {
    "id": "outlier-stop-loss-list",
    "title": "Outlier / stop-loss list",
    "description": "Records flagged by status or missing owner",
    "focusFields": [
      "status",
      "owner",
      "risk"
    ],
    "dateField": "due_date"
  },
  {
    "id": "appeal-packet-checklist",
    "title": "Appeal packet checklist",
    "description": "Cases missing appeal evidence fields",
    "focusFields": [
      "title",
      "owner",
      "status"
    ],
    "dateField": "due_date"
  }
];
const isEmpty = v => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
const isDone = v => ["done","completed","complete","closed","approved"].includes(String(v ?? "").toLowerCase());
export function runFallback(featureId, records) {
  const feature = FALLBACK_FEATURES.find(f => f.id === featureId); if (!feature) return null;
  const rows = Array.isArray(records) ? records.slice(0,500) : [];
  // records may wrap domain fields in payload
  const flat = rows.map(r => ({ ...(r.payload && typeof r.payload==="object" ? r.payload : {}), ...r }));
  const statusCounts={}; for (const r of flat){ const s=r.status==null||r.status===""? (r.state==null||r.state===""?"(empty status)":String(r.state)) : String(r.status); statusCounts[s]=(statusCounts[s]??0)+1; }
  const missingByField={}; for (const f of feature.focusFields) missingByField[f]=flat.filter(r=>isEmpty(r[f])).length;
  const zeroCounts={}, falseCounts={}; for (const r of flat) for (const [k,v] of Object.entries(r)){ if(v===0) zeroCounts[k]=(zeroCounts[k]??0)+1; if(v===false) falseCounts[k]=(falseCounts[k]??0)+1; }
  const overdue = feature.dateField ? flat.filter(r=>{ const d=r[feature.dateField] ?? r.due_date ?? r.dueDate; if(isEmpty(d)||isDone(r.status)||isDone(r.state)) return false; const t=Date.parse(String(d)); return Number.isFinite(t)&&t<Date.now(); }).length : 0;
  // domain numeric: variance for transplant
  let varianceTotal=null;
  if (featureId==="case-rate-variance-summary"){ varianceTotal = flat.reduce((s,r)=> s + Math.max(0,(Number(r.expectedAmount??r.expected_amount??r.amount)||0)-(Number(r.paidAmount??r.paid_amount)||0)),0); }
  const totalMissing=Object.values(missingByField).reduce((a,b)=>a+b,0);
  const counts={ total: rows.length, overdue, missingByField, statusCounts, zeroCounts, falseCounts, ...(varianceTotal!==null?{varianceTotal}:{}) };
  const findings=[`${rows.length} record(s) reviewed for ${feature.title}.`, ...feature.focusFields.map(f=>`${f}: ${missingByField[f]} empty of ${rows.length} (preserved as empty).`), `Status breakdown: ${Object.entries(statusCounts).map(([k,v])=>`${k}=${v}`).join(", ")||"(no records)"}.`, `Zero values preserved: ${Object.entries(zeroCounts).map(([k,v])=>`${k}=${v}`).join(", ")||"none"}. False values preserved: ${Object.entries(falseCounts).map(([k,v])=>`${k}=${v}`).join(", ")||"none"}.`, ...(varianceTotal!==null?[`Total positive variance (expected minus paid, 0 floor per record): ${varianceTotal}.`]:[])];
  const summary = rows.length===0 ? `No records supplied. ${feature.title} has 0 records to review.` : `${totalMissing} missing focus field(s) across ${rows.length} record(s); ${overdue} overdue.`;
  return { aiGenerated:false, label:"Deterministic fallback — no AI provider used", feature:feature.id, title:feature.title, summary, counts, findings, recommendations:["Review empty fields from source evidence.","Assign an owner for overdue or incomplete records.","Re-run with a provider configured only if a narrative draft is needed."], sections:[{title:"Summary",detail:summary},{title:"Counts",detail:findings.join(" ")},{title:"Findings",detail:findings.join("\n")}] };
}
export function filterRecords(rows, {q="", status="", risk=""}={}) {
  const needle=String(q).trim().toLowerCase();
  return (rows||[]).filter(r=>{ if(status && String(r.status??r.state??"")!==status) return false; if(risk && String(r.risk??"")!==risk) return false; if(!needle) return true; const flat={...(r.payload&&typeof r.payload==="object"?r.payload:{}),...r}; return Object.values(flat).some(v=> v!==null&&v!==undefined&&String(v).toLowerCase().includes(needle)); });
}
export function toCsv(rows, columns) {
  const cols = columns && columns.length ? columns : [...new Set((rows||[]).flatMap(r=>Object.keys(r)))];
  if (!cols.length) return "";
  const esc=v=>{ const s=v==null?"":typeof v==="object"?JSON.stringify(v):String(v); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
  return [cols.join(","), ...(rows||[]).map(r=>cols.map(c=>esc(r[c])).join(","))].join("\n");
}
export function sendExport(res, rows, format, filename="records") {
  if (format==="csv"){ res.setHeader("Content-Type","text/csv; charset=utf-8"); res.setHeader("Content-Disposition",`attachment; filename="${filename}.csv"`); return res.send(toCsv(rows)); }
  res.setHeader("Content-Disposition",`attachment; filename="${filename}.json"`); return res.json({ items: rows });
}
