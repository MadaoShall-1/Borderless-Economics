# PNWER Trade Analysis
## Methodology Report

**Econometric Analysis of USMCA Effects on Pacific Northwest Trade**

February 2026

---

## Executive Summary

This report presents an econometric analysis of the United States-Mexico-Canada Agreement (USMCA) and its effects on trade for Pacific Northwest Economic Region (PNWER) states. Using a two-layer Difference-in-Differences (DID) and Triple Difference (DDD) framework, we examine whether PNWER states have benefited disproportionately from USMCA implementation.

### Key Findings

**Layer 1 (National DID):** USMCA did not produce a statistically significant increase in U.S. exports to member countries relative to comparable non-member economies.

**Layer 2 (State DDD):** PNWER states experienced a statistically significant heterogeneous effect. After controlling for state, partner, and year fixed effects, PNWER states' exports to USMCA partners (relative to non-USMCA partners) grew approximately **59 percentage points** more than non-PNWER states (**p = 0.034**).

---

## 1. Methodology

### 1.1 Research Design Overview

We employ a two-layer econometric framework to isolate the causal effect of USMCA on regional trade:

- **Layer 1:** National-level DID estimates the overall effect of USMCA on U.S. trade with member countries versus non-member countries.
- **Layer 2:** State-level DDD estimates whether PNWER states benefit more from USMCA than other U.S. states, using within-state variation in partner composition.

### 1.2 Time Period Specification

| Period | Years | Description |
|--------|-------|-------------|
| Pre-period | 2017-2019 | Before USMCA implementation |
| Post-period | 2021-2025 | After USMCA took effect |
| Excluded | 2020 | Transition year with COVID-19 confounding |

*Rationale: USMCA was signed in November 2018 and entered into force on July 1, 2020. Excluding 2020 removes both the transition period and pandemic-related trade disruptions.*

### 1.3 Treatment and Control Groups

#### Layer 1: National DID

| Group | Countries | Rationale |
|-------|-----------|-----------|
| Treatment | Canada, Mexico | USMCA member countries |
| Control | Japan, South Korea, UK, Germany | Large, stable economies without preferential trade agreements affected by simultaneous policy shocks |

*Note: China is excluded from the control group due to simultaneous tariff conflicts (2018-2019 trade war), which would confound identification.*

#### Layer 2: State DDD

| Group | States | N |
|-------|--------|---|
| Treatment (PNWER) | WA, OR, ID, MT, AK | 5 |
| Control (Border North) | MI, MN, ND, WI, NY | 5 |
| Control (West) | CA, NV, UT, CO, WY | 5 |
| Control (Energy/Agriculture) | TX, LA, OK, NE, KS | 5 |
| Control (Southeast) | FL, GA, NC, SC, VA | 5 |

Control states were selected based on geographic proximity to international borders, similar industry composition, and comparable trade infrastructure.

---

## 2. Econometric Specifications

### 2.1 Layer 1: National DID

The national-level model estimates whether U.S. exports to USMCA partners grew faster than exports to non-USMCA partners after the agreement took effect:

```
ln(X_pt) = β(USMCA_p × Post_t) + FE_p + FE_t + ε_pt
```

**Where:**
- `X_pt` = U.S. exports to partner country p in year t
- `USMCA_p` = 1 if partner is Canada or Mexico, 0 otherwise
- `Post_t` = 1 if year ≥ 2021, 0 otherwise
- `FE_p` = Partner country fixed effects
- `FE_t` = Year fixed effects
- `β` = DID estimator (coefficient of interest)

**Interpretation of β:** β represents the percentage change in U.S. exports to USMCA partners relative to control partners after USMCA implementation, holding constant time-invariant partner characteristics and common year shocks.

### 2.2 Layer 2: State DDD

The state-level model uses a triple difference specification with **three-way crossed fixed effects** to identify whether PNWER states benefit disproportionately from USMCA:

```
ln(X_spt) = θ(PNWER_s × USMCA_p × Post_t) + FE_{s,t} + FE_{s,p} + FE_{p,t} + ε_spt
```

**Where:**
- `X_spt` = Exports from state s to partner p in year t
- `PNWER_s` = 1 if state is a PNWER member, 0 otherwise
- `USMCA_p` = 1 if partner is Canada or Mexico, 0 otherwise
- `Post_t` = 1 if year ≥ 2021, 0 otherwise
- `FE_{s,t}` = State × Year fixed effects (controls for state-specific annual shocks)
- `FE_{s,p}` = State × Partner fixed effects (controls for bilateral trade preferences)
- `FE_{p,t}` = Partner × Year fixed effects (controls for partner-specific annual shocks)
- `θ` = DDD estimator (coefficient of interest)

**Fixed Effects Structure:**

| Fixed Effect | Dimension | Controls For |
|--------------|-----------|--------------|
| FE_{s,t} | 25 states × 8 years = 200 | State-year shocks (e.g., Boeing crisis in WA) |
| FE_{s,p} | 25 states × 6 partners = 150 | Bilateral preferences (e.g., AK-JP energy links) |
| FE_{p,t} | 6 partners × 8 years = 48 | Partner-year shocks (e.g., Yen depreciation) |

**Estimation Method:**

Due to the high dimensionality of crossed fixed effects, we use **iterative within-group transformation** (also known as the alternating projections method) rather than explicit dummy variables. This approach:
1. Iteratively demeans the dependent variable and regressors within each fixed effect group
2. Continues until convergence (typically 2-3 iterations)
3. Estimates θ via OLS on the transformed data

This is equivalent to the fixed effects estimator but avoids constructing a nearly-singular design matrix.

**Interpretation of θ:** θ measures the differential effect of USMCA on PNWER states. Specifically:

> *After USMCA implementation, PNWER states' exports to USMCA partners (relative to non-USMCA partners) grew θ percentage points more than non-PNWER states' exports, controlling for all state-year, state-partner, and partner-year specific factors.*

This is the **heterogeneous treatment effect** of USMCA for PNWER states.

### 2.3 Standard Errors

All specifications use **cluster-robust standard errors** clustered at the partner level (Layer 1) or state level (Layer 2) to account for within-cluster correlation of error terms over time.

---

## 3. Results

### 3.1 Layer 1: National DID Results

| Metric | USMCA (CA/MX) | Control (JP/KR/UK/DE) |
|--------|---------------|----------------------|
| Pre-period avg exports | $273.6B | $61.9B |
| Post-period avg exports | $324.9B | $73.2B |
| Growth rate | +18.8% | +18.3% |
| Simple DID | +0.5% | — |

**Regression Results:**

| Coefficient | Estimate | 95% CI | p-value |
|-------------|----------|--------|---------|
| β (USMCA × Post) | -0.12% | [-13.1%, +14.7%] | 0.983 |

*Interpretation: USMCA did not produce a statistically significant change in U.S. exports to member countries relative to the control group. Both groups experienced similar growth rates of approximately 18%.*

### 3.2 Layer 2: State DDD Results

**Descriptive Statistics:**

| State Group | USMCA Growth | Control Growth | Within-DID |
|-------------|--------------|----------------|------------|
| PNWER states | +37.7% | -16.7% | **+54.4%** |
| Non-PNWER states | +18.0% | +22.1% | -4.1% |
| **Simple DDD** | — | — | **+58.5%** |

**Regression Results (Full Three-Way Crossed Fixed Effects):**

| Coefficient | Estimate | 95% CI | p-value | Significance |
|-------------|----------|--------|---------|--------------|
| θ (PNWER × USMCA × Post) | **+58.81%** | [+4.6%, +141.1%] | **0.031** | ** |

Additional statistics: n = 1,200 observations, df = 24, R² (within) = 0.038

*Interpretation: PNWER states experienced a statistically significant heterogeneous effect from USMCA. After controlling for state×year, state×partner, and partner×year fixed effects, PNWER states' relative export growth to USMCA partners exceeded that of non-PNWER states by approximately 59 percentage points.*

---

## 4. Identification and Robustness

### 4.1 Parallel Trends Assumption

The validity of DID/DDD estimation requires that treatment and control groups would have followed similar trends absent the policy intervention. We test this by comparing pre-period growth rates:

| Group | Pre-period Growth (2017-2019) | Difference | p-value |
|-------|------------------------------|------------|---------|
| PNWER states | +5.7% | — | — |
| Non-PNWER states | +3.2% | +2.6% | 0.608 |

*Result: The parallel trends assumption is satisfied. Pre-period growth rates do not differ significantly between PNWER and non-PNWER states (p = 0.608).*

### 4.2 Fixed Effects Structure

The DDD specification includes **three sets of two-way crossed fixed effects**:

1. **State × Year fixed effects (FE_{s,t}):** Control for state-specific annual shocks such as the Boeing production crisis in Washington, energy price impacts in Alaska, or state-level policy changes. This ensures that θ is not driven by state-specific events that happen to coincide with USMCA implementation.

2. **State × Partner fixed effects (FE_{s,p}):** Control for time-invariant bilateral relationships such as geographic proximity, port infrastructure, historical trade links, and industry specialization. This absorbs the fact that Washington has always traded heavily with Canada due to shared borders.

3. **Partner × Year fixed effects (FE_{p,t}):** Control for partner-specific annual shocks such as exchange rate movements (e.g., Yen depreciation), macroeconomic conditions, or partner-country policy changes. This ensures that θ is not driven by differential performance of USMCA vs. control countries over time.

**Estimation via Within Transformation:**

The three-way crossed fixed effects create a high-dimensional parameter space (200 + 150 + 48 = 398 fixed effect parameters for 1,200 observations). Direct estimation via dummy variables leads to near-perfect collinearity. We address this using iterative within-group demeaning, which is numerically equivalent to the fixed effects estimator but avoids matrix singularity issues.

### 4.3 Exclusion of 2020

The year 2020 is excluded from the analysis for two reasons:

1. **Transition period:** USMCA entered into force on July 1, 2020, making 2020 a partial treatment year.

2. **COVID-19 confounding:** The pandemic caused unprecedented trade disruptions that affected all trading relationships, potentially masking or amplifying policy effects.

---

## 5. Conclusion

This analysis provides econometric evidence on the effects of USMCA on Pacific Northwest trade. While USMCA did not produce a measurable increase in overall U.S. exports to member countries compared to similar non-member economies, PNWER states experienced a statistically significant heterogeneous benefit.

The triple difference estimate of **+58.81% (p = 0.034)** indicates that PNWER states' exports to Canada and Mexico (relative to exports to Japan, South Korea, UK, and Germany) grew substantially faster than the same relative comparison for non-PNWER states.

These findings suggest that while USMCA may not have fundamentally altered aggregate North American trade patterns, it has provided disproportionate benefits to states with strong pre-existing trade relationships with Canada and Mexico—a category that includes all PNWER member states.

### Policy Implications

1. Regional trade agreements can have heterogeneous effects across states, with border regions potentially capturing larger gains.

2. PNWER's geographic and economic integration with Canada and Mexico positions its member states to benefit from preferential trade arrangements.

3. As the 2026 USMCA review approaches, these findings provide quantitative evidence of the agreement's value to the Pacific Northwest region.

---

## Appendix: Data Sources

**Trade Data:** U.S. Census Bureau International Trade API

**Classification:** Harmonized System 2-digit level (HS2)

**Geographic Coverage:** 25 U.S. states, 6 trading partner countries

**Time Coverage:** 2017-2019 (pre-period), 2021-2025 (post-period)

### Industry Classification

| Industry | HS Codes |
|----------|----------|
| Agriculture | HS 01-24 |
| Energy | HS 27 |
| Forestry | HS 44-49 |
| Minerals | HS 26, 72-76 |
| Manufacturing | HS 84-90 |
| Other | All other HS codes |

---

*Report generated by PNWER Trade Analysis Model v6.0*
