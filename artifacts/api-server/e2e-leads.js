const API_URL = 'http://localhost:3000/api';
let passed = 0, failed = 0;
const failures = [];
const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed', 'converted'];

function pass(msg) { console.log(`  [PASS] ${msg}`); passed++; }
function fail(msg, detail='') { console.error(`  [FAIL] ${msg}${detail ? ': '+detail : ''}`); failed++; failures.push(msg); }
function check(cond, msg, detail='') { if(cond) pass(msg); else fail(msg, detail); }

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  let data; try { data = await res.json(); } catch { data = null; }
  if (!res.ok) console.error(`API Error ${method} ${path}:`, data);
  return { status: res.status, ok: res.ok, data };
}
function ts() { return Date.now(); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('\n=== Leads CRM Pipeline — Full E2E Audit ===\n');
  const createdIds = [];
  const createdWorkflowIds = [];

  // --- 1. Basic Lead CRUD & Validation ---
  console.log('--- 1. Lead CRUD & Validation ---');
  let r = await api('POST', '/leads', { firstName: 'NoLast' });
  check(!r.ok, 'Missing required fields returns validation error');

  r = await api('POST', '/leads', {
    firstName: `Audit`, lastName: `Lead ${ts()}`, email: `audit.${ts()}@test.com`,
    phone: '123456789', status: 'new', score: 10, source: 'website',
    budget: 500000, propertyType: 'residential', notes: 'Test notes'
  });
  check(r.ok && r.data?.id, 'Lead created successfully');
  const leadId = r.data?.id;
  if (leadId) createdIds.push(leadId);

  r = await api('GET', `/leads/${leadId}`);
  const l = r.data;
  check(r.ok, 'GET /leads/:id returns 200');
  check(l?.firstName === 'Audit', 'firstName persists correctly');
  check(l?.phone === '123456789', 'phone persists correctly');
  check(Number(l?.budget) === 500000, 'budget persists correctly');
  check(l?.propertyType === 'residential', 'propertyType persists correctly');

  r = await api('PATCH', `/leads/${leadId}`, { budget: 600000, notes: 'Updated notes' });
  check(r.ok, 'PATCH /leads/:id returns 200');
  check(Number(r.data?.budget) === 600000, 'budget updated');
  check(r.data?.notes === 'Updated notes', 'notes updated');

  // Verify deletion works cleanly
  r = await api('POST', '/leads', {
    firstName: 'Temp', lastName: 'Lead', email: `temp.${ts()}@test.com`, source: 'website'
  });
  const tempLeadId = r.data?.id;
  r = await api('DELETE', `/leads/${tempLeadId}`);
  check(r.status === 204, 'DELETE /leads/:id returns 204');
  r = await api('GET', `/leads/${tempLeadId}`);
  check(r.status === 404, 'Deleted lead is gone');

  // --- 2. Pipeline Status Progression & Guard ---
  console.log('\n--- 2. Pipeline Status Progression ---');
  r = await api('POST', '/leads', {
    firstName: 'Pipeline', lastName: 'Lead', email: `pipe.${ts()}@test.com`, status: 'new', source: 'website'
  });
  const pipeLeadId = r.data?.id;
  if (pipeLeadId) createdIds.push(pipeLeadId);

  check(r.data?.status === 'new', 'Lead starts in "new" status');

  // Forward progression
  for (let i = 1; i < LEAD_STATUSES.length; i++) {
    const nextStatus = LEAD_STATUSES[i];
    r = await api('PATCH', `/leads/${pipeLeadId}`, { status: nextStatus });
    check(r.ok && r.data?.status === nextStatus, `Progression to "${nextStatus}" succeeds`);
  }

  // Attempt backward progression (downgrade)
  r = await api('PATCH', `/leads/${pipeLeadId}`, { status: 'negotiation' });
  check(!r.ok, 'Pipeline guard prevents downgrading from converted -> negotiation');

  // Let's create another lead and test downgrade from a middle status
  r = await api('POST', '/leads', {
    firstName: 'MidPipe', lastName: 'Lead', email: `mid.${ts()}@test.com`, status: 'proposal', source: 'website'
  });
  const midLeadId = r.data?.id;
  if (midLeadId) createdIds.push(midLeadId);
  
  // Actually move it to proposal first, since POST ignores status
  await api('PATCH', `/leads/${midLeadId}`, { status: 'proposal' });

  r = await api('PATCH', `/leads/${midLeadId}`, { status: 'contacted' });
  check(!r.ok, 'Pipeline guard prevents downgrading from proposal -> contacted');

  // --- 3. Automation Assignment & Trigger Tests ---
  console.log('\n--- 3. Automation Assignment ---');
  
  // Verify manual Assign To selection is preserved.
  r = await api('GET', '/agents');
  const activeAgent = (r.data||[]).find(a => a.status === 'active');
  const inactiveAgent = (r.data||[]).find(a => a.status === 'inactive');

  r = await api('POST', '/leads', {
    firstName: 'Manual', lastName: 'Assign', email: `manual.${ts()}@test.com`, source: 'website',
    assignedAgentId: activeAgent?.id
  });
  const manualLeadId = r.data?.id;
  if (manualLeadId) createdIds.push(manualLeadId);
  check(r.data?.assignedAgentId === activeAgent?.id, 'Manual Assign To selection is preserved');

  // Verify inactive agents are never assigned
  if (inactiveAgent) {
    r = await api('POST', '/leads', {
      firstName: 'Bad', lastName: 'Assign', email: `bad.${ts()}@test.com`, source: 'website',
      assignedAgentId: inactiveAgent.id
    });
    check(!r.ok, 'Cannot assign lead to an inactive agent');
  } else {
    pass('No inactive agent available to test assignment block');
  }

  // Verify LEAD_UPDATED triggers appropriately and does NOT fire twice for no-op changes
  r = await api('POST', '/workflows', {
    name: `TEST_LEAD_UPDATED_${ts()}`,
    triggerEvent: 'LEAD_UPDATED',
    isActive: true,
    actions: JSON.stringify([{ type: 'LOG_ACTIVITY' }])
  });
  const wfUpdatedId = r.data?.id;
  if (wfUpdatedId) createdWorkflowIds.push(wfUpdatedId);

  const wfUBase = (await api('GET', `/workflows/${wfUpdatedId}`)).data?.executionCount || 0;

  await api('PATCH', `/leads/${manualLeadId}`, { score: 50 });
  await sleep(1000);
  r = await api('GET', `/workflows/${wfUpdatedId}`);
  check((r.data?.executionCount || 0) === wfUBase + 1, 'LEAD_UPDATED fires on score change');

  await api('PATCH', `/leads/${manualLeadId}`, { score: 50 }); // no-op
  await sleep(1000);
  r = await api('GET', `/workflows/${wfUpdatedId}`);
  check((r.data?.executionCount || 0) === wfUBase + 1, 'LEAD_UPDATED does NOT fire on no-op change');

  // ── Cleanup temp workflows ────────────────────────────────
  console.log('\n--- Cleanup: Deleting temp test workflows ---');
  for (const id of createdWorkflowIds) {
    await api('DELETE', `/workflows/${id}`);
  }
  for (const id of createdIds) {
    await api('DELETE', `/leads/${id}`);
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
