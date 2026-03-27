const { google } = require('googleapis');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, '..', '..', 'data', 'google-credentials.json');

const CALENDAR_IDS = {
  rooibos: '50f60dc406874d420a43df94d1c1345e91e518564d4867eec195ac613f0e3903@group.calendar.google.com',
  sheep: 'cb0b423fa828b0a2f0e5895c4f4d7d2245d1dec378ec85a3784891a256e71b3b@group.calendar.google.com',
  wine: '5d567550ac823e20b9dc967b4665be684c2abb1b3567509a3190cb7d1b12a5f6@group.calendar.google.com',
  general: '9208143bbd8f1f6947b8f04f853b504cf08f733269c695c50f1506a4bce86413@group.calendar.google.com',
};

const TIMEZONE = 'Africa/Johannesburg';

let authClient = null;

async function getAuth() {
  if (authClient) return authClient;
  const credentials = require(CREDENTIALS_PATH);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  authClient = await auth.getClient();
  return authClient;
}

function getCalendarId(enterprise) {
  if (!enterprise) return CALENDAR_IDS.general;
  const key = enterprise.toLowerCase();
  return CALENDAR_IDS[key] || CALENDAR_IDS.general;
}

/**
 * Push a calendar_events row to Google Calendar.
 * Creates if no google_event_id, updates if one exists.
 * Returns the google_event_id.
 */
async function pushEvent(event) {
  const auth = await getAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = getCalendarId(event.enterprise);

  // Build Google Calendar event body
  const body = {
    summary: event.title,
    description: event.notes || '',
  };

  // Start / end
  if (event.all_day || event.all_day === 1) {
    body.start = { date: event.start_date };
    if (event.end_date) {
      // Google all-day end date is exclusive, so add 1 day
      const endParts = event.end_date.split('-').map(Number);
      const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2] + 1);
      body.end = { date: endDate.toISOString().slice(0, 10) };
    } else {
      // Single-day event: end = day after start (exclusive)
      const startParts = event.start_date.split('-').map(Number);
      const nextDay = new Date(startParts[0], startParts[1] - 1, startParts[2] + 1);
      body.end = { date: nextDay.toISOString().slice(0, 10) };
    }
  } else {
    // Timed event — assume start_date contains datetime or use date + default times
    body.start = { dateTime: `${event.start_date}T08:00:00`, timeZone: TIMEZONE };
    body.end = {
      dateTime: event.end_date
        ? `${event.end_date}T17:00:00`
        : `${event.start_date}T09:00:00`,
      timeZone: TIMEZONE,
    };
  }

  // Recurrence
  if (event.recurrence_rule) {
    body.recurrence = [`RRULE:FREQ=${event.recurrence_rule}`];
  }

  if (event.google_event_id) {
    // Update existing
    await calendar.events.update({
      calendarId,
      eventId: event.google_event_id,
      requestBody: body,
    });
    return event.google_event_id;
  } else {
    // Insert new
    const res = await calendar.events.insert({
      calendarId,
      requestBody: body,
    });
    return res.data.id;
  }
}

/**
 * Delete an event from Google Calendar.
 */
async function deleteGoogleEvent(enterprise, googleEventId) {
  if (!googleEventId) return;
  const auth = await getAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = getCalendarId(enterprise);

  await calendar.events.delete({
    calendarId,
    eventId: googleEventId,
  });
}

/**
 * Pull events from a Google Calendar for a time range.
 * Returns array of normalized event objects.
 */
async function pullEvents(enterprise, timeMin, timeMax) {
  const auth = await getAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = getCalendarId(enterprise);

  const events = [];
  let pageToken;

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: false, // keep recurring as single entries
      maxResults: 250,
      pageToken,
    });

    for (const item of res.data.items || []) {
      events.push({
        googleEventId: item.id,
        summary: item.summary || '',
        description: item.description || '',
        start: item.start,
        end: item.end,
        recurrence: item.recurrence || null,
        updated: item.updated,
      });
    }

    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return events;
}

/**
 * Full sync from Google Calendar into local SQLite.
 * Returns { created, updated, deleted } counts.
 */
async function syncFromGoogle(db) {
  const counts = { created: 0, updated: 0, deleted: 0 };
  const year = new Date().getFullYear();
  const timeMin = `${year}-01-01T00:00:00Z`;
  const timeMax = `${year}-12-31T23:59:59Z`;

  for (const [enterprise, calendarId] of Object.entries(CALENDAR_IDS)) {
    let googleEvents;
    try {
      googleEvents = await pullEvents(enterprise, timeMin, timeMax);
    } catch (err) {
      console.warn(`[gcal-sync] Failed to pull ${enterprise}:`, err.message);
      continue;
    }

    const googleEventIds = new Set(googleEvents.map(e => e.googleEventId));

    for (const ge of googleEvents) {
      // Check if we have this event locally
      const local = db.prepare(
        'SELECT * FROM calendar_events WHERE google_event_id = ?'
      ).get(ge.googleEventId);

      if (local) {
        // Update local if Google version is newer
        const googleUpdated = ge.updated ? new Date(ge.updated) : new Date(0);
        const localUpdated = local.updated_at ? new Date(local.updated_at) : new Date(0);

        if (googleUpdated > localUpdated) {
          const startDate = ge.start.date || (ge.start.dateTime ? ge.start.dateTime.slice(0, 10) : local.start_date);
          let endDate = null;
          if (ge.end && ge.end.date) {
            // Google all-day end is exclusive — subtract 1 day
            const parts = ge.end.date.split('-').map(Number);
            const d = new Date(parts[0], parts[1] - 1, parts[2] - 1);
            endDate = d.toISOString().slice(0, 10);
            // If end == start after adjustment, no end_date needed
            if (endDate === startDate) endDate = null;
          } else if (ge.end && ge.end.dateTime) {
            endDate = ge.end.dateTime.slice(0, 10);
            if (endDate === startDate) endDate = null;
          }

          const allDay = ge.start.date ? 1 : 0;
          let recurrenceRule = null;
          if (ge.recurrence && ge.recurrence.length > 0) {
            const match = ge.recurrence[0].match(/FREQ=(\w+)/);
            if (match) recurrenceRule = match[1];
          }

          db.prepare(`
            UPDATE calendar_events
            SET title = ?, start_date = ?, end_date = ?, all_day = ?, recurrence_rule = ?, notes = ?, updated_at = ?
            WHERE id = ?
          `).run(
            ge.summary, startDate, endDate, allDay,
            recurrenceRule, ge.description || null,
            new Date().toISOString(), local.id
          );
          counts.updated++;
        }
      } else {
        // New event from Google — create locally
        const { v4: uuidv4 } = require('uuid');
        const startDate = ge.start.date || (ge.start.dateTime ? ge.start.dateTime.slice(0, 10) : null);
        if (!startDate) continue;

        let endDate = null;
        if (ge.end && ge.end.date) {
          const parts = ge.end.date.split('-').map(Number);
          const d = new Date(parts[0], parts[1] - 1, parts[2] - 1);
          endDate = d.toISOString().slice(0, 10);
          if (endDate === startDate) endDate = null;
        } else if (ge.end && ge.end.dateTime) {
          endDate = ge.end.dateTime.slice(0, 10);
          if (endDate === startDate) endDate = null;
        }

        const allDay = ge.start.date ? 1 : 0;
        let recurrenceRule = null;
        if (ge.recurrence && ge.recurrence.length > 0) {
          const match = ge.recurrence[0].match(/FREQ=(\w+)/);
          if (match) recurrenceRule = match[1];
        }

        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO calendar_events (id, title, enterprise, start_date, end_date, all_day, recurrence_rule, color, notes, google_event_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(), ge.summary, enterprise, startDate, endDate, allDay,
          recurrenceRule, null, ge.description || null, ge.googleEventId,
          now, now
        );
        counts.created++;
      }
    }

    // Check for locally-tracked events that were deleted from Google
    const localWithGoogleId = db.prepare(
      'SELECT id, google_event_id FROM calendar_events WHERE enterprise = ? AND google_event_id IS NOT NULL'
    ).all(enterprise);

    for (const local of localWithGoogleId) {
      if (!googleEventIds.has(local.google_event_id)) {
        db.prepare('DELETE FROM calendar_events WHERE id = ?').run(local.id);
        counts.deleted++;
      }
    }
  }

  return counts;
}

/**
 * Create an all-day Google Calendar event for a task due date.
 * Returns google_event_id.
 */
async function pushTaskDueDate(task) {
  const auth = await getAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = getCalendarId(task.enterprise);

  const startParts = task.due_date.split('-').map(Number);
  const nextDay = new Date(startParts[0], startParts[1] - 1, startParts[2] + 1);

  const body = {
    summary: `[TASK] ${task.title}`,
    description: `Priority: ${task.priority || 'medium'}\nEnterprise: ${task.enterprise || 'general'}\nType: ${task.type || 'manual'}`,
    start: { date: task.due_date },
    end: { date: nextDay.toISOString().slice(0, 10) },
  };

  const res = await calendar.events.insert({
    calendarId,
    requestBody: body,
  });
  return res.data.id;
}

/**
 * Update a Google Calendar event's description (e.g., mark completed).
 */
async function updateGoogleEventDescription(enterprise, googleEventId, description) {
  if (!googleEventId) return;
  const auth = await getAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = getCalendarId(enterprise);

  // Get existing event first to preserve other fields
  const existing = await calendar.events.get({ calendarId, eventId: googleEventId });
  existing.data.description = description;

  await calendar.events.update({
    calendarId,
    eventId: googleEventId,
    requestBody: existing.data,
  });
}

/**
 * Search Google Calendar by title to find matching events.
 * Used for initial linking of existing events.
 */
async function findEventByTitle(enterprise, title) {
  const auth = await getAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = getCalendarId(enterprise);

  const res = await calendar.events.list({
    calendarId,
    q: title,
    maxResults: 5,
    singleEvents: false,
  });

  const items = res.data.items || [];
  // Return the best match
  const exact = items.find(i => i.summary === title);
  return exact ? exact.id : (items.length > 0 ? items[0].id : null);
}

module.exports = {
  getAuth,
  getCalendarId,
  pushEvent,
  deleteGoogleEvent,
  pullEvents,
  syncFromGoogle,
  pushTaskDueDate,
  updateGoogleEventDescription,
  findEventByTitle,
  CALENDAR_IDS,
};
