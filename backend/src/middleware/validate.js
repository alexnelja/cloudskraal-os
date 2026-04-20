function validateBody(schema) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body required', code: 'INVALID_BODY' });
    }
    // Basic string length enforcement
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string' && value.length > 10000) {
        return res.status(400).json({ error: `Field '${key}' exceeds maximum length`, code: 'FIELD_TOO_LONG' });
      }
    }
    next();
  };
}

function validateQuery(rules) {
  return (req, res, next) => {
    for (const [key, rule] of Object.entries(rules)) {
      const val = req.query[key];
      if (!val) continue;
      if (rule.pattern && !rule.pattern.test(val)) {
        return res.status(400).json({ error: `Invalid ${key} format`, code: 'INVALID_PARAM' });
      }
    }
    next();
  };
}

module.exports = { validateBody, validateQuery };
