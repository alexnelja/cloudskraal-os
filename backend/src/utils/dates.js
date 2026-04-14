// All dates in field_usage_period are ISO YYYY-MM-DD in UTC.
// Cloudskraal is in Africa/Johannesburg (UTC+2) but date math is done in UTC
// throughout the backend to avoid off-by-one errors across midnight SA time.
// The timezone constant is exported for *display-only* use by the frontend.

const CLOUDSKRAAL_TIMEZONE = 'Africa/Johannesburg';

function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

module.exports = { todayUTC, CLOUDSKRAAL_TIMEZONE };
