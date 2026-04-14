const USAGE_TYPES = [
  'rooibos',
  'lupines_fourrages',
  'oats',
  'fallow',
  'almond',
  'grazing',
  'vines',
  'wheat',
];

const PERENNIAL_USAGES = new Set(['rooibos', 'almond', 'vines']);

function isValidUsage(usage) {
  return USAGE_TYPES.includes(usage);
}

function isPerennial(usage) {
  return PERENNIAL_USAGES.has(usage);
}

function assertNoOverlap(existingPeriods, candidate) {
  const INF = '9999-12-31';
  const cStart = candidate.start_date;
  const cEnd = candidate.end_date ?? INF;

  for (const row of existingPeriods) {
    if (row.field_id !== candidate.field_id) continue;
    if (row.deleted_at) continue;
    if (row.id && candidate.id && row.id === candidate.id) continue;
    const rStart = row.start_date;
    const rEnd = row.end_date ?? INF;
    if (!(cEnd <= rStart || cStart >= rEnd)) {
      const err = new Error(`overlap with period ${row.id}`);
      err.code = 'overlap';
      err.conflict = row.id;
      throw err;
    }
  }
}

function yearsSincePlanted(plantedDate, asOf) {
  if (!plantedDate) return null;
  const [py, pm, pd] = plantedDate.split('-').map(Number);
  const [ay, am, ad] = asOf.split('-').map(Number);
  let years = ay - py;
  if (am < pm || (am === pm && ad < pd)) years -= 1;
  return years;
}

function rotationYearEffective(period, asOf) {
  if (period.rotation_year != null) return period.rotation_year;
  if (isPerennial(period.usage) && period.planted_date) {
    return yearsSincePlanted(period.planted_date, asOf);
  }
  return null;
}

module.exports = {
  USAGE_TYPES,
  PERENNIAL_USAGES,
  isValidUsage,
  isPerennial,
  assertNoOverlap,
  yearsSincePlanted,
  rotationYearEffective,
};
