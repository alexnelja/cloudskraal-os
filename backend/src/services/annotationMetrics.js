const length = require('@turf/length').default;
const area = require('@turf/area').default;
const { lineString, polygon } = require('@turf/helpers');

function computeMetrics(geometry) {
  if (!geometry || typeof geometry !== 'object') return {};
  if (geometry.type === 'LineString') {
    return {
      length_m: length(lineString(geometry.coordinates), { units: 'meters' }),
    };
  }
  if (geometry.type === 'Polygon') {
    return { area_m2: area(polygon(geometry.coordinates)) };
  }
  return {};
}

module.exports = { computeMetrics };
