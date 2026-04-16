Add-Type -AssemblyName System.IO.Compression.FileSystem

$source = "D:\Tariff\Borderless Economics - Final Revised.pptx"
$tempRoot = Join-Path $env:TEMP ("ppt-revise-" + [guid]::NewGuid().ToString())
$extractRoot = Join-Path $tempRoot "deck"
$zipPath = Join-Path $tempRoot "deck.zip"

$slideText = @{
    2  = @(
        "Agenda",
        "01",
        "Problem & Partner",
        "Who we built for and why this matters",
        "02",
        "Project Journey",
        "How scope changed and what we learned",
        "03",
        "Solution & Demo",
        "Dashboard, model, and live walkthrough",
        "04",
        "Impact & Value",
        "Client value, evidence, and future steps"
    )
    4  = @(
        "The Team",
        "Name",
        "Role",
        "Contribution",
        "Varun Gehlot",
        "Data Engineering",
        "AWS pipeline, HS4 data",
        "Bhumika Yadav",
        "Project Lead",
        "Story, transitions, stakeholder alignment",
        "Shuhuan Ye",
        "Frontend",
        "React dashboard, Vercel deployment",
        "Cheng Li",
        "Backend + Model",
        "API, DID analysis, report flow"
    )
    5  = @(
        "Our Industry Partner: Pacific Northwest Economic Region (PNWER)",
        "Who They Are",
        "10 Jurisdictions",
        "Core Need",
        "2025 Trade Shock",
        "Cross-border nonprofit connecting U.S. states and Canadian provinces on regional policy.",
        "5 U.S. states + 5 Canadian provinces and territories.",
        "Needed one view of tariff exposure across the region.",
        "2025 tariffs hit general goods at 25% and Canadian energy at 10%.",
        "Why it matters",
        "Regional systems are shared",
        "Policy briefs were slow",
        "No single tool",
        "Energy, forestry, agriculture, and manufacturing move through one corridor.",
        "Staff were stitching together public data by hand."
    )
    6  = @(
        "Why This Matters",
        "The problem",
        '$58.9B -> $47.9B',
        "Trade corridor contracted in 2025",
        '$11.5B',
        "GDP at risk across PNWER",
        "63,899",
        "jobs exposed across 5 U.S. states",
        "40+ hrs",
        "manual work per policy brief",
        "Why analysis was hard",
        "Policy changed fast",
        "Energy followed different rules",
        "Official data lagged 2 months",
        "Sources were fragmented",
        "National totals hid regional differences",
        "No shared tool for 10 jurisdictions"
    )
    7  = @(
        "Business Case",
        "Why This Matters",
        """The real bottleneck was synthesis, not data.""",
        "For PNWER",
        "Turn 40+ hours of manual work into a briefing-ready dashboard.",
        "For the Region",
        "Support decisions affecting jobs, GDP, and shared supply chains.",
        "For the 2026 USMCA Review",
        "Give negotiators region-specific evidence before the review window."
    )
    9  = @(
        "Original Goals & Initial Scope",
        "Objectives",
        "Build one dashboard for all 10 jurisdictions",
        "Use official U.S. and Canadian trade data",
        "Forecast scenario changes with tariff sliders",
        "Generate report-ready outputs for policymakers",
        "Initial approach",
        "Data pipeline first",
        "Then model and API",
        "Then dashboard and reports",
        "Split workstreams early",
        "Target a usable MVP by midterm"
    )
    10 = @(
        "How the Project Evolved",
        "What we learned",
        "One tariff rate was wrong; energy needed separate treatment",
        "USMCA exemptions meant blanket Mexico assumptions would overstate damage",
        "Oil prices explained much of the energy story",
        "State-level heterogeneity mattered for PNWER",
        "Pivots we made",
        "Moved to sector-specific elasticities",
        "Added oil-price decomposition",
        "Prioritized causal attribution over headline accuracy",
        "Kept policy usability front and center"
    )
    11 = @(
        "Scope Expansions & Milestones",
        "Added beyond the original charter",
        "Oil-price decomposition",
        "DID + Triple-DID evidence",
        "HS4 product-level detail",
        "Bilateral U.S.-Canada view",
        "Milestones",
        "Data pipeline live",
        "Dashboard MVP deployed",
        "Forecast model calibrated",
        "AI reports integrated",
        "Documentation completed",
        "Ready for client handoff"
    )
    12 = @(
        "Key Challenges & How We Overcame Them",
        "Energy sector",
        "Tariff effects were mixed with WTI price movements.",
        "Built a three-factor decomposition to separate causes.",
        "USMCA scope",
        "Blanket assumptions overstated Mexico exposure.",
        "Added exemption logic and sector-specific calibration.",
        "Data publication lag",
        "Official releases arrive late by design.",
        "Automated monthly refresh with a clear data-as-of timestamp."
    )
    14 = @(
        "Design Rationale",
        "What we chose and why",
        "Causal attribution over misleading headline accuracy",
        "Public, no-login deployment for policy use",
        "AI reports with a low-cost primary model and a fallback",
        "Demo mode for offices without API keys",
        "Alternative not taken",
        "Chasing a higher accuracy number without fixing attribution",
        "That would be less defensible for advocacy and briefing work"
    )
    15 = @(
        "Architecture Pipeline",
        "Solution & Deliverable",
        "5-stage workflow",
        "Data Sources",
        "Census, Statistics Canada, BEA multipliers, WTI",
        "Pipeline",
        "Collectors plus monthly refresh automation",
        "Econometric Model",
        "CES/Armington, DID, Triple-DID, oil decomposition",
        "API Backend",
        "FastAPI forecast, refresh, and report endpoints",
        "React Dashboard",
        "Public dashboard deployed on Vercel"
    )
    16 = @(
        "Live Demo",
        "Overview tab",
        "Trends plus jurisdiction cards",
        "Modeling tab",
        "DID results plus tariff scenario sliders",
        "Reports tab",
        "Generate a policy brief in seconds"
    )
    17 = @(
        "Model Results",
        "Key takeaway",
        "Tariffs drove most of the 2025 trade decline, but energy needs separate interpretation.",
        "Trade loss",
        'Predicted: -$7.8B',
        'Actual: -$10.9B',
        "Overall accuracy: 72%",
        "Excluding energy",
        "~98% accuracy",
        "Best-fit sectors",
        "Minerals calibrated best; manufacturing directionally strong",
        "Energy gap",
        "Pipeline crude is USMCA-exempt and highly WTI-sensitive",
        "Decomposition",
        'Tariff effect: -$7.8B',
        'Oil-price effect: -$2.9B',
        'Residual: -$0.2B',
        "The model is most useful when it explains the cause, not just the total."
    )
    18 = @(
        "Sector Findings",
        "Solution & Deliverable - Sector-Level Impact",
        "Biggest signal",
        "Manufacturing and forestry were the most exposed sectors",
        "Manufacturing",
        "Cross-border industrial supply chains took the largest shock",
        "Forestry",
        "Integrated BC-PNW lumber flows saw severe disruption",
        "Agriculture",
        "Impacts were real, but producers adapted better than our first model assumed",
        "Energy",
        "Economically critical, but tariff attribution is limited by oil-price dynamics",
        "Canada",
        "Retaliation widened bilateral losses and hit U.S. farm exports"
    )
    19 = @(
        "Impact & Value",
        "One platform replaced scattered data pulls with a shareable dashboard, defensible tariff estimates, and faster policy-ready communication for PNWER."
    )
    20 = @(
        "Reflection & Next Steps",
        "Interdisciplinary collaboration made the solution stronger. Next steps are persistent storage, finer Mexico-side analysis, alerting, UI refinement, and poster polish. Thank you to PNWER, Oscar Veliz, and our mentors."
    )
    21 = @(
        "Thank You / Q&A"
    )
}

function Set-SlideText {
    param(
        [string]$SlidePath,
        [string[]]$Texts
    )

    [xml]$doc = Get-Content -LiteralPath $SlidePath -Raw
    $ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
    $ns.AddNamespace("a", "http://schemas.openxmlformats.org/drawingml/2006/main")
    $textNodes = $doc.SelectNodes("//a:t", $ns)

    for ($i = 0; $i -lt $textNodes.Count; $i++) {
        if ($i -lt $Texts.Count) {
            $textNodes[$i].InnerText = $Texts[$i]
        }
        else {
            $textNodes[$i].InnerText = ""
        }
    }

    $doc.Save($SlidePath)
}

if (Test-Path $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $extractRoot | Out-Null
[System.IO.Compression.ZipFile]::ExtractToDirectory($source, $extractRoot)

foreach ($slideNumber in $slideText.Keys) {
    $slidePath = Join-Path $extractRoot ("ppt\slides\slide{0}.xml" -f $slideNumber)
    if (-not (Test-Path -LiteralPath $slidePath)) {
        throw "Missing slide XML: $slidePath"
    }
    Set-SlideText -SlidePath $slidePath -Texts $slideText[$slideNumber]
}

if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($extractRoot, $zipPath)
Copy-Item -LiteralPath $zipPath -Destination $source -Force

Remove-Item -LiteralPath $tempRoot -Recurse -Force
Write-Output "Revised PPT saved to $source"
