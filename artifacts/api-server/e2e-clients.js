const API_URL = 'http://localhost:3000/api';
let passed = 0, failed = 0;
const failures = [];

function pass(msg) { console.log(`  [PASS] ${msg}`); passed++; }
function fail(msg, detail='') { console.error(`  [FAIL] ${msg}${detail ? ': '+detail : ''}`); failed++; failures.push(msg); }
function check(cond, msg, detail='') { if(cond) pass(msg); else fail(msg, detail); }
const ts = () => Date.now() + Math.floor(Math.random() * 10000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  let data; try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

async function runTests() {
  console.log('\n=== Clients CRM Pipeline — Full E2E Audit ===\n');
  const createdWorkflowIds = [];
  const createdClientIds = [];

  // --- 1. Client CRUD & Validation ---
  console.log('--- 1. Client CRUD & Validation ---');
  let r = await api('POST', '/clients', { firstName: 'Incomplete' });
  check(!r.ok && r.status === 400, 'Missing required fields returns validation error');

  r = await api('POST', '/clients', {
    firstName: 'Crud', lastName: 'Test', email: `crud.${ts()}@test.com`,
    phone: '1234567890', budget: '500000'
  });
  check(r.ok && r.data?.id, 'Client created successfully');
  const clientId = r.data?.id;
  if (clientId) createdClientIds.push(clientId);

  if (clientId) {
    r = await api('GET', `/clients/${clientId}`);
    check(r.ok && r.data?.firstName === 'Crud', 'firstName persists correctly');
    check(Number(r.data?.budget) === 500000, 'budget persists correctly');

    r = await api('PATCH', `/clients/${clientId}`, { budget: '600000' });
    check(r.ok, 'PATCH /clients/:id returns 200');
    check(Number(r.data?.budget) === 600000, 'budget updated');
    
    r = await api('DELETE', `/clients/${clientId}`);
    check(r.ok, 'DELETE /clients/:id returns 204');
    
    r = await api('GET', `/clients/${clientId}`);
    check(!r.ok && r.status === 404, 'Deleted client is gone');
  }

  // --- 2. Client Automation ---
  console.log('\n--- 2. Client Automation ---');

  // Create workflows
  r = await api('POST', '/workflows', {
    name: `Test Client Created ${ts()}`,
    triggerEvent: 'CLIENT_CREATED',
    conditions: '[]',
    actions: JSON.stringify([{ type: 'create_task', params: { title: 'New Client Task', description: 'Test' } }])
  });
  const wfCreatedId = r.data?.id;
  if (wfCreatedId) createdWorkflowIds.push(wfCreatedId);

  r = await api('POST', '/workflows', {
    name: `Test Client Updated Cond ${ts()}`,
    triggerEvent: 'CLIENT_UPDATED',
    conditions: JSON.stringify([{ field: 'status', operator: '==', value: 'active' }]),
    actions: JSON.stringify([{ type: 'create_task', params: { title: 'Client Active Task', description: 'Test' } }])
  });
  const wfUpdatedId = r.data?.id;
  if (wfUpdatedId) createdWorkflowIds.push(wfUpdatedId);

  // Workflow 2 for multiple execution test
  r = await api('POST', '/workflows', {
    name: `Test Client Updated Indep ${ts()}`,
    triggerEvent: 'CLIENT_UPDATED',
    conditions: JSON.stringify([{ field: 'status', operator: '==', value: 'active' }]),
    actions: JSON.stringify([{ type: 'create_task', params: { title: 'Indep Task', description: 'Test' } }])
  });
  const wfUpdated2Id = r.data?.id;
  if (wfUpdated2Id) createdWorkflowIds.push(wfUpdated2Id);
  
  // CLIENT_DELETED workflow
  r = await api('POST', '/workflows', {
    name: `Test Client Deleted ${ts()}`,
    triggerEvent: 'CLIENT_DELETED',
    conditions: '[]',
    actions: JSON.stringify([{ type: 'create_task', params: { title: 'Delete Task', description: 'Test' } }])
  });
  const wfDeletedId = r.data?.id;
  if (wfDeletedId) createdWorkflowIds.push(wfDeletedId);

  // Wait for workflows to register
  await sleep(500);

  // Get base execution counts
  let wfCBase = 0, wfUBase = 0, wfU2Base = 0, wfDBase = 0;
  if (wfCreatedId) wfCBase = (await api('GET', `/workflows/${wfCreatedId}`)).data?.executionCount || 0;
  if (wfUpdatedId) wfUBase = (await api('GET', `/workflows/${wfUpdatedId}`)).data?.executionCount || 0;
  if (wfUpdated2Id) wfU2Base = (await api('GET', `/workflows/${wfUpdated2Id}`)).data?.executionCount || 0;
  if (wfDeletedId) wfDBase = (await api('GET', `/workflows/${wfDeletedId}`)).data?.executionCount || 0;

  // Test CLIENT_CREATED
  r = await api('POST', '/clients', {
    firstName: 'Auto', lastName: 'Test', email: `auto.${ts()}@test.com`, status: 'prospect'
  });
  const autoClientId = r.data?.id;
  if (autoClientId) createdClientIds.push(autoClientId);
  
  await sleep(1000);
  r = await api('GET', `/workflows/${wfCreatedId}`);
  check((r.data?.executionCount || 0) === wfCBase + 1, 'CLIENT_CREATED fires exactly once on creation');

  // Test CLIENT_UPDATED - False to True transition
  r = await api('PATCH', `/clients/${autoClientId}`, { status: 'active' });
  await sleep(1000);
  r = await api('GET', `/workflows/${wfUpdatedId}`);
  check((r.data?.executionCount || 0) === wfUBase + 1, 'CLIENT_UPDATED fires on false->true condition transition');
  
  // Check independent multiple execution
  r = await api('GET', `/workflows/${wfUpdated2Id}`);
  check((r.data?.executionCount || 0) === wfU2Base + 1, 'Multiple matching client workflows execute independently');

  // Test CLIENT_UPDATED - No-Op (True to True, should NOT fire again according to state transition rules)
  r = await api('PATCH', `/clients/${autoClientId}`, { status: 'active' });
  await sleep(1000);
  r = await api('GET', `/workflows/${wfUpdatedId}`);
  check((r.data?.executionCount || 0) === wfUBase + 1, 'CLIENT_UPDATED does not trigger if condition was already true (no state transition)');

  // Unrelated edit
  r = await api('PATCH', `/clients/${autoClientId}`, { phone: '9999999999' });
  await sleep(1000);
  r = await api('GET', `/workflows/${wfUpdatedId}`);
  check((r.data?.executionCount || 0) === wfUBase + 1, 'CLIENT_UPDATED does not trigger on unrelated edits');

  // Test CLIENT_DELETED
  r = await api('DELETE', `/clients/${autoClientId}`);
  check(r.ok, 'Client deleted successfully for deleted trigger test');
  await sleep(1000);
  r = await api('GET', `/workflows/${wfDeletedId}`);
  check((r.data?.executionCount || 0) === wfDBase + 1, 'CLIENT_DELETED safely removes or logs without cascading failures');
  
  // ── Cleanup temp workflows ────────────────────────────────
  console.log('\n--- Cleanup: Deleting temp test workflows ---');
  for (const id of createdWorkflowIds) {
    const dr = await api('DELETE', `/workflows/${id}`);
    if (!dr.ok) {
       console.error(`API Error DELETE /workflows/${id}:`, dr.data || dr.status);
    }
  }

  // ── Cleanup temp clients ──────────────────────────────────
  for (const id of createdClientIds) {
    if (id !== autoClientId && id !== clientId) { // already deleted in tests
      await api('DELETE', `/clients/${id}`);
    }
  }

  console.log('\n======================================');
  console.log(`TOTAL: ${passed + failed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailed tests:');
    failures.forEach(f => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
  console.log('======================================\n');
}

runTests().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
