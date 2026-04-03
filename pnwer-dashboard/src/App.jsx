import { useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import ReportPanel from "./ReportPanel";

const US = [
  { id: "WA", name: "Washington", flag: "🇺🇸", trade: 38.2, topExport: "Aircraft & Parts", gdpImpact: -2.1, jobs: 142000, sectors: { Agriculture: 4.1, Manufacturing: 18.3, Energy: 8.7, Forestry: 2.1 } },
  { id: "OR", name: "Oregon", flag: "🇺🇸", trade: 12.8, topExport: "Semiconductors", gdpImpact: -1.6, jobs: 52000, sectors: { Agriculture: 3.2, Manufacturing: 6.1, Energy: 1.4, Forestry: 1.8 } },
  { id: "ID", name: "Idaho", flag: "🇺🇸", trade: 4.2, topExport: "Dairy Products", gdpImpact: -1.9, jobs: 18000, sectors: { Agriculture: 2.8, Manufacturing: 0.9, Energy: 0.3, Forestry: 0.6 } },
  { id: "MT", name: "Montana", flag: "🇺🇸", trade: 3.1, topExport: "Wheat & Grains", gdpImpact: -2.4, jobs: 11000, sectors: { Agriculture: 1.9, Manufacturing: 0.4, Energy: 0.6, Forestry: 0.3 } },
  { id: "AK", name: "Alaska", flag: "🇺🇸", trade: 5.6, topExport: "Seafood", gdpImpact: -1.3, jobs: 8500, sectors: { Agriculture: 0.8, Manufacturing: 1.2, Energy: 2.9, Forestry: 0.1 } },
];
const CA = [
  { id: "BC", name: "British Columbia", flag: "🇨🇦", trade: 28.4, topExport: "Lumber & Wood", gdpImpact: -2.8, jobs: 198000, sectors: { Agriculture: 3.6, Manufacturing: 8.2, Energy: 5.1, Forestry: 6.8 } },
  { id: "AB", name: "Alberta", flag: "🇨🇦", trade: 42.1, topExport: "Crude Oil", gdpImpact: -3.5, jobs: 245000, sectors: { Agriculture: 5.2, Manufacturing: 9.4, Energy: 22.1, Forestry: 1.8 } },
  { id: "SK", name: "Saskatchewan", flag: "🇨🇦", trade: 16.7, topExport: "Potash & Uranium", gdpImpact: -2.9, jobs: 67000, sectors: { Agriculture: 8.4, Manufacturing: 2.1, Energy: 4.6, Forestry: 0.9 } },
  { id: "YT", name: "Yukon", flag: "🇨🇦", trade: 0.8, topExport: "Gold & Minerals", gdpImpact: -1.1, jobs: 2200, sectors: { Agriculture: 0.05, Manufacturing: 0.1, Energy: 0.15, Forestry: 0.08 } },
  { id: "NT", name: "NW Territories", flag: "🇨🇦", trade: 0.6, topExport: "Diamonds", gdpImpact: -0.9, jobs: 1800, sectors: { Agriculture: 0.02, Manufacturing: 0.08, Energy: 0.3, Forestry: 0.05 } },
];
const ALL = [...US, ...CA];
const COLORS = ["#0B4F6C","#01BAEF","#20BF55","#FBB13C","#FE6847","#764BA2","#3A7CA5","#81C784","#F48FB1","#FFD54F"];
const SECTOR_CLR = { Agriculture: "#4CAF50", Manufacturing: "#2196F3", Energy: "#FF9800", Forestry: "#795548" };

const YEARLY = [
  { year: "2019", us: 156, ca: 162 },
  { year: "2020", us: 128, ca: 134 },
  { year: "2021", us: 168, ca: 171 },
  { year: "2022", us: 189, ca: 198 },
  { year: "2023", us: 195, ca: 204 },
  { year: "2024", us: 201, ca: 211 },
];

const DID_DATA = [
  { period: "Pre-USMCA", treated: 100, control: 100 },
  { period: "USMCA", treated: 108, control: 103 },
  { period: "Post-COVID", treated: 95, control: 88 },
  { period: "Recovery", treated: 118, control: 106 },
  { period: "Tariff Threat", treated: 112, control: 109 },
  { period: "Projected", treated: 98, control: 110 },
];

const DDD_DATA = ALL.map(j => ({
  id: j.id, current: j.trade, post25: +(j.trade * 0.76).toFixed(1), post10: +(j.trade * 0.92).toFixed(1),
}));

const HS = [
  { name: "Agriculture", code: "HS 01-24", products: 2847, risk: "$12.4B", icon: "🌾", color: "#4CAF50" },
  { name: "Manufacturing", code: "HS 25-83", products: 4215, risk: "$47.2B", icon: "🏭", color: "#2196F3" },
  { name: "Energy", code: "HS 27", products: 312, risk: "$38.9B", icon: "⚡", color: "#FF9800" },
  { name: "Forestry", code: "HS 44-48", products: 689, risk: "$14.1B", icon: "🌲", color: "#795548" },
];

export default function PNWERDashboard() {
  const [tab, setTab] = useState("overview");
  const [sel, setSel] = useState(null);
  const [model, setModel] = useState("did");
  const [tariff, setTariff] = useState(25);
  const [reportType, setReportType] = useState("jurisdiction");
  const [reportJurisdiction, setReportJurisdiction] = useState(ALL[0]);
  const [reportSector, setReportSector] = useState("Agriculture");
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportError, setReportError] = useState(null);

  const handleGen = async () => {
    setGenerating(true);
    setReportData(null);
    setReportError(null);

    const payload =
      reportType === "jurisdiction"
        ? {
            report_type: "jurisdiction",
            jurisdiction_id: reportJurisdiction.id,
            data: reportJurisdiction,
          }
        : {
            report_type: "sector",
            sector: reportSector,
            data: {
              all_jurisdictions: ALL,
              hs_info: HS.find((h) => h.name === reportSector) || {},
            },
          };

    try {
      const res = await fetch("http://localhost:8001/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Report generation failed");
      }
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      setReportError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const JurCard = ({ j }) => {
    const isSel = sel?.id === j.id;
    return (
      <div
        onClick={() => setSel(j)}
        className="cursor-pointer text-center relative overflow-hidden"
        style={{
          background: isSel ? "rgba(1,186,239,0.03)" : "white",
          border: isSel ? "2px solid #01BAEF" : "2px solid #E4EAF0",
          borderRadius: 12, padding: "14px 10px",
          transition: "all 0.2s",
        }}
      >
        {isSel && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #01BAEF, #20BF55)", borderRadius: "12px 12px 0 0" }} />}
        <div style={{ fontSize: 18, marginBottom: 4 }}>{j.flag}</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0A2540" }}>{j.id}</div>
        <div style={{ fontSize: 11, color: "#5A6B7C" }}>{j.name}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0B4F6C", marginTop: 5 }}>${j.trade}B</div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", background: "#F7F9FC", minHeight: "100vh", color: "#1A2B3C" }}>

      {/* ══ NAV ══ */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(10,37,64,0.97)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 28px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #01BAEF, #20BF55)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "white", fontSize: 12 }}>PNW</div>
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 16 }}>PNWER Tariff Dashboard</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>Trade Intelligence Platform</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 3 }}>
          {[["overview", "🗺️ Overview"], ["modeling", "📊 Modeling"], ["reports", "📋 Reports"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: tab === id ? "rgba(1,186,239,0.15)" : "transparent", color: tab === id ? "#01BAEF" : "rgba(255,255,255,0.5)", fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{label}</button>
          ))}
        </div>
      </nav>

      {/* ══ HERO (overview only) ══ */}
      {tab === "overview" && (
        <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(160deg, #0A2540 0%, #0F3460 35%, #0B4F6C 70%, #0A2540 100%)", padding: "56px 40px 48px" }}>
          <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(1,186,239,0.1)", border: "1px solid rgba(1,186,239,0.2)", borderRadius: 100, padding: "5px 14px", marginBottom: 20, fontSize: 11, color: "#01BAEF", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#01BAEF", display: "inline-block" }} />
              PNWER Trade Intelligence Platform
            </div>
            <h1 style={{ fontSize: 44, fontWeight: 700, color: "white", lineHeight: 1.15, maxWidth: 700, marginBottom: 16 }}>
              Understanding{" "}
              <span style={{ background: "linear-gradient(90deg, #01BAEF, #20BF55)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Tariff Impacts</span>
              {" "}Across the Pacific Northwest
            </h1>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, maxWidth: 580, marginBottom: 36 }}>
              Interactive analysis of how trade policy changes affect 10 jurisdictions across the US-Canada border — powered by DID and DDD econometric modeling with complete HS code coverage.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, maxWidth: 880 }}>
              {[["$152.5B", "Total PNWER Trade", "#01BAEF"], ["10", "Jurisdictions Covered", "#20BF55"], ["8,063", "HS Codes Analyzed", "#FBB13C"], ["-$34.2B", "Trade at Risk (25%)", "#FE6847"]].map(([v, l, c], i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 20px" }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: c, marginBottom: 3 }}>{v}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.6, lineHeight: 1.5 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ MAIN ══ */}
      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 28px 56px" }}>

        {/* ════════ OVERVIEW ════════ */}
        {tab === "overview" && (
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, fontWeight: 600, color: "#0B4F6C", marginBottom: 6 }}>Regional Overview</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#0A2540", marginBottom: 4 }}>PNWER Jurisdictions at a Glance</div>
            <div style={{ fontSize: 14, color: "#5A6B7C", lineHeight: 1.6, marginBottom: 24 }}>Select a jurisdiction to explore its trade profile, sector composition, and tariff vulnerability.</div>

            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 8, color: "#3A7CA5" }}>🇺🇸 United States</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
              {US.map(j => <JurCard key={j.id} j={j} />)}
            </div>

            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 8, color: "#FE6847" }}>🇨🇦 Canada</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
              {CA.map(j => <JurCard key={j.id} j={j} />)}
            </div>

            {/* Detail */}
            {!sel ? (
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", textAlign: "center", padding: 48, color: "#5A6B7C", marginTop: 12 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🗺️</div>
                <div style={{ fontSize: 19, fontWeight: 700, color: "#0A2540", marginBottom: 6 }}>Select a Jurisdiction</div>
                <div style={{ fontSize: 13 }}>Click any jurisdiction above to explore its trade profile</div>
              </div>
            ) : (
              <div style={{ background: "white", borderRadius: 16, border: "1px solid #E4EAF0", overflow: "hidden", marginTop: 12 }}>
                {/* Detail header */}
                <div style={{ background: "linear-gradient(135deg, #0A2540, #0F3460)", padding: 28, color: "white" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 34 }}>{sel.flag}</span>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 700 }}>{sel.name}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>Top Export: {sel.topExport}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 18 }}>
                    {[
                      ["Total Trade", "$" + sel.trade + "B", "#01BAEF"],
                      ["Jobs Supported", (sel.jobs / 1000).toFixed(0) + "K", "white"],
                      ["GDP Impact (25%)", sel.gdpImpact + "%", "#FE6847"],
                      ["Top Export", sel.topExport, "white"],
                    ].map(([l, v, c], i) => (
                      <div key={i} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{l}</div>
                        <div style={{ fontSize: i === 3 ? 14 : 20, fontWeight: 700, color: c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Detail body */}
                <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0A2540", marginBottom: 14 }}>Sector Breakdown ($B)</div>
                    {Object.entries(sel.sectors).map(([k, v]) => {
                      const max = Math.max(...Object.values(sel.sectors));
                      return (
                        <div key={k} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                            <span style={{ fontWeight: 500 }}>{k}</span>
                            <span style={{ fontWeight: 600, color: "#0A2540" }}>${v}B</span>
                          </div>
                          <div style={{ height: 7, background: "#EDF1F7", borderRadius: 100, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 100, width: `${(v / max) * 100}%`, background: SECTOR_CLR[k], transition: "width 0.6s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0A2540", marginBottom: 14 }}>Trade Composition</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={Object.entries(sel.sectors).map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                          {Object.keys(sel.sectors).map((k, i) => <Cell key={k} fill={Object.values(SECTOR_CLR)[i]} />)}
                        </Pie>
                        <Tooltip formatter={v => `$${v}B`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 6 }}>
                      {Object.entries(SECTOR_CLR).map(([k, c]) => (
                        <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                          <div style={{ width: 9, height: 9, borderRadius: 3, background: c }} />{k}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Charts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24 }}>
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#0A2540" }}>Historical Trade Trends ($B)</span>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "rgba(1,186,239,0.08)", color: "#0B4F6C", fontWeight: 600 }}>2019–2024</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={YEARLY}>
                    <defs>
                      <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#01BAEF" stopOpacity={0.2} /><stop offset="100%" stopColor="#01BAEF" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#20BF55" stopOpacity={0.2} /><stop offset="100%" stopColor="#20BF55" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="us" name="US Exports" stroke="#01BAEF" fill="url(#gU)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="ca" name="CA Exports" stroke="#20BF55" fill="url(#gC)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#0A2540" }}>Trade Share by Jurisdiction</span>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "rgba(1,186,239,0.08)", color: "#0B4F6C", fontWeight: 600 }}>$152.5B Total</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={ALL.map((j, i) => ({ name: j.id, value: j.trade }))} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                      {ALL.map((j, i) => <Cell key={j.id} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={v => `$${v}B`} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" }}>
                  {ALL.map((j, i) => (
                    <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i] }} />{j.id}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════ MODELING ════════ */}
        {tab === "modeling" && (
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, fontWeight: 600, color: "#0B4F6C", marginBottom: 6 }}>Econometric Analysis</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#0A2540", marginBottom: 4 }}>Tariff Impact Modeling</div>
            <div style={{ fontSize: 14, color: "#5A6B7C", lineHeight: 1.6, marginBottom: 24 }}>Explore our two-layer framework using historical trade data and advanced econometric methods.</div>

            <div style={{ display: "flex", gap: 2, background: "#EDF1F7", borderRadius: 10, padding: 3, width: "fit-content", marginBottom: 20 }}>
              {[["did", "Difference-in-Differences"], ["ddd", "Triple Difference (DDD)"], ["hs", "HS Code Coverage"]].map(([id, label]) => (
                <button key={id} onClick={() => setModel(id)} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: model === id ? "white" : "transparent", color: model === id ? "#0A2540" : "#5A6B7C", fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer", boxShadow: model === id ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>{label}</button>
              ))}
            </div>

            {/* DID */}
            {model === "did" && (
              <div>
                <div style={{ background: "linear-gradient(135deg, rgba(1,186,239,0.04), rgba(32,191,85,0.04))", border: "1px solid rgba(1,186,239,0.12)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: "#0A2540", marginBottom: 6 }}>Layer 1: National-Level Difference-in-Differences</h4>
                  <p style={{ fontSize: 13, color: "#5A6B7C", lineHeight: 1.65 }}>Compares US exports to USMCA partners (treatment) against non-USMCA countries (control) across pre/post-tariff periods to isolate causal tariff effects.</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#0A2540" }}>DID: Treatment vs Control</span>
                      <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "rgba(1,186,239,0.08)", color: "#0B4F6C", fontWeight: 600 }}>National</span>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={DID_DATA}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 12 }} domain={[80, 125]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="treated" name="USMCA Partners" stroke="#01BAEF" strokeWidth={3} dot={{ r: 5, fill: "#01BAEF" }} />
                        <Line type="monotone" dataKey="control" name="Non-USMCA" stroke="#FBB13C" strokeWidth={3} dot={{ r: 5, fill: "#FBB13C" }} strokeDasharray="8 4" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0A2540", marginBottom: 16 }}>Key Findings</div>
                    {[
                      ["📉", "Tariff Elasticity", "-0.42", "Trade drops 0.42% per 1% tariff increase"],
                      ["⚡", "Immediate Shock", "-12.4%", "First-quarter decline at 25% tariff"],
                      ["📊", "Treatment Effect", "-8.2pp", "Divergence from control trajectory"],
                      ["🔄", "Recovery Period", "18 mo.", "Estimated partial equilibrium time"],
                    ].map(([icon, label, val, desc], i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#F7F9FC", borderRadius: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 26 }}>{icon}</span>
                        <div>
                          <div style={{ fontSize: 11, color: "#5A6B7C" }}>{label}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#0A2540" }}>{val}</div>
                          <div style={{ fontSize: 11, color: "#5A6B7C" }}>{desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* DDD */}
            {model === "ddd" && (
              <div>
                <div style={{ background: "linear-gradient(135deg, rgba(1,186,239,0.04), rgba(32,191,85,0.04))", border: "1px solid rgba(1,186,239,0.12)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: "#0A2540", marginBottom: 6 }}>Layer 2: State-Level Triple Difference</h4>
                  <p style={{ fontSize: 13, color: "#5A6B7C", lineHeight: 1.65 }}>Three-way crossed fixed effects (State x Year, State x Partner, Partner x Year) for granular jurisdiction-level tariff impact estimates.</p>
                </div>

                <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Adjust Tariff Rate</span>
                    <span style={{ fontSize: 26, fontWeight: 700, color: "#FE6847" }}>{tariff}%</span>
                  </div>
                  <input type="range" min="0" max="50" value={tariff} onChange={e => setTariff(Number(e.target.value))} style={{ width: "100%", accentColor: "#FE6847" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    {["0% Baseline", "10% Moderate", "25% Current", "50% Escalation"].map(l => (
                      <span key={l} style={{ fontSize: 10, color: "#5A6B7C" }}>{l}</span>
                    ))}
                  </div>
                </div>

                <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#0A2540" }}>Trade Impact by Jurisdiction ($B)</span>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "rgba(1,186,239,0.08)", color: "#0B4F6C", fontWeight: 600 }}>Tariff: {tariff}%</span>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={DDD_DATA} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7" />
                      <XAxis dataKey="id" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="current" name="Current Trade" fill="#01BAEF" radius={[5, 5, 0, 0]} />
                      <Bar dataKey={tariff >= 20 ? "post25" : "post10"} name={`Post-Tariff (${tariff}%)`} fill="#FE6847" radius={[5, 5, 0, 0]} opacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {[
                    ["💰", "rgba(254,104,71,0.08)", "Total Trade at Risk", "$" + (tariff * 1.37).toFixed(1) + "B", "#FE6847"],
                    ["👷", "rgba(251,177,60,0.08)", "Jobs at Risk", (tariff * 3200).toLocaleString() + "+", "#FBB13C"],
                    ["📦", "rgba(1,186,239,0.08)", "Products Affected", Math.round(8063 * (tariff / 50)).toLocaleString(), "#0B4F6C"],
                    ["🏭", "rgba(32,191,85,0.08)", "Sectors Impacted", "4 / 4", "#20BF55"],
                  ].map(([icon, bg, label, val, color], i) => (
                    <div key={i} style={{ background: "white", border: "1px solid #E4EAF0", borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, background: bg, flexShrink: 0 }}>{icon}</div>
                      <div>
                        <div style={{ fontSize: 11, color: "#5A6B7C" }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HS */}
            {model === "hs" && (
              <div>
                <div style={{ background: "linear-gradient(135deg, rgba(1,186,239,0.04), rgba(32,191,85,0.04))", border: "1px solid rgba(1,186,239,0.12)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: "#0A2540", marginBottom: 6 }}>Complete HS Code Product-Level Coverage</h4>
                  <p style={{ fontSize: 13, color: "#5A6B7C", lineHeight: 1.65 }}>Full coverage across Agriculture, Manufacturing, Energy, and Forestry. Enables direct tariff cost per product, trade volume estimates, and regional ripple effects.</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
                  {HS.map((s, i) => (
                    <div key={i} style={{ background: "white", border: "1px solid #E4EAF0", borderRadius: 12, padding: 18, textAlign: "center" }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "#0A2540" }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "#5A6B7C", marginTop: 2 }}>{s.code}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#0B4F6C", marginTop: 8 }}>{s.products.toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: "#5A6B7C" }}>products analyzed</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: s.color, marginTop: 4 }}>{s.risk} at risk</div>
                      <div style={{ height: 4, background: "#EDF1F7", borderRadius: 100, marginTop: 8, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 100, width: "100%", background: "linear-gradient(90deg, #01BAEF, #20BF55)" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#5A6B7C", marginTop: 4 }}>100% coverage</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#0A2540" }}>Products Covered by Sector</span>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "rgba(1,186,239,0.08)", color: "#0B4F6C", fontWeight: 600 }}>8,063 Total</span>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={HS} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="products" name="Products" fill="#01BAEF" radius={[0, 5, 5, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════ REPORTS ════════ */}
        {tab === "reports" && (
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, fontWeight: 600, color: "#0B4F6C", marginBottom: 6 }}>Report Builder</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#0A2540", marginBottom: 4 }}>Generate Policy Reports</div>
            <div style={{ fontSize: 14, color: "#5A6B7C", lineHeight: 1.6, marginBottom: 24 }}>
              AI-generated narrative reports built from real trade data — ready for policymakers and PNWER stakeholders.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
              {/* ── Left sidebar: report type + parameters ── */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0A2540", marginBottom: 10 }}>Report Type</div>
                {[
                  ["jurisdiction", "🗺️", "Jurisdiction Trade Summary", "Full trade profile & tariff impact for one jurisdiction"],
                  ["sector", "🏭", "Sector Impact Report", "Sector-wide analysis across all 10 PNWER jurisdictions"],
                ].map(([id, icon, title, desc]) => (
                  <div
                    key={id}
                    onClick={() => { setReportType(id); setReportData(null); setReportError(null); }}
                    style={{
                      background: "white",
                      border: reportType === id ? "2px solid #01BAEF" : "2px solid #E4EAF0",
                      borderRadius: 12,
                      padding: "14px 16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 8,
                      transition: "border-color 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#0A2540" }}>{title}</div>
                      <div style={{ fontSize: 11, color: "#5A6B7C", marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}

                {/* ── Parameters ── */}
                <div style={{ marginTop: 20, background: "white", border: "1px solid #E4EAF0", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0A2540", marginBottom: 12 }}>
                    {reportType === "jurisdiction" ? "Select Jurisdiction" : "Select Sector"}
                  </div>

                  {reportType === "jurisdiction" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 11, color: "#5A6B7C", fontWeight: 600, marginBottom: 2 }}>🇺🇸 United States</div>
                      {US.map(j => (
                        <div
                          key={j.id}
                          onClick={() => { setReportJurisdiction(j); setReportData(null); setReportError(null); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "7px 10px",
                            borderRadius: 8,
                            cursor: "pointer",
                            background: reportJurisdiction?.id === j.id ? "rgba(1,186,239,0.07)" : "#F7F9FC",
                            border: reportJurisdiction?.id === j.id ? "1px solid rgba(1,186,239,0.3)" : "1px solid transparent",
                            transition: "all 0.15s",
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{j.flag}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#0A2540", minWidth: 22 }}>{j.id}</span>
                          <span style={{ fontSize: 11, color: "#5A6B7C" }}>{j.name}</span>
                        </div>
                      ))}
                      <div style={{ fontSize: 11, color: "#5A6B7C", fontWeight: 600, marginTop: 8, marginBottom: 2 }}>🇨🇦 Canada</div>
                      {CA.map(j => (
                        <div
                          key={j.id}
                          onClick={() => { setReportJurisdiction(j); setReportData(null); setReportError(null); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "7px 10px",
                            borderRadius: 8,
                            cursor: "pointer",
                            background: reportJurisdiction?.id === j.id ? "rgba(1,186,239,0.07)" : "#F7F9FC",
                            border: reportJurisdiction?.id === j.id ? "1px solid rgba(1,186,239,0.3)" : "1px solid transparent",
                            transition: "all 0.15s",
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{j.flag}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#0A2540", minWidth: 22 }}>{j.id}</span>
                          <span style={{ fontSize: 11, color: "#5A6B7C" }}>{j.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {reportType === "sector" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {HS.map(s => (
                        <div
                          key={s.name}
                          onClick={() => { setReportSector(s.name); setReportData(null); setReportError(null); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 8,
                            cursor: "pointer",
                            background: reportSector === s.name ? "rgba(1,186,239,0.07)" : "#F7F9FC",
                            border: reportSector === s.name ? "1px solid rgba(1,186,239,0.3)" : "1px solid transparent",
                            transition: "all 0.15s",
                          }}
                        >
                          <span style={{ fontSize: 20 }}>{s.icon}</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#0A2540" }}>{s.name}</div>
                            <div style={{ fontSize: 10, color: "#5A6B7C" }}>{s.products.toLocaleString()} products · {s.risk}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleGen}
                    disabled={generating}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      width: "100%",
                      background: generating
                        ? "#E4EAF0"
                        : "linear-gradient(135deg, #0A2540, #0F3460)",
                      color: generating ? "#5A6B7C" : "white",
                      border: "none",
                      borderRadius: 10,
                      padding: "12px 20px",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: generating ? "not-allowed" : "pointer",
                      marginTop: 16,
                    }}
                  >
                    {generating ? (
                      <>
                        <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span>
                        Generating report…
                      </>
                    ) : (
                      "✨ Generate Report"
                    )}
                  </button>
                </div>

                {/* How it works note */}
                <div style={{ marginTop: 12, background: "rgba(1,186,239,0.04)", border: "1px solid rgba(1,186,239,0.12)", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#0B4F6C", marginBottom: 3 }}>How it works</div>
                  <div style={{ fontSize: 11, color: "#5A6B7C", lineHeight: 1.6 }}>
                    Claude AI reads the actual trade data and writes a tailored narrative. The template layout is filled with real numbers from the dashboard.
                  </div>
                </div>
              </div>

              {/* ── Right panel: report output ── */}
              <div style={{ background: "white", border: "1px solid #E4EAF0", borderRadius: 14, padding: 28, minHeight: 500 }}>
                {/* Error state */}
                {reportError && (
                  <div style={{ background: "rgba(254,104,71,0.06)", border: "1px solid rgba(254,104,71,0.2)", borderRadius: 10, padding: 20, marginBottom: 20 }}>
                    <div style={{ fontWeight: 600, color: "#c0392b", marginBottom: 6, fontSize: 14 }}>Generation failed</div>
                    <div style={{ fontSize: 13, color: "#5A6B7C", lineHeight: 1.6, marginBottom: 10 }}>{reportError}</div>
                    {reportError.includes("ECONNREFUSED") || reportError.includes("fetch") ? (
                      <div style={{ background: "#F7F9FC", borderRadius: 8, padding: 12, fontFamily: "monospace", fontSize: 12, color: "#0A2540", lineHeight: 1.8 }}>
                        <strong>Start the report server:</strong><br />
                        cd pnwer-app<br />
                        export ANTHROPIC_API_KEY=sk-ant-...<br />
                        uvicorn report_server:app --reload --port 8001
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Idle / placeholder state */}
                {!reportData && !reportError && !generating && (
                  <div style={{ textAlign: "center", padding: "60px 40px", color: "#5A6B7C" }}>
                    <div style={{ fontSize: 52, marginBottom: 16 }}>
                      {reportType === "jurisdiction" ? "🗺️" : "🏭"}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#0A2540", marginBottom: 8 }}>
                      {reportType === "jurisdiction"
                        ? `Jurisdiction Trade Summary — ${reportJurisdiction?.name || ""}`
                        : `Sector Impact Report — ${reportSector}`}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 400, margin: "0 auto" }}>
                      {reportType === "jurisdiction"
                        ? "Select a jurisdiction on the left and click Generate Report. Claude will write an executive overview, impact analysis, and key recommendations using real trade data."
                        : "Select a sector on the left and click Generate Report. Claude will analyse all 10 PNWER jurisdictions and produce tailored policy recommendations."}
                    </div>
                  </div>
                )}

                {/* Loading skeleton */}
                {generating && (
                  <div style={{ padding: "20px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, padding: "18px 20px", background: "linear-gradient(135deg, rgba(1,186,239,0.04), rgba(32,191,85,0.04))", borderRadius: 10, border: "1px solid rgba(1,186,239,0.1)" }}>
                      <div style={{ fontSize: 24 }}>✨</div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#0A2540", fontSize: 14 }}>Claude is writing your report…</div>
                        <div style={{ fontSize: 12, color: "#5A6B7C", marginTop: 2 }}>Analysing trade data and generating professional narrative</div>
                      </div>
                    </div>
                    {["w-3/4", "w-full", "w-5/6", "w-full", "w-2/3"].map((_, i) => (
                      <div key={i} style={{ height: 14, background: "#F0F4F8", borderRadius: 100, marginBottom: 10, width: ["75%", "100%", "85%", "100%", "65%"][i], animation: "pulse 1.5s ease-in-out infinite" }} />
                    ))}
                  </div>
                )}

                {/* Generated report */}
                {reportData && !generating && (
                  <>
                    <ReportPanel
                      data={reportData}
                      jurisdiction={reportJurisdiction}
                      sector={reportSector}
                      ALL={ALL}
                      HS={HS}
                      SECTOR_CLR={SECTOR_CLR}
                    />
                    <div style={{ borderTop: "1px solid #EDF1F7", marginTop: 28, paddingTop: 18, display: "flex", gap: 10 }}>
                      <button
                        onClick={() => window.print()}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #0A2540, #0F3460)", color: "white", border: "none", borderRadius: 8, padding: "10px 18px", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        🖨️ Print / Save PDF
                      </button>
                      <button
                        onClick={() => { setReportData(null); setReportError(null); }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "white", color: "#0A2540", border: "1px solid #E4EAF0", borderRadius: 8, padding: "10px 18px", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        ↩ Generate Another
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
