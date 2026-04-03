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
  return { id, name:PROV_NAMES[id], flag:"ca", t24:Math.round(p.trade_2024/1e9*10)/10, t25:Math.round(p.trade_2025/1e9*10)/10, topExport:TOP_EXPORTS[id]||"", gdp:Math.round(p.gdp_at_risk/1e6), jobs:p.jobs_at_risk, currency:"CAD", sectors:sec }; });
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

const DECOMP = { us:{tariff:integrated.decomposition.tariff_effect_B,oil:integrated.decomposition.oil_price_effect_B,residual:integrated.decomposition.residual_B,total:integrated.decomposition.actual_total_B,unit:"USD"}, ca:{tariff:-8.9,oil:-10.5,residual:0.4,total:-18.9,unit:"CAD"} };
const DID_DATA = [{period:"Pre-USMCA",treated:100,control:100},{period:"USMCA",treated:108,control:103},{period:"Post-COVID",treated:95,control:88},{period:"Recovery",treated:118,control:106},{period:"2025 Tariff",treated:98,control:110}];
const US_T24=US.reduce((s,j)=>s+j.t24,0), US_T25=US.reduce((s,j)=>s+j.t25,0), US_GDP=US.reduce((s,j)=>s+j.gdp,0), US_JOBS=US.reduce((s,j)=>s+j.jobs,0);

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

  const JurCard = ({j}) => { const chg=j.t25-j.t24,pct=j.t24>0?(chg/j.t24*100).toFixed(0):"0"; return(
    <div onClick={()=>{setSel(j);setDetailView("current")}} style={{cursor:"pointer",background:sel?.id===j.id?"rgba(1,186,239,0.03)":"white",border:sel?.id===j.id?"2px solid #01BAEF":"2px solid #E4EAF0",borderRadius:12,padding:"14px 10px",textAlign:"center",transition:"all 0.2s"}}>
      <div style={{fontSize:18,marginBottom:4}}>{FL[j.flag]}</div><div style={{fontWeight:700,fontSize:15,color:"#0A2540"}}>{j.id}</div><div style={{fontSize:11,color:"#5A6B7C"}}>{j.name}</div>
      <div style={{fontSize:15,fontWeight:600,color:"#0B4F6C",marginTop:5}}>${j.t25}B</div><div style={{fontSize:11,color:chg<0?"#F44336":"#4CAF50",fontWeight:600}}>{chg<0?"":"+"}{chg.toFixed(1)}B ({pct}%)</div><div style={{fontSize:10,color:"#5A6B7C"}}>2024: ${j.t24}B</div>
    </div>);};

  // ══════ FORECAST PANEL — reads from backend JSON ══════
  const FP = () => (<div>
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
            <div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:1}}>Monthly Forecast</div><div style={{fontSize:20,fontWeight:700}}>{baseLbl} → {predLbl}</div></div>
            <div style={{fontSize:10,padding:"4px 10px",borderRadius:6,background:"rgba(1,186,239,0.15)",color:"#01BAEF"}}>CA {tCA}% / MX {tMX}%</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[[baseLbl,fmtV(fcTot.current),"#01BAEF"],[`${predLbl}`,fmtV(fcTot.predicted),"#20BF55"],["Δ Trade",`${fcTot.delta>=0?"+":""}${fmtV(fcTot.delta)}`,fcTot.delta>=0?"#4CAF50":"#FE6847"],["GDP Risk",fmtV(fcTot.gdp),"#FF9800"]].map(([l,v,c],i)=>(
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
      <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:16}}>{baseLbl} vs {predLbl} — By Industry</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:"2px solid #EDF1F7"}}>
          {["Industry","Imports","Exports","Current","Predicted","Δ","Δ%","GDP Risk","Jobs"].map(h=>(
            <th key={h} style={{padding:"10px 10px",textAlign:h==="Industry"?"left":"right",color:"#5A6B7C",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>))}
        </tr></thead>
        <tbody>
          {Object.entries(fcInd).sort((a,b)=>Math.abs(b[1].delta||0)-Math.abs(a[1].delta||0)).map(([ind,f])=>{
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
            <td style={{padding:"10px 10px",textAlign:"right"}}>{fmtV(fcTot.current)}</td>
            <td style={{padding:"10px 10px",textAlign:"right"}}>{fmtV(fcTot.predicted)}</td>
            <td style={{padding:"10px 10px",textAlign:"right",color:fcTot.delta<0?"#F44336":"#4CAF50"}}>{fcTot.delta>=0?"+":""}{fmtV(fcTot.delta)}</td>
            <td style={{padding:"10px 10px",textAlign:"right"}}>{fcTot.current>0?(fcTot.delta/fcTot.current*100).toFixed(1):"0.0"}%</td>
            <td style={{padding:"10px 10px",textAlign:"right",color:"#FF9800"}}>{fmtV(fcTot.gdp)}</td>
            <td style={{padding:"10px 10px",textAlign:"right"}}>{(fcTot.jobs||0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>)}

    {/* PRODUCT TABLE */}
    {fView==="product" && (<div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:20}}>
      <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:16}}>{baseLbl} vs {predLbl} — By Product (HS4)</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:"2px solid #EDF1F7"}}>
          {["HS4","Product","Industry","Imports","Exports","Current","Predicted","Δ","Δ%"].map(h=>(
            <th key={h} style={{padding:"8px 10px",textAlign:["HS4","Product","Industry"].includes(h)?"left":"right",color:"#5A6B7C",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>))}
        </tr></thead>
        <tbody>
          {Object.entries(fcProd).sort((a,b)=>Math.abs(b[1].delta||0)-Math.abs(a[1].delta||0)).map(([hs4,f])=>{
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

      {tab==="overview"&&!sel&&(<div style={{background:"linear-gradient(160deg,#0A2540,#0F3460 40%,#0B4F6C 70%,#0A2540)",padding:"44px 40px 36px"}}><div style={{maxWidth:1280,margin:"0 auto"}}>
        <h1 style={{fontSize:38,fontWeight:700,color:"white",lineHeight:1.15,maxWidth:700,marginBottom:14}}>Understanding <span style={{background:"linear-gradient(90deg,#01BAEF,#20BF55)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Tariff Impacts</span> Across the Pacific Northwest</h1>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",lineHeight:1.7,maxWidth:580,marginBottom:28}}>Real-time analysis across {ALL.length} jurisdictions. Census data + CES/Armington model.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,maxWidth:860}}>
          {[[`$${US_T24.toFixed(1)}B → $${US_T25.toFixed(1)}B`,"US Trade 2024→2025","#01BAEF"],[`-$${(US_T24-US_T25).toFixed(1)}B`,"YoY Decline","#FE6847"],[`$${(US_GDP/1000).toFixed(1)}B`,"GDP at Risk","#FF9800"],[US_JOBS.toLocaleString(),"Jobs at Risk","#FBB13C"]].map(([v,l,c],i)=>(
            <div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"14px 16px"}}><div style={{fontSize:22,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:.6}}>{l}</div></div>))}
        </div>
      </div></div>)}

      <div style={{maxWidth:1300,margin:"0 auto",padding:"24px 28px 56px"}}>
        {tab==="overview"&&(<div>{!sel?(<>
          <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:8,color:"#3A7CA5"}}>United States</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:18}}>{US.map(j=><JurCard key={j.id} j={j}/>)}</div>
          <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:8,color:"#FE6847"}}>Canada</div>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${CA.length},1fr)`,gap:10,marginBottom:18}}>{CA.map(j=><JurCard key={j.id} j={j}/>)}</div>
          <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",textAlign:"center",padding:40,color:"#5A6B7C"}}><div style={{fontSize:40,marginBottom:10}}>🗺️</div><div style={{fontSize:18,fontWeight:700,color:"#0A2540"}}>Select a Jurisdiction</div></div>
        </>):(<div>
          <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"#01BAEF",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,marginBottom:12,padding:0}}>← Back</button>
          <div style={{background:"linear-gradient(135deg,#0A2540,#0F3460)",borderRadius:16,padding:24,color:"white",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}><span style={{fontSize:34}}>{FL[sel.flag]}</span><div><div style={{fontSize:26,fontWeight:700}}>{sel.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.45)"}}>Top: {sel.topExport} | {sel.currency}</div></div></div>
              <div style={{display:"flex",gap:2,background:"rgba(255,255,255,0.08)",borderRadius:10,padding:3}}>
                {[["current","📊 Current"],["forecast","🔮 Forecast"]].map(([id,label])=>(<button key={id} onClick={()=>setDetailView(id)} style={{padding:"8px 18px",borderRadius:8,border:"none",background:detailView===id?"rgba(1,186,239,0.2)":"transparent",color:detailView===id?"#01BAEF":"rgba(255,255,255,0.5)",fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer"}}>{label}</button>))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginTop:16}}>
              {[["2024 Trade",`$${sel.t24}B`,"#01BAEF"],["2025 Trade",`$${sel.t25}B`,"white"],["Change",`${(sel.t25-sel.t24)<0?"":"+"}$${(sel.t25-sel.t24).toFixed(1)}B (${sel.t24>0?((sel.t25-sel.t24)/sel.t24*100).toFixed(0):0}%)`,sel.t25<sel.t24?"#FE6847":"#4CAF50"],["GDP / Jobs",`${fmtM(sel.gdp)} / ${sel.jobs.toLocaleString()}`,"#FBB13C"]].map(([l,v,c],i)=>(
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
          <div style={{fontSize:14,color:"#5A6B7C",marginBottom:24}}>Annual tariff impact across 5 US states × CA/MX. Source: Census bilateral data + CES/Armington model.</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
            {[[`$${US_T24.toFixed(1)}B`,"2024 Baseline","#01BAEF"],[`-$${(US_T24-US_T25).toFixed(1)}B`,"Trade Decline","#F44336"],[`$${(US_GDP/1000).toFixed(1)}B`,"GDP at Risk","#FF9800"],[US_JOBS.toLocaleString(),"Jobs at Risk","#FE6847"]].map(([v,l,c],i)=>(
              <div key={i} style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:"18px 20px"}}><div style={{fontSize:10,color:"#5A6B7C",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{l}</div><div style={{fontSize:26,fontWeight:700,color:c}}>{v}</div></div>))}
          </div>

          {/* Monthly trend charts */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
            <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
              <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:14}}>Monthly Trade — 2025 vs 2024 ($M)</div>
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
          <div style={{fontSize:18,fontWeight:700,color:"#0A2540",marginBottom:12}}>Impact by Industry</div>
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
          <div style={{fontSize:18,fontWeight:700,color:"#0A2540",marginBottom:12}}>Impact by Product (HS4)</div>
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

          {/* ── Three-Factor Decomposition ── */}
          <div style={{fontSize:18,fontWeight:700,color:"#0A2540",marginBottom:12}}>Trade Decline Decomposition</div>
          <div style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              {[["US 5 States (USD)",DECOMP.us],["CA 3 Provinces (CAD)",DECOMP.ca]].map(([title,d])=>(
                <div key={title}><div style={{fontSize:13,fontWeight:600,color:"#0A2540",marginBottom:10}}>{title}</div>
                  {[["Tariff",d.tariff,"#F44336"],["Oil/Energy",d.oil,"#FF9800"],["Residual",d.residual,d.residual>=0?"#4CAF50":"#607D8B"]].map(([l,v,c])=>(
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
                <div style={{fontWeight:600,fontSize:14,color:"#0A2540",marginBottom:14}}>Model Validation</div>
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
                <div style={{marginTop:10,fontSize:10,color:"#5A6B7C",lineHeight:1.5}}>Model captures tariff-driven trade loss. Residual (actual &gt; model) reflects oil price decline, anticipatory purchasing, and supply chain restructuring — decomposed below.</div>
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
                {[["US 5 States (USD)",DECOMP.us],["CA 3 Provinces (CAD)",DECOMP.ca]].map(([title,d])=>(
                  <div key={title}><div style={{fontSize:13,fontWeight:600,color:"#0A2540",marginBottom:10}}>{title}</div>
                    {[["Tariff effect",d.tariff,"#F44336"],["Oil price (WTI -15.7%)",d.oil,"#FF9800"],["Residual",d.residual,d.residual>=0?"#4CAF50":"#607D8B"]].map(([l,v,c])=>(
                      <div key={l} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><div style={{width:12,height:12,borderRadius:3,background:c,flexShrink:0}}/><div style={{flex:1,fontSize:13}}>{l}</div><div style={{fontSize:15,fontWeight:700,color:c}}>${v}B ({Math.abs(Math.round(v/d.total*100))}%)</div></div>
                    ))}<div style={{borderTop:"1px solid #EDF1F7",paddingTop:8,marginTop:4,fontSize:14,fontWeight:700}}>Total: ${d.total}B</div></div>))}
              </div>
              <div style={{marginTop:14,fontSize:10,color:"#5A6B7C",lineHeight:1.5}}>Residual includes pre-existing trends, supply chain restructuring, exchange rates, and anticipatory purchasing effects. Energy decline dominated by WTI price drop (-15.7% YoY), not tariffs.</div>
            </div>
          </div>)}
        </div>)}

        {tab==="reports"&&(<div>
          <div style={{fontSize:24,fontWeight:700,color:"#0A2540",marginBottom:4}}>Policy Reports</div>
          <div style={{fontSize:14,color:"#5A6B7C",marginBottom:24}}>Deliverables for PNWER stakeholders.</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
            {[["📋","Validation Report","Model vs actual, parameter reliability","pnwer_validation_report.docx"],["📊","Elasticity Comparison","Back-calibrated ε vs B&W σ","elasticity_comparison.xlsx"],["🔮","Monthly Forecast","Next-month rolling prediction","monthly_forecast.json"]].map(([icon,title,desc,file])=>(
              <div key={title} style={{background:"white",borderRadius:14,border:"1px solid #E4EAF0",padding:24}}><div style={{fontSize:32,marginBottom:10}}>{icon}</div><div style={{fontSize:15,fontWeight:700,color:"#0A2540",marginBottom:6}}>{title}</div><div style={{fontSize:12,color:"#5A6B7C",lineHeight:1.6,marginBottom:14}}>{desc}</div><div style={{fontSize:11,color:"#01BAEF",fontWeight:600}}>{file}</div></div>))}
          </div>
        </div>)}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}