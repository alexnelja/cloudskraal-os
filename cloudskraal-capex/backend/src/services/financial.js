/**
 * Financial computation engine for CapEx evaluation.
 * All rates are stored as decimals (e.g. 0.105 = 10.5%).
 */

const SA_CORPORATE_TAX = 0.27;

/**
 * Weighted Average Cost of Capital
 * WACC = (debtPercent * interestRate * (1 - taxRate)) + (equityPercent * equityCostPercent)
 */
function computeWacc(scenario) {
  const { debtPercent, interestRate, equityPercent, equityCostPercent } = scenario;
  return (debtPercent * interestRate * (1 - SA_CORPORATE_TAX)) + (equityPercent * equityCostPercent);
}

/**
 * Net Present Value
 * NPV = sum(CF_i / (1 + wacc)^year) - initialOutlay + salvageValue / (1 + wacc)^usefulLife
 */
function computeNpv(cashFlows, wacc, initialOutlay, salvageValue, usefulLifeYears) {
  let pvCashFlows = 0;
  for (const cf of cashFlows) {
    pvCashFlows += cf.netCashFlow / Math.pow(1 + wacc, cf.year);
  }
  const pvSalvage = salvageValue / Math.pow(1 + wacc, usefulLifeYears);
  return pvCashFlows - initialOutlay + pvSalvage;
}

/**
 * Internal Rate of Return — Newton-Raphson method
 * Finds rate r where NPV(r) = 0
 */
function computeIrr(cashFlows, initialOutlay, salvageValue, usefulLifeYears) {
  // NPV as function of rate
  function npvAtRate(r) {
    let pv = -initialOutlay;
    for (const cf of cashFlows) {
      pv += cf.netCashFlow / Math.pow(1 + r, cf.year);
    }
    pv += salvageValue / Math.pow(1 + r, usefulLifeYears);
    return pv;
  }

  // Derivative of NPV w.r.t. rate
  function npvDerivative(r) {
    let d = 0;
    for (const cf of cashFlows) {
      d -= cf.year * cf.netCashFlow / Math.pow(1 + r, cf.year + 1);
    }
    d -= usefulLifeYears * salvageValue / Math.pow(1 + r, usefulLifeYears + 1);
    return d;
  }

  let r = 0.10; // initial guess
  const maxIter = 200;
  const tolerance = 1e-8;

  for (let i = 0; i < maxIter; i++) {
    const npv = npvAtRate(r);
    const deriv = npvDerivative(r);

    if (Math.abs(deriv) < 1e-14) break;

    const rNew = r - npv / deriv;

    // Guard against divergence
    if (rNew < -0.99) {
      r = -0.5;
      continue;
    }
    if (rNew > 10) {
      r = 5;
      continue;
    }

    if (Math.abs(rNew - r) < tolerance) {
      return rNew;
    }
    r = rNew;
  }

  // If Newton-Raphson didn't converge, try bisection
  let lo = -0.5, hi = 5.0;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const npv = npvAtRate(mid);
    if (Math.abs(npv) < 1e-6) return mid;
    if (npv > 0) lo = mid;
    else hi = mid;
  }

  return null; // could not converge
}

/**
 * Payback period — year where cumulative cash flows exceed initial outlay
 */
function computePayback(cashFlows, initialOutlay) {
  // Sort by year
  const sorted = [...cashFlows].sort((a, b) => a.year - b.year);
  let cumulative = 0;
  for (const cf of sorted) {
    const prevCumulative = cumulative;
    cumulative += cf.netCashFlow;
    if (cumulative >= initialOutlay) {
      // Interpolate within the year
      const remaining = initialOutlay - prevCumulative;
      const fraction = cf.netCashFlow > 0 ? remaining / cf.netCashFlow : 0;
      return (cf.year - 1) + fraction;
    }
  }
  return null; // never pays back within the projection
}

/**
 * Profitability Index = (NPV + initialOutlay) / initialOutlay
 */
function computeProfitabilityIndex(npv, initialOutlay) {
  if (initialOutlay === 0) return null;
  return (npv + initialOutlay) / initialOutlay;
}

/**
 * Monthly loan payment based on repayment type.
 * Returns { monthlyPayment, totalInterest }
 */
function computeLoanMetrics(scenario, initialOutlay) {
  const debtAmount = initialOutlay * scenario.debtPercent;
  const monthlyRate = scenario.interestRate / 12;
  const totalMonths = scenario.loanTermYears * 12;

  if (debtAmount <= 0 || totalMonths <= 0) {
    return { monthlyPayment: 0, totalInterest: 0 };
  }

  let monthlyPayment = 0;
  let totalInterest = 0;

  switch (scenario.repaymentType) {
    case 'equal_installments': {
      // Standard amortization: PMT = P * r * (1+r)^n / ((1+r)^n - 1)
      if (monthlyRate === 0) {
        monthlyPayment = debtAmount / totalMonths;
        totalInterest = 0;
      } else {
        const factor = Math.pow(1 + monthlyRate, totalMonths);
        monthlyPayment = debtAmount * monthlyRate * factor / (factor - 1);
        totalInterest = (monthlyPayment * totalMonths) - debtAmount;
      }
      break;
    }
    case 'equal_principal': {
      // Equal principal repayment — monthly payment declines over time
      // Report the first month's payment as the "monthly payment"
      const principalPerMonth = debtAmount / totalMonths;
      const firstMonthInterest = debtAmount * monthlyRate;
      monthlyPayment = principalPerMonth + firstMonthInterest;
      // Total interest = sum of interest on declining balance
      // = monthlyRate * sum(debtAmount - k * principalPerMonth) for k=0..n-1
      // = monthlyRate * (n * debtAmount - principalPerMonth * n*(n-1)/2)
      totalInterest = monthlyRate * (totalMonths * debtAmount - principalPerMonth * totalMonths * (totalMonths - 1) / 2);
      break;
    }
    case 'bullet': {
      // Interest-only payments + lump sum principal at end
      monthlyPayment = debtAmount * monthlyRate;
      totalInterest = monthlyPayment * totalMonths;
      break;
    }
    default:
      break;
  }

  return {
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
  };
}

/**
 * Compute all financial metrics for a scenario given project data and cash flows.
 */
function computeAll(scenario, project, cashFlows) {
  const wacc = computeWacc(scenario);
  const npv = computeNpv(cashFlows, wacc, project.initialOutlay, project.salvageValue, project.usefulLifeYears);
  const irr = computeIrr(cashFlows, project.initialOutlay, project.salvageValue, project.usefulLifeYears);
  const paybackYears = computePayback(cashFlows, project.initialOutlay);
  const profitabilityIndex = computeProfitabilityIndex(npv, project.initialOutlay);
  const { monthlyPayment, totalInterest } = computeLoanMetrics(scenario, project.initialOutlay);

  return {
    wacc: Math.round(wacc * 10000) / 10000,
    npv: Math.round(npv * 100) / 100,
    irr: irr !== null ? Math.round(irr * 10000) / 10000 : null,
    paybackYears: paybackYears !== null ? Math.round(paybackYears * 100) / 100 : null,
    profitabilityIndex: profitabilityIndex !== null ? Math.round(profitabilityIndex * 10000) / 10000 : null,
    monthlyPayment,
    totalInterest,
  };
}

module.exports = { computeAll, computeWacc, computeNpv, computeIrr, computePayback, computeProfitabilityIndex, computeLoanMetrics };
