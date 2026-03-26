const { v4: uuidv4 } = require('uuid');
const { computeAll } = require('../services/financial');

/**
 * Seed data for Cloudskraal CapEx projects.
 * Cash flow estimates based on agricultural / farm operation knowledge.
 *
 * Growth assumptions:
 *   - Revenue: 6% p.a. (rooibos price appreciation + volume)
 *   - Costs: 4% p.a. (inflation)
 *   - Solar electricity price: 8% p.a. (Eskom increases)
 *   - Tourism/hospitality: 5% p.a.
 *   - Useful lives capped at 30 years for NPV purposes
 */

// Helpers for growth
const grow = (base, rate, year) => Math.round(base * Math.pow(1 + rate, year - 1));

const SEED_PROJECTS = [
  {
    name: 'Tea Court Expansion (1,000 m²)',
    type: 'infrastructure',
    description: 'Expand tea court drying area by 1,000 m² to enable additional ~25t/season drying capacity. Incremental revenue from drying more tea that otherwise requires scheduling workarounds.',
    initialOutlay: 875000,
    usefulLifeYears: 20,
    salvageValue: 50000,
    status: 'approved',
    priority: 'tier1',
    taxBenefit: 'Paragraph 12: 100% deduction (farming)',
    cashFlowFn: (year) => ({
      revenue: grow(600000, 0.06, year),
      operatingCosts: grow(80000, 0.04, year),
    }),
  },
  {
    name: 'Processing Plant Stabilisation',
    type: 'infrastructure',
    description: 'Stabilise processing plant for FSSC 22000 certification enabling export at premium pricing (R120-250/kg).',
    initialOutlay: 1530000,
    usefulLifeYears: 15,
    salvageValue: 100000,
    status: 'evaluating',
    priority: 'tier2',
    taxBenefit: 'Paragraph 12: 100% deduction (farming)',
    cashFlowFn: (year) => {
      // Ramp-up: year 1 partial, full from year 2, then grow
      const baseRevenue = year === 1 ? 250000 : 500000;
      const growthYear = year === 1 ? 1 : year;
      return {
        revenue: year === 1 ? 250000 : grow(500000, 0.06, year - 1),
        operatingCosts: grow(80000, 0.04, year),
      };
    },
  },
  {
    name: 'VFD Upgrades (5× Bovic Cutters)',
    type: 'equipment',
    description: 'Install variable frequency drives on 5 Bovic tea cutters for energy savings and smoother operation.',
    initialOutlay: 200000,
    usefulLifeYears: 10,
    salvageValue: 10000,
    status: 'approved',
    priority: 'tier1',
    taxBenefit: 'Section 12C: 40/20/20/20 depreciation',
    cashFlowFn: (year) => ({
      revenue: grow(50000, 0.06, year),
      operatingCosts: grow(5000, 0.04, year),
    }),
  },
  {
    name: 'Masatec Platform Scale',
    type: 'equipment',
    description: 'Heavy-duty platform scale for accurate weighing of tea and other produce.',
    initialOutlay: 60000,
    usefulLifeYears: 15,
    salvageValue: 5000,
    status: 'approved',
    priority: 'tier1',
    taxBenefit: 'Section 12C: 40/20/20/20 depreciation',
    cashFlowFn: (year) => ({
      revenue: grow(25000, 0.06, year),
      operatingCosts: grow(2000, 0.04, year),
    }),
  },
  {
    name: 'Wagon Turning Table',
    type: 'equipment',
    description: 'Turning table for tea wagons to improve logistics flow at the processing plant.',
    initialOutlay: 45000,
    usefulLifeYears: 20,
    salvageValue: 5000,
    status: 'draft',
    priority: 'tier3',
    taxBenefit: 'Section 12C: 40/20/20/20 depreciation',
    cashFlowFn: (year) => ({
      revenue: grow(15000, 0.06, year),
      operatingCosts: grow(1000, 0.04, year),
    }),
  },
  {
    name: 'Moisture Probes & Fermentation',
    type: 'equipment',
    description: 'Install moisture probes and fermentation monitoring equipment to improve tea quality consistency.',
    initialOutlay: 130000,
    usefulLifeYears: 8,
    salvageValue: 10000,
    status: 'evaluating',
    priority: 'tier1',
    taxBenefit: 'Section 12C: 40/20/20/20 depreciation',
    cashFlowFn: (year) => ({
      revenue: grow(60000, 0.06, year),
      operatingCosts: grow(5000, 0.04, year),
    }),
  },
  {
    name: 'Soil Amendment Program (500 ha)',
    type: 'other',
    description: 'Comprehensive soil amendment across 500 ha of tea and crop land: lime, comite, organic matter. 3-year program.',
    initialOutlay: 3750000,
    usefulLifeYears: 3,
    salvageValue: 0,
    status: 'evaluating',
    priority: 'tier3',
    taxBenefit: 'Paragraph 12: 100% deduction (farming)',
    cashFlowFn: (year) => {
      // Yield improvement compounds over 3 years, no growth beyond since program ends
      const revenue = year === 1 ? 400000 : year === 2 ? 900000 : 1500000;
      const costs = year === 1 ? 150000 : year === 2 ? 160000 : 170000;
      return { revenue, operatingCosts: costs };
    },
  },
  {
    name: 'Tea Bin Upgrades (20 bins)',
    type: 'storage',
    description: 'Replace and upgrade 20 tea storage bins for improved quality control and capacity.',
    initialOutlay: 225000,
    usefulLifeYears: 15,
    salvageValue: 15000,
    status: 'draft',
    priority: 'tier2',
    taxBenefit: 'Section 12C: 40/20/20/20 depreciation',
    cashFlowFn: (year) => ({
      revenue: grow(45000, 0.06, year),
      operatingCosts: grow(3000, 0.04, year),
    }),
  },
  {
    name: 'Farm Road Improvements (20 km)',
    type: 'infrastructure',
    description: 'Gravel and drainage improvements across 20 km of internal farm roads.',
    initialOutlay: 2500000,
    usefulLifeYears: 20,
    salvageValue: 0,
    status: 'draft',
    priority: 'tier3',
    taxBenefit: 'Paragraph 12: 100% deduction (farming)',
    cashFlowFn: (year) => ({
      revenue: grow(350000, 0.06, year),   // reduced maintenance, fuel savings, less crop damage
      operatingCosts: grow(50000, 0.04, year),
    }),
  },
  {
    name: 'Solar PV 70kWp + 350kWh BESS',
    type: 'solar',
    description: '70 kWp solar PV array with 350 kWh battery energy storage system for factory power.',
    initialOutlay: 2145000,
    usefulLifeYears: 25,
    salvageValue: 200000,
    status: 'evaluating',
    priority: 'tier2',
    taxBenefit: 'Section 12B: 100% first-year write-off',
    cashFlowFn: (year) => {
      // Panel degradation 0.5%/yr on generation, but electricity price rises 8%/yr (Eskom)
      // Net effect: base 300K × 0.995^(y-1) × 1.08^(y-1)
      const savings = 300000 * Math.pow(0.995, year - 1) * Math.pow(1.08, year - 1);
      return {
        revenue: Math.round(savings),
        operatingCosts: grow(30000, 0.04, year),
      };
    },
  },
  {
    name: 'Worker Housing (6 units)',
    type: 'infrastructure',
    description: 'Build 6 worker housing units to improve staff retention and comply with housing standards.',
    initialOutlay: 810000,
    usefulLifeYears: 30,
    salvageValue: 300000,
    status: 'draft',
    priority: 'tier3',
    taxBenefit: 'Paragraph 12: 100% deduction (farming)',
    cashFlowFn: (year) => ({
      revenue: grow(120000, 0.05, year),   // retention savings + reduced recruitment costs
      operatingCosts: grow(20000, 0.04, year),
    }),
  },
  {
    name: 'Hospitality Cabins (3 units)',
    type: 'infrastructure',
    description: '3 self-catering cabins for agri-tourism and farm-stay revenue diversification.',
    initialOutlay: 1980000,
    usefulLifeYears: 20,
    salvageValue: 500000,
    status: 'evaluating',
    priority: 'tier3',
    taxBenefit: 'Paragraph 12: 100% deduction (farming)',
    cashFlowFn: (year) => {
      // Ramp-up then grow 5%/yr from year 3 base
      let baseRevenue;
      if (year === 1) baseRevenue = 100000;
      else if (year === 2) baseRevenue = 350000;
      else baseRevenue = grow(450000, 0.05, year - 2);

      let baseCosts;
      if (year === 1) baseCosts = 40000;
      else if (year === 2) baseCosts = 70000;
      else baseCosts = grow(90000, 0.04, year - 2);

      return { revenue: baseRevenue, operatingCosts: baseCosts };
    },
  },
  {
    name: 'Vineyard Replanting (6 ha)',
    type: 'other',
    description: 'Replant 6 ha of vineyards with premium cultivars for Boland wine production.',
    initialOutlay: 2280000,
    usefulLifeYears: 25,
    salvageValue: 0,
    status: 'draft',
    priority: 'tier3',
    taxBenefit: 'Paragraph 12: 100% planting deduction',
    cashFlowFn: (year) => {
      // Vines: no production years 1-2, partial year 3-4, full year 5+, then grow 6%
      let revenue;
      if (year <= 2) revenue = 0;
      else if (year === 3) revenue = 300000;
      else if (year === 4) revenue = 700000;
      else revenue = grow(1200000, 0.06, year - 4);

      let costs;
      if (year <= 2) costs = grow(80000, 0.04, year);
      else if (year <= 4) costs = grow(100000, 0.04, year);
      else costs = grow(150000, 0.04, year);

      return { revenue, operatingCosts: costs };
    },
  },
  {
    name: 'Fencing & Kraals — Karoo',
    type: 'livestock',
    description: 'Fencing and kraal infrastructure for Karoo livestock operation expansion.',
    initialOutlay: 1600000,
    usefulLifeYears: 15,
    salvageValue: 100000,
    status: 'draft',
    priority: 'tier3',
    taxBenefit: 'Paragraph 12: 100% deduction (farming)',
    cashFlowFn: (year) => ({
      revenue: grow(280000, 0.06, year),
      operatingCosts: grow(30000, 0.04, year),
    }),
  },
  {
    name: 'Buchu Expansion (3 ha)',
    type: 'other',
    description: 'Expand buchu cultivation by 3 ha — high-value essential oil crop.',
    initialOutlay: 940000,
    usefulLifeYears: 10,
    salvageValue: 0,
    status: 'draft',
    priority: 'tier3',
    taxBenefit: 'Paragraph 12: 100% planting deduction',
    cashFlowFn: (year) => {
      if (year === 1) return { revenue: 0, operatingCosts: 60000 };
      if (year === 2) return { revenue: 150000, operatingCosts: grow(70000, 0.04, 2) };
      return {
        revenue: grow(350000, 0.06, year - 2),
        operatingCosts: grow(80000, 0.04, year),
      };
    },
  },
  {
    name: 'Sceletium Pilot (1-2 ha)',
    type: 'other',
    description: 'Pilot Sceletium tortuosum cultivation for nutraceutical / export market.',
    initialOutlay: 580000,
    usefulLifeYears: 5,
    salvageValue: 0,
    status: 'draft',
    priority: 'tier3',
    taxBenefit: 'Paragraph 12: 100% planting deduction',
    cashFlowFn: (year) => {
      if (year === 1) return { revenue: 0, operatingCosts: 40000 };
      if (year === 2) return { revenue: 100000, operatingCosts: grow(50000, 0.04, 2) };
      return {
        revenue: grow(280000, 0.06, year - 2),
        operatingCosts: grow(60000, 0.04, year),
      };
    },
  },
  {
    name: 'Centre Pivot Irrigation (15 ha)',
    type: 'irrigation',
    description: '15 ha centre pivot irrigation system for improved water efficiency and crop yield.',
    initialOutlay: 965000,
    usefulLifeYears: 20,
    salvageValue: 50000,
    status: 'draft',
    priority: 'tier3',
    taxBenefit: 'Paragraph 12: 100% deduction (farming)',
    cashFlowFn: (year) => ({
      revenue: grow(180000, 0.06, year),
      operatingCosts: grow(25000, 0.04, year),
    }),
  },
  {
    name: 'Bulk Storage & Conveyor System',
    type: 'storage',
    description: 'Bulk tea storage facility with conveyor system for improved processing flow.',
    initialOutlay: 1930000,
    usefulLifeYears: 20,
    salvageValue: 150000,
    status: 'draft',
    priority: 'tier3',
    taxBenefit: 'Section 12C: 40/20/20/20 depreciation',
    cashFlowFn: (year) => ({
      revenue: grow(320000, 0.06, year),
      operatingCosts: grow(40000, 0.04, year),
    }),
  },
  {
    name: 'Meulsteenvlei Purchase',
    type: 'land',
    description: 'Acquire Meulsteenvlei farm — strategic consolidation for tea expansion and lease savings.',
    initialOutlay: 12000000,
    usefulLifeYears: 30,
    salvageValue: 15000000,
    status: 'approved',
    priority: 'tier1',
    taxBenefit: 'Section 24J: Interest deductible',
    cashFlowFn: (year) => ({
      revenue: grow(1600000, 0.06, year),
      operatingCosts: grow(500000, 0.04, year),
    }),
  },
  {
    name: 'Fuel Storage Tank (10,000L)',
    type: 'storage',
    description: '10,000L diesel storage tank for bulk fuel purchasing and on-farm distribution.',
    initialOutlay: 275000,
    usefulLifeYears: 20,
    salvageValue: 20000,
    status: 'draft',
    priority: 'tier3',
    taxBenefit: 'Section 12C: 40/20/20/20 depreciation',
    cashFlowFn: (year) => ({
      revenue: grow(60000, 0.06, year),
      operatingCosts: grow(5000, 0.04, year),
    }),
  },
  {
    name: 'Buchu Irrigation Fix (1.6 ha)',
    type: 'irrigation',
    description: 'Repair and upgrade irrigation on existing 1.6 ha buchu block.',
    initialOutlay: 110000,
    usefulLifeYears: 10,
    salvageValue: 5000,
    status: 'evaluating',
    priority: 'tier2',
    taxBenefit: 'Paragraph 12: 100% deduction (farming)',
    cashFlowFn: (year) => ({
      revenue: grow(40000, 0.06, year),
      operatingCosts: grow(3000, 0.04, year),
    }),
  },
  {
    name: 'Wine Irrigation Replacement (10 ha)',
    type: 'irrigation',
    description: 'Replace ageing drip irrigation on 10 ha wine block for water efficiency.',
    initialOutlay: 525000,
    usefulLifeYears: 15,
    salvageValue: 20000,
    status: 'draft',
    priority: 'tier3',
    taxBenefit: 'Paragraph 12: 100% deduction (farming)',
    cashFlowFn: (year) => ({
      revenue: grow(110000, 0.06, year),
      operatingCosts: grow(10000, 0.04, year),
    }),
  },
];

function seedDatabase(db) {
  const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
  if (projectCount > 0) return; // Already seeded

  console.log('Seeding database with Cloudskraal CapEx projects...');

  const insertProject = db.prepare(`
    INSERT INTO projects (id, name, type, description, initialOutlay, usefulLifeYears, salvageValue, status, priority, taxBenefit, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCashFlow = db.prepare(`
    INSERT INTO cash_flows (id, projectId, year, revenue, operatingCosts, netCashFlow)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertScenario = db.prepare(`
    INSERT INTO scenarios (id, projectId, name, debtPercent, equityPercent, interestRate, loanTermYears, equityCostPercent, repaymentType, wacc, npv, irr, paybackYears, profitabilityIndex, monthlyPayment, totalInterest)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  const seedAll = db.transaction(() => {
    for (const proj of SEED_PROJECTS) {
      const projectId = uuidv4();

      insertProject.run(
        projectId, proj.name, proj.type, proj.description,
        proj.initialOutlay, proj.usefulLifeYears, proj.salvageValue,
        proj.status, proj.priority, proj.taxBenefit, now, now
      );

      // Generate cash flows
      const cashFlows = [];
      for (let year = 1; year <= proj.usefulLifeYears; year++) {
        const { revenue, operatingCosts } = proj.cashFlowFn(year);
        const netCashFlow = revenue - operatingCosts;
        const cfId = uuidv4();
        insertCashFlow.run(cfId, projectId, year, revenue, operatingCosts, netCashFlow);
        cashFlows.push({ id: cfId, projectId, year, revenue, operatingCosts, netCashFlow });
      }

      // Create default "Base Case" scenario
      const scenario = {
        debtPercent: 0.6,
        equityPercent: 0.4,
        interestRate: 0.105,
        loanTermYears: 10,
        equityCostPercent: 0.15,
        repaymentType: 'equal_installments',
      };

      const project = {
        initialOutlay: proj.initialOutlay,
        salvageValue: proj.salvageValue,
        usefulLifeYears: proj.usefulLifeYears,
      };

      const computed = computeAll(scenario, project, cashFlows);
      const scenarioId = uuidv4();

      insertScenario.run(
        scenarioId, projectId, 'Base Case',
        scenario.debtPercent, scenario.equityPercent, scenario.interestRate,
        scenario.loanTermYears, scenario.equityCostPercent, scenario.repaymentType,
        computed.wacc, computed.npv, computed.irr, computed.paybackYears,
        computed.profitabilityIndex, computed.monthlyPayment, computed.totalInterest
      );
    }
  });

  seedAll();
  console.log(`Seeded ${SEED_PROJECTS.length} projects with cash flows and base case scenarios.`);
}

module.exports = { seedDatabase };
