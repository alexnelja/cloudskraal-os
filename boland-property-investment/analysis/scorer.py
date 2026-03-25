#!/usr/bin/env python3
"""
BRRRR Property Investment Scorer — v2
Fully configurable via config.json so it can be reused in any SA market.

Usage: python3 analysis/scorer.py
"""

import csv
import glob
import json
import math
import os
import sys
from collections import defaultdict
from datetime import date
from statistics import median as _median, stdev as _stdev, mean as _mean


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
SCRAPER_DIR = os.path.join(PROJECT_DIR, "scraper")
DATA_DIR = os.path.join(PROJECT_DIR, "data")
ANALYSIS_DIR = SCRIPT_DIR
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")

TODAY = date.today().isoformat()


# ---------------------------------------------------------------------------
# Helpers — parsing
# ---------------------------------------------------------------------------

def parse_price(val):
    """Parse a price string/value to float, returning None on failure."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    val = str(val).strip().replace("R", "").replace(",", "").replace(" ", "")
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def parse_int(val, default=0):
    if val is None:
        return default
    try:
        return int(float(str(val).strip()))
    except (ValueError, TypeError):
        return default


def parse_float(val, default=0.0):
    if val is None:
        return default
    try:
        return float(str(val).strip())
    except (ValueError, TypeError):
        return default


def parse_floor_size(val):
    """Parse floor size like '47 m²' or '150' to float. Returns None on failure."""
    if val is None:
        return None
    s = str(val).strip().lower().replace("m²", "").replace("m2", "").replace("sqm", "").strip()
    try:
        v = float(s)
        return v if v > 0 else None
    except (ValueError, TypeError):
        return None


def safe_median(vals):
    if not vals:
        return None
    return _median(vals)


def safe_stdev(vals):
    if len(vals) < 2:
        return 0.0
    return _stdev(vals)


def safe_mean(vals):
    if not vals:
        return None
    return _mean(vals)


# ---------------------------------------------------------------------------
# Helpers — formatting
# ---------------------------------------------------------------------------

def fmt_currency(val):
    if val is None:
        return "N/A"
    return f"R{val:,.0f}"


def fmt_pct(val):
    if val is None:
        return "N/A"
    return f"{val:.1f}%"


def fmt_ratio(val):
    if val is None:
        return "N/A"
    return f"{val:.2f}"


# ---------------------------------------------------------------------------
# Helpers — finance
# ---------------------------------------------------------------------------

def calc_bond_repayment(principal, annual_rate, months):
    if principal <= 0:
        return 0.0
    r = annual_rate / 12
    if r == 0:
        return principal / months
    return principal * (r * (1 + r) ** months) / ((1 + r) ** months - 1)


def calc_transfer_duty(price, brackets):
    """Calculate transfer duty from configurable brackets."""
    duty = 0.0
    prev_threshold = 0
    for i, bracket in enumerate(brackets):
        threshold = bracket["threshold"]
        rate = bracket["rate"]
        base = bracket["base"]

        if i == 0:
            # First bracket — check if price falls within
            if threshold is not None and price <= threshold:
                return 0.0
            prev_threshold = threshold if threshold is not None else 0
            continue

        if threshold is None or price <= threshold:
            # Final bracket or price falls within this bracket
            return base + (price - prev_threshold) * rate

        prev_threshold = threshold

    # Fallback — should not reach here if brackets are well-formed
    return duty


def calc_refurb_estimate(price, bands):
    """Estimated refurb cost from configurable bands."""
    for band in bands:
        max_price = band["max_price"]
        if max_price is None or price <= max_price:
            return band["refurb"]
    # Fallback to last band
    return bands[-1]["refurb"]


def calc_rates_monthly(price, area, area_assumptions):
    """Calculate monthly rates from area-specific config."""
    aa = area_assumptions.get(area)
    if aa is None:
        # Try case-insensitive match
        for k, v in area_assumptions.items():
            if k.lower() == area.lower():
                aa = v
                break
    if aa is None:
        return 0.0

    formula = aa.get("rates_formula", "flat")
    if formula == "drakenstein":
        exemption = aa.get("rates_exemption", 0)
        cent_in_rand = aa.get("rates_cent_in_rand", 0)
        rateable = price - exemption
        if rateable <= 0:
            return 0.0
        return rateable * cent_in_rand / 12
    elif formula == "flat":
        return aa.get("rates_monthly", 0)
    else:
        return 0.0


# ---------------------------------------------------------------------------
# Helpers — geo
# ---------------------------------------------------------------------------

def haversine_km(lat1, lon1, lat2, lon2):
    """Haversine distance in kilometres."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def timeline_factor(dev, today_date):
    """Calculate timeline discount factor for a development catalyst."""
    status = dev.get("status", "")
    if status in ("completed", "existing"):
        return 1.0
    comp_str = dev.get("completion_date")
    if comp_str is None:
        if status in ("tender", "phased"):
            return 0.2
        return 0.4
    try:
        comp_date = date.fromisoformat(comp_str)
    except (ValueError, TypeError):
        return 0.4
    months_away = (comp_date.year - today_date.year) * 12 + (comp_date.month - today_date.month)
    if months_away <= 0:
        return 1.0
    elif months_away <= 6:
        return 0.8
    elif months_away <= 12:
        return 0.6
    elif months_away <= 24:
        return 0.4
    else:
        return 0.2


def calc_catalyst_score(suburb, config, today_date):
    """Distance-weighted catalyst score for a suburb, normalized to 0-100."""
    centroid = config["suburb_centroids"].get(suburb)
    if centroid is None:
        return 0.0

    lat, lng = centroid["lat"], centroid["lng"]
    total_impact = 0.0

    for dev in config.get("developments", []):
        dist = haversine_km(lat, lng, dev["lat"], dev["lng"])
        radius = dev.get("impact_radius_km", 5)
        if dist >= radius:
            continue
        base = dev.get("base_uplift_pct", 0)
        tf = timeline_factor(dev, today_date)
        impact = base * (1 - dist / radius) * tf
        total_impact += impact

    # Normalize: assume max plausible raw impact ~40 -> 100
    return min(total_impact / 40 * 100, 100)


# ---------------------------------------------------------------------------
# File I/O
# ---------------------------------------------------------------------------

def find_most_recent(pattern):
    files = sorted(glob.glob(pattern))
    if not files:
        print(f"ERROR: No files matching {pattern}")
        sys.exit(1)
    return files[-1]


def load_csv(filepath):
    rows = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def load_json(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Rental market lookup
# ---------------------------------------------------------------------------

def build_rental_lookup(rentals):
    """Build median rent lookup keyed by (level, name, beds)."""
    suburb_rents = defaultdict(list)
    area_rents = defaultdict(list)

    for r in rentals:
        rent = parse_price(r.get("monthly_rent"))
        beds = parse_int(r.get("bedrooms"))
        suburb = (r.get("suburb") or "").strip()
        area = (r.get("area") or "").strip()

        if rent is None or rent <= 0 or beds <= 0:
            continue
        if suburb:
            suburb_rents[(suburb, beds)].append(rent)
        if area:
            area_rents[(area, beds)].append(rent)

    lookup = {}
    def percentile_25(values):
        """25th percentile — conservative estimate."""
        s = sorted(values)
        n = len(s)
        if n == 0:
            return None
        idx = max(0, int(n * 0.25) - 1)
        return s[idx]

    for (name, beds), vals in suburb_rents.items():
        m = safe_median(vals)
        if m is not None:
            lookup[("suburb", name, beds)] = {"median": m, "q1": percentile_25(vals),
                                               "count": len(vals),
                                               "min": min(vals), "max": max(vals)}
    for (name, beds), vals in area_rents.items():
        m = safe_median(vals)
        if m is not None:
            lookup[("area", name, beds)] = {"median": m, "q1": percentile_25(vals),
                                             "count": len(vals),
                                             "min": min(vals), "max": max(vals)}
    return lookup


def get_rent_estimate(listing, rental_lookup, suburb_scores):
    suburb = (listing.get("suburb") or "").strip()
    area = (listing.get("area") or "").strip()
    beds = parse_int(listing.get("bedrooms"))
    price = parse_price(listing.get("price")) or 0

    # 1. Suburb + beds from rental CSV (most reliable)
    key = ("suburb", suburb, beds)
    if key in rental_lookup:
        return rental_lookup[key]["median"], "rental_suburb"

    # 2. Area + beds from rental CSV — use Q1 (25th percentile) not median
    #    Area medians are skewed by premium estates. Q1 is conservative and
    #    more representative of middle-income suburbs.
    key = ("area", area, beds)
    if key in rental_lookup:
        rl = rental_lookup[key]
        q1 = rl.get("q1", rl["median"])
        rent = q1
        # Sanity check: area fallback can be skewed by premium estates
        # Cap at 1.2% of price — conservative for middle/high income suburbs
        if price > 0:
            max_plausible = price * 0.012
            rent = min(rent, max_plausible)
        return rent, "rental_area_q1"

    # 3. Area + beds from suburb-scores.json
    areas_data = suburb_scores.get("areas", {})
    area_data = areas_data.get(area, {})
    rental_medians = area_data.get("rental_medians", {})
    beds_key = f"{beds}_bed"
    if beds_key in rental_medians:
        med = rental_medians[beds_key].get("median_rent")
        if med is not None and med > 0:
            rent = float(med)
            if price > 0:
                max_plausible = price * 0.011
                rent = min(rent, max_plausible)
            return rent, "scores_json"

    # 4. Fallback to CSV estimate (also capped)
    est = parse_price(listing.get("estimated_monthly_rent"))
    if est is not None and est > 0:
        if price > 0:
            max_plausible = price * 0.011
            est = min(est, max_plausible)
        return est, "csv_estimate"

    return None, "none"


# ---------------------------------------------------------------------------
# Supply/demand stats (pre-computed across all listings)
# ---------------------------------------------------------------------------

def build_supply_stats(sales, rentals):
    """Pre-compute per-suburb and per-suburb+beds supply counts."""
    sale_by_suburb = defaultdict(int)
    sale_prices_by_suburb = defaultdict(list)
    rental_by_suburb_beds = defaultdict(int)
    rental_by_suburb = defaultdict(int)

    for s in sales:
        suburb = (s.get("suburb") or "").strip()
        if suburb:
            sale_by_suburb[suburb] += 1
            p = parse_price(s.get("price"))
            if p and p > 0:
                sale_prices_by_suburb[suburb].append(p)

    for r in rentals:
        suburb = (r.get("suburb") or "").strip()
        beds = parse_int(r.get("bedrooms"))
        if suburb:
            rental_by_suburb[suburb] += 1
            if beds > 0:
                rental_by_suburb_beds[(suburb, beds)] += 1

    return {
        "sale_by_suburb": dict(sale_by_suburb),
        "sale_prices_by_suburb": dict(sale_prices_by_suburb),
        "rental_by_suburb_beds": dict(rental_by_suburb_beds),
        "rental_by_suburb": dict(rental_by_suburb),
    }


def build_price_per_m2_medians(sales):
    """Compute median price/m2 per suburb from sale listings."""
    by_suburb = defaultdict(list)
    for s in sales:
        suburb = (s.get("suburb") or "").strip()
        price = parse_price(s.get("price"))
        floor_size = parse_floor_size(s.get("floor_size_m2"))
        if suburb and price and price > 0 and floor_size and floor_size > 0:
            by_suburb[suburb].append(price / floor_size)
    return {k: safe_median(v) for k, v in by_suburb.items()}


# ---------------------------------------------------------------------------
# Score a single listing
# ---------------------------------------------------------------------------

def score_listing(listing, rental_lookup, suburb_scores, crime_stats,
                  config, supply_stats, ppm2_medians, today_date):
    result = dict(listing)

    price = parse_price(listing.get("price"))
    if price is None or price <= 0:
        return None

    beds = parse_int(listing.get("bedrooms"))
    suburb = (listing.get("suburb") or "").strip()
    area = (listing.get("area") or "").strip()
    floor_size = parse_floor_size(listing.get("floor_size_m2"))

    fin = config["financing"]
    ops = config["operating_assumptions"]
    area_assumptions = config["area_assumptions"]
    weights = config["scoring_weights"]

    investment_rate = fin["prime_rate"] + fin.get("investment_rate_spread", 0)
    bond_term = fin["bond_term_months"]
    ltv = fin["ltv"]

    # -----------------------------------------------------------------------
    # Rent estimate
    # -----------------------------------------------------------------------
    monthly_rent, rent_source = get_rent_estimate(listing, rental_lookup, suburb_scores)
    if monthly_rent is None:
        monthly_rent = 0.0

    annual_rent = monthly_rent * 12
    effective_annual_rent = annual_rent * (1 - ops["vacancy_rate"])

    result["real_monthly_rent"] = round(monthly_rent, 0)
    result["real_annual_rent"] = round(annual_rent, 0)
    result["rent_source"] = rent_source

    # -----------------------------------------------------------------------
    # Operating expenses
    # -----------------------------------------------------------------------
    monthly_rates = calc_rates_monthly(price, area, area_assumptions)
    monthly_insurance = price * ops["insurance_pct_of_value"] / 12
    monthly_maintenance = price * ops["maintenance_pct_of_value"] / 12
    monthly_management = monthly_rent * ops["management_fee_pct_of_rent"]
    monthly_levy = ops["default_levy"]

    annual_opex = (monthly_rates + monthly_insurance + monthly_maintenance +
                   monthly_management + monthly_levy) * 12

    result["monthly_rates"] = round(monthly_rates, 0)
    result["monthly_insurance"] = round(monthly_insurance, 0)
    result["monthly_maintenance"] = round(monthly_maintenance, 0)
    result["monthly_management"] = round(monthly_management, 0)
    result["monthly_levy"] = monthly_levy

    # -----------------------------------------------------------------------
    # Tier 1 — Core BRRRR metrics
    # -----------------------------------------------------------------------
    noi = effective_annual_rent - annual_opex
    cap_rate = noi / price if price > 0 else 0.0
    grm = price / annual_rent if annual_rent > 0 else None
    rent_to_price_pct = (monthly_rent / price) * 100 if price > 0 else 0.0
    oer = annual_opex / annual_rent if annual_rent > 0 else None

    result["noi"] = round(noi, 0)
    result["cap_rate"] = round(cap_rate, 4)
    result["real_gross_yield"] = round((annual_rent / price) * 100, 2) if price > 0 else 0.0
    result["grm"] = round(grm, 2) if grm is not None else None
    result["rent_to_price_pct"] = round(rent_to_price_pct, 2)
    result["oer"] = round(oer, 4) if oer is not None else None

    # Transfer duty & refurb
    transfer_duty = calc_transfer_duty(price, config["transfer_duty_brackets"])
    refurb = calc_refurb_estimate(price, config["refurb_bands"])
    deposit = price * (1 - ltv)
    bond_init = fin.get("bond_initiation_fee", 0)
    bond_reg = fin.get("bond_registration_estimate", 0)
    all_in_cost = deposit + transfer_duty + refurb + bond_init + bond_reg

    result["transfer_duty"] = round(transfer_duty, 0)
    result["refurb_estimate"] = round(refurb, 0)
    result["all_in_cost"] = round(all_in_cost, 0)

    # Bond
    bond_amount = price * ltv
    monthly_bond = calc_bond_repayment(bond_amount, investment_rate, bond_term)
    annual_debt_service = monthly_bond * 12

    result["bond_amount"] = round(bond_amount, 0)
    result["monthly_bond"] = round(monthly_bond, 0)

    # Cash on cash, DSCR, BER
    annual_pre_refi_cf = noi - annual_debt_service
    monthly_cash_flow = annual_pre_refi_cf / 12
    cash_on_cash_pre_refi = annual_pre_refi_cf / all_in_cost if all_in_cost > 0 else 0.0
    dscr = noi / annual_debt_service if annual_debt_service > 0 else 0.0
    ber = (annual_opex + annual_debt_service) / annual_rent if annual_rent > 0 else None

    result["monthly_cash_flow"] = round(monthly_cash_flow, 0)
    result["annual_cash_flow"] = round(annual_pre_refi_cf, 0)
    result["cash_on_cash_pre_refi"] = round(cash_on_cash_pre_refi, 4)
    result["dscr"] = round(dscr, 2)
    result["ber"] = round(ber, 4) if ber is not None else None

    # -----------------------------------------------------------------------
    # Tier 2 — BRRRR value metrics
    # -----------------------------------------------------------------------
    area_cap = None
    aa = area_assumptions.get(area)
    if aa is None:
        for k, v in area_assumptions.items():
            if k.lower() == area.lower():
                aa = v
                break
    if aa:
        area_cap = aa.get("cap_rate")

    income_implied_value = noi / area_cap if area_cap and area_cap > 0 else None
    value_gap_pct = ((income_implied_value - price) / price * 100) if income_implied_value is not None and price > 0 else None

    result["income_implied_value"] = round(income_implied_value, 0) if income_implied_value is not None else None
    result["value_gap_pct"] = round(value_gap_pct, 2) if value_gap_pct is not None else None

    # Price per m2
    price_per_m2 = price / floor_size if floor_size and floor_size > 0 else None
    suburb_med_ppm2 = ppm2_medians.get(suburb)
    ppm2_vs_median = None
    if price_per_m2 is not None and suburb_med_ppm2 is not None and suburb_med_ppm2 > 0:
        ppm2_vs_median = ((price_per_m2 - suburb_med_ppm2) / suburb_med_ppm2) * 100

    result["price_per_m2"] = round(price_per_m2, 0) if price_per_m2 is not None else None
    result["suburb_median_price_per_m2"] = round(suburb_med_ppm2, 0) if suburb_med_ppm2 is not None else None
    result["price_per_m2_vs_median"] = round(ppm2_vs_median, 2) if ppm2_vs_median is not None else None

    # BRRRR lifecycle — revaluation via income approach with 20% floor
    revalued_price = max(
        income_implied_value if income_implied_value is not None else price * 1.20,
        price * 1.20
    )
    new_bond = revalued_price * ltv
    equity_extracted = new_bond - bond_amount
    cash_left = all_in_cost - equity_extracted

    new_monthly_bond = calc_bond_repayment(new_bond, investment_rate, bond_term)
    new_annual_debt = new_monthly_bond * 12
    post_refi_annual_cf = noi - new_annual_debt
    post_refi_cf = post_refi_annual_cf / 12

    result["revalued_price"] = round(revalued_price, 0)
    result["new_bond"] = round(new_bond, 0)
    result["equity_extracted"] = round(equity_extracted, 0)
    result["cash_left_in_deal"] = round(cash_left, 0)
    result["post_refi_monthly_cash_flow"] = round(post_refi_cf, 0)

    # Equity multiple 5yr
    escalation = ops.get("rental_escalation_pa", 0.055)
    cumulative_net_cf = 0.0
    projected_noi = noi
    for yr in range(1, 6):
        projected_noi = projected_noi * (1 + escalation)
        projected_annual_cf = projected_noi - new_annual_debt
        cumulative_net_cf += projected_annual_cf

    equity_multiple_5yr = (equity_extracted + cumulative_net_cf) / all_in_cost if all_in_cost > 0 else 0.0
    result["equity_multiple_5yr"] = round(equity_multiple_5yr, 2)

    # -----------------------------------------------------------------------
    # Capital Appreciation Metrics
    # -----------------------------------------------------------------------
    # Annual property appreciation rate assumption (from config or default 6%)
    cap_appreciation_pa = ops.get("capital_appreciation_pa", 0.06)
    rental_esc = ops.get("rental_escalation_pa", 0.055)

    # Projected values at year 3, 5, 10
    value_yr3 = price * (1 + cap_appreciation_pa) ** 3
    value_yr5 = price * (1 + cap_appreciation_pa) ** 5
    value_yr10 = price * (1 + cap_appreciation_pa) ** 10

    result["value_yr3"] = round(value_yr3, 0)
    result["value_yr5"] = round(value_yr5, 0)
    result["value_yr10"] = round(value_yr10, 0)

    # Capital gain at year 5 (after selling costs ~5%)
    selling_costs_pct = 0.05
    capital_gain_yr5 = value_yr5 * (1 - selling_costs_pct) - price
    result["capital_gain_yr5"] = round(capital_gain_yr5, 0)

    # Bond balance at year 5 (amortisation schedule)
    monthly_rate = investment_rate / 12
    payments_made = 60  # 5 years
    if monthly_rate > 0:
        remaining_factor = ((1 + monthly_rate) ** bond_term - (1 + monthly_rate) ** payments_made) / ((1 + monthly_rate) ** bond_term - 1)
        bond_balance_yr5 = bond_amount * remaining_factor
    else:
        bond_balance_yr5 = bond_amount * (1 - payments_made / bond_term)
    result["bond_balance_yr5"] = round(bond_balance_yr5, 0)

    # Equity at year 5 = projected value - bond balance
    equity_yr5 = value_yr5 - bond_balance_yr5
    result["equity_yr5"] = round(equity_yr5, 0)

    # Equity built from purchase = equity_yr5 - initial equity (deposit)
    equity_growth = equity_yr5 - deposit
    result["equity_growth_yr5"] = round(equity_growth, 0)

    # Total return yr5 = capital gain + cumulative net rental income
    # (recalculate cumulative CF over 5 yrs with original bond, not refi)
    total_cf_5yr = 0.0
    proj_annual_rent_cf = effective_annual_rent
    for yr in range(1, 6):
        proj_annual_rent_cf = proj_annual_rent_cf * (1 + rental_esc) if yr > 1 else proj_annual_rent_cf
        proj_opex = annual_opex * (1 + 0.06) ** (yr - 1)  # expenses inflate ~6%
        proj_noi = proj_annual_rent_cf - proj_opex
        proj_cf = proj_noi - annual_debt_service
        total_cf_5yr += proj_cf

    result["total_cf_5yr"] = round(total_cf_5yr, 0)

    # Total return = capital gain + rental income
    total_return_yr5 = capital_gain_yr5 + total_cf_5yr
    result["total_return_yr5"] = round(total_return_yr5, 0)

    # Return on equity (total return / cash invested)
    roe_yr5 = total_return_yr5 / all_in_cost if all_in_cost > 0 else 0.0
    result["roe_yr5"] = round(roe_yr5, 4)

    # Annualised total return (CAGR on cash invested)
    if all_in_cost > 0 and total_return_yr5 > -all_in_cost:
        total_multiple = (all_in_cost + total_return_yr5) / all_in_cost
        annualised_return = total_multiple ** (1 / 5) - 1 if total_multiple > 0 else 0.0
    else:
        annualised_return = 0.0
    result["annualised_return_yr5"] = round(annualised_return, 4)

    # Yield on cost (NOI / all-in cost) — what the property yields on YOUR money
    yield_on_cost = noi / all_in_cost if all_in_cost > 0 else 0.0
    result["yield_on_cost"] = round(yield_on_cost, 4)

    # -----------------------------------------------------------------------
    # Tier 3 — Supply/demand dynamics
    # -----------------------------------------------------------------------
    rental_supply_count = supply_stats["rental_by_suburb_beds"].get((suburb, beds), 0)
    sale_supply_count = supply_stats["sale_by_suburb"].get(suburb, 0)
    rental_sub_total = supply_stats["rental_by_suburb"].get(suburb, 0)
    rental_to_sale_ratio = rental_sub_total / sale_supply_count if sale_supply_count > 0 else None

    result["rental_supply_count"] = rental_supply_count
    result["sale_supply_count"] = sale_supply_count
    result["rental_to_sale_ratio"] = round(rental_to_sale_ratio, 2) if rental_to_sale_ratio is not None else None

    # Rent spread for suburb+beds from rental lookup
    rl_key = ("suburb", suburb, beds)
    if rl_key in rental_lookup:
        rl = rental_lookup[rl_key]
        rent_spread = (rl["max"] - rl["min"]) / rl["median"] if rl["median"] > 0 else None
    else:
        rent_spread = None
    result["rent_spread"] = round(rent_spread, 2) if rent_spread is not None else None

    # Price dispersion in suburb
    suburb_prices = supply_stats["sale_prices_by_suburb"].get(suburb, [])
    if len(suburb_prices) >= 2:
        price_dispersion = safe_stdev(suburb_prices) / safe_mean(suburb_prices) if safe_mean(suburb_prices) else None
    else:
        price_dispersion = None
    result["price_dispersion"] = round(price_dispersion, 4) if price_dispersion is not None else None

    # -----------------------------------------------------------------------
    # Catalyst proximity
    # -----------------------------------------------------------------------
    catalyst_score = calc_catalyst_score(suburb, config, today_date)
    result["catalyst_score"] = round(catalyst_score, 1)

    # -----------------------------------------------------------------------
    # Suburb quality score
    # -----------------------------------------------------------------------
    suburbs_data = suburb_scores.get("suburbs", {})
    suburb_info = suburbs_data.get(suburb)
    if suburb_info is None:
        for s_name, s_data in suburbs_data.items():
            if s_name.lower() == suburb.lower():
                suburb_info = s_data
                break

    dimensions = ["demand_level", "supply_tightness", "tenant_quality",
                  "catalyst_proximity", "infrastructure_quality"]

    if suburb_info:
        dim_values = [suburb_info.get(d, 5) for d in dimensions]
        suburb_quality_score = sum(dim_values) / len(dim_values) * 10
    else:
        suburb_quality_score = 50.0

    result["suburb_quality_score"] = round(suburb_quality_score, 1)

    # -----------------------------------------------------------------------
    # Safety score
    # -----------------------------------------------------------------------
    precincts = crime_stats.get("precincts", {})
    precinct_data = precincts.get(area)
    if precinct_data is None:
        for k, v in precincts.items():
            if k.lower() == area.lower():
                precinct_data = v
                break
    safety_score_raw = precinct_data.get("safety_score", 5.0) if precinct_data else 5.0
    safety_score = safety_score_raw * 10
    result["safety_score"] = round(safety_score, 1)

    # -----------------------------------------------------------------------
    # Capital appreciation score (0-100)
    # -----------------------------------------------------------------------
    cap_appr_score = (
        suburb_quality_score * 0.5 +   # suburb fundamentals
        catalyst_score * 0.3 +          # development catalysts
        safety_score * 0.2              # safety supports values
    )
    result["capital_appreciation_score"] = round(cap_appr_score, 1)

    # -----------------------------------------------------------------------
    # Distressed bonus
    # -----------------------------------------------------------------------
    distressed_flags = (listing.get("distressed_flags") or "").lower().strip()
    high_kw = ["repo", "estate", "motivated", "reduced", "auction", "as-is"]
    if any(kw in distressed_flags for kw in high_kw):
        distressed_score = 100
    elif "mandate" in distressed_flags:
        distressed_score = 30
    else:
        distressed_score = 0
    result["distressed_bonus"] = distressed_score

    # -----------------------------------------------------------------------
    # Component scores (all normalized to 0-100)
    # -----------------------------------------------------------------------
    cap_rate_score = min(cap_rate / 0.15 * 100, 100)
    coc_score = min(max(cash_on_cash_pre_refi, 0) / 0.25 * 100, 100)
    dscr_score_val = min(max(dscr - 0.8, 0) / 0.7 * 100, 100)
    vg_score = min(max(value_gap_pct, 0) / 30 * 100, 100) if value_gap_pct is not None else 0.0
    affordability_score = max(0, (1 - price / config["price_ceiling"]) * 100)
    brrrr_eff_score = min(equity_extracted / all_in_cost * 100, 100) if all_in_cost > 0 else 0.0

    # Rental supply tightness: fewer rental listings = higher score
    # Use inverse: score = max(0, 100 - rental_supply_count * 10)
    rental_supply_score = max(0, 100 - rental_supply_count * 10)

    result["cap_rate_score"] = round(cap_rate_score, 1)
    result["coc_score"] = round(coc_score, 1)
    result["dscr_score"] = round(dscr_score_val, 1)
    result["value_gap_score"] = round(vg_score, 1)
    result["affordability_score"] = round(affordability_score, 1)
    result["brrrr_efficiency_score"] = round(brrrr_eff_score, 1)
    result["rental_supply_score"] = round(rental_supply_score, 1)

    # Capital appreciation score (already computed above)
    cap_appr_score_val = result.get("capital_appreciation_score", 50.0)

    # -----------------------------------------------------------------------
    # Composite score
    # -----------------------------------------------------------------------
    composite = (
        cap_rate_score * weights.get("cap_rate", 0) +
        coc_score * weights.get("cash_on_cash", 0) +
        dscr_score_val * weights.get("dscr", 0) +
        vg_score * weights.get("value_gap", 0) +
        suburb_quality_score * weights.get("suburb_quality", 0) +
        cap_appr_score_val * weights.get("capital_appreciation", 0) +
        catalyst_score * weights.get("catalyst_proximity", 0) +
        safety_score * weights.get("safety", 0) +
        rental_supply_score * weights.get("rental_supply_tightness", 0) +
        affordability_score * weights.get("affordability", 0) +
        distressed_score * weights.get("distressed_bonus", 0) +
        brrrr_eff_score * weights.get("brrrr_efficiency", 0)
    )

    result["composite_score"] = round(composite, 1)

    return result


# ---------------------------------------------------------------------------
# Console output
# ---------------------------------------------------------------------------

def print_summary(scored, rental_lookup, config, sales, rentals):
    if not scored:
        print("No scored listings to display.")
        return

    W = 185
    line = "-" * W
    dline = "=" * W

    print(f"\n{dline}")
    print(f"  {config['market']['name'].upper()} — BRRRR INVESTMENT SCORECARD".center(W))
    print(f"  Generated: {TODAY}".center(W))
    print(dline)

    # --- 1. Top 20 deals ---
    print(f"\n  TOP 20 DEALS BY COMPOSITE SCORE\n{line}")
    header = (
        f"{'#':>3}  {'Area':<12} {'Suburb':<20} {'Bd':>2}  "
        f"{'Price':>10}  {'Rent':>8}  {'Cap':>6}  {'CoC':>6}  "
        f"{'DSCR':>5}  {'VGap%':>6}  {'Score':>6}  {'Flags':<12}"
    )
    print(header)
    print(line)

    for i, row in enumerate(scored[:20], 1):
        price = parse_float(row.get("price"))
        rent = parse_float(row.get("real_monthly_rent"))
        cap = parse_float(row.get("cap_rate")) * 100
        coc = parse_float(row.get("cash_on_cash_pre_refi")) * 100
        dscr_v = parse_float(row.get("dscr"))
        vgap = row.get("value_gap_pct")
        vgap_s = fmt_pct(vgap) if vgap is not None else "N/A"
        score = parse_float(row.get("composite_score"))
        flags = (row.get("distressed_flags") or "")[:12]
        area = (row.get("area") or "")[:12]
        suburb = (row.get("suburb") or "")[:20]
        beds = row.get("bedrooms", "?")

        print(
            f"{i:>3}  {area:<12} {suburb:<20} {beds:>2}  "
            f"{fmt_currency(price):>10}  {fmt_currency(rent):>8}  {cap:>5.1f}%  {coc:>5.1f}%  "
            f"{dscr_v:>5.2f}  {vgap_s:>6}  {score:>6.1f}  {flags:<12}"
        )

    # --- 2. Summary stats ---
    print(f"\n{line}")
    print("  SUMMARY STATISTICS")
    print(line)

    total = len(scored)
    caps = [parse_float(r.get("cap_rate")) * 100 for r in scored if parse_float(r.get("cap_rate")) > 0]
    yields = [parse_float(r.get("real_gross_yield")) for r in scored if parse_float(r.get("real_gross_yield")) > 0]
    avg_yield = safe_mean(yields) if yields else 0
    avg_cap = safe_mean(caps) if caps else 0
    cf_pos = sum(1 for r in scored if parse_float(r.get("monthly_cash_flow")) > 0)

    print(f"  Total listings scored:    {total}")
    print(f"  Average gross yield:      {fmt_pct(avg_yield)}")
    print(f"  Average cap rate:         {fmt_pct(avg_cap)}")
    print(f"  Cash-flow positive:       {cf_pos}/{total}")

    # --- 3. BRRRR viability ---
    print(f"\n{line}")
    print("  BRRRR VIABILITY")
    print(line)

    dscr_pass = sum(1 for r in scored if parse_float(r.get("dscr")) > 1.2)
    vgap_pos = sum(1 for r in scored if (r.get("value_gap_pct") or 0) > 0)
    cf_pos_refi = sum(1 for r in scored if parse_float(r.get("post_refi_monthly_cash_flow")) > 0)
    rtp_pass = sum(1 for r in scored if parse_float(r.get("rent_to_price_pct")) >= 1.3)

    print(f"  DSCR > 1.2:              {dscr_pass}/{total}")
    print(f"  Positive value gap:      {vgap_pos}/{total}")
    print(f"  Post-refi CF positive:   {cf_pos_refi}/{total}")
    print(f"  Rent/price >= 1.3%:      {rtp_pass}/{total}")

    # --- 4. Rental market comparison ---
    print(f"\n{line}")
    print("  RENTAL MARKET: SUBURB + BEDS SUPPLY")
    print(line)
    print(f"  {'Suburb':<22} {'Beds':>4}  {'Med Rent':>10}  {'Count':>5}  {'Spread':>8}")
    print(f"  {'-'*22} {'-'*4}  {'-'*10}  {'-'*5}  {'-'*8}")

    sorted_keys = sorted(
        [(k, v) for k, v in rental_lookup.items() if k[0] == "suburb"],
        key=lambda x: (x[0][1], x[0][2])
    )
    for key, val in sorted_keys:
        _, name, beds = key
        spread = (val["max"] - val["min"]) / val["median"] if val["median"] > 0 else 0
        print(
            f"  {name:<22} {beds:>4}  {fmt_currency(val['median']):>10}  "
            f"{val['count']:>5}  {spread:>7.2f}"
        )

    # --- 5. Area comparison ---
    print(f"\n{line}")
    print("  AREA COMPARISON")
    print(line)
    print(
        f"  {'Area':<15} {'Count':>5}  {'Avg Price':>12}  {'Avg Yield':>10}  "
        f"{'Avg Cap':>8}  {'Avg DSCR':>8}  {'Avg Score':>9}"
    )
    print(f"  {'-'*15} {'-'*5}  {'-'*12}  {'-'*10}  {'-'*8}  {'-'*8}  {'-'*9}")

    area_groups = defaultdict(list)
    for r in scored:
        a = (r.get("area") or "Other").strip()
        area_groups[a].append(r)

    for area_name in config["market"]["areas"]:
        rows = area_groups.get(area_name, [])
        if not rows:
            continue
        n = len(rows)
        ap = safe_mean([parse_float(r.get("price")) for r in rows]) or 0
        ay = safe_mean([parse_float(r.get("real_gross_yield")) for r in rows]) or 0
        ac = safe_mean([parse_float(r.get("cap_rate")) * 100 for r in rows]) or 0
        ad = safe_mean([parse_float(r.get("dscr")) for r in rows]) or 0
        asc = safe_mean([parse_float(r.get("composite_score")) for r in rows]) or 0
        print(
            f"  {area_name:<15} {n:>5}  {fmt_currency(ap):>12}  {fmt_pct(ay):>10}  "
            f"{fmt_pct(ac):>8}  {ad:>8.2f}  {asc:>9.1f}"
        )

    print(dline + "\n")


# ---------------------------------------------------------------------------
# CSV output
# ---------------------------------------------------------------------------

def write_output_csv(scored, output_path):
    if not scored:
        print("No scored listings to write.")
        return
    fieldnames = list(scored[0].keys())
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in scored:
            writer.writerow(row)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Loading data...")

    # Load config
    if not os.path.exists(CONFIG_PATH):
        print(f"ERROR: Config file not found at {CONFIG_PATH}")
        sys.exit(1)
    config = load_json(CONFIG_PATH)
    print(f"  Config:       {config['market']['name']}")

    today_date = date.today()

    # Load data files
    sales_file = find_most_recent(os.path.join(SCRAPER_DIR, "property24_listings_*.csv"))
    rentals_file = find_most_recent(os.path.join(SCRAPER_DIR, "property24_rentals_*.csv"))
    suburb_scores_file = os.path.join(DATA_DIR, "suburb-scores.json")
    crime_stats_file = os.path.join(DATA_DIR, "crime-stats.json")

    print(f"  Sales:        {os.path.basename(sales_file)}")
    print(f"  Rentals:      {os.path.basename(rentals_file)}")

    sales = load_csv(sales_file)
    rentals = load_csv(rentals_file)
    suburb_scores = load_json(suburb_scores_file)
    crime_stats = load_json(crime_stats_file)

    print(f"  Loaded {len(sales)} sale listings, {len(rentals)} rental listings")

    # Build lookups
    rental_lookup = build_rental_lookup(rentals)
    supply_stats = build_supply_stats(sales, rentals)
    ppm2_medians = build_price_per_m2_medians(sales)
    print(f"  Built rental lookup with {len(rental_lookup)} entries")

    # Score each listing
    scored = []
    skipped = 0
    for listing in sales:
        result = score_listing(
            listing, rental_lookup, suburb_scores, crime_stats,
            config, supply_stats, ppm2_medians, today_date
        )
        if result is not None:
            scored.append(result)
        else:
            skipped += 1

    if skipped:
        print(f"  Skipped {skipped} listings (no valid price)")

    # Sort by composite score descending
    scored.sort(key=lambda x: parse_float(x.get("composite_score")), reverse=True)

    # Add rank
    for i, row in enumerate(scored, 1):
        row["rank"] = i

    # Output
    output_csv = os.path.join(ANALYSIS_DIR, f"scored_listings_{TODAY}.csv")
    write_output_csv(scored, output_csv)
    print(f"\n  Output written to: {output_csv}")

    print_summary(scored, rental_lookup, config, sales, rentals)

    # --- HOUSES-ONLY CASH-NEUTRAL REPORT ---
    print_houses_report(scored)


def print_houses_report(scored):
    """Print a focused report: houses only, sorted by price/m², cash-neutral highlighted."""
    # Filter for houses and townhouses only
    houses = []
    for row in scored:
        title = (row.get("title") or "").lower()
        if "house" in title or "townhouse" in title:
            houses.append(row)

    if not houses:
        print("\nNo houses found in scored listings.")
        return

    dline = "=" * 180
    line = "-" * 180

    ltv = 0.90  # default
    try:
        import json as _json
        with open(os.path.join(SCRIPT_DIR, "config.json")) as _f:
            _cfg = _json.load(_f)
        ltv = _cfg.get("financing", {}).get("ltv", 0.90)
        prime = _cfg.get("financing", {}).get("prime_rate", 0.105)
    except Exception:
        prime = 0.105

    deposit_pct = int((1 - ltv) * 100)
    try:
        ops_note = _cfg.get("operating_assumptions", {}).get("capital_appreciation_pa", 0.06) * 100
        esc_note = _cfg.get("operating_assumptions", {}).get("rental_escalation_pa", 0.055) * 100
    except Exception:
        ops_note = 6.0
        esc_note = 5.5
    print(f"\n{dline}")
    print(f"  HOUSES & TOWNHOUSES — CASH-NEUTRAL ANALYSIS ({deposit_pct}% DEPOSIT / {prime*100:.1f}% PRIME)".center(180))
    print(dline)

    # Split: max R8,000/mo subsidy acceptable for first 2 years
    max_subsidy = -8000
    cash_neutral = [h for h in houses if parse_float(h.get("monthly_cash_flow")) >= max_subsidy]
    cash_negative = [h for h in houses if parse_float(h.get("monthly_cash_flow")) < max_subsidy]

    # Sort by capital appreciation score (catalyst + suburb quality), highest first
    cash_neutral.sort(key=lambda x: parse_float(x.get("capital_appreciation_score")), reverse=True)
    cash_neutral_sorted = cash_neutral

    print(f"\n  VIABLE HOUSES — MAX R5,000/mo SUBSIDY ({len(cash_neutral)} of {len(houses)} houses)")
    print(f"  Sorted by capital appreciation score (catalyst proximity + suburb quality + safety)")
    print(f"  Assumptions: {deposit_pct}% deposit, {prime*100:.1f}% prime, {ops_note:.0f}% annual appreciation")
    print(line)
    print(
        f"  {'#':>3}  {'Area':<14} {'Suburb':<22} {'Bd':>2}  {'Price':>12}  "
        f"{'Size':>7}  {'R/m²':>8}  {'Rent/mo':>10}  {'CF/mo':>9}  "
        f"{'Val@5yr':>12}  {'Eq@5yr':>12}  {'TotRtn':>12}  {'Ann%':>6}  URL"
    )
    print(line)

    for i, row in enumerate(cash_neutral_sorted, 1):
        price = parse_float(row.get("price"))
        ppm2 = parse_float(row.get("price_per_m2"))
        size = row.get("floor_size_m2", "")
        rent = parse_float(row.get("real_monthly_rent"))
        cf = parse_float(row.get("monthly_cash_flow"))
        val5 = parse_float(row.get("value_yr5"))
        eq5 = parse_float(row.get("equity_yr5"))
        tot_rtn = parse_float(row.get("total_return_yr5"))
        ann_rtn = parse_float(row.get("annualised_return_yr5"))
        area = (row.get("area") or "")[:14]
        suburb = (row.get("suburb") or "")[:22]
        beds = row.get("bedrooms", "?")
        url = row.get("listing_url", "")

        size_str = str(size)[:7] if size else "-"
        ppm2_str = fmt_currency(ppm2) if ppm2 > 0 else "-"
        cf_str = fmt_currency(cf)
        if cf >= 0:
            cf_str = f"+{cf_str}"

        print(
            f"  {i:>3}  {area:<14} {suburb:<22} {beds:>2}  {fmt_currency(price):>12}  "
            f"{size_str:>7}  {ppm2_str:>8}  {fmt_currency(rent):>10}  {cf_str:>9}  "
            f"{fmt_currency(val5):>12}  {fmt_currency(eq5):>12}  {fmt_currency(tot_rtn):>12}  {fmt_pct(ann_rtn * 100):>6}  {url}"
        )

    # Summary
    cash_neutral_with_m2 = [h for h in cash_neutral_sorted if h.get("price_per_m2") and parse_float(h.get("price_per_m2")) > 0]
    if cash_neutral_with_m2:
        ppm2_values = [parse_float(h.get("price_per_m2")) for h in cash_neutral_with_m2]
        avg_ppm2 = sum(ppm2_values) / len(ppm2_values)
        min_ppm2 = min(ppm2_values)
        max_ppm2 = max(ppm2_values)
        print(f"\n  Price per m² range: {fmt_currency(min_ppm2)} - {fmt_currency(max_ppm2)} (avg {fmt_currency(avg_ppm2)})")

    if cash_neutral:
        avg_price = sum(parse_float(h.get("price")) for h in cash_neutral) / len(cash_neutral)
        avg_cf = sum(parse_float(h.get("monthly_cash_flow")) for h in cash_neutral) / len(cash_neutral)
        print(f"  Average price: {fmt_currency(avg_price)}")
        print(f"  Average monthly cash flow: {fmt_currency(avg_cf)}")

    # Also show the best near-miss houses (CF between -R200 and -R1000)
    near_miss = [h for h in cash_negative if parse_float(h.get("monthly_cash_flow")) >= -2000]
    near_miss.sort(key=lambda x: parse_float(x.get("monthly_cash_flow")), reverse=True)

    if near_miss:
        print(f"\n  NEAR-MISS HOUSES ({len(near_miss)} — within R1,000/mo of cash-neutral)")
        print(line)
        print(
            f"  {'#':>3}  {'Area':<14} {'Suburb':<22} {'Bd':>2}  {'Price':>12}  "
            f"{'Size':>7}  {'R/m²':>8}  {'Rent/mo':>10}  {'CF/mo':>9}  "
            f"{'Val@5yr':>12}  {'Eq@5yr':>12}  {'TotRtn':>12}  URL"
        )
        print(line)

        for i, row in enumerate(near_miss[:15], 1):
            price = parse_float(row.get("price"))
            ppm2 = parse_float(row.get("price_per_m2"))
            size = row.get("floor_size_m2", "")
            rent = parse_float(row.get("real_monthly_rent"))
            cf = parse_float(row.get("monthly_cash_flow"))
            val5 = parse_float(row.get("value_yr5"))
            eq5 = parse_float(row.get("equity_yr5"))
            tot_rtn = parse_float(row.get("total_return_yr5"))
            area = (row.get("area") or "")[:14]
            suburb = (row.get("suburb") or "")[:22]
            beds = row.get("bedrooms", "?")
            url = row.get("listing_url", "")
            size_str = str(size)[:7] if size else "-"
            ppm2_str = fmt_currency(ppm2) if ppm2 > 0 else "-"

            print(
                f"  {i:>3}  {area:<14} {suburb:<22} {beds:>2}  {fmt_currency(price):>12}  "
                f"{size_str:>7}  {ppm2_str:>8}  {fmt_currency(rent):>10}  {fmt_currency(cf):>9}  "
                f"{fmt_currency(val5):>12}  {fmt_currency(eq5):>12}  {fmt_currency(tot_rtn):>12}  {url}"
            )

    print(f"\n  Total houses: {len(houses)} | Cash-neutral: {len(cash_neutral)} | Near-miss: {len(near_miss)} | Cash-negative: {len(cash_negative) - len(near_miss)}")

    # --- BEST FOR CAPITAL APPRECIATION (all houses, sorted by annualised return) ---
    houses_with_return = [h for h in houses if parse_float(h.get("annualised_return_yr5")) > 0]
    houses_with_return.sort(key=lambda x: parse_float(x.get("annualised_return_yr5")), reverse=True)
    top_cap = houses_with_return[:25]

    if top_cap:
        print(f"\n  TOP 25 HOUSES BY CAPITAL APPRECIATION + TOTAL RETURN (5-YEAR)")
        print(f"  Assumes {ops_note}% annual appreciation, rents escalate {esc_note}%/yr")
        print(line)
        print(
            f"  {'#':>3}  {'Area':<14} {'Suburb':<22} {'Bd':>2}  {'Price':>12}  "
            f"{'Size':>7}  {'R/m²':>8}  {'Rent/mo':>10}  {'CF/mo':>9}  "
            f"{'Val@5yr':>12}  {'Eq@5yr':>12}  {'TotRtn':>12}  {'Ann%':>6}  {'CapApr':>6}  URL"
        )
        print(line)

        for i, row in enumerate(top_cap, 1):
            price = parse_float(row.get("price"))
            ppm2 = parse_float(row.get("price_per_m2"))
            size = row.get("floor_size_m2", "")
            rent = parse_float(row.get("real_monthly_rent"))
            cf = parse_float(row.get("monthly_cash_flow"))
            val5 = parse_float(row.get("value_yr5"))
            eq5 = parse_float(row.get("equity_yr5"))
            tot_rtn = parse_float(row.get("total_return_yr5"))
            ann_rtn = parse_float(row.get("annualised_return_yr5"))
            cap_apr = parse_float(row.get("capital_appreciation_score"))
            area = (row.get("area") or "")[:14]
            suburb = (row.get("suburb") or "")[:22]
            beds = row.get("bedrooms", "?")
            url = row.get("listing_url", "")

            size_str = str(size)[:7] if size else "-"
            ppm2_str = fmt_currency(ppm2) if ppm2 > 0 else "-"
            cf_str = fmt_currency(cf)

            print(
                f"  {i:>3}  {area:<14} {suburb:<22} {beds:>2}  {fmt_currency(price):>12}  "
                f"{size_str:>7}  {ppm2_str:>8}  {fmt_currency(rent):>10}  {cf_str:>9}  "
                f"{fmt_currency(val5):>12}  {fmt_currency(eq5):>12}  {fmt_currency(tot_rtn):>12}  {fmt_pct(ann_rtn * 100):>6}  {cap_apr:>6.1f}  {url}"
            )

    print(dline + "\n")


if __name__ == "__main__":
    main()
