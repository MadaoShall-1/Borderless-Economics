import { useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";

// ═══════════════════════════════════════════════════════════════
// Real data from local JSON files (Census Bureau / model outputs)
// ═══════════════════════════════════════════════════════════════

// US jurisdictions — trade values from tariff_bilateral_integrated.json (2024 $M)
// Sector breakdowns from pnwer_analysis_data_v9.json state_trade (CA+MX 2024)
// GDP impact % computed from gdp_at_risk_M / state GDP estimates
// Top exports from v9 focus_products + actual export volumes
const US = [
  { id: "WA", name: "Washington", flag: "🇺🇸", trade: 31.3, topExport: "Aircraft & Spacecraft", gdpImpact: -0.8, jobs: 38703,
    sectors: { Agriculture: 4.70, Manufacturing: 6.91, Energy: 11.93, Forestry: 2.25 } },
  { id: "OR", name: "Oregon", flag: "🇺🇸", trade: 14.3, topExport: "Integrated Circuits", gdpImpact: -1.8, jobs: 31312,
    sectors: { Agriculture: 1.29, Manufacturing: 8.15, Energy: 0.45, Forestry: 0.98 } },
  { id: "ID", name: "Idaho", flag: "🇺🇸", trade: 3.7, topExport: "Wheat & Agriculture", gdpImpact: -0.8, jobs: 6268,
    sectors: { Agriculture: 1.25, Manufacturing: 0.54, Energy: 0.10, Forestry: 0.45 } },
  { id: "MT", name: "Montana", flag: "🇺🇸", trade: 7.9, topExport: "Crude Petroleum", gdpImpact: -1.3, jobs: 4592,
    sectors: { Agriculture: 0.80, Manufacturing: 0.48, Energy: 5.26, Forestry: 0.17 } },
  { id: "AK", name: "Alaska", flag: "🇺🇸", trade: 1.7, topExport: "Minerals & Ores", gdpImpact: -0.3, jobs: 924,
    sectors: { Agriculture: 0.12, Manufacturing: 0.33, Energy: 0.53, Forestry: 0.03 } },
];

// Canadian provinces — no Census bilateral data available; marked as estimates
// These are order-of-magnitude estimates for PNWER context
const CA = [
  { id: "BC", name: "British Columbia", flag: "🇨🇦", trade: 28.4, topExport: "Lumber & Wood", gdpImpact: -2.8, jobs: 198000,
    sectors: { Agriculture: 3.6, Manufacturing: 8.2, Energy: 5.1, Forestry: 6.8 }, estimated: true },
  { id: "AB", name: "Alberta", flag: "🇨🇦", trade: 42.1, topExport: "Crude Oil", gdpImpact: -3.5, jobs: 245000,
    sectors: { Agriculture: 5.2, Manufacturing: 9.4, Energy: 22.1, Forestry: 1.8 }, estimated: true },
  { id: "SK", name: "Saskatchewan", flag: "🇨🇦", trade: 16.7, topExport: "Potash & Uranium", gdpImpact: -2.9, jobs: 67000,
    sectors: { Agriculture: 8.4, Manufacturing: 2.1, Energy: 4.6, Forestry: 0.9 }, estimated: true },
  { id: "YT", name: "Yukon", flag: "🇨🇦", trade: 0.8, topExport: "Gold & Minerals", gdpImpact: -1.1, jobs: 2200,
    sectors: { Agriculture: 0.05, Manufacturing: 0.1, Energy: 0.15, Forestry: 0.08 }, estimated: true },
  { id: "NT", name: "NW Territories", flag: "🇨🇦", trade: 0.6, topExport: "Diamonds", gdpImpact: -0.9, jobs: 1800,
    sectors: { Agriculture: 0.02, Manufacturing: 0.08, Energy: 0.3, Forestry: 0.05 }, estimated: true },
];
const ALL = [...US, ...CA];
const COLORS = ["#0B4F6C","#01BAEF","#20BF55","#FBB13C","#FE6847","#764BA2","#3A7CA5","#81C784","#F48FB1","#FFD54F"];
const SECTOR_CLR = { Agriculture: "#4CAF50", Manufacturing: "#2196F3", Energy: "#FF9800", Forestry: "#795548" };

// ═══ PNWER total trade to CA+MX by year (from pnwer_analysis_data_v9.json state_trade) ═══
const YEARLY = [
  { year: "2017", pnwer: 38.7 },
  { year: "2018", pnwer: 42.9 },
  { year: "2019", pnwer: 44.5 },
  { year: "2020", pnwer: 36.6 },
  { year: "2021", pnwer: 52.0 },
  { year: "2022", pnwer: 66.8 },
  { year: "2023", pnwer: 62.5 },
  { year: "2024", pnwer: 58.8 },
  { year: "2025", pnwer: 48.0 },
];

// ═══ National US trade: USMCA vs Control (from national_trade.json, $B) ═══
const NATIONAL_YEARLY = [
  { year: "2017", usmca: 1138.1, control: 604.8 },
  { year: "2018", usmca: 1228.0, control: 458.7 },
  { year: "2019", usmca: 1224.2, control: 672.3 },
  { year: "2020", usmca: 1062.2, control: 592.2 },
  { year: "2021", usmca: 1326.6, control: 688.4 },
  { year: "2022", usmca: 1575.5, control: 775.7 },
  { year: "2023", usmca: 1569.0, control: 779.3 },
  { year: "2024", usmca: 1601.3, control: 808.3 },
  { year: "2025", usmca: 1457.8, control: 749.8 },
];

// ═══ DID model results (from analysis_results_v6.json) ═══
// Layer 1: β = -0.12%, p = 0.9828 (insignificant at national level)
// Layer 2: θ = +58.81%, p = 0.0314 (significant at 5%)
// Indexed to 100 at 2017 for visualization
const DID_DATA = [
  { period: "2017", treated: 100.0, control: 100.0 },
  { period: "2018", treated: 107.9, control: 75.9 },
  { period: "2019", treated: 107.6, control: 111.2 },
  { period: "2020", treated: 93.4, control: 97.9 },
  { period: "2021", treated: 116.6, control: 113.8 },
  { period: "2022", treated: 138.4, control: 128.3 },
  { period: "2023", treated: 137.9, control: 128.9 },
  { period: "2024", treated: 140.7, control: 133.7 },
  { period: "2025", treated: 128.1, control: 124.0 },
];

// ═══ DDD chart: state-level trade 2024 vs model-predicted post-tariff ═══
// From tariff_bilateral_integrated.json by_state
const DDD_DATA = [
  { id: "WA", current: 31.3, postModel: 28.1, actual25: 26.3 },
  { id: "OR", current: 14.3, postModel: 11.9, actual25: 10.3 },
  { id: "ID", current: 3.7, postModel: 3.3, actual25: 3.1 },
  { id: "MT", current: 7.9, postModel: 7.4, actual25: 6.3 },
  { id: "AK", current: 1.7, postModel: 1.6, actual25: 1.9 },
];

// ═══ Industry/Sector data (from tariff_bilateral_integrated.json by_industry) ═══
const HS = [
  { name: "Agriculture", code: "HS 01-24", baseM: 8162, riskM: 1256, icon: "🌾", color: "#4CAF50" },
  { name: "Manufacturing", code: "HS 84-90", baseM: 16415, riskM: 2888, icon: "🏭", color: "#2196F3" },
  { name: "Energy", code: "HS 27", baseM: 18274, riskM: 631, icon: "⚡", color: "#FF9800" },
  { name: "Forestry", code: "HS 44-49", baseM: 3883, riskM: 767, icon: "🌲", color: "#795548" },
  { name: "Minerals", code: "HS 26, 72-76", baseM: 2658, riskM: 298, icon: "⛏️", color: "#9C27B0" },
  { name: "Other", code: "Other HS", baseM: 9455, riskM: 728, icon: "📦", color: "#607D8B" },
];

// ═══ Summary stats from tariff_bilateral_integrated.json ═══
const SUMMARY = {
  totalTrade2024B: 58.8,
  totalTrade2025B: 48.0,
  tradeLossB: -10.9,
  tradeLossPct: -18.5,
  gdpAtRiskM: 13156.3,
  jobsAtRisk: 81799,
  tariffEffectB: -6.6,
  tariffSharePct: 60,
  oilEffectB: -2.9,
  oilSharePct: 26,
  residualB: -1.4,
  residualSharePct: 13,
};

export default function PNWERDashboard() {
  const [tab, setTab] = useState("overview");
  const [sel, setSel] = useState(null);
  const [model, setModel] = useState("did");
  const [tariff, setTariff] = useState(25);
  const [reportType, setReportType] = useState("executive");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGen = () => {
    setGenerating(true);
    setGenerated(false);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 2000);
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
        {j.estimated && <div style={{ fontSize: 9, color: "#FBB13C", marginTop: 2 }}>est.</div>}
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
              Interactive analysis of how 2025 U.S. tariff actions affect 5 states and 5 provinces across the US-Canada border — powered by DID, Triple-DID, and CES/Armington econometric modeling.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, maxWidth: 880 }}>
              {[
                [`$${SUMMARY.totalTrade2024B}B`, "PNWER Trade (2024)", "#01BAEF"],
                ["10", "Jurisdictions Covered", "#20BF55"],
                [`$${SUMMARY.gdpAtRiskM.toLocaleString()}M`, "GDP at Risk", "#FBB13C"],
                [`${SUMMARY.jobsAtRisk.toLocaleString()}`, "Jobs at Risk", "#FE6847"],
              ].map(([v, l, c], i) => (
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
            <div style={{ fontSize: 14, color: "#5A6B7C", lineHeight: 1.6, marginBottom: 24 }}>Select a jurisdiction to explore its trade profile, sector composition, and tariff vulnerability. US data from Census Bureau; Canadian provinces are estimates pending extension.</div>

            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 8, color: "#3A7CA5" }}>🇺🇸 United States</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
              {US.map(j => <JurCard key={j.id} j={j} />)}
            </div>

            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 8, color: "#FE6847" }}>🇨🇦 Canada (Estimates)</div>
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
                      <div style={{ fontSize: 28, fontWeight: 700 }}>{sel.name} {sel.estimated && <span style={{ fontSize: 13, color: "#FBB13C" }}>(estimated)</span>}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>Top Export: {sel.topExport}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 18 }}>
                    {[
                      ["Total Trade (2024)", "$" + sel.trade + "B", "#01BAEF"],
                      ["Jobs at Risk", sel.jobs.toLocaleString(), "white"],
                      ["GDP Impact", sel.gdpImpact + "%", "#FE6847"],
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
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#0A2540" }}>PNWER Trade to CA+MX ($B)</span>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "rgba(1,186,239,0.08)", color: "#0B4F6C", fontWeight: 600 }}>2017–2025</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={YEARLY}>
                    <defs>
                      <linearGradient id="gPnwer" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#01BAEF" stopOpacity={0.2} /><stop offset="100%" stopColor="#01BAEF" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={v => `$${v}B`} />
                    <Area type="monotone" dataKey="pnwer" name="PNWER Total Trade" stroke="#01BAEF" fill="url(#gPnwer)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 10, color: "#5A6B7C", marginTop: 6, textAlign: "center" }}>Source: U.S. Census Bureau state-level trade data (5 PNWER states to CA+MX)</div>
              </div>
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#0A2540" }}>Trade Share by Jurisdiction</span>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "rgba(1,186,239,0.08)", color: "#0B4F6C", fontWeight: 600 }}>${SUMMARY.totalTrade2024B}B Total (US)</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={US.map((j, i) => ({ name: j.id + " " + j.name, value: j.trade }))} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                      {US.map((j, i) => <Cell key={j.id} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={v => `$${v}B`} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" }}>
                  {US.map((j, i) => (
                    <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i] }} />{j.id} ({j.name})
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
            <div style={{ fontSize: 14, color: "#5A6B7C", lineHeight: 1.6, marginBottom: 24 }}>Three-layer framework: National DID, State-level Triple-DID, and CES/Armington tariff shock model.</div>

            <div style={{ display: "flex", gap: 2, background: "#EDF1F7", borderRadius: 10, padding: 3, width: "fit-content", marginBottom: 20 }}>
              {[["did", "Layer 1: DID"], ["ddd", "Layer 2: Triple-DID"], ["impact", "Layer 3: Tariff Impact"]].map(([id, label]) => (
                <button key={id} onClick={() => setModel(id)} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: model === id ? "white" : "transparent", color: model === id ? "#0A2540" : "#5A6B7C", fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer", boxShadow: model === id ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>{label}</button>
              ))}
            </div>

            {/* DID */}
            {model === "did" && (
              <div>
                <div style={{ background: "linear-gradient(135deg, rgba(1,186,239,0.04), rgba(32,191,85,0.04))", border: "1px solid rgba(1,186,239,0.12)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: "#0A2540", marginBottom: 6 }}>Layer 1: National-Level Difference-in-Differences</h4>
                  <p style={{ fontSize: 13, color: "#5A6B7C", lineHeight: 1.65 }}>
                    ln(X<sub>p,t</sub>) = β(USMCA<sub>p</sub> × Post<sub>t</sub>) + FE<sub>p</sub> + FE<sub>t</sub> + ε — Compares US trade with USMCA partners (CA, MX) vs. control countries (JP, KR, UK, DE) across pre-USMCA (2017–2019) vs. post (2021–2025).
                  </p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#0A2540" }}>National: USMCA vs Control (indexed)</span>
                      <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "rgba(1,186,239,0.08)", color: "#0B4F6C", fontWeight: 600 }}>2017=100</span>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={DID_DATA}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 12 }} domain={[70, 150]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="treated" name="USMCA Partners" stroke="#01BAEF" strokeWidth={3} dot={{ r: 5, fill: "#01BAEF" }} />
                        <Line type="monotone" dataKey="control" name="Non-USMCA Control" stroke="#FBB13C" strokeWidth={3} dot={{ r: 5, fill: "#FBB13C" }} strokeDasharray="8 4" />
                      </LineChart>
                    </ResponsiveContainer>
                    <div style={{ fontSize: 10, color: "#5A6B7C", marginTop: 6, textAlign: "center" }}>Source: Census Bureau national trade data</div>
                  </div>
                  <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0A2540", marginBottom: 16 }}>Layer 1 Results</div>
                    {[
                      ["📉", "DID Coefficient (β)", "-0.12%", "USMCA effect on national trade — statistically insignificant"],
                      ["📊", "p-value", "0.9828", "Cannot reject null: no significant national USMCA effect"],
                      ["🔢", "Observations", "48", "6 countries × 8 years (excl. 2020)"],
                      ["📐", "R²", "0.9948", "Very high fit with partner + year fixed effects"],
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
                    <div style={{ background: "rgba(251,177,60,0.08)", border: "1px solid rgba(251,177,60,0.2)", borderRadius: 8, padding: 12, marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#0A2540", marginBottom: 4 }}>Key Insight</div>
                      <div style={{ fontSize: 12, color: "#5A6B7C", lineHeight: 1.6 }}>At the national level, USMCA and non-USMCA trade grew at similar rates (~18%). The USMCA effect is masked by national aggregation — motivating Layer 2 state-level analysis.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DDD */}
            {model === "ddd" && (
              <div>
                <div style={{ background: "linear-gradient(135deg, rgba(1,186,239,0.04), rgba(32,191,85,0.04))", border: "1px solid rgba(1,186,239,0.12)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: "#0A2540", marginBottom: 6 }}>Layer 2: State-Level Triple Difference (DDD)</h4>
                  <p style={{ fontSize: 13, color: "#5A6B7C", lineHeight: 1.65 }}>
                    θ measures whether PNWER states' exports to USMCA partners grew more (relative to control countries) than non-PNWER states. Three-way crossed FE: State × Year, State × Partner, Partner × Year.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                  <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0A2540", marginBottom: 16 }}>Layer 2 Results</div>
                    {[
                      ["🎯", "DDD Coefficient (θ)", "+58.81%", "PNWER states gained ~59% more from USMCA than other states"],
                      ["📊", "p-value", "0.0314", "Significant at 5% level"],
                      ["🔢", "Observations", "1,200", "25 states × 6 partners × 8 years"],
                      ["📐", "t-statistic", "2.286", "Robust to three-way fixed effects"],
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
                  <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0A2540", marginBottom: 16 }}>Descriptive DDD Decomposition</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[
                        ["PNWER→USMCA growth", "+37.7%", "#20BF55"],
                        ["PNWER→Control growth", "-16.7%", "#FE6847"],
                        ["PNWER within-DID", "+54.4%", "#01BAEF"],
                        ["Non-PNWER within-DID", "-4.1%", "#FBB13C"],
                      ].map(([label, val, color], i) => (
                        <div key={i} style={{ background: "#F7F9FC", borderRadius: 8, padding: 12 }}>
                          <div style={{ fontSize: 10, color: "#5A6B7C", marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: "rgba(32,191,85,0.08)", border: "1px solid rgba(32,191,85,0.15)", borderRadius: 8, padding: 12, marginTop: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#0A2540", marginBottom: 4 }}>Key Insight</div>
                      <div style={{ fontSize: 12, color: "#5A6B7C", lineHeight: 1.6 }}>PNWER states benefited disproportionately from USMCA — meaning they also face disproportionate risk from tariff disruption. Simple DDD: +58.5%, consistent with regression θ = +58.81%.</div>
                    </div>
                  </div>
                </div>

                <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#0A2540" }}>State Trade: 2024 Baseline vs 2025 Actual ($B)</span>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "rgba(254,104,71,0.08)", color: "#FE6847", fontWeight: 600 }}>Post-Tariff</span>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={DDD_DATA} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7" />
                      <XAxis dataKey="id" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={v => `$${v}B`} />
                      <Bar dataKey="current" name="2024 Trade" fill="#01BAEF" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="postModel" name="Model Predicted" fill="#FBB13C" radius={[5, 5, 0, 0]} opacity={0.8} />
                      <Bar dataKey="actual25" name="2025 Actual" fill="#FE6847" radius={[5, 5, 0, 0]} opacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: 10, color: "#5A6B7C", marginTop: 6, textAlign: "center" }}>Source: Census Bureau bilateral trade data + CES/Armington model</div>
                </div>
              </div>
            )}

            {/* Layer 3: Tariff Impact */}
            {model === "impact" && (
              <div>
                <div style={{ background: "linear-gradient(135deg, rgba(1,186,239,0.04), rgba(32,191,85,0.04))", border: "1px solid rgba(1,186,239,0.12)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: "#0A2540", marginBottom: 6 }}>Layer 3: CES/Armington Tariff Shock Model</h4>
                  <p style={{ fontSize: 13, color: "#5A6B7C", lineHeight: 1.65 }}>Calibrated to PNWER Census data with region-specific effective tariff rates (CA ~8%, MX ~9%). PNWER rates are ~3x the national average due to energy/forestry/minerals mix with lower USMCA compliance and Section 232 stacking.</p>
                </div>

                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
                  {[
                    ["💰", "rgba(254,104,71,0.08)", "Trade Loss (2025)", `$${Math.abs(SUMMARY.tradeLossB)}B (${SUMMARY.tradeLossPct}%)`, "#FE6847"],
                    ["📉", "rgba(251,177,60,0.08)", "GDP at Risk", `$${(SUMMARY.gdpAtRiskM / 1000).toFixed(1)}B`, "#FBB13C"],
                    ["👷", "rgba(1,186,239,0.08)", "Jobs at Risk", SUMMARY.jobsAtRisk.toLocaleString(), "#0B4F6C"],
                    ["🔄", "rgba(32,191,85,0.08)", "Tariff-Driven Share", `${SUMMARY.tariffSharePct}%`, "#20BF55"],
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

                {/* Decomposition + Industry */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                  <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0A2540", marginBottom: 16 }}>Trade Decline Decomposition</div>
                    <div style={{ fontSize: 13, color: "#5A6B7C", lineHeight: 1.6, marginBottom: 14 }}>
                      Total observed decline: ${Math.abs(SUMMARY.tradeLossB)}B
                    </div>
                    {[
                      ["Tariff Effect", `$${Math.abs(SUMMARY.tariffEffectB)}B`, `${SUMMARY.tariffSharePct}%`, "#FE6847"],
                      ["Oil Price Effect", `$${Math.abs(SUMMARY.oilEffectB)}B`, `${SUMMARY.oilSharePct}%`, "#FF9800"],
                      ["Residual / Other", `$${Math.abs(SUMMARY.residualB)}B`, `${SUMMARY.residualSharePct}%`, "#5A6B7C"],
                    ].map(([label, val, pct, color], i) => (
                      <div key={i} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                          <span style={{ fontWeight: 500 }}>{label}</span>
                          <span style={{ fontWeight: 600, color: "#0A2540" }}>{val} ({pct})</span>
                        </div>
                        <div style={{ height: 8, background: "#EDF1F7", borderRadius: 100, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 100, width: pct, background: color, transition: "width 0.6s" }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "#5A6B7C", marginTop: 10, lineHeight: 1.5 }}>
                      Note: Oil price adjustment separates WTI-driven energy import decline from pure tariff effects.
                    </div>
                  </div>
                  <div style={{ background: "white", borderRadius: 14, border: "1px solid #E4EAF0", padding: 24 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0A2540", marginBottom: 16 }}>Industry Risk ($M at Risk)</div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={HS} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={v => `$${v}M`} />
                        <Bar dataKey="riskM" name="Model Loss ($M)" fill="#FE6847" radius={[0, 5, 5, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ fontSize: 10, color: "#5A6B7C", marginTop: 6, textAlign: "center" }}>Source: CES/Armington model import + export side combined</div>
                  </div>
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
            <div style={{ fontSize: 14, color: "#5A6B7C", lineHeight: 1.6, marginBottom: 24 }}>Compile data and analysis into shareable reports for PNWER stakeholders and policymakers.</div>

            <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0A2540", marginBottom: 10 }}>Report Type</div>
                {[
                  ["executive", "📋", "Executive Summary", "High-level brief for policymakers"],
                  ["jurisdiction", "🗺️", "Jurisdiction Report", "Deep dive into a specific region"],
                  ["sector", "🏭", "Sector Analysis", "Industry-specific tariff impacts"],
                  ["recommendation", "💡", "PNWER Policy Brief", "Recommendations & action items"],
                ].map(([id, icon, title, desc]) => (
                  <div key={id} onClick={() => { setReportType(id); setGenerated(false); }} style={{ background: "white", border: reportType === id ? "2px solid #01BAEF" : "2px solid #E4EAF0", borderRadius: 12, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>{icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
                      <div style={{ fontSize: 11, color: "#5A6B7C", marginTop: 1 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: "white", border: "1px solid #E4EAF0", borderRadius: 14, padding: 28, minHeight: 450 }}>
                <div style={{ borderBottom: "2px solid #0A2540", paddingBottom: 14, marginBottom: 20 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#0A2540" }}>
                    {reportType === "executive" && "📋 Executive Summary"}
                    {reportType === "jurisdiction" && "🗺️ Jurisdiction Report"}
                    {reportType === "sector" && "🏭 Sector Analysis"}
                    {reportType === "recommendation" && "💡 PNWER Policy Brief"}
                  </div>
                </div>

                {reportType === "executive" && (
                  <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#5A6B7C" }}>
                    <p style={{ marginBottom: 14 }}><strong style={{ color: "#0A2540" }}>Purpose:</strong> Provides PNWER leadership with a concise overview of tariff impact projections across all 10 jurisdictions ahead of the July 2026 USMCA review.</p>
                    <p style={{ marginBottom: 14 }}><strong style={{ color: "#0A2540" }}>Data:</strong> Three-layer econometric analysis (DID β=-0.12%, DDD θ=+58.81%, CES/Armington ~$13.2B GDP at risk), trade decomposition, and scenario projections.</p>
                    <p><strong style={{ color: "#0A2540" }}>Audience:</strong> PNWER board, state/provincial legislators, federal trade advisors.</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, margin: "20px 0" }}>
                      {[
                        [`$${SUMMARY.totalTrade2024B}B`, "PNWER Trade"],
                        [`${SUMMARY.jobsAtRisk.toLocaleString()}`, "Jobs at Risk"],
                        [`${SUMMARY.tariffSharePct}%`, "Tariff-Driven"],
                      ].map(([v, l], i) => (
                        <div key={i} style={{ background: "#F7F9FC", borderRadius: 8, padding: 12, textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: "#0A2540" }}>{v}</div>
                          <div style={{ fontSize: 10, color: "#5A6B7C" }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reportType === "jurisdiction" && (
                  <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#5A6B7C" }}>
                    <p style={{ marginBottom: 14 }}>Detailed trade profile for any PNWER jurisdiction: bilateral flows, industry breakdown, tariff vulnerability, model-predicted impacts.</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
                      {ALL.map(j => (
                        <span key={j.id} style={{ padding: "5px 12px", borderRadius: 100, background: "#F0F4F8", fontSize: 11, fontWeight: 500, color: "#0A2540" }}>{j.flag} {j.id} {j.estimated ? "(est.)" : ""}</span>
                      ))}
                    </div>
                  </div>
                )}

                {reportType === "sector" && (
                  <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#5A6B7C" }}>
                    <p style={{ marginBottom: 14 }}>Industry-level analysis: import/export baselines, model-predicted losses, oil price adjustment for energy sector.</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
                      {HS.map((s, i) => (
                        <div key={i} style={{ padding: 12, borderRadius: 8, border: "1px solid #E4EAF0", display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 20 }}>{s.icon}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{s.name}</div>
                            <div style={{ fontSize: 10, color: "#5A6B7C" }}>Base: ${(s.baseM / 1000).toFixed(1)}B · Risk: ${s.riskM}M</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reportType === "recommendation" && (
                  <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#5A6B7C" }}>
                    <p style={{ marginBottom: 14 }}>Data-backed policy recommendations for PNWER advocacy: talking points, risk mitigation, comparative analysis.</p>
                    <div style={{ background: "rgba(32,191,85,0.06)", border: "1px solid rgba(32,191,85,0.15)", borderRadius: 8, padding: 14, marginTop: 14 }}>
                      <div style={{ fontWeight: 600, color: "#0A2540", marginBottom: 4, fontSize: 13 }}>Suggested Sections</div>
                      <div style={{ fontSize: 12, lineHeight: 1.8 }}>USMCA Compliance Benefits · Trade Diversion Risk · Supply Chain Vulnerability · Oil Price vs Tariff Decomposition · State/Provincial Actions · Federal Advocacy</div>
                    </div>
                  </div>
                )}

                <button onClick={handleGen} disabled={generating} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: generated ? "#20BF55" : "linear-gradient(135deg, #0A2540, #0F3460)", color: "white", border: "none", borderRadius: 10, padding: "12px 24px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 20, opacity: generating ? 0.7 : 1 }}>
                  {generating ? "⏳ Generating..." : generated ? "✅ Download PDF" : "📄 Generate Report"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}