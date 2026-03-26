const { v4: uuidv4 } = require('uuid');

function seedCalendar(db) {
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM calendar_events').get().cnt;
  if (count > 0) return;

  const now = new Date().toISOString();

  // ── Seasonal Calendar Events ────────────────────────────────────────────────

  const events = [
    // Rooibos
    { title: 'Start Rooibos Harvest', enterprise: 'rooibos', start_date: '2026-01-06', end_date: null, color: '#047857' },
    { title: 'Harvest at Agterseland', enterprise: 'rooibos', start_date: '2026-01-16', end_date: null, color: '#047857' },
    { title: 'Rooibos Seed Sowing', enterprise: 'rooibos', start_date: '2026-02-15', end_date: '2026-03-31', color: '#047857' },
    { title: 'Transplanting Window', enterprise: 'rooibos', start_date: '2026-05-01', end_date: '2026-07-31', color: '#047857' },
    { title: 'Garsland Factory Occupation', enterprise: 'rooibos', start_date: '2026-11-01', end_date: null, color: '#047857' },

    // Sheep
    { title: 'Ramme by die Ooie (Joining)', enterprise: 'sheep', start_date: '2026-12-03', end_date: null, color: '#d97706' },
    { title: 'Ram Removal', enterprise: 'sheep', start_date: '2026-12-20', end_date: null, color: '#d97706' },
    { title: 'Lambing Season', enterprise: 'sheep', start_date: '2026-05-17', end_date: '2026-07-31', color: '#d97706' },
    { title: 'Shearing Season', enterprise: 'sheep', start_date: '2026-09-01', end_date: '2026-10-31', color: '#d97706' },

    // Wine
    { title: 'Check Grapes for Harvest', enterprise: 'wine', start_date: '2026-03-04', end_date: null, color: '#7c3aed' },
    { title: 'Grape Harvest', enterprise: 'wine', start_date: '2026-03-10', end_date: '2026-03-31', color: '#7c3aed' },
    { title: 'Vineyard Pruning', enterprise: 'wine', start_date: '2026-07-01', end_date: '2026-07-31', color: '#7c3aed' },

    // General
    { title: 'Khulani Team Begins', enterprise: 'general', start_date: '2026-01-16', end_date: null, color: '#6b7280' },
    { title: 'Prepare Soil for Grains', enterprise: 'general', start_date: '2026-11-01', end_date: '2026-12-18', color: '#6b7280' },
    { title: 'Grain Sowing', enterprise: 'general', start_date: '2026-04-01', end_date: null, color: '#6b7280' },
  ];

  const insertEvent = db.prepare(`
    INSERT INTO calendar_events (id, title, enterprise, start_date, end_date, all_day, recurrence_rule, color, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 'YEARLY', ?, NULL, ?, ?)
  `);

  for (const e of events) {
    insertEvent.run(uuidv4(), e.title, e.enterprise, e.start_date, e.end_date, e.color, now, now);
  }

  // ── Example Tasks ───────────────────────────────────────────────────────────

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, title, description, enterprise, field_id, type, status, priority, due_date, completed_date, completed_by, assigned_to, depends_on_task_id, recurrence_rule, calendar_event_id, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertInput = db.prepare(`
    INSERT INTO task_inputs (id, task_id, product_name, category, rate, rate_unit, total_applied, total_unit, cost_per_unit, total_cost, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertChecklist = db.prepare(`
    INSERT INTO task_checklists (id, task_id, item, checked, sort_order)
    VALUES (?, ?, ?, 0, ?)
  `);

  // Look up field B2 for the lime task
  const b2Field = db.prepare('SELECT id FROM fields WHERE code = ? LIMIT 1').get('B2');
  const b2FieldId = b2Field ? b2Field.id : null;

  // 1. Order rooibos seed
  const task1Id = uuidv4();
  insertTask.run(task1Id, 'Order rooibos seed for 2026 nursery', null, 'rooibos', null, 'scheduled', 'pending', 'high', '2026-01-15', null, null, null, null, null, null, null, now, now);

  // 2. Service Bovic cutters (completed)
  const task2Id = uuidv4();
  insertTask.run(task2Id, 'Service Bovic cutters pre-harvest', null, 'rooibos', null, 'scheduled', 'completed', 'high', '2025-12-15', '2025-12-14', null, null, null, null, null, null, now, now);

  // 3. Apply lime to B2: Damkamp
  const task3Id = uuidv4();
  insertTask.run(task3Id, 'Apply lime to B2: Damkamp', null, 'rooibos', b2FieldId, 'manual', 'pending', 'medium', '2026-03-15', null, null, null, null, null, null, null, now, now);

  insertInput.run(uuidv4(), task3Id, 'Agricultural Lime', 'fertilizer', 2, 'tonnes/ha', 36.2, 'tonnes', 850, 30770, null);

  // 4. Move sheep to shearing shed
  const task4Id = uuidv4();
  insertTask.run(task4Id, 'Move sheep to shearing shed', null, 'sheep', null, 'manual', 'pending', 'medium', '2026-09-01', null, null, null, null, null, null, null, now, now);

  // 5. Shearing preparation (depends on task 4)
  const task5Id = uuidv4();
  insertTask.run(task5Id, 'Shearing preparation', null, 'sheep', null, 'dependent', 'pending', 'high', '2026-09-02', null, null, null, task4Id, null, null, null, now, now);

  // 6. Check vineyard irrigation drippers
  const task6Id = uuidv4();
  insertTask.run(task6Id, 'Check vineyard irrigation drippers', null, 'wine', null, 'manual', 'pending', 'low', '2026-08-15', null, null, null, null, null, null, null, now, now);

  // 7. Soil pH test — Garsland fields
  const task7Id = uuidv4();
  insertTask.run(task7Id, 'Soil pH test — Garsland fields', null, 'rooibos', null, 'triggered', 'pending', 'medium', '2026-04-01', null, null, null, null, null, null, null, now, now);

  const checklistItems = [
    'Collect soil samples from GA2',
    'Collect from GA3',
    'Collect from GA5',
    'Send to lab',
    'Record results in wiki',
  ];
  checklistItems.forEach((item, i) => {
    insertChecklist.run(uuidv4(), task7Id, item, i);
  });

  console.log(`  Seeded ${events.length} calendar events and 7 tasks`);
}

module.exports = { seedCalendar };
