/**
 * Calendar events + Google Calendar sync + month summary.
 *
 * Split out of the former routes/calendar.js (v1.0.0 release gate) which mixed
 * two domains. Task CRUD now lives in routes/tasks-crud.js; task tags/statuses
 * live in routes/tasks.js.
 */
const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const gcal = require('../services/google-calendar');

const router = Router();

// ===========================================================================
// CALENDAR EVENTS
// ===========================================================================

// GET /api/calendar/events — list events, optional ?month=YYYY-MM&enterprise=X
router.get('/calendar/events', (req, res) => {
  const db = getDb();
  const { month, enterprise } = req.query;

  const conditions = [];
  const params = [];

  if (month) {
    // month format: YYYY-MM
    const start = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    conditions.push('start_date >= ? AND start_date < ?');
    params.push(start, nextMonth);
  }

  if (enterprise) {
    conditions.push('enterprise = ?');
    params.push(enterprise);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const events = db.prepare(`SELECT * FROM calendar_events ${where} ORDER BY start_date`).all(...params);
  res.json(events);
});

// POST /api/calendar/events — create event (+ push to Google)
router.post('/calendar/events', async (req, res) => {
  try {
    const db = getDb();
    const { title, enterprise, start_date, end_date, all_day, recurrence_rule, color, notes } = req.body;

    if (!title || !start_date) {
      return res.status(400).json({ error: 'title and start_date are required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const allDayInt = all_day === false || all_day === 0 ? 0 : 1;
    db.prepare(`
      INSERT INTO calendar_events (id, title, enterprise, start_date, end_date, all_day, recurrence_rule, color, notes, google_event_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(id, title, enterprise || null, start_date, end_date || null, allDayInt, recurrence_rule || null, color || null, notes || null, now, now);

    const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id);

    // Push to Google Calendar (best-effort)
    try {
      const googleEventId = await gcal.pushEvent(event);
      db.prepare('UPDATE calendar_events SET google_event_id = ? WHERE id = ?').run(googleEventId, id);
      event.google_event_id = googleEventId;
    } catch (err) {
      console.warn('[gcal] Failed to push new event to Google:', err.message);
    }

    res.status(201).json(event);
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/calendar/events/:id — update event (+ push to Google)
router.patch('/calendar/events/:id', async (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    const allowed = ['title', 'enterprise', 'start_date', 'end_date', 'all_day', 'recurrence_rule', 'color', 'notes'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
      db.prepare(`UPDATE calendar_events SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
    }

    const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);

    // Push update to Google Calendar (best-effort)
    try {
      const googleEventId = await gcal.pushEvent(event);
      if (!event.google_event_id && googleEventId) {
        db.prepare('UPDATE calendar_events SET google_event_id = ? WHERE id = ?').run(googleEventId, req.params.id);
        event.google_event_id = googleEventId;
      }
    } catch (err) {
      console.warn('[gcal] Failed to push event update to Google:', err.message);
    }

    res.json(event);
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/calendar/events/:id (+ delete from Google)
router.delete('/calendar/events/:id', async (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);

    // Delete from Google Calendar (best-effort)
    if (existing.google_event_id) {
      try {
        await gcal.deleteGoogleEvent(existing.enterprise, existing.google_event_id);
      } catch (err) {
        console.warn('[gcal] Failed to delete event from Google:', err.message);
      }
    }

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===========================================================================
// GOOGLE CALENDAR SYNC
// ===========================================================================

// POST /api/calendar/sync — pull changes from Google Calendar
router.post('/calendar/sync', async (req, res) => {
  try {
    const db = getDb();
    const counts = await gcal.syncFromGoogle(db);
    res.json(counts);
  } catch (err) {
    // Do not leak raw Google API error strings (tokens, refresh URLs,
    // internal account ids) to the client. Log server-side, return generic.
    console.error('[gcal] Sync failed:', err);
    res.status(500).json({ error: 'Google Calendar sync failed. Check server logs.' });
  }
});

// POST /api/calendar/link-google — link existing local events to Google by title
router.post('/calendar/link-google', async (req, res) => {
  try {
    const db = getDb();
    const unlinked = db.prepare(
      'SELECT * FROM calendar_events WHERE google_event_id IS NULL'
    ).all();

    let linked = 0;
    for (const event of unlinked) {
      try {
        const googleEventId = await gcal.findEventByTitle(event.enterprise, event.title);
        if (googleEventId) {
          db.prepare('UPDATE calendar_events SET google_event_id = ? WHERE id = ?').run(googleEventId, event.id);
          linked++;
        }
      } catch (err) {
        console.warn(`[gcal] Failed to find Google event for "${event.title}":`, err.message);
      }
    }

    res.json({ unlinked: unlinked.length, linked });
  } catch (err) {
    console.error('[gcal] Link failed:', err);
    res.status(500).json({ error: 'Google Calendar link-up failed. Check server logs.' });
  }
});

// ===========================================================================
// CALENDAR SUMMARY
// ===========================================================================

// GET /api/calendar/summary?month=YYYY-MM
router.get('/calendar/summary', (req, res) => {
  const db = getDb();
  const { month } = req.query;

  if (!month) return res.status(400).json({ error: 'month query param required (YYYY-MM)' });

  const start = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  const events = db.prepare(`
    SELECT * FROM calendar_events WHERE start_date >= ? AND start_date < ? ORDER BY start_date
  `).all(start, nextMonth);

  const tasks = db.prepare(`
    SELECT t.*, f.name AS field_name
    FROM tasks t
    LEFT JOIN fields f ON t.field_id = f.id
    WHERE t.due_date >= ? AND t.due_date < ?
    ORDER BY t.due_date
  `).all(start, nextMonth);

  res.json({ events, tasks });
});

module.exports = router;
