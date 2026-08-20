
const API_URL = 'http://localhost:3000/api';
let passed = 0, failed = 0;
const failures = [];
const PROPERTY_TYPES = ['residential','apartment','villa','commercial','office','retail','industrial','land','other'];

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
  console.log('\n=== Properties CRUD & Automation — Full E2E Audit (v2) ===\n');
  const createdIds = [];
  const createdWorkflowIds = [];

  // ── 1. Property CRUD ──────────────────────────────────────
  console.log('--- 1. Property CRUD ---');
  let r = await api('POST', '/properties', { title:'Missing Fields' });
  check(!r.ok, 'Missing required fields returns validation error');

  for (const type of PROPERTY_TYPES) {
    r = await api('POST', '/properties', {
      title: `Test ${type} ${ts()}`, address: `123 ${type} St`,
      city: 'Testville', price: 350000, type, status: 'available',
      bedrooms: 2, bathrooms: 1, area: 900,
    });
    check(r.ok && r.data?.id, `Property type "${type}" created successfully`);
    if (r.ok && r.data?.id) createdIds.push(r.data.id);
  }

  const firstId = createdIds[0];
  r = await api('GET', `/properties/${firstId}`);
  const p = r.data;
  check(r.ok, 'GET /properties/:id returns 200');
  check(p?.title?.startsWith('Test residential'), 'title persists correctly');
  check(p?.address === '123 residential St', 'address persists');
  check(p?.city === 'Testville', 'city persists');
  check(Number(p?.price) === 350000, 'price persists');
  check(p?.type === 'residential', 'type persists');
  check(p?.status === 'available', 'status persists');
  check(Number(p?.bedrooms) === 2, 'bedrooms persists');
  check(Number(p?.bathrooms) === 1, 'bathrooms persists');
  check(Number(p?.area) === 900, 'area persists');

  r = await api('PATCH', `/properties/${firstId}`, {
    title: 'Updated Title', price: 400000, area: 1100, status: 'pending',
    address: '999 Updated Ave', city: 'New City',
  });
  check(r.ok, 'PATCH /properties/:id returns 200');
  check(r.data?.title === 'Updated Title', 'title updated');
  check(Number(r.data?.price) === 400000, 'price updated');
  check(Number(r.data?.area) === 1100, 'area updated');
  check(r.data?.status === 'pending', 'status updated');

  r = await api('PATCH', `/properties/${firstId}`, { title: 'Title Only Update' });
  check(r.ok && r.data?.status === 'pending', 'Editing title does not change status');

  // Note: We do NOT delete "other" here (section 1 only deletes a known index)
  const deleteId = createdIds[4]; // delete 'office' type
  r = await api('DELETE', `/properties/${deleteId}`);
  check(r.status === 204, 'DELETE /properties/:id returns 204');
  r = await api('GET', `/properties/${deleteId}`);
  check(r.status === 404, 'Deleted property returns 404');
  createdIds.splice(4, 1); // remove from tracking

  // ── 2. Property Types Consistency ────────────────────────
  console.log('\n--- 2. Property Types Consistency ---');
  // Create one fresh property for each type, then check they all exist in DB
  for (const type of PROPERTY_TYPES) {
    r = await api('POST', '/properties', {
      title: `TypeCheck-${type}-${ts()}`, address: '1 St', city: 'City',
      price: 100000, type, bedrooms: 0, bathrooms: 0, area: 500,
    });
    check(r.ok, `API accepts property type "${type}" without error`);
    if (r.ok && r.data?.id) createdIds.push(r.data.id);
  }
  r = await api('GET', '/properties');
  const allProps = r.data || [];
  const typesInDb = new Set(allProps.map(p => p.type));
  for (const type of PROPERTY_TYPES) {
    check(typesInDb.has(type), `Type "${type}" present in DB after creation`);
  }

  // ── 3. Ordering & Filters ─────────────────────────────────
  console.log('\n--- 3. Ordering & Filters ---');
  const ordered = r.data || [];
  check(ordered.length >= 2, 'Properties list has multiple entries');
  let orderOk = true;
  for (let i = 0; i < ordered.length - 1; i++) {
    if (new Date(ordered[i].createdAt) < new Date(ordered[i+1].createdAt)) { orderOk = false; break; }
  }
  check(orderOk, 'Properties list is ordered newest-first');

  r = await api('GET', '/properties?type=villa');
  check((r.data||[]).every(p => p.type === 'villa'), 'type=villa filter returns only villas');
  r = await api('GET', '/properties?status=available');
  check((r.data||[]).every(p => p.status === 'available'), 'status=available filter correct');
  r = await api('GET', '/properties?type=residential&status=available');
  check((r.data||[]).every(p => p.type === 'residential' && p.status === 'available'), 'Combined filter correct');

  // ── 4. Property Status Lifecycle ──────────────────────────
  console.log('\n--- 4. Property Status Lifecycle ---');
  r = await api('POST', '/properties', {
    title: `Lifecycle-${ts()}`, address: '1 Life St', city: 'City',
    price: 500000, type: 'apartment', status: 'available', bedrooms: 3, bathrooms: 2, area: 1200,
  });
  const lifeId = r.data?.id;
  createdIds.push(lifeId);
  check(r.ok, 'Property created with status=available');
  for (const s of ['available','pending','sold','rented','off-market']) {
    r = await api('PATCH', `/properties/${lifeId}`, { status: s });
    check(r.ok && r.data?.status === s, `Status transition to "${s}" works`);
  }
  r = await api('PATCH', `/properties/${lifeId}`, { title: 'No Status Change' });
  check(r.ok && r.data?.status === 'off-market', 'Unrelated edit (title) preserves current status');

  // ── 5 & 6 & 7. PROPERTY_SOLD Bug-Fix Verification ────────
  console.log('\n--- 5/6/7. PROPERTY_SOLD State-Transition Bug Fix ---');
  // Create a temporary PROPERTY_SOLD workflow for precise testing
  r = await api('POST', '/workflows', {
    name: `E2E_PROPERTY_SOLD_TEST_${ts()}`,
    description: 'Temp test workflow for PROPERTY_SOLD audit',
    triggerEvent: 'PROPERTY_SOLD',
    
    actions: JSON.stringify([{ type: 'LOG_ACTIVITY' }]),
    isActive: true,
  });
  check(r.ok && r.data?.id, 'Created temp PROPERTY_SOLD workflow');
  const tempSoldWfId = r.data?.id;
  if (tempSoldWfId) createdWorkflowIds.push(tempSoldWfId);

  // Create test property
  r = await api('POST', '/properties', {
    title: `SoldBugTest-${ts()}`, address: '5 Sold St', city: 'SoldCity',
    price: 800000, type: 'villa', status: 'available', bedrooms: 4, bathrooms: 3, area: 3000,
  });
  check(r.ok, 'PROPERTY_SOLD test: property created');
  const soldBugId = r.data?.id;
  createdIds.push(soldBugId);
  await sleep(500);

  // Fetch baseline count
  r = await api('GET', `/workflows/${tempSoldWfId}`);
  const countBase = r.data?.executionCount || 0;

  // First transition: available → sold — should fire PROPERTY_SOLD once
  await api('PATCH', `/properties/${soldBugId}`, { status: 'sold' });
  await sleep(1000);
  r = await api('GET', `/workflows/${tempSoldWfId}`);
  const countAfterFirst = r.data?.executionCount || 0;
  check(countAfterFirst === countBase + 1, `PROPERTY_SOLD fires exactly once on available→sold transition (${countBase}→${countAfterFirst})`);

  // Second edit: change price while already sold — should NOT fire PROPERTY_SOLD again
  await api('PATCH', `/properties/${soldBugId}`, { price: 850000 });
  await sleep(1000);
  r = await api('GET', `/workflows/${tempSoldWfId}`);
  const countAfterPrice = r.data?.executionCount || 0;
  check(countAfterPrice === countAfterFirst, `PROPERTY_SOLD does NOT re-fire on price edit of already-sold property (count stable at ${countAfterFirst})`);

  // Third: PATCH sold → sold (status unchanged) — should NOT fire PROPERTY_SOLD
  await api('PATCH', `/properties/${soldBugId}`, { status: 'sold' });
  await sleep(1000);
  r = await api('GET', `/workflows/${tempSoldWfId}`);
  const countAfterNoop = r.data?.executionCount || 0;
  check(countAfterNoop === countAfterFirst, `PROPERTY_SOLD does NOT fire on sold→sold no-op PATCH (count stable at ${countAfterFirst})`);

  // Fourth: title edit while sold — should NOT fire PROPERTY_SOLD
  await api('PATCH', `/properties/${soldBugId}`, { title: 'Renamed Sold Property' });
  await sleep(1000);
  r = await api('GET', `/workflows/${tempSoldWfId}`);
  const countAfterTitle = r.data?.executionCount || 0;
  check(countAfterTitle === countAfterFirst, `PROPERTY_SOLD does NOT fire on title edit of sold property (count stable at ${countAfterFirst})`);

  // Create PROPERTY_UPDATED workflow to confirm it fires on non-sold edits
  r = await api('POST', '/workflows', {
    name: `E2E_PROPERTY_UPDATED_TEST_${ts()}`,
    description: 'Temp test workflow for PROPERTY_UPDATED audit',
    triggerEvent: 'PROPERTY_UPDATED',
    
    actions: JSON.stringify([{ type: 'LOG_ACTIVITY' }]),
    isActive: true,
  });
  check(r.ok && r.data?.id, 'Created temp PROPERTY_UPDATED workflow');
  const tempUpdWfId = r.data?.id;
  if (tempUpdWfId) createdWorkflowIds.push(tempUpdWfId);

  r = await api('GET', `/workflows/${tempUpdWfId}`);
  const updBase = r.data?.executionCount || 0;

  // Edit non-status field on sold property — should fire PROPERTY_UPDATED, NOT PROPERTY_SOLD
  await api('PATCH', `/properties/${soldBugId}`, { bedrooms: 5 });
  await sleep(1000);
  r = await api('GET', `/workflows/${tempUpdWfId}`);
  check((r.data?.executionCount || 0) === updBase + 1, 'PROPERTY_UPDATED fires for non-status edit of already-sold property');

  // ── 5. PROPERTY_LISTED Automation ─────────────────────────
  console.log('\n--- 5. PROPERTY_LISTED Automation ---');
  r = await api('POST', '/workflows', {
    name: `E2E_PROPERTY_LISTED_TEST_${ts()}`,
    triggerEvent: 'PROPERTY_LISTED',
    
    actions: JSON.stringify([{ type: 'LOG_ACTIVITY' }]),
    isActive: true,
  });
  check(r.ok, 'Created temp PROPERTY_LISTED workflow');
  const tempListedWfId = r.data?.id;
  if (tempListedWfId) createdWorkflowIds.push(tempListedWfId);

  r = await api('GET', `/workflows/${tempListedWfId}`);
  const listedBase = r.data?.executionCount || 0;

  r = await api('POST', '/properties', {
    title: `ListingAuto-${ts()}`, address: '8 Auto St', city: 'City',
    price: 600000, type: 'residential', status: 'available', bedrooms: 3, bathrooms: 2, area: 1800,
  });
  check(r.ok, 'PROPERTY_LISTED: new property created');
  const listedPropId = r.data?.id;
  createdIds.push(listedPropId);
  await sleep(1000);

  r = await api('GET', `/workflows/${tempListedWfId}`);
  check((r.data?.executionCount || 0) === listedBase + 1, 'PROPERTY_LISTED fires exactly once on property creation');

  // Unrelated PATCH must NOT trigger PROPERTY_LISTED again
  const listedCount1 = r.data?.executionCount || 0;
  await api('PATCH', `/properties/${listedPropId}`, { description: 'Updated desc' });
  await sleep(1000);
  r = await api('GET', `/workflows/${tempListedWfId}`);
  check((r.data?.executionCount || 0) === listedCount1, 'PROPERTY_LISTED does NOT re-fire on unrelated PATCH');

  // ── 8. Property → Appointment Relationship ───────────────
  console.log('\n--- 8. Property → Appointment Relationship ---');
  r = await api('POST', '/properties', {
    title: `ApptProp-${ts()}`, address: '9 Apt St', city: 'AptCity',
    price: 400000, type: 'apartment', status: 'available', bedrooms: 2, bathrooms: 1, area: 800,
  });
  const apptPropId = r.data?.id;
  createdIds.push(apptPropId);
  r = await api('GET', '/agents');
  const agentId = (r.data||[])[0]?.id;

  r = await api('POST', '/appointments', {
    title: 'Property Viewing', type: 'viewing',
    startTime: new Date(Date.now() + 86400000).toISOString(),
    endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
    propertyId: apptPropId,
    assignedAgentId: agentId || null,
  });
  check(r.ok && r.data?.id, 'Appointment created with propertyId');
  const apptId = r.data?.id;
  check(r.data?.propertyId === apptPropId, 'Appointment.propertyId set correctly on create');
  r = await api('PATCH', `/appointments/${apptId}`, { title: 'Updated Viewing' });
  check(r.ok, 'PATCH appointment succeeds');
  check(r.data?.propertyId === apptPropId, 'propertyId preserved after appointment PATCH');
  await api('DELETE', `/properties/${apptPropId}`);
  r = await api('GET', `/appointments/${apptId}`);
  check(r.ok || r.status === 404, 'Appointment survives or cleanly returns 404 after property deletion');

  // ── 9. Property → Lead / Client Relationships ────────────
  console.log('\n--- 9. Property → Lead/Client Relationships ---');
  r = await api('GET', '/leads');
  const leadSample = (r.data||[])[0];
  check(!leadSample || !('propertyId' in leadSample), 'No native propertyId on Leads — architectural limitation confirmed');
  r = await api('GET', '/clients');
  const clientSample = (r.data||[])[0];
  check(!clientSample || !('propertyId' in clientSample), 'No native propertyId on Clients — architectural limitation confirmed');
  console.log('  [INFO] Lead→Property and Client→Property linkage is via Appointments only (by design).');

  // ── 10. Automation Traceability ───────────────────────────
  console.log('\n--- 10. Automation Traceability ---');
  r = await api('GET', '/workflow-executions');
  const allExecs = r.data || [];
  const propExecs = allExecs.filter(e => e.triggerEntityType === 'property');
  check(propExecs.length > 0, `Property workflow executions exist in log (found ${propExecs.length})`);
  if (propExecs.length > 0) {
    const exec = propExecs[0];
    check(exec.triggerEntityType === 'property', 'Execution.triggerEntityType = "property"');
    check(typeof exec.triggerEntityId === 'number', `Execution.triggerEntityId is a number (${exec.triggerEntityId})`);
    check(!!exec.triggerEntityName && exec.triggerEntityName.length > 0, `Execution.triggerEntityName is human-readable ("${exec.triggerEntityName}")`);
    check(!!exec.triggeredBy, `Execution.triggeredBy present ("${exec.triggeredBy}")`);
    check(!!exec.workflowName, `Execution.workflowName present ("${exec.workflowName}")`);
    check(exec.status === 'success' || exec.status === 'failed', `Execution.status is valid ("${exec.status}")`);
  }

  // ── 11. Automated Tasks & Notifications ──────────────────
  console.log('\n--- 11. Automated Tasks & Notifications ---');
  r = await api('GET', '/tasks');
  const automatedTasks = (r.data||[]).filter(t => t.isAutomated || t.sourceWorkflowName);
  console.log(`  Found ${automatedTasks.length} automated task(s)`);
  if (automatedTasks.length > 0) {
    const t = automatedTasks[0];
    check(!!t.sourceWorkflowName, `Task has sourceWorkflowName: "${t.sourceWorkflowName}"`);
    check(!!t.title, `Task has title: "${t.title}"`);
  }
  r = await api('GET', '/notifications');
  check(r.ok, 'GET /notifications returns 200');
  console.log(`  Found ${(r.data||[]).length} notifications`);

  // ── 13. Regression Audit ──────────────────────────────────
  console.log('\n--- 13. Regression Audit ---');
  r = await api('POST', '/leads', {
    firstName: 'RegTest', lastName: 'Prop',
    email: `regtest.${ts()}@example.com`, source: 'website', status: 'new',
  });
  check(r.ok && r.data?.id, 'Lead creation still works');
  r = await api('GET', '/clients'); check(r.ok, 'GET /clients still works');
  r = await api('GET', '/appointments'); check(r.ok, 'GET /appointments still works');
  r = await api('GET', '/notifications'); check(r.ok, 'GET /notifications still works');
  r = await api('GET', '/leads?status=converted'); check(r.ok, 'Lead converted filter still works');

  // ── 14. Final E2E Chain ───────────────────────────────────
  console.log('\n--- 14. Final E2E Chain ---');
  const chainTs = ts();
  r = await api('POST', '/properties', {
    title: `Chain Property ${chainTs}`, address: '10 Chain Blvd', city: 'ChainCity',
    price: 1200000, type: 'villa', status: 'available', bedrooms: 6, bathrooms: 5, area: 6000,
  });
  check(r.ok && r.data?.id, 'Chain: Property created → got ID');
  const chainPropId = r.data?.id;
  const chainPropTitle = r.data?.title;
  createdIds.push(chainPropId);
  await sleep(1000);

  // Check PROPERTY_LISTED fired
  r = await api('GET', `/workflows/${tempListedWfId}`);
  const listedAfterChain = r.data?.executionCount || 0;
  check(listedAfterChain > listedCount1, 'Chain: PROPERTY_LISTED fired on chain property creation');

  // Transition to sold — PROPERTY_SOLD fires
  const soldCountBefore = (await api('GET', `/workflows/${tempSoldWfId}`)).data?.executionCount || 0;
  await api('PATCH', `/properties/${chainPropId}`, { status: 'sold' });
  await sleep(1000);
  r = await api('GET', `/workflows/${tempSoldWfId}`);
  check((r.data?.executionCount || 0) === soldCountBefore + 1, 'Chain: PROPERTY_SOLD fires exactly once on sold transition');

  // Executions reference property title and ID
  r = await api('GET', '/workflow-executions');
  const chainExecs = (r.data||[]).filter(e =>
    e.triggerEntityType === 'property' && e.triggerEntityId === chainPropId
  );
  check(chainExecs.length > 0, `Chain: Execution logs exist for property ID ${chainPropId}`);
  if (chainExecs.length > 0) {
    check(chainExecs[0].triggerEntityName === chainPropTitle, `Chain: Execution shows property title "${chainPropTitle}"`);
    check(chainExecs[0].triggerEntityId === chainPropId, 'Chain: Execution shows correct property ID');
  }

  // ── Cleanup temp workflows ────────────────────────────────
  console.log('\n--- Cleanup: Deleting temp test workflows ---');
  for (const id of createdWorkflowIds) {
    r = await api('DELETE', `/workflows/${id}`);
    console.log(`  Deleted workflow ${id}: ${r.status}`);
  }

  // ── Final Report ──────────────────────────────────────────
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

