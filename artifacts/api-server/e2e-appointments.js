const API_URL = 'http://localhost:3000/api';
let passed = 0, failed = 0;
const failures = [];

function pass(msg) { console.log(`  [PASS] ${msg}`); passed++; }
function fail(msg, detail='') { console.error(`  [FAIL] ${msg}${detail ? ': '+detail : ''}`); failed++; failures.push(msg); }
function check(cond, msg, detail='') { if(cond) pass(msg); else fail(msg, detail); }

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  let data; try { data = await res.json(); } catch { data = null; }
  return { status: res.status, ok: res.ok, data };
}
function ts() { return Date.now(); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('\n=== Appointments CRUD & Automation — Full E2E Audit ===\n');
  const createdIds = [];
  const createdWorkflowIds = [];

  // --- 1. Basic Appointment CRUD ---
  console.log('--- 1. Appointment CRUD ---');
  let r = await api('POST', '/appointments', { title: 'Missing Times' });
  check(!r.ok, 'Missing required fields returns validation error');

  const startTime = new Date(Date.now() + 86400000); // tomorrow
  const endTime = new Date(Date.now() + 86400000 + 3600000); // tomorrow + 1 hour

  r = await api('POST', '/appointments', {
    title: `Audit Appt ${ts()}`,
    description: 'A test appointment',
    type: 'viewing',
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    status: 'scheduled',
    location: '123 Audit St'
  });
  check(r.ok && r.data?.id, 'Appointment created successfully');
  const apptId = r.data?.id;
  if (apptId) createdIds.push(apptId);

  r = await api('GET', `/appointments/${apptId}`);
  const a = r.data;
  check(r.ok, 'GET /appointments/:id returns 200');
  check(a?.title?.startsWith('Audit Appt'), 'title persists correctly');
  check(a?.description === 'A test appointment', 'description persists');
  check(a?.type === 'viewing', 'type persists');
  check(a?.status === 'scheduled', 'status persists');
  check(a?.location === '123 Audit St', 'location persists');

  // Verify date handling
  const dbStart = new Date(a.startTime);
  const dbEnd = new Date(a.endTime);
  check(dbStart.getTime() === startTime.getTime(), 'startTime timezone/date handling is correct');
  check(dbEnd.getTime() === endTime.getTime(), 'endTime timezone/date handling is correct');

  // --- 2. Relationships ---
  console.log('\n--- 2. Relationships (Property/Lead/Client) ---');
  // Create a property
  let pRes = await api('POST', '/properties', {
    title: `Appt Property ${ts()}`, address: '456 Rel St', city: 'RelCity',
    price: 300000, type: 'residential', status: 'available', bedrooms: 1, bathrooms: 1, area: 500,
  });
  const propId = pRes.data?.id;

  // Create a lead
  let lRes = await api('POST', '/leads', {
    firstName: 'Appt', lastName: 'Lead', email: `appt.${ts()}@test.com`, source: 'website', status: 'new'
  });
  const leadId = lRes.data?.id;

  r = await api('PATCH', `/appointments/${apptId}`, {
    propertyId: propId,
    leadId: leadId
  });
  check(r.ok, 'PATCH appointment relationships succeeds');
  check(r.data?.propertyId === propId, 'propertyId linked correctly');
  check(r.data?.leadId === leadId, 'leadId linked correctly');

  // --- 3. Automation Integration ---
  console.log('\n--- 3. VIEWING_SCHEDULED / VIEWING_COMPLETED Automation ---');
  
  // Create test workflows
  r = await api('POST', '/workflows', {
    name: `TEST_VIEWING_SCHEDULED_${ts()}`,
    triggerEvent: 'VIEWING_SCHEDULED',
    actions: JSON.stringify([{ type: 'LOG_ACTIVITY' }]),
    isActive: true,
  });
  const wfScheduledId = r.data?.id;
  if (wfScheduledId) createdWorkflowIds.push(wfScheduledId);

  r = await api('POST', '/workflows', {
    name: `TEST_VIEWING_COMPLETED_${ts()}`,
    triggerEvent: 'VIEWING_COMPLETED',
    actions: JSON.stringify([{ type: 'LOG_ACTIVITY' }]),
    isActive: true,
  });
  const wfCompletedId = r.data?.id;
  if (wfCompletedId) createdWorkflowIds.push(wfCompletedId);

  // Baseline
  let wfSBase = (await api('GET', `/workflows/${wfScheduledId}`)).data?.executionCount || 0;
  let wfCBase = (await api('GET', `/workflows/${wfCompletedId}`)).data?.executionCount || 0;

  // Create new appointment -> should trigger VIEWING_SCHEDULED
  r = await api('POST', '/appointments', {
    title: `Auto Appt ${ts()}`,
    type: 'viewing',
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    status: 'scheduled',
  });
  const autoApptId = r.data?.id;
  if (autoApptId) createdIds.push(autoApptId);
  await sleep(1000);

  r = await api('GET', `/workflows/${wfScheduledId}`);
  check((r.data?.executionCount || 0) === wfSBase + 1, 'VIEWING_SCHEDULED fires exactly once on creation');

  // Edit non-status field -> should NOT trigger VIEWING_COMPLETED
  await api('PATCH', `/appointments/${autoApptId}`, { title: 'Updated Auto Appt' });
  await sleep(1000);
  r = await api('GET', `/workflows/${wfCompletedId}`);
  check((r.data?.executionCount || 0) === wfCBase, 'VIEWING_COMPLETED does NOT fire on unrelated edit');

  // Complete appointment -> should trigger VIEWING_COMPLETED
  await api('PATCH', `/appointments/${autoApptId}`, { status: 'completed' });
  await sleep(1000);
  r = await api('GET', `/workflows/${wfCompletedId}`);
  check((r.data?.executionCount || 0) === wfCBase + 1, 'VIEWING_COMPLETED fires exactly once on transition to completed');

  // Edit already-completed appointment -> should NOT re-trigger VIEWING_COMPLETED
  await api('PATCH', `/appointments/${autoApptId}`, { location: 'New Location' });
  await sleep(1000);
  r = await api('GET', `/workflows/${wfCompletedId}`);
  check((r.data?.executionCount || 0) === wfCBase + 1, 'VIEWING_COMPLETED does NOT re-fire when editing an already-completed appointment');

  // --- 4. Deletion / Cleanup ---
  console.log('\n--- 4. Deletion & Cleanup ---');
  r = await api('DELETE', `/appointments/${autoApptId}`);
  check(r.status === 204, 'DELETE /appointments/:id returns 204');
  r = await api('GET', `/appointments/${autoApptId}`);
  check(r.status === 404, 'Deleted appointment is gone');

  // Delete the other appointment so FKs are freed
  await api('DELETE', `/appointments/${apptId}`);
  
  // Delete associated property/lead to ensure appointment doesn't block it
  r = await api('DELETE', `/properties/${propId}`);
  check(r.status === 204, 'DELETE linked property succeeds (no FK blocking)');
  r = await api('DELETE', `/leads/${leadId}`);
  check(r.status === 204, 'DELETE linked lead succeeds (no FK blocking)');

  // ── Cleanup temp workflows ────────────────────────────────
  console.log('\n--- Cleanup: Deleting temp test workflows ---');
  for (const id of createdWorkflowIds) {
    await api('DELETE', `/workflows/${id}`);
  }
  for (const id of createdIds) {
    if (id !== autoApptId && id !== apptId) await api('DELETE', `/appointments/${id}`);
  }

  console.log('\n======================================');
  console.log(`TOTAL: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(f => console.log(`  ✗ ${f}`));
  }
  console.log('======================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Unexpected error:', e.message, e.stack); process.exit(1); });
