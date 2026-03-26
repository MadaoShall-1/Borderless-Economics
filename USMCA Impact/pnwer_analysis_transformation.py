import json
import numpy as np
from pathlib import Path
from typing import Dict, List
from scipy import stats
from dataclasses import dataclass


@dataclass
class RegressionResult:
    coefficient: float = 0.0
    std_error: float = 0.0
    t_stat: float = 0.0
    p_value: float = 1.0
    ci_lower: float = 0.0
    ci_upper: float = 0.0
    n_obs: int = 0
    r_squared: float = 0.0
    df: int = 0
    
    def is_significant(self, alpha: float = 0.05) -> bool:
        return self.p_value < alpha
    
    def to_dict(self) -> dict:
        return {
            "coefficient_pct": round(self.coefficient, 2),
            "std_error": round(self.std_error, 4),
            "t_statistic": round(self.t_stat, 3),
            "p_value": round(self.p_value, 4),
            "ci_95_pct": [round(self.ci_lower, 2), round(self.ci_upper, 2)],
            "n_observations": self.n_obs,
            "r_squared": round(self.r_squared, 4),
            "degrees_of_freedom": self.df,
            "significant_5pct": bool(self.is_significant(0.05)),
            "significant_10pct": bool(self.is_significant(0.10))
        }


class Layer1_NationalDID:
    """
    National-level DID: Overall USMCA Effect
    
    Treatment: CA, MX
    Control: JP, KR, UK, DE
    """
    
    def __init__(self, national_data: dict):
        self.data = national_data.get("national_trade", {})
        self.usmca = ["CA", "MX"]
        self.control = ["JP", "KR", "UK", "DE"]
        self.all_partners = self.usmca + self.control
        self.pre_years = ["2017", "2018", "2019"]
        self.post_years = ["2021", "2022", "2023", "2024", "2025"]
        self.all_years = self.pre_years + self.post_years
    
    def run(self, use_exports: bool = True) -> RegressionResult:
        Y_list, usmca_list, post_list = [], [], []
        partner_idx_list, year_idx_list = [], []
        
        for i, partner in enumerate(self.all_partners):
            is_usmca = partner in self.usmca
            partner_years = self.data.get(partner, {}).get("years", {})
            
            for j, year in enumerate(self.all_years):
                val = partner_years.get(year, {}).get("exports" if use_exports else "imports", 0)
                
                if val > 0:
                    Y_list.append(np.log(val))
                    usmca_list.append(1 if is_usmca else 0)
                    post_list.append(1 if year in self.post_years else 0)
                    partner_idx_list.append(i)
                    year_idx_list.append(j)
        
        Y = np.array(Y_list)
        usmca = np.array(usmca_list)
        post = np.array(post_list)
        partner_idx = np.array(partner_idx_list)
        year_idx = np.array(year_idx_list)
        
        n = len(Y)
        n_partners = len(self.all_partners)
        n_years = len(self.all_years)
        
        did_term = usmca * post
        
        partner_dummies = np.zeros((n, n_partners - 1))
        for k in range(n_partners - 1):
            partner_dummies[:, k] = (partner_idx == k + 1).astype(float)
        
        year_dummies = np.zeros((n, n_years - 1))
        for k in range(n_years - 1):
            year_dummies[:, k] = (year_idx == k + 1).astype(float)
        
        X = np.column_stack([np.ones(n), did_term, partner_dummies, year_dummies])
        
        return self._run_ols_cluster(X, Y, partner_idx, n_partners)
    
    def _run_ols_cluster(self, X, Y, cluster_idx, n_clusters) -> RegressionResult:
        n, k = X.shape
        
        try:
            beta = np.linalg.lstsq(X, Y, rcond=None)[0]
            residuals = Y - X @ beta
            
            ss_res = np.sum(residuals ** 2)
            ss_tot = np.sum((Y - np.mean(Y)) ** 2)
            r_squared = 1 - ss_res / ss_tot
            
            XtX_inv = np.linalg.inv(X.T @ X)
            meat = np.zeros((k, k))
            
            for g in range(n_clusters):
                mask = cluster_idx == g
                if np.sum(mask) > 0:
                    X_g = X[mask]
                    e_g = residuals[mask]
                    meat += X_g.T @ np.outer(e_g, e_g) @ X_g
            
            adj = (n_clusters / (n_clusters - 1)) * ((n - 1) / (n - k))
            V = adj * XtX_inv @ meat @ XtX_inv
            
            coef = beta[1]
            se = np.sqrt(max(V[1, 1], 1e-10))
            t_stat = coef / se
            df = n_clusters - 1
            p_val = 2 * (1 - stats.t.cdf(abs(t_stat), df=df))
            t_crit = stats.t.ppf(0.975, df=df)
            
            pct = (np.exp(coef) - 1) * 100
            pct_lo = (np.exp(coef - t_crit * se) - 1) * 100
            pct_hi = (np.exp(coef + t_crit * se) - 1) * 100
            
            return RegressionResult(
                coefficient=pct, std_error=se, t_stat=t_stat,
                p_value=p_val, ci_lower=pct_lo, ci_upper=pct_hi,
                n_obs=n, r_squared=r_squared, df=df
            )
        except Exception as e:
            print(f"    Layer 1 regression error: {e}")
            return RegressionResult(n_obs=n)
    
    def descriptive_stats(self) -> dict:
        result = {}
        
        for group_name, partners in [("usmca", self.usmca), ("control", self.control)]:
            pre_vals, post_vals = [], []
            
            for p in partners:
                for year in self.pre_years:
                    exp = self.data.get(p, {}).get("years", {}).get(year, {}).get("exports", 0)
                    if exp > 0:
                        pre_vals.append(exp)
                
                for year in self.post_years:
                    exp = self.data.get(p, {}).get("years", {}).get(year, {}).get("exports", 0)
                    if exp > 0:
                        post_vals.append(exp)
            
            pre_avg = np.mean(pre_vals) if pre_vals else 0
            post_avg = np.mean(post_vals) if post_vals else 0
            growth = (post_avg / pre_avg - 1) * 100 if pre_avg > 0 else 0
            
            result[group_name] = {
                "pre_avg_B": round(pre_avg / 1e9, 1),
                "post_avg_B": round(post_avg / 1e9, 1),
                "growth_pct": round(growth, 1)
            }
        
        result["simple_did_pct"] = round(
            result["usmca"]["growth_pct"] - result["control"]["growth_pct"], 1
        )
        
        return result


class Layer2_StateDDD:
    """
    State-level DDD: PNWER Heterogeneous Effect
    
    Treatment states: WA, OR, ID, MT, AK (PNWER)
    Control states: 20 comparison states
    USMCA partners: CA, MX
    Control partners: JP, KR, UK, DE
    """
    
    def __init__(self, usmca_data: dict, control_data: dict):
        self.usmca_state_data = usmca_data.get("state_trade", {})
        self.control_state_data = control_data.get("state_exports_to_control", {})
        
        self.pnwer_states = ["WA", "OR", "ID", "MT", "AK"]
        self.control_states = [
            "MI", "MN", "ND", "WI", "NY",
            "CA", "NV", "UT", "CO", "WY",
            "TX", "LA", "OK", "NE", "KS",
            "FL", "GA", "NC", "SC", "VA"
        ]
        self.all_states = self.pnwer_states + self.control_states
        
        self.usmca_partners = ["CA", "MX"]
        self.control_partners = ["JP", "KR", "UK", "DE"]
        self.all_partners = self.usmca_partners + self.control_partners
        
        self.pre_years = ["2017", "2018", "2019"]
        self.post_years = ["2021", "2022", "2023", "2024", "2025"]
        self.all_years = self.pre_years + self.post_years
    
    def _get_exports(self, state: str, partner: str, year: str) -> float:
        if partner in self.usmca_partners:
            return self.usmca_state_data.get(state, {}).get(partner, {}).get(year, {}).get("total", {}).get("exports", 0)
        else:
            return self.control_state_data.get(state, {}).get(partner, {}).get(year, {}).get("exports", 0)
    
    def run_ddd(self) -> RegressionResult:
        """
        Full DDD with three-way crossed fixed effects using within transformation:
        ln(X_{s,p,t}) = θ(PNWER_s × USMCA_p × Post_t) + FE_{s,t} + FE_{s,p} + FE_{p,t} + ε
        
        Within transformation: demean Y and X within each FE group
        This avoids constructing dummy matrices and handles high-dimensional FE
        """
        Y_list, pnwer_list, usmca_list, post_list = [], [], [], []
        state_idx_list, partner_idx_list, year_idx_list = [], [], []
        
        for s_i, state in enumerate(self.all_states):
            is_pnwer = state in self.pnwer_states
            
            for p_i, partner in enumerate(self.all_partners):
                is_usmca = partner in self.usmca_partners
                
                for y_i, year in enumerate(self.all_years):
                    is_post = year in self.post_years
                    exports = self._get_exports(state, partner, year)
                    
                    if exports > 0:
                        Y_list.append(np.log(exports))
                        pnwer_list.append(1 if is_pnwer else 0)
                        usmca_list.append(1 if is_usmca else 0)
                        post_list.append(1 if is_post else 0)
                        state_idx_list.append(s_i)
                        partner_idx_list.append(p_i)
                        year_idx_list.append(y_i)
        
        Y = np.array(Y_list)
        pnwer = np.array(pnwer_list)
        usmca = np.array(usmca_list)
        post = np.array(post_list)
        state_idx = np.array(state_idx_list)
        partner_idx = np.array(partner_idx_list)
        year_idx = np.array(year_idx_list)
        
        n = len(Y)
        n_states = len(self.all_states)
        n_partners = len(self.all_partners)
        n_years = len(self.all_years)
        
        print(f"    Panel size: {n} observations ({n_states} states × {n_partners} partners × {n_years} years)")
        
        # DDD triple interaction (the only regressor we care about)
        ddd = pnwer * usmca * post
        
        # Create group indices for three-way FE
        # FE_{s,t}: state × year
        st_groups = state_idx * n_years + year_idx
        # FE_{s,p}: state × partner  
        sp_groups = state_idx * n_partners + partner_idx
        # FE_{p,t}: partner × year
        pt_groups = partner_idx * n_years + year_idx
        
        print(f"    Applying within transformation for FE_{{s,t}}, FE_{{s,p}}, FE_{{p,t}}...")
        
        # Iterative within transformation (Frisch-Waugh-Lovell)
        # Demean until convergence
        Y_demean = Y.copy()
        ddd_demean = ddd.copy().astype(float)
        
        max_iter = 100
        tol = 1e-8
        
        for iteration in range(max_iter):
            Y_old = Y_demean.copy()
            
            # Demean by state×year
            for g in np.unique(st_groups):
                mask = st_groups == g
                if np.sum(mask) > 1:
                    Y_demean[mask] -= np.mean(Y_demean[mask])
                    ddd_demean[mask] -= np.mean(ddd_demean[mask])
            
            # Demean by state×partner
            for g in np.unique(sp_groups):
                mask = sp_groups == g
                if np.sum(mask) > 1:
                    Y_demean[mask] -= np.mean(Y_demean[mask])
                    ddd_demean[mask] -= np.mean(ddd_demean[mask])
            
            # Demean by partner×year
            for g in np.unique(pt_groups):
                mask = pt_groups == g
                if np.sum(mask) > 1:
                    Y_demean[mask] -= np.mean(Y_demean[mask])
                    ddd_demean[mask] -= np.mean(ddd_demean[mask])
            
            # Check convergence
            change = np.max(np.abs(Y_demean - Y_old))
            if change < tol:
                print(f"    Within transformation converged in {iteration+1} iterations")
                break
        else:
            print(f"    WARNING: Did not converge after {max_iter} iterations (change={change:.2e})")
        
        # Check if ddd_demean has any variation left
        ddd_var = np.var(ddd_demean)
        print(f"    Residual variance in DDD term: {ddd_var:.6f}")
        
        if ddd_var < 1e-10:
            print("    ERROR: DDD term is collinear with fixed effects!")
            return RegressionResult(n_obs=n)
        
        # Simple OLS on demeaned data (no intercept needed)
        # θ = Cov(ddd_demean, Y_demean) / Var(ddd_demean)
        theta = np.sum(ddd_demean * Y_demean) / np.sum(ddd_demean ** 2)
        residuals = Y_demean - theta * ddd_demean
        
        # R-squared (within)
        ss_res = np.sum(residuals ** 2)
        ss_tot = np.sum(Y_demean ** 2)
        r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else 0
        
        print(f"    θ (raw) = {theta:.6f}, R² (within) = {r_squared:.4f}")
        
        # Cluster-robust SE (by state)
        # V(θ) = (X'X)^{-1} * meat * (X'X)^{-1}
        # where meat = Σ_g (X_g' e_g)(X_g' e_g)'
        
        XtX = np.sum(ddd_demean ** 2)
        meat = 0.0
        
        for g in range(n_states):
            mask = state_idx == g
            if np.sum(mask) > 0:
                x_g = ddd_demean[mask]
                e_g = residuals[mask]
                meat += (np.sum(x_g * e_g)) ** 2
        
        # Degrees of freedom adjustment
        # df for FE: approximate as n_st + n_sp + n_pt - overlaps
        n_st = len(np.unique(st_groups))
        n_sp = len(np.unique(sp_groups))
        n_pt = len(np.unique(pt_groups))
        
        # Conservative: use n_states as cluster count
        adj = (n_states / (n_states - 1)) * ((n - 1) / (n - 1))  # simplified
        
        var_theta = adj * meat / (XtX ** 2)
        se = np.sqrt(max(var_theta, 1e-20))
        
        t_stat = theta / se
        df = n_states - 1
        p_val = 2 * (1 - stats.t.cdf(abs(t_stat), df=df))
        t_crit = stats.t.ppf(0.975, df=df)
        
        # Convert to percentage
        pct = (np.exp(theta) - 1) * 100
        pct_lo = (np.exp(theta - t_crit * se) - 1) * 100
        pct_hi = (np.exp(theta + t_crit * se) - 1) * 100
        
        print(f"    θ = {pct:+.2f}% [{pct_lo:+.1f}%, {pct_hi:+.1f}%], t = {t_stat:.3f}, p = {p_val:.4f}")
        
        return RegressionResult(
            coefficient=pct, std_error=se, t_stat=t_stat,
            p_value=p_val, ci_lower=pct_lo, ci_upper=pct_hi,
            n_obs=n, r_squared=r_squared, df=df
        )
    
    def run_ddd_simplified(self) -> RegressionResult:
        """
        Simplified DDD with main effect FE + two-way interactions (for comparison)
        """
        Y_list, pnwer_list, usmca_list, post_list = [], [], [], []
        state_idx_list, partner_idx_list, year_idx_list = [], [], []
        
        for s_i, state in enumerate(self.all_states):
            is_pnwer = state in self.pnwer_states
            
            for p_i, partner in enumerate(self.all_partners):
                is_usmca = partner in self.usmca_partners
                
                for y_i, year in enumerate(self.all_years):
                    is_post = year in self.post_years
                    exports = self._get_exports(state, partner, year)
                    
                    if exports > 0:
                        Y_list.append(np.log(exports))
                        pnwer_list.append(1 if is_pnwer else 0)
                        usmca_list.append(1 if is_usmca else 0)
                        post_list.append(1 if is_post else 0)
                        state_idx_list.append(s_i)
                        partner_idx_list.append(p_i)
                        year_idx_list.append(y_i)
        
        Y = np.array(Y_list)
        pnwer = np.array(pnwer_list)
        usmca = np.array(usmca_list)
        post = np.array(post_list)
        state_idx = np.array(state_idx_list)
        partner_idx = np.array(partner_idx_list)
        year_idx = np.array(year_idx_list)
        
        n = len(Y)
        n_states = len(self.all_states)
        n_partners = len(self.all_partners)
        n_years = len(self.all_years)
        
        ddd = pnwer * usmca * post
        pnwer_usmca = pnwer * usmca
        pnwer_post = pnwer * post
        usmca_post = usmca * post
        
        state_dummies = np.zeros((n, n_states - 1))
        for k in range(n_states - 1):
            state_dummies[:, k] = (state_idx == k + 1).astype(float)
        
        partner_dummies = np.zeros((n, n_partners - 1))
        for k in range(n_partners - 1):
            partner_dummies[:, k] = (partner_idx == k + 1).astype(float)
        
        year_dummies = np.zeros((n, n_years - 1))
        for k in range(n_years - 1):
            year_dummies[:, k] = (year_idx == k + 1).astype(float)
        
        X = np.column_stack([
            np.ones(n),
            ddd,
            pnwer_usmca,
            pnwer_post,
            usmca_post,
            state_dummies,
            partner_dummies,
            year_dummies
        ])
        
        return self._run_ols_cluster(X, Y, state_idx, n_states)
    
    def _run_ols_cluster(self, X, Y, state_idx, n_states) -> RegressionResult:
        n, k = X.shape
        
        try:
            beta = np.linalg.lstsq(X, Y, rcond=None)[0]
            residuals = Y - X @ beta
            
            ss_res = np.sum(residuals ** 2)
            ss_tot = np.sum((Y - np.mean(Y)) ** 2)
            r_squared = 1 - ss_res / ss_tot
            
            XtX_inv = np.linalg.inv(X.T @ X)
            meat = np.zeros((k, k))
            
            for g in range(n_states):
                mask = state_idx == g
                if np.sum(mask) > 0:
                    X_g = X[mask]
                    e_g = residuals[mask]
                    meat += X_g.T @ np.outer(e_g, e_g) @ X_g
            
            adj = (n_states / (n_states - 1)) * ((n - 1) / (n - k))
            V = adj * XtX_inv @ meat @ XtX_inv
            
            coef = beta[1]
            se = np.sqrt(max(V[1, 1], 1e-10))
            t_stat = coef / se
            df = n_states - 1
            p_val = 2 * (1 - stats.t.cdf(abs(t_stat), df=df))
            t_crit = stats.t.ppf(0.975, df=df)
            
            pct = (np.exp(coef) - 1) * 100
            pct_lo = (np.exp(coef - t_crit * se) - 1) * 100
            pct_hi = (np.exp(coef + t_crit * se) - 1) * 100
            
            return RegressionResult(
                coefficient=pct, std_error=se, t_stat=t_stat,
                p_value=p_val, ci_lower=pct_lo, ci_upper=pct_hi,
                n_obs=n, r_squared=r_squared, df=df
            )
        except Exception as e:
            print(f"    DDD regression error: {e}")
            return RegressionResult(n_obs=n)
    
    def descriptive_stats(self) -> dict:
        result = {
            "pnwer": {"usmca_growth": 0, "control_growth": 0, "within_did": 0},
            "non_pnwer": {"usmca_growth": 0, "control_growth": 0, "within_did": 0}
        }
        
        for group_name, states in [("pnwer", self.pnwer_states), 
                                    ("non_pnwer", self.control_states)]:
            usmca_pre, usmca_post = [], []
            ctrl_pre, ctrl_post = [], []
            
            for state in states:
                for partner in self.usmca_partners:
                    for year in self.pre_years:
                        exp = self._get_exports(state, partner, year)
                        if exp > 0:
                            usmca_pre.append(exp)
                    for year in self.post_years:
                        exp = self._get_exports(state, partner, year)
                        if exp > 0:
                            usmca_post.append(exp)
                
                for partner in self.control_partners:
                    for year in self.pre_years:
                        exp = self._get_exports(state, partner, year)
                        if exp > 0:
                            ctrl_pre.append(exp)
                    for year in self.post_years:
                        exp = self._get_exports(state, partner, year)
                        if exp > 0:
                            ctrl_post.append(exp)
            
            usmca_growth = (np.mean(usmca_post) / np.mean(usmca_pre) - 1) * 100 if usmca_pre else 0
            ctrl_growth = (np.mean(ctrl_post) / np.mean(ctrl_pre) - 1) * 100 if ctrl_pre else 0
            
            result[group_name] = {
                "usmca_growth_pct": round(usmca_growth, 1),
                "control_growth_pct": round(ctrl_growth, 1),
                "within_did_pct": round(usmca_growth - ctrl_growth, 1)
            }
        
        result["simple_ddd_pct"] = round(
            result["pnwer"]["within_did_pct"] - result["non_pnwer"]["within_did_pct"], 1
        )
        
        return result


class PNWERAnalysisV6:
    
    def __init__(self, usmca_path: str, control_path: str, national_path: str):
        with open(usmca_path, 'r', encoding='utf-8') as f:
            self.usmca_data = json.load(f)
        with open(control_path, 'r', encoding='utf-8') as f:
            self.control_data = json.load(f)
        with open(national_path, 'r', encoding='utf-8') as f:
            self.national_data = json.load(f)
        
        self.layer1 = Layer1_NationalDID(self.national_data)
        self.layer2 = Layer2_StateDDD(self.usmca_data, self.control_data)
        
        print(f"Data loaded successfully")
        print(f"  Layer 1: National DID (6 partners × 8 years)")
        print(f"  Layer 2: State DDD (25 states × 6 partners × 8 years)")
    
    def run_analysis(self) -> dict:
        results = {
            "metadata": {
                "model_version": "6.0",
                "analysis_date": "2026-02",
                "pre_period": "2017-2019",
                "post_period": "2021-2025",
                "excluded_year": 2020
            }
        }
        
        print("\n" + "=" * 60)
        print("Layer 1: National DID - Overall USMCA Effect")
        print("=" * 60)
        
        l1_exports = self.layer1.run(use_exports=True)
        l1_stats = self.layer1.descriptive_stats()
        
        results["layer1_national_did"] = {
            "description": "Does USMCA increase US exports to member countries relative to non-members?",
            "model": "ln(X_{p,t}) = β(USMCA_p × Post_t) + FE_p + FE_t + ε",
            "treatment": ["CA", "MX"],
            "control": ["JP", "KR", "UK", "DE"],
            "result": l1_exports.to_dict(),
            "descriptive_stats": l1_stats
        }
        
        print("\n" + "=" * 60)
        print("Layer 2: State DDD - PNWER Heterogeneous Effect")
        print("=" * 60)
        
        l2_result = self.layer2.run_ddd()
        l2_stats = self.layer2.descriptive_stats()
        
        results["layer2_state_ddd"] = {
            "description": "Do PNWER states benefit more from USMCA than other states?",
            "model": "ln(X_{s,p,t}) = θ(PNWER×USMCA×Post) + two-way interactions + FE_s + FE_p + FE_t + ε",
            "interpretation": "θ measures whether PNWER states' exports to USMCA partners (relative to non-USMCA partners) grew more than non-PNWER states after USMCA implementation",
            "result": l2_result.to_dict(),
            "descriptive_stats": l2_stats
        }
        
        return results
    
    def print_results(self, results: dict):
        print("\n" + "=" * 75)
        print("                    PNWER Trade Analysis Results v6.0")
        print("                    (Pre: 2017-2019, Post: 2021-2025)")
        print("=" * 75)
        
        print("\n[Layer 1: National DID - Overall USMCA Effect]")
        print("-" * 75)
        
        l1 = results["layer1_national_did"]
        stats1 = l1["descriptive_stats"]
        
        print(f"  Descriptive Statistics:")
        print(f"    USMCA (CA/MX):    Pre ${stats1['usmca']['pre_avg_B']}B -> Post ${stats1['usmca']['post_avg_B']}B ({stats1['usmca']['growth_pct']:+.1f}%)")
        print(f"    Control (JP/KR/UK/DE): Pre ${stats1['control']['pre_avg_B']}B -> Post ${stats1['control']['post_avg_B']}B ({stats1['control']['growth_pct']:+.1f}%)")
        print(f"    Simple DID: {stats1['simple_did_pct']:+.1f}%")
        
        r1 = l1["result"]
        sig1 = "**" if r1["significant_5pct"] else ("*" if r1["significant_10pct"] else "")
        print(f"\n  Regression Results:")
        print(f"    β = {r1['coefficient_pct']:+.2f}% [{r1['ci_95_pct'][0]:+.1f}%, {r1['ci_95_pct'][1]:+.1f}%]")
        print(f"    t = {r1['t_statistic']:.3f}, p = {r1['p_value']:.4f} {sig1}")
        print(f"    (n={r1['n_observations']}, df={r1['degrees_of_freedom']})")
        
        print("\n" + "-" * 75)
        print("[Layer 2: State DDD - PNWER Heterogeneous Effect]")
        print("-" * 75)
        
        l2 = results["layer2_state_ddd"]
        stats2 = l2["descriptive_stats"]
        
        print(f"  Descriptive Statistics (within-state: USMCA growth - Control growth):")
        print(f"    PNWER states:     USMCA {stats2['pnwer']['usmca_growth_pct']:+.1f}%, Control {stats2['pnwer']['control_growth_pct']:+.1f}% -> Within-DID {stats2['pnwer']['within_did_pct']:+.1f}%")
        print(f"    Non-PNWER states: USMCA {stats2['non_pnwer']['usmca_growth_pct']:+.1f}%, Control {stats2['non_pnwer']['control_growth_pct']:+.1f}% -> Within-DID {stats2['non_pnwer']['within_did_pct']:+.1f}%")
        print(f"    Simple DDD: {stats2['simple_ddd_pct']:+.1f}%")
        
        r2 = l2["result"]
        sig2 = "**" if r2["significant_5pct"] else ("*" if r2["significant_10pct"] else "")
        print(f"\n  Regression Results:")
        print(f"    θ = {r2['coefficient_pct']:+.2f}% [{r2['ci_95_pct'][0]:+.1f}%, {r2['ci_95_pct'][1]:+.1f}%]")
        print(f"    t = {r2['t_statistic']:.3f}, p = {r2['p_value']:.4f} {sig2}")
        print(f"    (n={r2['n_observations']}, df={r2['degrees_of_freedom']}, R²={r2['r_squared']:.3f})")
        
        print("\n  Interpretation of θ:")
        print("    After USMCA implementation, PNWER states' exports to USMCA partners")
        print("    (relative to non-USMCA partners) grew more/less than non-PNWER states")
        print("    by approximately θ percentage points.")
        
        print("\n" + "=" * 75)
    
    def save_results(self, results: dict, path: str = "analysis_results_v6.json"):
        def convert(obj):
            if isinstance(obj, dict):
                return {k: convert(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert(v) for v in obj]
            elif isinstance(obj, (np.integer, np.floating)):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, (np.bool_, bool)):
                return bool(obj)
            return obj
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(convert(results), f, indent=2, ensure_ascii=False)
        print(f"\nResults saved to: {path}")


def main():
 
    
    paths = [
        ("data/pnwer_analysis_data_v8.json", "pnwer_analysis_data_v8.json"),
        ("data/state_to_control_countries.json", "state_to_control_countries.json"),
        ("data/national_trade.json", "national_trade.json")
    ]
    
    def find_path(candidates):
        for p in candidates:
            if Path(p).exists():
                return p
        return None
    
    usmca_path = find_path([paths[0][0], paths[0][1]])
    control_path = find_path([paths[1][0], paths[1][1]])
    national_path = find_path([paths[2][0], paths[2][1]])
    
    if not all([usmca_path, control_path, national_path]):
        print("ERROR: Missing data files!")
        print(f"   USMCA data: {usmca_path}")
        print(f"   Control country data: {control_path}")
        print(f"   National data: {national_path}")
        return
    
    model = PNWERAnalysisV6(usmca_path, control_path, national_path)
    results = model.run_analysis()
    model.print_results(results)
    model.save_results(results)
    
    print("\nAnalysis complete!")


if __name__ == "__main__":
    main()