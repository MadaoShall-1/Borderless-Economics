import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend, ReferenceLine, BarChart, Bar } from "recharts";

// Runner outputs + source data
import usAnnual from "./data/us_industry_results.json";
import caAnnual from "./data/ca_industry_results.json";
import usCurrent from "./data/us_current_impact.json";
import srcData from "./data/pnwer_analysis_data_v9.json";
import integrated from "./data/tariff_bilateral_integrated.json";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const STATE_NAMES = { WA:"Washington", OR:"Oregon", ID:"Idaho", MT:"Montana", AK:"Alaska" };
const PROV_NAMES = { BC:"British Columbia", AB:"Alberta", SK:"Saskatchewan", YT:"Yukon", NT:"NW Territories" };
const TOP_EXPORTS = { WA:"Crude Petroleum", OR:"Auto Parts (MX)", ID:"Dairy Products", MT:"Crude Oil (CA)", AK:"Refined Petroleum", BC:"Lumber & Wood", AB:"Crude Oil", SK:"Potash & Canola" };
const SC = { Agriculture:"#4CAF50", Energy:"#FF9800", Forestry:"#795548", Minerals:"#607D8B", Manufacturing:"#2196F3", Other:"#9C27B0" };
const CL = ["#0B4F6C","#01BAEF","#20BF55","#FBB13C","#FE6847","#764BA2","#3A7CA5","#81C784","#F48FB1","#FFD54F"];
const FL = { us:"🇺🇸", ca:"🇨🇦" };
const INDS = ["agriculture","energy","forestry","minerals","manufacturing","other"];
const PS = ["WA","OR","ID","MT","AK"];
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ══════ PER-STATE SECTORS ══════
function buildSectors(sid) {
  const st = srcData.state_trade; const sec = {};
  INDS.forEach(ind => { let i4=0,i5=0,e4=0,e5=0;
    ["CA","MX"].forEach(p => { const d4=st?.[sid]?.[p]?.["2024"]?.by_industry?.[ind]||{}; const d5=st?.[sid]?.[p]?.["2025"]?.by_industry?.[ind]||{};
      i4+=d4.imports||0; i5+=d5.imports||0; e4+=d4.exports||0; e5+=d5.exports||0; });
    const b=Math.round((i4+e4)/1e6), c=Math.round((i5+e5)/1e6);
    sec[ind.charAt(0).toUpperCase()+ind.slice(1)] = { base:b, current:c, pct: b>0?Math.round((c-b)/b*1000)/10:0 };
  }); return sec;
}

// ══════ US / CA / MONTHLY ══════
const US = Object.entries(usAnnual.by_state).map(([id,s]) => ({ id, name:STATE_NAMES[id], flag:"us", t24:Math.round(s.trade_2024/1e9*10)/10, t25:Math.round(s.trade_2025/1e9*10)/10, topExport:TOP_EXPORTS[id]||"", gdp:Math.round(s.gdp_at_risk/1e6), jobs:s.jobs_at_risk, currency:"USD", sectors:buildSectors(id) }));
const CA = Object.entries(caAnnual.by_province).map(([id,p]) => { const sec={};
  INDS.forEach(ind => { const d=caAnnual.by_industry[ind]; if(d){ const b=Math.round((d.export_base+d.import_base)/1e6); const c=b+Math.round((d.export_actual+d.import_actual)/1e6);
    sec[ind.charAt(0).toUpperCase()+ind.slice(1)]={base:b,current:c,pct:b>0?Math.round((c-b)/b*1000)/10:0};}});
  const raw24=p.trade_2024, raw25=p.trade_2025;
  // Use M for small provinces (YT, NT), B for large
  const useM = raw24 < 1e9;
  const t24v = useM ? Math.round(raw24/1e6) : Math.round(raw24/1e9*10)/10;
  const t25v = useM ? Math.round(raw25/1e6) : Math.round(raw25/1e9*10)/10;
  const unit = useM ? "M" : "B";
  return { id, name:PROV_NAMES[id], flag:"ca", t24:t24v, t25:t25v, unit, topExport:TOP_EXPORTS[id]||"", gdp:Math.round(p.gdp_at_risk/1e6), jobs:p.jobs_at_risk, currency:"CAD", sectors:sec }; });
const ALL = [...US,...CA];

// Monthly from runner + refreshed data
const MONTHLY_BASE = Object.entries(usCurrent.monthly_trend).map(([k,v]) => ({ key:k, m:MN[parseInt(k.split("-")[1])-1]||k, t24:Math.round(v.trade_2024/1e6), t25:Math.round(v.trade_2025/1e6), yoy:v.yoy_pct, mom:v.mom_pct }));
// Append ONLY newer months from refreshed data (after last BASE month)
const existingKeys = new Set(MONTHLY_BASE.map(d=>d.key));
const lastBaseKey = MONTHLY_BASE.length > 0 ? MONTHLY_BASE[MONTHLY_BASE.length-1].key : "0000-00";
const mt = srcData.monthly_trade||{};
const rm = {};
PS.forEach(s => { ["CA","MX"].forEach(p => { const pm=mt?.[s]?.[p]||{};
  Object.entries(pm).forEach(([mk,md]) => { if(!rm[mk]) rm[mk]={exp:0,imp:0}; rm[mk].exp+=md?.exports?.total||0; rm[mk].imp+=md?.imports?.total||0; }); }); });
// Only months that are AFTER the latest base month AND not already in base
const MONTHLY_EXTRA = Object.entries(rm)
  .filter(([mk]) => !existingKeys.has(mk) && mk > lastBaseKey)
  .sort((a,b)=>a[0].localeCompare(b[0]))
  .map(([mk,d])=>{
    const mIdx=parseInt(mk.split("-")[1]); const total=Math.round((d.exp+d.imp)/1e6);
    // YoY: compare to same month in MONTHLY_BASE (which is 2025 data)
    const sameMonthLastYear = MONTHLY_BASE.find(m => parseInt(m.key.split("-")[1]) === mIdx);
    // MoM: compare to the previous entry
    const prevTotal = MONTHLY_BASE.length > 0 ? MONTHLY_BASE[MONTHLY_BASE.length-1].t25 : 0;
    return { key:mk, m:MN[mIdx-1]||mk, t25:total,
      t24: sameMonthLastYear ? sameMonthLastYear.t25 : 0,
      yoy: sameMonthLastYear && sameMonthLastYear.t25 > 0 ? Math.round((total-sameMonthLastYear.t25)/sameMonthLastYear.t25*1000)/10 : 0,
      mom: prevTotal > 0 ? Math.round((total-prevTotal)/prevTotal*1000)/10 : 0 };
  });
const MONTHLY = [...MONTHLY_BASE,...MONTHLY_EXTRA];

// Product data from v9
const PM = {"0808":{name:"Apples & Pears",ind:"agriculture"},"0402":{name:"Dairy",ind:"agriculture"},"1001":{name:"Wheat",ind:"agriculture"},"1205":{name:"Canola",ind:"agriculture"},"0201":{name:"Beef",ind:"agriculture"},"2709":{name:"Crude Oil",ind:"energy"},"2710":{name:"Refined Petroleum",ind:"energy"},"2711":{name:"Natural Gas",ind:"energy"},"4407":{name:"Lumber",ind:"forestry"},"4418":{name:"Builders Woodwork",ind:"forestry"},"4703":{name:"Woodpulp",ind:"forestry"},"7601":{name:"Aluminum",ind:"minerals"},"7208":{name:"Steel",ind:"minerals"},"8708":{name:"Auto Parts",ind:"manufacturing"},"8413":{name:"Pumps",ind:"manufacturing"},"8481":{name:"Valves",ind:"manufacturing"},"8432":{name:"Ag Machinery",ind:"manufacturing"}};
const PD = {}; const pt=srcData.product_trade||{};
Object.entries(PM).forEach(([hs4,m]) => { let t4=0,t5=0; PS.forEach(s => { ["CA","MX"].forEach(p => { const d4=pt?.[s]?.[p]?.["2024"]?.[hs4]||{}; const d5=pt?.[s]?.[p]?.["2025"]?.[hs4]||{};
  t4+=(d4.imports||0)+(d4.exports||0); t5+=(d5.imports||0)+(d5.exports||0); }); }); PD[hs4]={...m,trade24:Math.round(t4/1e6),trade25:Math.round(t5/1e6)}; });

const DECOMP = { us:{tariff:integrated.decomposition.tariff_effect_B,oil:integrated.decomposition.oil_price_effect_B,residual:integrated.decomposition.residual_B,total:integrated.decomposition.actual_total_B,unit:"USD"}, ca:{tariff:-8.9,oil:-10.5,residual:0.5,total:-18.9,unit:"CAD"} };
const DID_DATA = [{period:"Pre-USMCA",treated:100,control:100},{period:"USMCA",treated:108,control:103},{period:"Post-COVID",treated:95,control:88},{period:"Recovery",treated:118,control:106},{period:"2025 Tariff",treated:98,control:110}];
const US_T24=US.reduce((s,j)=>s+j.t24,0), US_T25=US.reduce((s,j)=>s+j.t25,0), US_GDP=US.reduce((s,j)=>s+j.gdp,0), US_JOBS=US.reduce((s,j)=>s+j.jobs,0);

// PNWER Cross-Border: US 5 states ↔ Canada (from Census state_trade)
const stTrade = srcData.state_trade||{};
const XBORDER_STATES = PS.map(s => {
  const e24=stTrade[s]?.CA?.["2024"]?.total?.exports||0, i24=stTrade[s]?.CA?.["2024"]?.total?.imports||0;
  const e25=stTrade[s]?.CA?.["2025"]?.total?.exports||0, i25=stTrade[s]?.CA?.["2025"]?.total?.imports||0;
  return {id:s, exp24:e24, imp24:i24, t24:e24+i24, exp25:e25, imp25:i25, t25:e25+i25, delta:(e25+i25)-(e24+i24)};
});
const XBORDER_IND = INDS.map(ind => {
  let e24=0,i24=0,e25=0,i25=0;
  PS.forEach(s=>{
    e24+=stTrade[s]?.CA?.["2024"]?.by_industry?.[ind]?.exports||0;
    i24+=stTrade[s]?.CA?.["2024"]?.by_industry?.[ind]?.imports||0;
    e25+=stTrade[s]?.CA?.["2025"]?.by_industry?.[ind]?.exports||0;
    i25+=stTrade[s]?.CA?.["2025"]?.by_industry?.[ind]?.imports||0;
  });
  return {ind, t24:e24+i24, t25:e25+i25, delta:(e25+i25)-(e24+i24), pct:(e24+i24)>0?((e25+i25-(e24+i24))/(e24+i24)*100):0};
});
const XB_T24=XBORDER_STATES.reduce((s,d)=>s+d.t24,0), XB_T25=XBORDER_STATES.reduce((s,d)=>s+d.t25,0);

// ══════ COMPONENT ══════
export default function PNWERDashboard() {
  const [tab,setTab] = useState("overview");
  const [sel,setSel] = useState(null);
  const [detailView,setDetailView] = useState("current");
  const [mdl,setMdl] = useState("did");
  const [refreshing,setRefreshing] = useState(false);
  const [refreshMsg,setRefreshMsg] = useState(null);
  const [tCA,setTCA] = useState(15);
  const [tMX,setTMX] = useState(12);
  const [fView,setFView] = useState("industry");
  const [forecast,setForecast] = useState(null);
  const [fcLoading,setFcLoading] = useState(false);
  const [savedReports,setSavedReports] = useState({});  // {impact: ..., forecast: ...}
  const debounceRef = useRef(null);

  // Load initial forecast from backend on mount
  useEffect(() => {
    fetch(`${API}/api/forecast`).then(r=>r.ok?r.json():null).then(d=>{if(d&&!d.error)setForecast(d)}).catch(()=>{});
  }, []);

  // When sliders change, call backend /api/forecast with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setFcLoading(true);
      try {
        const r = await fetch(`${API}/api/forecast?ca=${tCA}&mx=${tMX}`);
        if (r.ok) { const d = await r.json(); if (!d.error) setForecast(d); }
      } catch(e) { /* backend down, keep current forecast */ }
      finally { setFcLoading(false); }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [tCA, tMX]);

  // Derived from forecast JSON
  const fc = forecast || {};
  const fcMeta = fc.metadata || {};
  const fcInd = fc.by_industry || {};
  const fcProd = fc.by_product || {};
  const fcTot = fc.totals || { current:0, predicted:0, delta:0, gdp:0, jobs:0 };
  const baseLbl = fcMeta.baseline_label || (MONTHLY.length>0 ? MONTHLY[MONTHLY.length-1].m+" 2025" : "—");
  const predLbl = fcMeta.predicted_label || "Next month";

  const handleRefresh = useCallback(async () => {
    setRefreshing(true); setRefreshMsg(null);
    try {
      const r = await fetch(`${API}/api/refresh`,{method:"POST"});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setRefreshMsg(d.status==="success" ? `✅ Refreshed ${d.records_updated} records (${d.month_refreshed}). Reloading...` : `⚠️ Partial: ${d.errors?.length||0} errors`);
      if(d.status==="success"||d.status==="partial") setTimeout(()=>window.location.reload(),2000);
    } catch(e) { setRefreshMsg(`❌ ${e.message}`); }
    finally { setRefreshing(false); }
  },[]);

  const fmtM = v => "$"+Math.abs(v).toLocaleString(undefined,{maximumFractionDigits:0})+"M";
  const fmtV = v => { if(Math.abs(v)>=1e9) return "$"+(v/1e9).toFixed(1)+"B"; return "$"+Math.round(v/1e6).toLocaleString()+"M"; };
  const getDonut = j => j?.sectors ? Object.entries(j.sectors).map(([k,v])=>({name:k,value:Math.abs(v.base-v.current),pct:v.pct,base:v.base,current:v.current})).filter(d=>d.value>0).sort((a,b)=>b.value-a.value) : [];

  const JurCard = ({j}) => { const chg=j.t25-j.t24,pct=j.t24>0?(chg/j.t24*100).toFixed(0):"0"; const u=j.unit||"B"; return(
    <div onClick={()=>{setSel(j);setDetailView("current")}} style={{cursor:"pointer",background:sel?.id===j.id?"rgba(1,186,239,0.03)":"white",border:sel?.id===j.id?"2px solid #01BAEF":"2px solid #E4EAF0",borderRadius:12,padding:"14px 10px",textAlign:"center",transition:"all 0.2s"}}>
      <div style={{fontSize:18,marginBottom:4}}>{FL[j.flag]}</div><div style={{fontWeight:700,fontSize:15,color:"#0A2540"}}>{j.id}</div><div style={{fontSize:11,color:"#5A6B7C"}}>{j.name}</div>
      <div style={{fontSize:15,fontWeight:600,color:"#0B4F6C",marginTop:5}}>${j.t25}{u}</div><div style={{fontSize:11,color:chg<0?"#F44336":"#4CAF50",fontWeight:600}}>{chg<0?"":"+"}{u==="M"?Math.round(chg):chg.toFixed(1)}{u} ({pct}%)</div><div style={{fontSize:10,color:"#5A6B7C"}}>2024: ${j.t24}{u}</div>
    </div>);};

  // ══════ FORECAST PANEL — reads from backend JSON ══════
  const FP = () => {
    // If a US state is selected and backend returned per-state slice, use that.
    // Otherwise fall back to the aggregate (5 states × CA+MX).
    const stateSlice = (sel && sel.flag === "us" && fc.by_state) ? fc.by_state[sel.id] : null;
    const pInd  = stateSlice ? (stateSlice.by_industry || {}) : fcInd;
    const pProd = stateSlice ? (stateSlice.by_product  || {}) : fcProd;
    const pTot  = stateSlice ? (stateSlice.totals || {current:0,predicted:0,delta:0,gdp:0,jobs:0}) : fcTot;
    const scopeLbl = stateSlice ? `${sel.name} ↔ CA+MX` : "5 States ↔ CA+MX";
    return (<div>
    <div style={{display:"flex",gap:16,marginBottom:20,flexWrap:"wrap"}}>
      {/* Tariff sliders */}
      <div style={{flex:"1 1 320px",background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:20}}>
        <div style={{fontSize:14,fontWeight:700,color:"#0A2540",marginBottom:4}}>Tariff Scenario</div>
        <div style={{fontSize:11,color:"#5A6B7C",marginBottom:14}}>Adjust rates — forecast updates from model backend</div>
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}><span style={{color:"#5A6B7C"}}>🇨🇦 Canada</span><span style={{fontWeight:700,color:"#0A2540"}}>{tCA}%</span></div>
          <input type="range" min={0} max={50} value={tCA} onChange={e=>setTCA(+e.target.value)} style={{width:"100%",accentColor:"#F44336"}} />
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#9AA5B4"}}><span>0%</span><span>15% (current)</span><span>50%</span></div>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}><span style={{color:"#5A6B7C"}}>🇲🇽 Mexico</span><span style={{fontWeight:700,color:"#0A2540"}}>{tMX}%</span></div>
          <input type="range" min={0} max={50} value={tMX} onChange={e=>setTMX(+e.target.value)} style={{width:"100%",accentColor:"#FF9800"}} />
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#9AA5B4"}}><span>0%</span><span>12% (current)</span><span>50%</span></div>
        </div>
        {fcLoading && <div style={{marginTop:10,fontSize:11,color:"#01BAEF"}}>⏳ Updating forecast...</div>}
      </div>
      {/* Summary */}
      <div style={{flex:"1 1 400px"}}>
        <div style={{background:"linear-gradient(135deg,#0A2540,#0F3460)",borderRadius:14,padding:20,color:"white",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:1}}>Monthly Forecast · {scopeLbl}</div><div style={{fontSize:20,fontWeight:700}}>{baseLbl} → {predLbl}</div></div>
            <div style={{fontSize:10,padding:"4px 10px",borderRadius:6,background:"rgba(1,186,239,0.15)",color:"#01BAEF"}}>CA {tCA}% / MX {tMX}%</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[[baseLbl,fmtV(pTot.current),"#01BAEF"],[`${predLbl}`,fmtV(pTot.predicted),"#20BF55"],["Δ Trade",`${pTot.delta>=0?"+":""}${fmtV(pTot.delta)}`,pTot.delta>=0?"#4CAF50":"#FE6847"],["GDP Risk",fmtV(pTot.gdp),"#FF9800"]].map(([l,v,c],i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.06)",borderRadius:8,padding:"10px 12px",border:"1px solid rgba(255,255,255,0.08)"}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>{l}</div>
                <div style={{fontSize:17,fontWeight:700,color:c,fontVariantNumeric:"tabular-nums"}}>{v}</div>
              </div>))}
          </div>
        </div>
        <div style={{padding:"8px 12px",background:"#F7F9FC",borderRadius:8,border:"1px solid #E4EAF0",fontSize:10,color:"#5A6B7C",lineHeight:1.5}}>
          Model: <b>run_forecast.py</b> → tariff_model.py (CES/Armington, H2 calibrated ε, per-partner τ). Click <b>Refresh Data</b> to pull latest Census month + auto-rerun forecast.
        </div>
      </div>
    </div>

    {/* View toggle */}
    <div style={{display:"flex",gap:2,background:"#EDF1F7",borderRadius:10,padding:3,width:"fit-content",marginBottom:16}}>
      {[["industry","By Industry"],["product","By Product"]].map(([id,label])=>(
        <button key={id} onClick={()=>setFView(id)} style={{padding:"8px 18px",borderRadius:8,border:"none",background:fView===id?"white":"transparent",color:fView===id?"#0A2540":"#5A6B7C",fontFamily:"inherit",fontSize:12,fontWeight:500,cursor:"pointer",boxShadow:fView===id?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>{label}</button>))}
    </div>

    {/* INDUSTRY TABLE */}
    {fView==="industry" && (<div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:20}}>
      <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:16}}>{baseLbl} vs {predLbl} — By Industry · {scopeLbl}</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:"2px solid #EDF1F7"}}>
          {["Industry","Imports","Exports","Current","Predicted","Δ","Δ%","GDP Risk","Jobs"].map(h=>(
            <th key={h} style={{padding:"10px 10px",textAlign:h==="Industry"?"left":"right",color:"#5A6B7C",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>))}
        </tr></thead>
        <tbody>
          {Object.entries(pInd).sort((a,b)=>Math.abs(b[1].delta||0)-Math.abs(a[1].delta||0)).map(([ind,f])=>{
            const lb=ind.charAt(0).toUpperCase()+ind.slice(1); const cl=SC[lb]||"#999"; return(
            <tr key={ind} style={{borderBottom:"1px solid #F3F5F9"}}>
              <td style={{padding:"10px 10px"}}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:2,background:cl,display:"inline-block"}}/><span style={{fontWeight:600,color:"#0A2540"}}>{lb}</span></span></td>
              <td style={{padding:"10px 10px",textAlign:"right",fontSize:11,color:"#5A6B7C"}}>{fmtV(f.current_imp||0)}</td>
              <td style={{padding:"10px 10px",textAlign:"right",fontSize:11,color:"#5A6B7C"}}>{fmtV(f.current_exp||0)}</td>
              <td style={{padding:"10px 10px",textAlign:"right"}}>{fmtV(f.current||0)}</td>
              <td style={{padding:"10px 10px",textAlign:"right",fontWeight:600}}>{fmtV(f.predicted||0)}</td>
              <td style={{padding:"10px 10px",textAlign:"right",color:(f.delta||0)<0?"#F44336":(f.delta||0)>0?"#4CAF50":"#5A6B7C",fontWeight:600}}>{(f.delta||0)>0?"+":""}{fmtV(f.delta||0)}</td>
              <td style={{padding:"10px 10px",textAlign:"right"}}><span style={{fontSize:11,fontWeight:700,color:(f.pct_change||0)<-5?"#F44336":(f.pct_change||0)<0?"#FF9800":(f.pct_change||0)>0?"#4CAF50":"#5A6B7C"}}>{(f.pct_change||0)>0?"+":""}{(f.pct_change||0).toFixed(1)}%</span></td>
              <td style={{padding:"10px 10px",textAlign:"right",color:"#FF9800",fontWeight:600}}>{fmtV(f.gdp_risk||0)}</td>
              <td style={{padding:"10px 10px",textAlign:"right",color:"#5A6B7C"}}>{(f.jobs_risk||0).toLocaleString()}</td>
            </tr>);})}
          <tr style={{borderTop:"2px solid #0A2540",fontWeight:700}}>
            <td style={{padding:"10px 10px",color:"#0A2540"}}>Total</td><td/><td/>
            <td style={{padding:"10px 10px",textAlign:"right"}}>{fmtV(pTot.current)}</td>
            <td style={{padding:"10px 10px",textAlign:"right"}}>{fmtV(pTot.predicted)}</td>
            <td style={{padding:"10px 10px",textAlign:"right",color:pTot.delta<0?"#F44336":"#4CAF50"}}>{pTot.delta>=0?"+":""}{fmtV(pTot.delta)}</td>
            <td style={{padding:"10px 10px",textAlign:"right"}}>{pTot.current>0?(pTot.delta/pTot.current*100).toFixed(1):"0.0"}%</td>
            <td style={{padding:"10px 10px",textAlign:"right",color:"#FF9800"}}>{fmtV(pTot.gdp)}</td>
            <td style={{padding:"10px 10px",textAlign:"right"}}>{(pTot.jobs||0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>)}

    {/* PRODUCT TABLE */}
    {fView==="product" && (<div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:20}}>
      <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:16}}>{baseLbl} vs {predLbl} — By Product (HS4) · {scopeLbl}</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:"2px solid #EDF1F7"}}>
          {["HS4","Product","Industry","Imports","Exports","Current","Predicted","Δ","Δ%"].map(h=>(
            <th key={h} style={{padding:"8px 10px",textAlign:["HS4","Product","Industry"].includes(h)?"left":"right",color:"#5A6B7C",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>))}
        </tr></thead>
        <tbody>
          {Object.entries(pProd).sort((a,b)=>Math.abs(b[1].delta||0)-Math.abs(a[1].delta||0)).map(([hs4,f])=>{
            const ind=f.industry||""; const cl=SC[ind.charAt(0).toUpperCase()+ind.slice(1)]||"#999"; return(
            <tr key={hs4} style={{borderBottom:"1px solid #F3F5F9"}}>
              <td style={{padding:"8px 10px",fontWeight:600,color:"#0A2540"}}>{hs4}</td>
              <td style={{padding:"8px 10px",color:"#0A2540"}}>{f.name}</td>
              <td style={{padding:"8px 10px"}}><span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:`${cl}15`,color:cl,fontWeight:600}}>{ind.charAt(0).toUpperCase()+ind.slice(1)}</span></td>
              <td style={{padding:"8px 10px",textAlign:"right",fontSize:11,color:"#5A6B7C"}}>{fmtV(f.current_imp||0)}</td>
              <td style={{padding:"8px 10px",textAlign:"right",fontSize:11,color:"#5A6B7C"}}>{fmtV(f.current_exp||0)}</td>
              <td style={{padding:"8px 10px",textAlign:"right"}}>{fmtV(f.current||0)}</td>
              <td style={{padding:"8px 10px",textAlign:"right",fontWeight:600}}>{fmtV(f.predicted||0)}</td>
              <td style={{padding:"8px 10px",textAlign:"right",color:(f.delta||0)<0?"#F44336":(f.delta||0)>0?"#4CAF50":"#5A6B7C",fontWeight:600}}>{(f.delta||0)>0?"+":""}{fmtV(f.delta||0)}</td>
              <td style={{padding:"8px 10px",textAlign:"right"}}><span style={{fontSize:11,fontWeight:700,color:(f.pct_change||0)<-10?"#F44336":(f.pct_change||0)<0?"#FF9800":(f.pct_change||0)>0?"#4CAF50":"#5A6B7C"}}>{(f.pct_change||0)>0?"+":""}{(f.pct_change||0).toFixed(1)}%</span></td>
            </tr>);})}
        </tbody>
      </table></div>
    </div>)}
  </div>);
  };

  // ══════ RENDER ══════
  return (
    <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",background:"#F7F9FC",minHeight:"100vh",color:"#1A2B3C"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(10,37,64,0.97)",backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(255,255,255,0.08)",padding:"0 28px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#01BAEF,#20BF55)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"white",fontSize:10}}>PNW</div>
          <div style={{color:"white",fontWeight:700,fontSize:15}}>PNWER Tariff Dashboard</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{display:"flex",gap:2,background:"rgba(255,255,255,0.06)",borderRadius:10,padding:3}}>
            {[["overview","Overview"],["total","Total Impact"],["modeling","Modeling"],["reports","Reports"]].map(([id,label])=>(
              <button key={id} onClick={()=>{setTab(id);setSel(null)}} style={{padding:"7px 18px",borderRadius:8,border:"none",background:tab===id?"rgba(1,186,239,0.15)":"transparent",color:tab===id?"#01BAEF":"rgba(255,255,255,0.5)",fontFamily:"inherit",fontSize:13,fontWeight:500,cursor:"pointer"}}>{label}</button>))}
          </div>
          <button onClick={handleRefresh} disabled={refreshing} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:8,border:"1px solid rgba(32,191,85,0.3)",background:refreshing?"rgba(255,255,255,0.05)":"rgba(32,191,85,0.1)",color:refreshing?"rgba(255,255,255,0.4)":"#20BF55",fontFamily:"inherit",fontSize:12,fontWeight:600,cursor:refreshing?"wait":"pointer"}}>
            <span style={{display:"inline-block",animation:refreshing?"spin 1s linear infinite":"none"}}>🔄</span>{refreshing?"Refreshing...":"Refresh Data"}
          </button>
        </div>
      </nav>

      {refreshMsg && (<div style={{padding:"10px 28px",background:refreshMsg.startsWith("❌")?"#FEE2E2":refreshMsg.startsWith("✅")?"#DCFCE7":"#FEF3C7",fontSize:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>{refreshMsg}</span><button onClick={()=>setRefreshMsg(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14}}>✕</button>
      </div>)}

      {tab==="overview"&&!sel&&(<div style={{background:"linear-gradient(160deg,#0A2540,#0F3460 40%,#0B4F6C 70%,#0A2540)",padding:"44px 40px 36px"}}><div>
        <h1 style={{fontSize:38,fontWeight:700,color:"white",lineHeight:1.15,maxWidth:700,marginBottom:14}}>Understanding <span style={{background:"linear-gradient(90deg,#01BAEF,#20BF55)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Tariff Impacts</span> Across the Pacific Northwest</h1>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",lineHeight:1.7,maxWidth:680,marginBottom:28}}>Analyzing trade between {ALL.length} PNWER jurisdictions (5 US states ↔ Canada &amp; Mexico, 5 Canadian provinces ↔ United States). Data: U.S. Census Bureau + Statistics Canada. Model: CES/Armington with monthly-calibrated elasticities.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {[[`$${US_T24.toFixed(1)}B → $${US_T25.toFixed(1)}B`,"US 5 States ↔ CA+MX","#01BAEF"],[`-$${(US_T24-US_T25).toFixed(1)}B`,"YoY Trade Decline (USD)","#FE6847"],[`$${(US_GDP/1000).toFixed(1)}B`,"GDP at Risk (USD)","#FF9800"],[US_JOBS.toLocaleString(),"Jobs at Risk (US)","#FBB13C"]].map(([v,l,c],i)=>(
            <div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"14px 16px"}}><div style={{fontSize:22,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:.6}}>{l}</div></div>))}
        </div>
      </div></div>)}

      <div style={{padding:"24px 28px 56px"}}>
        {tab==="overview"&&(<div>{!sel?(<>
          <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:4,color:"#3A7CA5"}}>United States</div>
          <div style={{fontSize:11,color:"#5A6B7C",marginBottom:10}}>Each state's bilateral trade with Canada + Mexico combined (USD). Source: U.S. Census Bureau.</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:18}}>{US.map(j=><JurCard key={j.id} j={j}/>)}</div>
          <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:4,color:"#FE6847"}}>Canada</div>
          <div style={{fontSize:11,color:"#5A6B7C",marginBottom:10}}>Each province's bilateral trade with all 50 US states combined (CAD). Source: Statistics Canada.</div>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${CA.length},1fr)`,gap:10,marginBottom:18}}>{CA.map(j=><JurCard key={j.id} j={j}/>)}</div>
          <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",textAlign:"center",padding:40,color:"#5A6B7C"}}><div style={{fontSize:40,marginBottom:10}}>🗺️</div><div style={{fontSize:18,fontWeight:700,color:"#0A2540"}}>Select a Jurisdiction</div><div style={{fontSize:12,marginTop:6}}>Click a state or province above to view detailed industry breakdown and forecast. US states show trade with CA+MX; Canadian provinces show trade with all US states.</div></div>
        </>):(<div>
          <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"#01BAEF",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,marginBottom:12,padding:0}}>← Back</button>
          <div style={{background:"linear-gradient(135deg,#0A2540,#0F3460)",borderRadius:16,padding:24,color:"white",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}><span style={{fontSize:34}}>{FL[sel.flag]}</span><div><div style={{fontSize:26,fontWeight:700}}>{sel.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.45)"}}>Top: {sel.topExport} | {sel.currency} | {sel.flag==="us"?"Trade with Canada + Mexico":"Trade with all US states"}</div></div></div>
              <div style={{display:"flex",gap:2,background:"rgba(255,255,255,0.08)",borderRadius:10,padding:3}}>
                {[["current","📊 Current"],["forecast","🔮 Forecast"]].map(([id,label])=>(<button key={id} onClick={()=>setDetailView(id)} style={{padding:"8px 18px",borderRadius:8,border:"none",background:detailView===id?"rgba(1,186,239,0.2)":"transparent",color:detailView===id?"#01BAEF":"rgba(255,255,255,0.5)",fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer"}}>{label}</button>))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginTop:16}}>
              {(()=>{const u=sel.unit||"B";const chg=sel.t25-sel.t24;const chgStr=u==="M"?`${chg<0?"":"+"}$${Math.round(chg)}M`:`${chg<0?"":"+"}$${chg.toFixed(1)}B`;const scope=sel.flag==="us"?"↔ CA+MX":"↔ US";return [[`2024 Bilateral ${scope}`,`$${sel.t24}${u}`,"#01BAEF"],[`2025 Bilateral ${scope}`,`$${sel.t25}${u}`,"white"],["YoY Change",`${chgStr} (${sel.t24>0?((chg)/sel.t24*100).toFixed(0):0}%)`,sel.t25<sel.t24?"#FE6847":"#4CAF50"],["GDP Risk / Jobs at Risk",`${fmtM(sel.gdp)} / ${sel.jobs.toLocaleString()}`,"#FBB13C"]];})().map(([l,v,c],i)=>(
                <div key={i} style={{background:"rgba(255,255,255,0.06)",borderRadius:10,padding:12,border:"1px solid rgba(255,255,255,0.08)"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{l}</div><div style={{fontSize:i===3?14:20,fontWeight:700,color:c}}>{v}</div></div>))}
            </div>
          </div>
          {detailView==="current"&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
              <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:14}}>Industry Impact</div>
              <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={getDonut(sel)} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                {getDonut(sel).map((d,i)=><Cell key={d.name} fill={SC[d.name]||CL[i]}/>)}</Pie><Tooltip formatter={(v,n,p)=>[`$${v.toLocaleString()}M`,p.payload.name]}/></PieChart></ResponsiveContainer>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:8}}>{getDonut(sel).map((d,i)=>(<div key={d.name} style={{display:"flex",alignItems:"center",gap:5,fontSize:11}}><div style={{width:9,height:9,borderRadius:3,background:SC[d.name]||CL[i]}}/>{d.name} ({d.pct>0?"+":""}{d.pct}%)</div>))}</div>
            </div>
            <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
              <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:14}}>Sector Detail ({sel.currency} $M)</div>
              {Object.entries(sel.sectors).map(([k,v])=>{const max=Math.max(...Object.values(sel.sectors).map(s=>s.base),1);return(<div key={k} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{fontWeight:500}}>{k}</span><span style={{color:v.pct<0?"#F44336":"#4CAF50",fontWeight:600}}>{v.pct>0?"+":""}{v.pct}%</span></div>
                <div style={{position:"relative",height:8,background:"#EDF1F7",borderRadius:100,overflow:"hidden"}}><div style={{position:"absolute",height:"100%",borderRadius:100,width:`${(v.base/max)*100}%`,background:SC[k]||"#999",opacity:.3}}/><div style={{position:"absolute",height:"100%",borderRadius:100,width:`${(v.current/max)*100}%`,background:SC[k]||"#999"}}/></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#5A6B7C",marginTop:2}}><span>2024: ${v.base.toLocaleString()}M</span><span>2025: ${v.current.toLocaleString()}M</span></div>
              </div>);})}
            </div>
          </div>)}
          {detailView==="forecast"&&<FP/>}
        </div>)}</div>)}

        {tab==="total"&&(<div>
          <div style={{fontSize:24,fontWeight:700,color:"#0A2540",marginBottom:4}}>Total PNWER Tariff Impact — 2025</div>
          <div style={{fontSize:14,color:"#5A6B7C",marginBottom:24}}>Annual impact of 2025 U.S. tariffs on 5 PNWER states' bilateral trade with Canada and Mexico. Values in USD. Source: U.S. Census Bureau bilateral data + CES/Armington tariff model (v2, monthly-calibrated).</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
            {[[`$${US_T24.toFixed(1)}B`,"2024 Baseline (5 States ↔ CA+MX)","#01BAEF"],[`-$${(US_T24-US_T25).toFixed(1)}B`,"Total Trade Decline (USD)","#F44336"],[`$${(US_GDP/1000).toFixed(1)}B`,"GDP at Risk (IO Multiplier)","#FF9800"],[US_JOBS.toLocaleString(),"Jobs at Risk (Direct + Indirect)","#FE6847"]].map(([v,l,c],i)=>(
              <div key={i} style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:"18px 20px"}}><div style={{fontSize:10,color:"#5A6B7C",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{l}</div><div style={{fontSize:26,fontWeight:700,color:c}}>{v}</div></div>))}
          </div>

          {/* Monthly trend charts */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
            <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
              <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:14}}>Monthly Bilateral Trade — 5 States ↔ CA+MX ($M, USD)</div>
              <ResponsiveContainer width="100%" height={280}><AreaChart data={MONTHLY}><defs><linearGradient id="g24" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#01BAEF" stopOpacity={.15}/><stop offset="100%" stopColor="#01BAEF" stopOpacity={0}/></linearGradient><linearGradient id="g25" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FE6847" stopOpacity={.15}/><stop offset="100%" stopColor="#FE6847" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7"/><XAxis dataKey="m" tick={{fontSize:10}}/><YAxis tick={{fontSize:11}} domain={["auto","auto"]}/><Tooltip formatter={v=>`$${v?.toLocaleString()}M`} labelFormatter={(_,payload)=>payload?.[0]?.payload?.key||_}/>
                <Area type="monotone" dataKey="t24" name="Prev Year" stroke="#01BAEF" fill="url(#g24)" strokeWidth={2.5}/><Area type="monotone" dataKey="t25" name="Current" stroke="#FE6847" fill="url(#g25)" strokeWidth={2.5}/><Legend/></AreaChart></ResponsiveContainer>
            </div>
            <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
              <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:14}}>YoY Change (%)</div>
              <ResponsiveContainer width="100%" height={280}><BarChart data={MONTHLY.filter(d=>d.yoy!==0||d.key.startsWith("2025"))}><CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7"/><XAxis dataKey="m" tick={{fontSize:10}}/><YAxis tick={{fontSize:11}} domain={[-30,10]} tickFormatter={v=>`${v}%`}/><Tooltip formatter={v=>`${v}%`} labelFormatter={(_,payload)=>payload?.[0]?.payload?.key||_}/>
                <ReferenceLine y={0} stroke="#999"/>
                <Bar dataKey="yoy" name="YoY %" radius={[4,4,0,0]}>{MONTHLY.filter(d=>d.yoy!==0||d.key.startsWith("2025")).map((d,i)=><Cell key={i} fill={d.yoy<-10?"#F44336":d.yoy<-5?"#FF9800":d.yoy<0?"#FFC107":"#4CAF50"}/>)}</Bar></BarChart></ResponsiveContainer>
            </div>
          </div>

          {/* ── Industry Impact Table ── */}
          <div style={{fontSize:18,fontWeight:700,color:"#0A2540",marginBottom:4}}>Impact by Industry</div>
          <div style={{fontSize:11,color:"#5A6B7C",marginBottom:12}}>Model prediction vs Census actual for 5 US states ↔ CA+MX. Import side: ΔM = base × ε × τ. Export side: ΔX = base × ε × τ_ret. Values in USD millions.</div>
          <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:20,marginBottom:24}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{borderBottom:"2px solid #EDF1F7"}}>
                {["Industry","Imp Base ($M)","Imp Δ Model","Imp Δ Actual","Exp Base ($M)","Exp Δ Model","Exp Δ Actual","Total Base","Total Δ Actual","Chg %"].map(h=>(
                  <th key={h} style={{padding:"10px 8px",textAlign:h==="Industry"?"left":"right",color:"#5A6B7C",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>))}
              </tr></thead>
              <tbody>
                {INDS.map(ind => { const bi=integrated.by_industry[ind]; const lb=ind.charAt(0).toUpperCase()+ind.slice(1); const cl=SC[lb]||"#999";
                  const totalBase=bi.imp_base_M+bi.exp_base_M; const totalActual=bi.imp_actual_chg_M+bi.exp_actual_chg_M;
                  const pct=totalBase>0?(totalActual/totalBase*100):0;
                  return(<tr key={ind} style={{borderBottom:"1px solid #F3F5F9"}}>
                    <td style={{padding:"10px 8px"}}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:2,background:cl,display:"inline-block"}}/><span style={{fontWeight:600,color:"#0A2540"}}>{lb}</span></span></td>
                    <td style={{padding:"10px 8px",textAlign:"right"}}>{bi.imp_base_M.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right",color:"#FF9800"}}>{bi.imp_model_chg_M>0?"+":""}{bi.imp_model_chg_M.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right",color:bi.imp_actual_chg_M<0?"#F44336":"#4CAF50",fontWeight:600}}>{bi.imp_actual_chg_M>0?"+":""}{bi.imp_actual_chg_M.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right"}}>{bi.exp_base_M.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right",color:"#FF9800"}}>{bi.exp_model_chg_M>0?"+":""}{bi.exp_model_chg_M.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right",color:bi.exp_actual_chg_M<0?"#F44336":"#4CAF50",fontWeight:600}}>{bi.exp_actual_chg_M>0?"+":""}{bi.exp_actual_chg_M.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right",fontWeight:600}}>{totalBase.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right",color:totalActual<0?"#F44336":"#4CAF50",fontWeight:600}}>{totalActual>0?"+":""}{totalActual.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right"}}><span style={{fontWeight:700,color:pct<-10?"#F44336":pct<0?"#FF9800":"#4CAF50"}}>{pct>0?"+":""}{pct.toFixed(1)}%</span></td>
                  </tr>);
                })}
                {(()=>{ const s=integrated.summary; const totBase=Math.round(s.total_trade_2024_B*1000); const totActual=Math.round((s.actual_import_decline_M+s.actual_export_decline_M)); return(
                  <tr style={{borderTop:"2px solid #0A2540",fontWeight:700}}>
                    <td style={{padding:"10px 8px",color:"#0A2540"}}>Total</td>
                    <td style={{padding:"10px 8px",textAlign:"right"}}>{Math.round(s.total_trade_2024_B*1000/2).toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right",color:"#FF9800"}}>{s.import_decline_M.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right",color:"#F44336",fontWeight:600}}>{s.actual_import_decline_M.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right"}}>{Math.round(s.total_trade_2024_B*1000/2).toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right",color:"#FF9800"}}>{s.export_decline_M.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right",color:"#F44336",fontWeight:600}}>{s.actual_export_decline_M.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right"}}>{totBase.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right",color:"#F44336"}}>{totActual.toLocaleString()}</td>
                    <td style={{padding:"10px 8px",textAlign:"right"}}><span style={{fontWeight:700,color:"#F44336"}}>{s.total_trade_loss_pct.toFixed(1)}%</span></td>
                  </tr>);})()}
              </tbody>
            </table>
          </div>

          {/* ── Product Impact Table ── */}
          <div style={{fontSize:18,fontWeight:700,color:"#0A2540",marginBottom:4}}>Impact by Product (HS4)</div>
          <div style={{fontSize:11,color:"#5A6B7C",marginBottom:12}}>Top traded products across 5 US states ↔ CA+MX. Aggregated from Census Bureau HS4-level bilateral data. Values in USD millions.</div>
          <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:20,marginBottom:24}}>
            <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{borderBottom:"2px solid #EDF1F7"}}>
                {["HS4","Product","Industry","2024 ($M)","2025 ($M)","Δ ($M)","Δ (%)"].map(h=>(
                  <th key={h} style={{padding:"8px 10px",textAlign:["HS4","Product","Industry"].includes(h)?"left":"right",color:"#5A6B7C",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>))}
              </tr></thead>
              <tbody>
                {Object.entries(PD).sort((a,b)=>Math.abs(b[1].trade24-b[1].trade25)-Math.abs(a[1].trade24-a[1].trade25)).map(([hs4,d])=>{
                  const delta=d.trade25-d.trade24; const pct=d.trade24>0?(delta/d.trade24*100):0;
                  const cl=SC[d.ind.charAt(0).toUpperCase()+d.ind.slice(1)]||"#999"; return(
                  <tr key={hs4} style={{borderBottom:"1px solid #F3F5F9"}}>
                    <td style={{padding:"8px 10px",fontWeight:600,color:"#0A2540"}}>{hs4}</td>
                    <td style={{padding:"8px 10px",color:"#0A2540"}}>{d.name}</td>
                    <td style={{padding:"8px 10px"}}><span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:`${cl}15`,color:cl,fontWeight:600}}>{d.ind.charAt(0).toUpperCase()+d.ind.slice(1)}</span></td>
                    <td style={{padding:"8px 10px",textAlign:"right"}}>{d.trade24.toLocaleString()}</td>
                    <td style={{padding:"8px 10px",textAlign:"right",fontWeight:600}}>{d.trade25.toLocaleString()}</td>
                    <td style={{padding:"8px 10px",textAlign:"right",color:delta<0?"#F44336":delta>0?"#4CAF50":"#5A6B7C",fontWeight:600}}>{delta>0?"+":""}{delta.toLocaleString()}</td>
                    <td style={{padding:"8px 10px",textAlign:"right"}}><span style={{fontSize:11,fontWeight:700,color:pct<-10?"#F44336":pct<0?"#FF9800":pct>0?"#4CAF50":"#5A6B7C"}}>{pct>0?"+":""}{pct.toFixed(1)}%</span></td>
                  </tr>);})}
              </tbody>
            </table></div>
          </div>

          {/* ── PNWER Cross-Border: US States ↔ Canada ── */}
          <div style={{fontSize:18,fontWeight:700,color:"#0A2540",marginBottom:12}}>PNWER Cross-Border Trade (US ↔ Canada)</div>
          <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:20,marginBottom:24}}>
            <div style={{display:"flex",gap:14,marginBottom:16,flexWrap:"wrap"}}>
              {[[`$${(XB_T24/1e9).toFixed(1)}B`,"2024","#01BAEF"],[`$${(XB_T25/1e9).toFixed(1)}B`,"2025","#FE6847"],[`$${((XB_T25-XB_T24)/1e9).toFixed(1)}B`,"Decline","#F44336"],[`${(XB_T24>0?((XB_T25-XB_T24)/XB_T24*100):-0).toFixed(1)}%`,"YoY","#FF9800"]].map(([v,l,c],i)=>(
                <div key={i} style={{padding:"10px 18px",background:"#F7F9FC",borderRadius:10,border:"1px solid #EDF1F7"}}><div style={{fontSize:9,color:"#5A6B7C",textTransform:"uppercase",letterSpacing:.5}}>{l}</div><div style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#0A2540",marginBottom:8}}>By State (USD)</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{borderBottom:"2px solid #EDF1F7"}}>
                    {["State","Exp→CA","Imp←CA","2024 Total","2025 Total","Δ"].map(h=>(
                      <th key={h} style={{padding:"6px 6px",textAlign:h==="State"?"left":"right",color:"#5A6B7C",fontSize:9,fontWeight:600}}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {XBORDER_STATES.map(d=>(
                      <tr key={d.id} style={{borderBottom:"1px solid #F7F9FC"}}>
                        <td style={{padding:"6px",fontWeight:600,color:"#0A2540"}}>{d.id}</td>
                        <td style={{padding:"6px",textAlign:"right"}}>${(d.exp24/1e9).toFixed(1)}B</td>
                        <td style={{padding:"6px",textAlign:"right"}}>${(d.imp24/1e9).toFixed(1)}B</td>
                        <td style={{padding:"6px",textAlign:"right"}}>${(d.t24/1e9).toFixed(1)}B</td>
                        <td style={{padding:"6px",textAlign:"right",fontWeight:600}}>${(d.t25/1e9).toFixed(1)}B</td>
                        <td style={{padding:"6px",textAlign:"right",color:d.delta<0?"#F44336":"#4CAF50",fontWeight:600}}>${(d.delta/1e9).toFixed(1)}B</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#0A2540",marginBottom:8}}>By Industry (USD)</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{borderBottom:"2px solid #EDF1F7"}}>
                    {["Industry","2024","2025","Δ","Δ%"].map(h=>(
                      <th key={h} style={{padding:"6px 6px",textAlign:h==="Industry"?"left":"right",color:"#5A6B7C",fontSize:9,fontWeight:600}}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {XBORDER_IND.map(d=>{const cl=SC[d.ind.charAt(0).toUpperCase()+d.ind.slice(1)]||"#999"; return(
                      <tr key={d.ind} style={{borderBottom:"1px solid #F7F9FC"}}>
                        <td style={{padding:"6px"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:2,background:cl}}/>{d.ind.charAt(0).toUpperCase()+d.ind.slice(1)}</span></td>
                        <td style={{padding:"6px",textAlign:"right"}}>${(d.t24/1e6).toLocaleString()}M</td>
                        <td style={{padding:"6px",textAlign:"right",fontWeight:600}}>${(d.t25/1e6).toLocaleString()}M</td>
                        <td style={{padding:"6px",textAlign:"right",color:d.delta<0?"#F44336":"#4CAF50",fontWeight:600}}>${(d.delta/1e6).toLocaleString()}M</td>
                        <td style={{padding:"6px",textAlign:"right",fontWeight:700,color:d.pct<-15?"#F44336":d.pct<0?"#FF9800":"#4CAF50"}}>{d.pct>0?"+":""}{d.pct.toFixed(1)}%</td>
                      </tr>);})}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{marginTop:12,fontSize:10,color:"#5A6B7C",lineHeight:1.5}}>Source: U.S. Census Bureau bilateral trade data. Shows PNWER 5 US states' trade with Canada specifically (not Mexico). This represents 22% of Canada's total US trade. CA province data covers all 50 US states.</div>
          </div>

          {/* ── Three-Factor Decomposition ── */}
          <div style={{fontSize:18,fontWeight:700,color:"#0A2540",marginBottom:12}}>Trade Decline Decomposition</div>
          <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              {[["US 5 States (USD)",DECOMP.us,"Oil Price (WTI -15.7%)"],["CA 5 Provinces (CAD)",DECOMP.ca,"Energy Market (price + volume)"]].map(([title,d,oilLabel])=>(
                <div key={title}><div style={{fontSize:13,fontWeight:600,color:"#0A2540",marginBottom:10}}>{title}</div>
                  {[["Tariff effect",d.tariff,"#F44336"],[oilLabel,d.oil,"#FF9800"],["Residual",d.residual,d.residual>=0?"#4CAF50":"#607D8B"]].map(([l,v,c])=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><div style={{width:12,height:12,borderRadius:3,background:c,flexShrink:0}}/><div style={{flex:1,fontSize:13}}>{l}</div><div style={{fontSize:15,fontWeight:700,color:c}}>${v}B ({Math.abs(Math.round(v/d.total*100))}%)</div></div>
                  ))}<div style={{borderTop:"1px solid #EDF1F7",paddingTop:8,marginTop:4,fontSize:14,fontWeight:700}}>Total: ${d.total}B</div></div>))}
            </div>
          </div>
        </div>)}

        {tab==="modeling"&&(<div>
          <div style={{fontSize:24,fontWeight:700,color:"#0A2540",marginBottom:4}}>Econometric Modeling</div>
          <div style={{fontSize:14,color:"#5A6B7C",marginBottom:24}}>Three-layer framework: DID → Triple-DID → CES/Armington. Pre: 2017–2019, Post: 2021–2025.</div>
          <div style={{display:"flex",gap:2,background:"#EDF1F7",borderRadius:10,padding:3,width:"fit-content",marginBottom:20}}>
            {[["did","Layer 1: National DID"],["ddd","Layer 2: State DDD"],["tariff","Layer 3: CES/Armington"]].map(([id,label])=>(
              <button key={id} onClick={()=>setMdl(id)} style={{padding:"9px 20px",borderRadius:8,border:"none",background:mdl===id?"white":"transparent",color:mdl===id?"#0A2540":"#5A6B7C",fontFamily:"inherit",fontSize:13,fontWeight:500,cursor:"pointer",boxShadow:mdl===id?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>{label}</button>))}
          </div>

          {/* ══ LAYER 1: National DID ══ */}
          {mdl==="did"&&(<div>
            <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24,marginBottom:20}}>
              <div style={{fontWeight:600,fontSize:16,color:"#0A2540",marginBottom:6}}>Layer 1: National DID — Overall USMCA Effect</div>
              <div style={{fontSize:12,color:"#5A6B7C",marginBottom:16,lineHeight:1.6}}>
                Model: ln(X<sub>pt</sub>) = β(USMCA<sub>p</sub> × Post<sub>t</sub>) + FE<sub>p</sub> + FE<sub>t</sub> + ε<sub>pt</sub><br/>
                Treatment: CA, MX &nbsp;|&nbsp; Control: JP, KR, UK, DE &nbsp;|&nbsp; Pre: 2017–2019, Post: 2021–2025
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
                <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:14}}>Descriptive Statistics</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{borderBottom:"2px solid #EDF1F7"}}>
                    <th style={{padding:"8px 10px",textAlign:"left",color:"#5A6B7C",fontSize:10,fontWeight:600}}>GROUP</th>
                    <th style={{padding:"8px 10px",textAlign:"right",color:"#5A6B7C",fontSize:10,fontWeight:600}}>PRE AVG</th>
                    <th style={{padding:"8px 10px",textAlign:"right",color:"#5A6B7C",fontSize:10,fontWeight:600}}>POST AVG</th>
                    <th style={{padding:"8px 10px",textAlign:"right",color:"#5A6B7C",fontSize:10,fontWeight:600}}>GROWTH</th>
                  </tr></thead>
                  <tbody>
                    <tr style={{borderBottom:"1px solid #F3F5F9"}}><td style={{padding:"10px",fontWeight:600,color:"#0A2540"}}>🇺🇸🇨🇦🇲🇽 USMCA</td><td style={{padding:"10px",textAlign:"right"}}>$273.6B</td><td style={{padding:"10px",textAlign:"right"}}>$324.9B</td><td style={{padding:"10px",textAlign:"right",color:"#4CAF50",fontWeight:600}}>+18.8%</td></tr>
                    <tr style={{borderBottom:"1px solid #F3F5F9"}}><td style={{padding:"10px",fontWeight:600,color:"#0A2540"}}>🌐 Control (JP/KR/UK/DE)</td><td style={{padding:"10px",textAlign:"right"}}>$61.9B</td><td style={{padding:"10px",textAlign:"right"}}>$73.2B</td><td style={{padding:"10px",textAlign:"right",color:"#4CAF50",fontWeight:600}}>+18.3%</td></tr>
                    <tr style={{borderTop:"2px solid #0A2540"}}><td style={{padding:"10px",fontWeight:700,color:"#0A2540"}}>Simple DID</td><td/><td/><td style={{padding:"10px",textAlign:"right",fontWeight:700,color:"#5A6B7C"}}>+0.5%</td></tr>
                  </tbody>
                </table>
              </div>
              <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
                <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:14}}>Regression Results</div>
                {[["β (USMCA × Post)","-0.12%","DID coefficient — USMCA effect on national trade","#F44336"],["95% CI","[-13.1%, +14.7%]","Wide interval — low precision at national level","#5A6B7C"],["p-value","0.983","Cannot reject null: no significant effect","#FF9800"],["Observations","48","6 countries × 8 years","#01BAEF"],["Cluster SE","Partner-level","Robust to within-partner correlation","#5A6B7C"]].map(([label,val,desc,clr],i)=>(
                  <div key={i} style={{padding:"10px 14px",background:"#F7F9FC",borderRadius:10,marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                    <div style={{minWidth:100}}><div style={{fontSize:10,color:"#5A6B7C"}}>{label}</div><div style={{fontSize:16,fontWeight:700,color:clr}}>{val}</div></div>
                    <div style={{fontSize:11,color:"#5A6B7C"}}>{desc}</div>
                  </div>))}
                <div style={{marginTop:12,padding:"10px 14px",background:"rgba(255,152,0,0.06)",borderRadius:8,border:"1px solid rgba(255,152,0,0.15)",fontSize:11,color:"#5A6B7C",lineHeight:1.6}}>
                  <b style={{color:"#FF9800"}}>Interpretation:</b> USMCA did not produce a statistically significant change in U.S. exports to member countries at the national level. Both treatment and control groups grew ~18%. This motivates Layer 2 — the benefit may be heterogeneous across states.
                </div>
              </div>
            </div>
          </div>)}

          {/* ══ LAYER 2: State DDD ══ */}
          {mdl==="ddd"&&(<div>
            <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24,marginBottom:20}}>
              <div style={{fontWeight:600,fontSize:16,color:"#0A2540",marginBottom:6}}>Layer 2: State Triple-DID — PNWER Heterogeneous Effect</div>
              <div style={{fontSize:12,color:"#5A6B7C",marginBottom:8,lineHeight:1.6}}>
                Model: ln(X<sub>spt</sub>) = θ(PNWER<sub>s</sub> × USMCA<sub>p</sub> × Post<sub>t</sub>) + FE<sub>s,t</sub> + FE<sub>s,p</sub> + FE<sub>p,t</sub> + ε<sub>spt</sub><br/>
                Three-way crossed FE: State×Year (200) + State×Partner (150) + Partner×Year (48)
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
              <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
                <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:14}}>DDD Descriptive Decomposition</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{borderBottom:"2px solid #EDF1F7"}}>
                    {["State Group","USMCA Growth","Control Growth","Within-DID"].map(h=>(
                      <th key={h} style={{padding:"8px",textAlign:h==="State Group"?"left":"right",color:"#5A6B7C",fontSize:10,fontWeight:600}}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    <tr style={{borderBottom:"1px solid #F3F5F9"}}><td style={{padding:"10px 8px",fontWeight:600,color:"#0A2540"}}>PNWER (5 states)</td><td style={{padding:"10px 8px",textAlign:"right",color:"#4CAF50",fontWeight:600}}>+37.7%</td><td style={{padding:"10px 8px",textAlign:"right",color:"#F44336"}}>-16.7%</td><td style={{padding:"10px 8px",textAlign:"right",fontWeight:700,color:"#01BAEF"}}>+54.4%</td></tr>
                    <tr style={{borderBottom:"1px solid #F3F5F9"}}><td style={{padding:"10px 8px",fontWeight:600,color:"#0A2540"}}>Non-PNWER (20 states)</td><td style={{padding:"10px 8px",textAlign:"right",color:"#4CAF50"}}>+18.0%</td><td style={{padding:"10px 8px",textAlign:"right",color:"#4CAF50"}}>+22.1%</td><td style={{padding:"10px 8px",textAlign:"right",color:"#F44336"}}>-4.1%</td></tr>
                    <tr style={{borderTop:"2px solid #0A2540"}}><td style={{padding:"10px 8px",fontWeight:700}}>Simple DDD</td><td/><td/><td style={{padding:"10px 8px",textAlign:"right",fontWeight:700,color:"#0A2540",fontSize:16}}>+58.5%</td></tr>
                  </tbody>
                </table>
              </div>
              <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
                <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:14}}>Regression Results</div>
                {[["🎯","θ (PNWER×USMCA×Post)","+58.81%","PNWER states gained ~59% more from USMCA"],["📊","p-value","0.031","Significant at 5% level **"],["📐","t-statistic","2.286","Cluster-robust (by state, df=24)"],["📏","95% CI","[+4.6%, +141.1%]","Wide but positive — excludes zero"],["🔢","Observations","1,200","25 states × 6 partners × 8 years"],["📈","R² (within)","0.038","Low R² typical for high-dimensional FE models"]].map(([icon,label,val,desc],i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:i===0?"rgba(1,186,239,0.04)":"#F7F9FC",borderRadius:8,marginBottom:6,border:i===0?"1px solid rgba(1,186,239,0.15)":"none"}}>
                    <span style={{fontSize:20}}>{icon}</span>
                    <div style={{flex:1}}><div style={{fontSize:10,color:"#5A6B7C"}}>{label}</div><div style={{fontSize:i===0?18:15,fontWeight:700,color:i===0?"#01BAEF":"#0A2540"}}>{val}</div></div>
                    <div style={{fontSize:10,color:"#5A6B7C",maxWidth:200}}>{desc}</div>
                  </div>))}
              </div>
            </div>
            {/* Jurisdiction comparison chart */}
            <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
              <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:14}}>2024 vs 2025 Trade by Jurisdiction ($B)</div>
              <ResponsiveContainer width="100%" height={300}><BarChart data={ALL.filter(j=>j.t24>0.5).map(j=>({id:j.id,"2024":j.t24,"2025":j.t25}))} barGap={4}><CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7"/><XAxis dataKey="id" tick={{fontSize:12}}/><YAxis tick={{fontSize:12}} tickFormatter={v=>`$${v}B`}/><Tooltip formatter={v=>`$${v}B`}/><Bar dataKey="2024" fill="#01BAEF" radius={[4,4,0,0]}/><Bar dataKey="2025" fill="#FE6847" radius={[4,4,0,0]} opacity={.8}/><Legend/></BarChart></ResponsiveContainer>
            </div>
          </div>)}

          {/* ══ LAYER 3: CES/Armington Tariff Model ══ */}
          {mdl==="tariff"&&(<div>
            <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24,marginBottom:20}}>
              <div style={{fontWeight:600,fontSize:16,color:"#0A2540",marginBottom:6}}>Layer 3: CES/Armington Bilateral Tariff Model</div>
              <div style={{fontSize:12,color:"#5A6B7C",lineHeight:1.6}}>
                Import side: ΔM = M<sub>base</sub> × ε<sub>imp</sub> × κ<sub>agg</sub> × τ<sub>eff</sub> &nbsp;|&nbsp;
                Export side: ΔX = X<sub>base</sub> × ε<sub>exp</sub> × τ<sub>ret</sub><br/>
                Elasticities back-calibrated from H2 2025 Census data. Oil price adjustment via WTI residual method.
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
              {/* Model vs Actual */}
              <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
                <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:14}}>Model Validation — US 5 States</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{borderBottom:"2px solid #EDF1F7"}}>
                    {["Metric","Model","Actual","Accuracy"].map(h=>(
                      <th key={h} style={{padding:"8px",textAlign:h==="Metric"?"left":"right",color:"#5A6B7C",fontSize:10,fontWeight:600}}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {[["Import decline",`$${integrated.summary.import_decline_M.toLocaleString()}M`,`$${integrated.summary.actual_import_decline_M.toLocaleString()}M`,`${Math.round(integrated.summary.import_decline_M/integrated.summary.actual_import_decline_M*100)}%`],
                      ["Export decline",`$${integrated.summary.export_decline_M.toLocaleString()}M`,`$${integrated.summary.actual_export_decline_M.toLocaleString()}M`,`${Math.round(integrated.summary.export_decline_M/integrated.summary.actual_export_decline_M*100)}%`],
                      ["Total trade loss",`$${(integrated.summary.import_decline_M+integrated.summary.export_decline_M).toLocaleString()}M`,`$${(integrated.summary.actual_import_decline_M+integrated.summary.actual_export_decline_M).toLocaleString()}M`,`${Math.round((integrated.summary.import_decline_M+integrated.summary.export_decline_M)/(integrated.summary.actual_import_decline_M+integrated.summary.actual_export_decline_M)*100)}%`],
                      ["GDP at risk",`$${integrated.summary.gdp_at_risk_M.toLocaleString()}M`,"—","—"],
                      ["Jobs at risk",integrated.summary.jobs_at_risk.toLocaleString(),"—","—"],
                    ].map(([metric,model,actual,acc],i)=>(
                      <tr key={i} style={{borderBottom:"1px solid #F3F5F9"}}>
                        <td style={{padding:"10px 8px",fontWeight:600,color:"#0A2540"}}>{metric}</td>
                        <td style={{padding:"10px 8px",textAlign:"right",color:"#FF9800"}}>{model}</td>
                        <td style={{padding:"10px 8px",textAlign:"right",color:"#F44336",fontWeight:600}}>{actual}</td>
                        <td style={{padding:"10px 8px",textAlign:"right",fontWeight:600,color:acc!=="—"?"#4CAF50":"#5A6B7C"}}>{acc}</td>
                      </tr>))}
                  </tbody>
                </table>

                {/* Per-industry accuracy */}
                <div style={{fontWeight:600,fontSize:12,color:"#0A2540",marginTop:16,marginBottom:8}}>By Industry</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{borderBottom:"1px solid #EDF1F7"}}>
                    {["Industry","Model Δ","Actual Δ","Acc"].map(h=>(
                      <th key={h} style={{padding:"5px 6px",textAlign:h==="Industry"?"left":"right",color:"#5A6B7C",fontSize:9,fontWeight:600}}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {INDS.map(ind=>{const bi=integrated.by_industry[ind]||{}; const m=(bi.imp_model_chg_M||0)+(bi.exp_model_chg_M||0); const a=(bi.imp_actual_chg_M||0)+(bi.exp_actual_chg_M||0); const acc=a!==0?Math.round(m/a*100):0; const cl=SC[ind.charAt(0).toUpperCase()+ind.slice(1)]||"#999"; return(
                      <tr key={ind} style={{borderBottom:"1px solid #F7F9FC",background:ind==="energy"?"rgba(255,152,0,0.04)":"transparent"}}>
                        <td style={{padding:"5px 6px"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:2,background:cl}}/>{ind}{ind==="energy"&&<span style={{fontSize:8,color:"#FF9800",marginLeft:4}}>⚠</span>}</span></td>
                        <td style={{padding:"5px 6px",textAlign:"right"}}>${m.toLocaleString()}M</td>
                        <td style={{padding:"5px 6px",textAlign:"right"}}>${a.toLocaleString()}M</td>
                        <td style={{padding:"5px 6px",textAlign:"right",fontWeight:600,color:Math.abs(acc-100)<30?"#4CAF50":Math.abs(acc-100)<60?"#FF9800":"#F44336"}}>{acc}%</td>
                      </tr>);})}
                  </tbody>
                </table>

                {/* Energy exclusion note */}
                <div style={{marginTop:12,padding:"10px 14px",background:"rgba(255,152,0,0.06)",borderRadius:8,border:"1px solid rgba(255,152,0,0.15)",fontSize:11,color:"#5A6B7C",lineHeight:1.6}}>
                  <b style={{color:"#FF9800"}}>⚠ Why energy accuracy is low:</b> Energy trade is dominated by oil price movements (WTI -15.7%), not tariffs. Pipeline crude is USMCA-exempt (τ ≈ 0%), so the tariff model correctly predicts minimal tariff impact. The large actual decline is price-driven and captured separately in the three-factor decomposition. <b>Excluding energy, US model accuracy is ~98% and CA is ~106%.</b>
                </div>
              </div>
              {/* Key parameters */}
              <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
                <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:4}}>Calibrated Parameters (v2 — Monthly)</div>
                <div style={{fontSize:10,color:"#5A6B7C",marginBottom:12}}>Elasticities re-calibrated from Apr-Dec 2025 monthly Census data with seasonal adjustment. AGG_SCALE removed — ε now directly reflects market response including USMCA exemptions.</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{borderBottom:"2px solid #EDF1F7"}}>
                    {["Industry","ε_imp (v1→v2)","ε_exp (v1→v2)","τ_imp CA","τ_imp MX","τ_ret CA","τ_ret MX"].map(h=>(
                      <th key={h} style={{padding:"6px 8px",textAlign:h==="Industry"?"left":"right",color:"#5A6B7C",fontSize:9,fontWeight:600}}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {[["Agriculture","-1.5 → -1.9","-1.2 → -1.0","21.5%","17.3%","6.0%","4.0%"],
                      ["Energy","-0.5 → -0.5","-0.3 → -0.3","10.0%","0%","8.0%","3.0%"],
                      ["Forestry","-1.2 → -1.3","-1.0 → -1.2","23.6%","0%","14.0%","8.0%"],
                      ["Minerals","-0.8 → -0.8","-0.6 → -0.6","33.9%","15.1%","6.0%","5.0%"],
                      ["Manufacturing","-2.0 → -1.0","-1.5 → -1.4","4.1%","4.8%","17.0%","15.0%"],
                      ["Other","-1.5 → -1.1","-1.2 → -1.5","5.8%","4.6%","12.0%","11.0%"]
                    ].map(([ind,ei,ee,tiCA,tiMX,teCA,teMX],i)=>{const cl=SC[ind]||"#999"; return(
                      <tr key={i} style={{borderBottom:"1px solid #F3F5F9"}}>
                        <td style={{padding:"6px 8px"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:2,background:cl}}/>{ind}</span></td>
                        <td style={{padding:"6px 8px",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{ei}</td>
                        <td style={{padding:"6px 8px",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{ee}</td>
                        <td style={{padding:"6px 8px",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{tiCA}</td>
                        <td style={{padding:"6px 8px",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{tiMX}</td>
                        <td style={{padding:"6px 8px",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{teCA}</td>
                        <td style={{padding:"6px 8px",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{teMX}</td>
                      </tr>);})}
                  </tbody>
                </table>
                <div style={{marginTop:10,fontSize:10,color:"#5A6B7C",lineHeight:1.5}}>
                  <b>v2 changes:</b> Manufacturing ε_imp: -2.0→-1.0 (v1 overestimated; USMCA compliance shields most mfg). Agriculture ε_imp: -1.5→-1.9 (monthly shows higher sensitivity). κ_agg removed (was a fudge factor for inaccurate ε). τ_imp: annualized effective rates. τ_ret: estimated retaliatory rates.
                </div>
              </div>
            </div>
            {/* Three-Factor Decomposition */}
            <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
              <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:14}}>Three-Factor Trade Decline Decomposition</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                {[["US 5 States (USD)",DECOMP.us,"Oil Price (WTI -15.7%)"],["CA 5 Provinces (CAD)",DECOMP.ca,"Energy Market (price + volume)"]].map(([title,d,oilLabel])=>(
                  <div key={title}><div style={{fontSize:13,fontWeight:600,color:"#0A2540",marginBottom:10}}>{title}</div>
                    {[["Tariff effect",d.tariff,"#F44336"],[oilLabel,d.oil,"#FF9800"],["Residual",d.residual,d.residual>=0?"#4CAF50":"#607D8B"]].map(([l,v,c])=>(
                      <div key={l} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><div style={{width:12,height:12,borderRadius:3,background:c,flexShrink:0}}/><div style={{flex:1,fontSize:13}}>{l}</div><div style={{fontSize:15,fontWeight:700,color:c}}>${v}B ({Math.abs(Math.round(v/d.total*100))}%)</div></div>
                    ))}<div style={{borderTop:"1px solid #EDF1F7",paddingTop:8,marginTop:4,fontSize:14,fontWeight:700}}>Total: ${d.total}B</div></div>))}
              </div>
              <div style={{marginTop:14,fontSize:10,color:"#5A6B7C",lineHeight:1.5}}>US: WTI direct method (price × base). CA: Energy residual method (actual energy Δ - tariff model) — captures both oil price decline and Trans Mountain pipeline volume increase. Residual includes supply chain restructuring and exchange rate effects.</div>
            </div>
          </div>)}
        </div>)}

        {tab==="reports"&&(<div>
          <div style={{fontSize:24,fontWeight:700,color:"#0A2540",marginBottom:4}}>AI-Powered Policy Reports</div>
          <div style={{fontSize:14,color:"#5A6B7C",marginBottom:24}}>Groq AI generates tailored reports using real model data and analysis results.</div>
          <ReportBuilder forecast={forecast} integrated={integrated} srcData={srcData} usCurrent={usCurrent} usAnnual={usAnnual} DECOMP={DECOMP} US={US} CA={CA} ALL={ALL} SC={SC} MONTHLY={MONTHLY} savedReports={savedReports} onSaveReport={(type,data)=>setSavedReports(prev=>({...prev,[type]:data}))} />
        </div>)}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// REPORT BUILDER — LLM-powered report generation via Anthropic API
// ══════════════════════════════════════════════════════════════

function ReportBuilder({ forecast, integrated, srcData, usCurrent, usAnnual, DECOMP, US, CA, ALL, SC, MONTHLY, savedReports, onSaveReport }) {
  const [rType, setRType] = useState("impact");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [rCA, setRCA] = useState(15);
  const [rMX, setRMX] = useState(12);
  const [reportFc, setReportFc] = useState(forecast);  // forecast used for report
  const report = savedReports[rType] || null;
  const setReport = (r) => onSaveReport(rType, r);

  const fc = (rType === "forecast" ? reportFc : forecast) || {};
  const fcMeta = fc.metadata || {};
  const fcTot = fc.totals || {current:0,predicted:0,delta:0,gdp:0,jobs:0};
  const fcInd = fc.by_industry || {};
  const fcProd = fc.by_product || {};
  const intSum = integrated.summary || {};
  const intDec = integrated.decomposition || {};
  const intInd = integrated.by_industry || {};

  const buildImpactContext = () => {
    const stateLines = US.map(j => `${j.name}: $${j.t24}B→$${j.t25}B (${((j.t25-j.t24)/j.t24*100).toFixed(1)}%), GDP risk $${j.gdp}M, ${j.jobs.toLocaleString()} jobs`).join("\n");
    const indLines = INDS.map(ind => {
      const d = intInd[ind] || {};
      return `${ind}: base $${((d.imp_base_M||0)+(d.exp_base_M||0))}M, actual Δ $${((d.imp_actual_chg_M||0)+(d.exp_actual_chg_M||0)).toFixed(0)}M, model Δ $${((d.imp_model_chg_M||0)+(d.exp_model_chg_M||0)).toFixed(0)}M`;
    }).join("\n");
    const monthLines = MONTHLY.slice(-6).map(m => `${m.key}: $${m.t25}M (YoY ${m.yoy}%)`).join("\n");
    return `PNWER Tariff Impact & USMCA Analysis Data\n\nHEADLINE:\n- Trade: $${intSum.total_trade_2024_B}B (2024) → $${intSum.total_trade_2025_B}B (2025) = $${intSum.total_trade_loss_B}B (${intSum.total_trade_loss_pct}%)\n- GDP at Risk: $${(intSum.gdp_at_risk_M/1000).toFixed(1)}B\n- Jobs at Risk: ${intSum.jobs_at_risk?.toLocaleString()}\n\nDECOMPOSITION:\n- Tariff: $${intDec.tariff_effect_B}B (${intDec.tariff_share_pct}%)\n- Oil (WTI -15.7%): $${intDec.oil_price_effect_B}B (${intDec.oil_share_pct}%)\n- Residual: $${intDec.residual_B}B (${intDec.residual_share_pct}%)\n\nECONOMETRICS:\n- Layer 1 DID: β=-0.12%, p=0.98 (not significant nationally)\n- Layer 2 DDD: θ=+58.81%, p=0.031 (PNWER significant at 5%)\n- Layer 3: CES/Armington v2 monthly-calibrated\n\nBY STATE:\n${stateLines}\n\nBY INDUSTRY:\n${indLines}\n\nMONTHLY TREND:\n${monthLines}\n\nTARIFF TIMELINE: IEEPA Feb 4, USMCA exempt Mar 7, S232 steel/alum Mar 12, S232 auto May 3, S232 50% Jun 4, IEEPA 35% Aug 1, S232 timber Oct 14\n\nENERGY NOTE: Energy industry shows low model accuracy because pipeline crude is USMCA-exempt (tariff ≈ 0%). The actual energy trade decline is driven by WTI oil price drop (-15.7%), NOT tariffs. This is captured in the three-factor decomposition as "Oil Price" (US) or "Energy Market" (CA). Excluding energy, model accuracy is ~98% for US and ~106% for CA. For CA, the energy market adjustment also includes Trans Mountain pipeline volume increases.\n\nUSMCA REVIEW: July 2026. θ=+59% means PNWER states benefited most and have most to lose.`;
  };

  const buildForecastContext = () => buildForecastContextWith(fc);

  const buildForecastContextWith = (f) => {
    const fm = f.metadata||{}; const ft = f.totals||{}; const fi = f.by_industry||{}; const fp = f.by_product||{};
    const indLines = Object.entries(fi).map(([ind,d]) => `${ind}: current $${(d.current/1e6).toFixed(0)}M, predicted $${(d.predicted/1e6).toFixed(0)}M, Δ $${(d.delta/1e6).toFixed(0)}M (${d.pct_change}%)`).join("\n");
    const prodLines = Object.entries(fp).map(([hs4,d]) => `${hs4} ${d.name}: current $${(d.current/1e6).toFixed(0)}M → $${(d.predicted/1e6).toFixed(0)}M (${d.pct_change}%)`).join("\n");
    return `PNWER Monthly Forecast Data\n\nSCENARIO: CA tariff ${rCA}%, MX tariff ${rMX}%\nFORECAST: ${fm.baseline_label||"N/A"} → ${fm.predicted_label||"N/A"}\nTariffs: CA=${fm.tariff_ca||rCA+"%"}, MX=${fm.tariff_mx||rMX+"%"}\nModel: ${fm.model||"CES/Armington v2"}\n\nTOTALS: Current $${((ft.current||0)/1e6).toFixed(0)}M, Predicted $${((ft.predicted||0)/1e6).toFixed(0)}M, Delta $${((ft.delta||0)/1e6).toFixed(0)}M\n\nBY INDUSTRY:\n${indLines}\n\nBY PRODUCT:\n${prodLines}\n\nTREND (last 6 months):\n${MONTHLY.slice(-6).map(m => `${m.key}: $${m.t25}M (YoY ${m.yoy}%, MoM ${m.mom}%)`).join("\n")}`;
  };

  const handleGenerate = async () => {
    setGenerating(true); setReport(null); setError(null);
    const isImpact = rType === "impact";

    // For forecast reports, fetch fresh forecast with slider tariff rates
    let activeFc = fc;
    if (!isImpact) {
      try {
        const fcRes = await fetch(`${API}/api/forecast?ca=${rCA}&mx=${rMX}`);
        if (fcRes.ok) {
          const fcData = await fcRes.json();
          if (!fcData.error) { setReportFc(fcData); activeFc = fcData; }
        }
      } catch(e) { /* use existing forecast */ }
    }

    // Rebuild context with fresh data
    const context = isImpact ? buildImpactContext() : buildForecastContextWith(activeFc);
    const sysPrompt = isImpact
      ? "You are a trade policy analyst writing for PNWER leadership ahead of the July 2026 USMCA review. Write a professional, data-driven report. Use exact numbers from the data. Return ONLY valid JSON with keys: executive_summary (string), trade_impact (string), decomposition (string), usmca_significance (string), risks (array of strings), recommendations (array of strings). No markdown, no backticks."
      : "You are a trade analyst writing a monthly forecast brief for PNWER stakeholders. The user has set custom tariff rates — analyze impact at these specific rates. Use exact numbers from the data. Return ONLY valid JSON with keys: forecast_summary (string), industry_outlook (string), product_highlights (string), trend_analysis (string), watch_items (array of strings). No markdown, no backticks.";
    try {
      const res = await fetch(`${API}/api/report`, {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, system: sysPrompt, messages: [{role:"user",content:context}] }),
      });
      const data = await res.json();
      // Check for API-level errors
      if (data.error) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      if (data.type === "error") throw new Error(data.error?.message || JSON.stringify(data));
      const text = (data.content||[]).map(b=>b.text||"").join("");
      if (!text) throw new Error("Empty response from AI. Check API key and model access.");
      const clean = text.replace(/```json|```/g,"").trim();
      try {
        setReport({ type: rType, narrative: JSON.parse(clean), generated_at: new Date().toISOString() });
      } catch(parseErr) {
        throw new Error("Failed to parse report JSON. Raw response: " + clean.slice(0, 200));
      }
    } catch(e) { setError(e.message); }
    finally { setGenerating(false); }
  };

  const Bullet = ({index,text}) => (
    <div style={{display:"flex",alignItems:"flex-start",gap:10,background:"#F7F9FC",borderRadius:8,padding:"10px 14px",border:"1px solid #EDF1F7",marginBottom:8}}>
      <div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,background:"linear-gradient(135deg,#01BAEF,#20BF55)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:10,fontWeight:700}}>{index+1}</div>
      <span style={{fontSize:13,color:"#3A4A5C",lineHeight:1.65}}>{text}</span>
    </div>);
  const ST = ({children}) => (<div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:2.5,color:"#0B4F6C",marginBottom:12,paddingBottom:6,borderBottom:"2px solid #EDF1F7"}}>{children}</div>);
  const Prose = ({children}) => (<p style={{fontSize:13.5,lineHeight:1.85,color:"#3A4A5C",whiteSpace:"pre-wrap"}}>{children}</p>);
  const Sec = ({children}) => (<div style={{marginBottom:28,paddingBottom:24,borderBottom:"1px solid #F0F4F8"}}>{children}</div>);

  return (
    <div>
      {/* Top bar: report type selector + generate button */}
      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:rType==="forecast"?12:24,flexWrap:"wrap"}}>
        {[["impact","📋","Tariff Impact & USMCA"],["forecast","🔮","Monthly Forecast Brief"]].map(([id,icon,title])=>(
          <div key={id} onClick={()=>{setRType(id);setError(null);}} style={{background:"white",border:rType===id?"2px solid #01BAEF":"2px solid #E4EAF0",borderRadius:10,padding:"10px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,transition:"all 0.2s"}}>
            <span style={{fontSize:18}}>{icon}</span><span style={{fontWeight:600,fontSize:13,color:rType===id?"#0A2540":"#5A6B7C"}}>{title}</span>
            {savedReports[id] && <span style={{width:8,height:8,borderRadius:"50%",background:"#20BF55",flexShrink:0}}/>}
          </div>))}
        <button onClick={handleGenerate} disabled={generating} style={{display:"flex",alignItems:"center",gap:8,background:generating?"#E4EAF0":"linear-gradient(135deg,#0A2540,#0F3460)",color:generating?"#5A6B7C":"white",border:"none",borderRadius:10,padding:"10px 22px",fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:generating?"not-allowed":"pointer",marginLeft:"auto"}}>
          {generating?<><span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⏳</span>Generating...</>:"✨ Generate Report"}</button>
      </div>

      {/* Tariff sliders for forecast mode */}
      {rType==="forecast"&&(
        <div style={{display:"flex",gap:20,marginBottom:24,padding:"16px 20px",background:"white",borderRadius:12,border:"1px solid #E4EAF0",alignItems:"center",flexWrap:"wrap"}}>
          <div style={{fontSize:12,fontWeight:600,color:"#0A2540"}}>Tariff Scenario</div>
          <div style={{flex:"1 1 200px",minWidth:180}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{color:"#5A6B7C"}}>🇨🇦 Canada</span><span style={{fontWeight:700,color:"#0A2540"}}>{rCA}%</span></div>
            <input type="range" min={0} max={50} value={rCA} onChange={e=>setRCA(+e.target.value)} style={{width:"100%",accentColor:"#F44336"}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#9AA5B4"}}><span>0%</span><span>15% (current)</span><span>50%</span></div>
          </div>
          <div style={{flex:"1 1 200px",minWidth:180}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{color:"#5A6B7C"}}>🇲🇽 Mexico</span><span style={{fontWeight:700,color:"#0A2540"}}>{rMX}%</span></div>
            <input type="range" min={0} max={50} value={rMX} onChange={e=>setRMX(+e.target.value)} style={{width:"100%",accentColor:"#FF9800"}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#9AA5B4"}}><span>0%</span><span>12% (current)</span><span>50%</span></div>
          </div>
          <div style={{fontSize:10,color:"#5A6B7C",maxWidth:200}}>Report will use these rates to run a fresh forecast via the backend model before generating narrative.</div>
        </div>
      )}

      {/* Error */}
      {error&&(<div style={{background:"rgba(254,104,71,0.06)",border:"1px solid rgba(254,104,71,0.2)",borderRadius:10,padding:20,marginBottom:20}}><div style={{fontWeight:600,color:"#c0392b",marginBottom:6,fontSize:14}}>Generation failed</div><div style={{fontSize:13,color:"#5A6B7C"}}>{error}</div></div>)}

      {/* Loading */}
      {generating&&(<div style={{background:"white",border:"1px solid #E4EAF0",borderRadius:14,padding:28}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28,padding:"18px 20px",background:"linear-gradient(135deg,rgba(1,186,239,0.04),rgba(32,191,85,0.04))",borderRadius:10,border:"1px solid rgba(1,186,239,0.1)"}}>
          <div style={{fontSize:24}}>✨</div><div><div style={{fontWeight:600,color:"#0A2540",fontSize:14}}>AI is generating your report...</div><div style={{fontSize:12,color:"#5A6B7C",marginTop:2}}>Analyzing {rType==="impact"?"tariff data and USMCA findings":"forecast and trend data"}</div></div>
        </div>
        {[75,100,85,100,65].map((w,i)=>(<div key={i} style={{height:14,background:"#F0F4F8",borderRadius:100,marginBottom:10,width:`${w}%`,animation:"pulse 1.5s ease-in-out infinite"}}/>))}
      </div>)}

      {/* Placeholder when no report */}
      {!report&&!error&&!generating&&(<div style={{background:"white",border:"1px solid #E4EAF0",borderRadius:14,padding:"60px 40px",textAlign:"center",color:"#5A6B7C"}}>
        <div style={{fontSize:52,marginBottom:16}}>{rType==="impact"?"📋":"🔮"}</div>
        <div style={{fontSize:18,fontWeight:700,color:"#0A2540",marginBottom:8}}>{rType==="impact"?"Tariff Impact & USMCA Report":"Monthly Forecast Brief"}</div>
        <div style={{fontSize:13,lineHeight:1.7,maxWidth:500,margin:"0 auto"}}>{rType==="impact"?"Generates a full policy report covering tariff decomposition, USMCA findings (θ=+59%), state-by-state impact, and advocacy recommendations.":"Generates a forward-looking brief with next-month predictions by industry and product, trend analysis, and watch items."}</div>
      </div>)}

      {/* ── IMPACT REPORT ── */}
      {report&&!generating&&report.type==="impact"&&(()=>{const n=report.narrative;const date=new Date(report.generated_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});return(<div style={{background:"white",border:"1px solid #E4EAF0",borderRadius:14,padding:28}}>
        <div style={{background:"linear-gradient(135deg,#0A2540,#0F3460,#0B4F6C)",borderRadius:14,padding:"26px 28px",marginBottom:28,color:"white"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:2,marginBottom:3}}>PNWER Trade Intelligence · Tariff Impact Report</div>
          <div style={{fontSize:22,fontWeight:700}}>2025 Tariff Impact &amp; USMCA Analysis</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginTop:2}}>Generated {date}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:16}}>
            {[[`$${intSum.total_trade_2024_B}B`,"2024 Trade","#01BAEF"],[`$${intSum.total_trade_loss_B}B`,"Decline","#FE6847"],[`$${(intSum.gdp_at_risk_M/1000).toFixed(1)}B`,"GDP Risk","#FF9800"],[`${intSum.jobs_at_risk?.toLocaleString()}`,"Jobs Risk","#FBB13C"]].map(([v,l,c],i)=>(<div key={i} style={{background:"rgba(255,255,255,0.06)",borderRadius:8,padding:"11px 13px",border:"1px solid rgba(255,255,255,0.08)"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:.6,marginBottom:4}}>{l}</div><div style={{fontSize:17,fontWeight:700,color:c}}>{v}</div></div>))}
          </div>
        </div>
        <Sec><ST>Executive Summary</ST><Prose>{n.executive_summary}</Prose></Sec>
        <Sec><ST>Trade Impact Analysis</ST><Prose>{n.trade_impact}</Prose></Sec>
        <Sec><ST>Three-Factor Decomposition</ST><Prose>{n.decomposition}</Prose></Sec>
        <Sec><ST>USMCA Significance for PNWER</ST><Prose>{n.usmca_significance}</Prose></Sec>
        <Sec><ST>Key Risks</ST>{(n.risks||[]).map((r,i)=><Bullet key={i} index={i} text={r}/>)}</Sec>
        <div><ST>Policy Recommendations</ST>{(n.recommendations||[]).map((r,i)=><Bullet key={i} index={i} text={r}/>)}</div>
        <div style={{borderTop:"1px solid #EDF1F7",marginTop:28,paddingTop:18,display:"flex",gap:10}}>
          <button onClick={()=>window.print()} style={{display:"inline-flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,#0A2540,#0F3460)",color:"white",border:"none",borderRadius:8,padding:"10px 18px",fontFamily:"inherit",fontSize:12,fontWeight:600,cursor:"pointer"}}>🖨️ Print / PDF</button>
          <button onClick={()=>setReport(null)} style={{display:"inline-flex",alignItems:"center",gap:6,background:"white",color:"#0A2540",border:"1px solid #E4EAF0",borderRadius:8,padding:"10px 18px",fontFamily:"inherit",fontSize:12,fontWeight:600,cursor:"pointer"}}>↩ Regenerate</button>
        </div>
      </div>);})()}

      {/* ── FORECAST REPORT ── */}
      {report&&!generating&&report.type==="forecast"&&(()=>{const n=report.narrative;const date=new Date(report.generated_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});return(<div style={{background:"white",border:"1px solid #E4EAF0",borderRadius:14,padding:28}}>
        <div style={{background:"linear-gradient(135deg,#0A2540,#0F3460,#0B4F6C)",borderRadius:14,padding:"26px 28px",marginBottom:28,color:"white"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:2,marginBottom:3}}>PNWER Trade Intelligence · Monthly Forecast Brief</div>
          <div style={{fontSize:22,fontWeight:700}}>{fcMeta.baseline_label||"Current"} → {fcMeta.predicted_label||"Next Month"}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginTop:2}}>Generated {date}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:16}}>
            {[[`$${(fcTot.current/1e6).toFixed(0)}M`,"Current","#01BAEF"],[`$${(fcTot.predicted/1e6).toFixed(0)}M`,"Predicted","#20BF55"],[`$${((fcTot.delta||0)/1e6).toFixed(0)}M`,"Delta",fcTot.delta>=0?"#4CAF50":"#FE6847"],[`$${((fcTot.gdp||0)/1e6).toFixed(0)}M`,"GDP Risk","#FF9800"]].map(([v,l,c],i)=>(<div key={i} style={{background:"rgba(255,255,255,0.06)",borderRadius:8,padding:"11px 13px",border:"1px solid rgba(255,255,255,0.08)"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:.6,marginBottom:4}}>{l}</div><div style={{fontSize:17,fontWeight:700,color:c}}>{v}</div></div>))}
          </div>
        </div>
        <Sec><ST>Forecast Summary</ST><Prose>{n.forecast_summary}</Prose></Sec>
        <Sec><ST>Industry Outlook</ST><Prose>{n.industry_outlook}</Prose></Sec>
        <Sec><ST>Product Highlights</ST><Prose>{n.product_highlights}</Prose></Sec>
        <Sec><ST>Trend Analysis</ST><Prose>{n.trend_analysis}</Prose></Sec>
        <div><ST>Watch Items</ST>{(n.watch_items||[]).map((r,i)=><Bullet key={i} index={i} text={r}/>)}</div>
        <div style={{borderTop:"1px solid #EDF1F7",marginTop:28,paddingTop:18,display:"flex",gap:10}}>
          <button onClick={()=>window.print()} style={{display:"inline-flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,#0A2540,#0F3460)",color:"white",border:"none",borderRadius:8,padding:"10px 18px",fontFamily:"inherit",fontSize:12,fontWeight:600,cursor:"pointer"}}>🖨️ Print / PDF</button>
          <button onClick={()=>setReport(null)} style={{display:"inline-flex",alignItems:"center",gap:6,background:"white",color:"#0A2540",border:"1px solid #E4EAF0",borderRadius:8,padding:"10px 18px",fontFamily:"inherit",fontSize:12,fontWeight:600,cursor:"pointer"}}>↩ Regenerate</button>
        </div>
      </div>);})()}
    </div>
  );
}