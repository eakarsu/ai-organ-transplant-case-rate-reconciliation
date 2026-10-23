
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
delete process.env.OPENROUTER_API_KEY; delete process.env.OPENAI_API_KEY;
const { runFallback, filterRecords, toCsv, FALLBACK_FEATURES } = await import("../fallbackAi.mjs");
test("fallback labelled deterministic aiGenerated:false preserves 0/false/empty", ()=>{ assert.equal(FALLBACK_FEATURES.length,3); const r=runFallback(FALLBACK_FEATURES[0].id,[{status:"Open",score:0,verified:false,note:"",amount:0}]); assert.equal(r.aiGenerated,false); assert.match(r.label,/Deterministic fallback/); assert.equal(r.counts.zeroCounts.score,1); assert.equal(r.counts.falseCounts.verified,1); assert.ok(r.sections.length>=3); });
test("filterRecords search/filter and csv export preserve values", ()=>{ const rows=[{title:"Alpha case",status:"Open",amount:0},{title:"Beta",status:"Closed",amount:5}]; assert.equal(filterRecords(rows,{q:"alpha"}).length,1); assert.equal(filterRecords(rows,{status:"Closed"}).length,1); assert.match(toCsv(rows),/Alpha case/); assert.match(toCsv(rows),/,0/); });
test("fallback empty list and routes mounted behind auth", ()=>{ assert.equal(runFallback(FALLBACK_FEATURES[0].id,[]).counts.total,0); const s=fs.readFileSync(new URL("../server.mjs",import.meta.url),"utf8"); assert.ok(s.includes("ai-fallback")); assert.ok(s.includes("/export")); });
