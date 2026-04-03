/**
 * ReportPanel — LLM-powered report template renderer
 *
 * Renders either a Jurisdiction Trade Summary or a Sector Impact Report.
 * The `data` prop contains the structured narrative returned by the report server.
 * All other props supply the raw dashboard data for the data sections of the report.
 */

const SECTION_TITLE = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 2.5,
  color: "#0B4F6C",
  marginBottom: 12,
  paddingBottom: 6,
  borderBottom: "2px solid #EDF1F7",
};

const NARRATIVE = {
  fontSize: 13.5,
  lineHeight: 1.85,
  color: "#3A4A5C",
};

const SECTION_WRAP = {
  marginBottom: 28,
  paddingBottom: 24,
  borderBottom: "1px solid #F0F4F8",
};

// Numbered bullet used for risks / recommendations
function Bullet({ index, text }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: "#F7F9FC",
        borderRadius: 8,
        padding: "10px 14px",
        border: "1px solid #EDF1F7",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          flexShrink: 0,
          background: "linear-gradient(135deg, #01BAEF, #20BF55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        {index + 1}
      </div>
      <span style={{ fontSize: 13, color: "#3A4A5C", lineHeight: 1.65 }}>{text}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Jurisdiction Trade Summary
// ─────────────────────────────────────────────────────────────
function JurisdictionReport({ narrative, jurisdiction, date, SECTOR_CLR }) {
  const j = jurisdiction;
  const sectorMax = Math.max(...Object.values(j.sectors));

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      {/* ── Report Header ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2540 0%, #0F3460 60%, #0B4F6C 100%)",
          borderRadius: 14,
          padding: "26px 28px",
          marginBottom: 28,
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <span style={{ fontSize: 38 }}>{j.flag}</span>
          <div>
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 3,
              }}
            >
              PNWER Trade Intelligence Platform · Jurisdiction Trade Summary
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{j.name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
              Report generated {date}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            ["Total Bilateral Trade", `$${j.trade}B`, "#01BAEF"],
            ["GDP Impact (25% Tariff)", `${j.gdpImpact}%`, "#FE6847"],
            ["Trade-Supported Jobs", j.jobs.toLocaleString(), "#FBB13C"],
            ["Top Export", j.topExport, "white"],
          ].map(([label, value, color]) => (
            <div
              key={label}
              style={{
                background: "rgba(255,255,255,0.06)",
                borderRadius: 8,
                padding: "11px 13px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.35)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginBottom: 4,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: label === "Top Export" ? 11 : 17,
                  fontWeight: 700,
                  color,
                  lineHeight: 1.3,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Executive Overview ── */}
      <div style={SECTION_WRAP}>
        <div style={SECTION_TITLE}>Executive Overview</div>
        <p style={NARRATIVE}>{narrative.executive_overview}</p>
      </div>

      {/* ── Sector Breakdown ── */}
      <div style={SECTION_WRAP}>
        <div style={SECTION_TITLE}>Sector Breakdown ($B)</div>
        {Object.entries(j.sectors).map(([sector, value]) => (
          <div key={sector} style={{ marginBottom: 11 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              <span style={{ fontWeight: 500, color: "#0A2540" }}>{sector}</span>
              <span style={{ fontWeight: 600, color: "#0A2540" }}>${value}B</span>
            </div>
            <div
              style={{
                height: 7,
                background: "#EDF1F7",
                borderRadius: 100,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 100,
                  width: `${(value / sectorMax) * 100}%`,
                  background: SECTOR_CLR[sector] || "#0B4F6C",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Tariff Impact Analysis ── */}
      <div style={SECTION_WRAP}>
        <div style={SECTION_TITLE}>Tariff Impact Analysis</div>
        <p style={NARRATIVE}>{narrative.impact_analysis}</p>
      </div>

      {/* ── Risks & Recommendations ── */}
      <div>
        <div style={SECTION_TITLE}>Key Risks &amp; Recommendations</div>
        {(narrative.risks_recommendations || []).map((item, i) => (
          <Bullet key={i} index={i} text={item} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sector Impact Report
// ─────────────────────────────────────────────────────────────
function SectorReport({ narrative, sector, date, ALL, HS, SECTOR_CLR }) {
  const hs = HS.find((h) => h.name === sector) || {};

  const jurisdictionsWithSector = ALL.map((j) => ({
    ...j,
    sectorValue: j.sectors[sector] || 0,
  }))
    .filter((j) => j.sectorValue > 0)
    .sort((a, b) => b.sectorValue - a.sectorValue);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      {/* ── Report Header ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2540 0%, #0F3460 60%, #0B4F6C 100%)",
          borderRadius: 14,
          padding: "26px 28px",
          marginBottom: 28,
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <span style={{ fontSize: 38 }}>{hs.icon || "🏭"}</span>
          <div>
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 3,
              }}
            >
              PNWER Trade Intelligence Platform · Sector Impact Report
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{sector}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
              Report generated {date}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            ["HS Code Range", hs.code || "N/A", "#01BAEF"],
            ["Products Analyzed", (hs.products || 0).toLocaleString(), "#FBB13C"],
            ["Trade at Risk", hs.risk || "N/A", "#FE6847"],
          ].map(([label, value, color]) => (
            <div
              key={label}
              style={{
                background: "rgba(255,255,255,0.06)",
                borderRadius: 8,
                padding: "11px 13px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.35)",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginBottom: 4,
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sector Overview ── */}
      <div style={SECTION_WRAP}>
        <div style={SECTION_TITLE}>Sector Overview</div>
        <p style={NARRATIVE}>{narrative.sector_overview}</p>
      </div>

      {/* ── Affected Jurisdictions ── */}
      <div style={SECTION_WRAP}>
        <div style={SECTION_TITLE}>
          Affected Jurisdictions ({jurisdictionsWithSector.length} of 10)
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 8,
          }}
        >
          {jurisdictionsWithSector.map((j) => (
            <div
              key={j.id}
              style={{
                background: "#F7F9FC",
                borderRadius: 8,
                padding: "10px 8px",
                textAlign: "center",
                border: "1px solid #EDF1F7",
              }}
            >
              <div style={{ fontSize: 18 }}>{j.flag}</div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 12,
                  color: "#0A2540",
                  marginTop: 2,
                }}
              >
                {j.id}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: SECTOR_CLR[sector] || "#0B4F6C",
                  fontWeight: 600,
                  marginTop: 2,
                }}
              >
                ${j.sectorValue}B
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Economic Impact Analysis ── */}
      <div style={SECTION_WRAP}>
        <div style={SECTION_TITLE}>Economic Impact Analysis</div>
        <p style={NARRATIVE}>{narrative.economic_impact}</p>
      </div>

      {/* ── Policy Recommendations ── */}
      <div>
        <div style={SECTION_TITLE}>Policy Recommendations</div>
        {(narrative.policy_recommendations || []).map((item, i) => (
          <Bullet key={i} index={i} text={item} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────
export default function ReportPanel({ data, jurisdiction, sector, ALL, HS, SECTOR_CLR }) {
  const { narrative, generated_at, report_type } = data;
  const date = new Date(generated_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (report_type === "jurisdiction") {
    return (
      <JurisdictionReport
        narrative={narrative}
        jurisdiction={jurisdiction}
        date={date}
        SECTOR_CLR={SECTOR_CLR}
      />
    );
  }

  if (report_type === "sector") {
    return (
      <SectorReport
        narrative={narrative}
        sector={sector}
        date={date}
        ALL={ALL}
        HS={HS}
        SECTOR_CLR={SECTOR_CLR}
      />
    );
  }

  return null;
}
