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
  console.log('\n=== Workflow Builder & Automation Config E2E Audit ===\n');
  const createdIds = [];
  const leadIds = [];

  // --- 1. Workflow CRUD ---
  console.log('--- 1. Workflow CRUD ---');
  let wfPayload = {
    name: `Test CRUD ${ts()}`,
    description: 'Test Desc',
    triggerEvent: 'LEAD_CREATED',
    conditions: JSON.stringify([{ field: 'budget', operator: '>', value: '1000' }]),
    actions: JSON.stringify([{ type: 'LOG_ACTIVITY', params: {} }]),
    isActive: true
  };
  let r = await api('POST', '/workflows', wfPayload);
  check(r.ok && r.data?.id, 'Workflow created successfully');
  const wfId = r.data?.id;
  if (wfId) createdIds.push(wfId);

  r = await api('GET', `/workflows/${wfId}`);
  check(r.data?.name === wfPayload.name, 'Name persists exactly');
  check(r.data?.description === 'Test Desc', 'Description persists exactly');
  check(r.data?.triggerEvent === 'LEAD_CREATED', 'Trigger persists exactly');
  check(r.data?.conditions === wfPayload.conditions, 'Conditions persist exactly');
  check(r.data?.actions === wfPayload.actions, 'Actions persist exactly');
  check(r.data?.isActive === true, 'isActive persists exactly');

  const patchPayload = {
    name: `Updated CRUD ${ts()}`,
    description: 'Updated Desc',
    triggerEvent: 'LEAD_UPDATED',
    conditions: JSON.stringify([{ field: 'budget', operator: '<', value: '500' }]),
    actions: JSON.stringify([{ type: 'CREATE_TASK', params: {} }]),
    isActive: false
  };
  r = await api('PATCH', `/workflows/${wfId}`, patchPayload);
  check(r.ok, 'Workflow edited successfully');
  
  r = await api('GET', `/workflows/${wfId}`);
  check(r.data?.name === patchPayload.name, 'Edited name persists');
  check(r.data?.description === 'Updated Desc', 'Edited description persists');
  check(r.data?.triggerEvent === 'LEAD_UPDATED', 'Edited trigger persists');
  check(r.data?.conditions === patchPayload.conditions, 'Edited conditions persist');
  check(r.data?.actions === patchPayload.actions, 'Edited actions persist');
  check(r.data?.isActive === false, 'Edited isActive state persists');

  r = await api('DELETE', `/workflows/${wfId}`);
  check(r.ok, 'Workflow deleted successfully');
  
  r = await api('GET', `/workflows/${wfId}`);
  check(r.status === 404, 'Deleted workflow is gone (404)');

  // --- 2. Workflow Activation ---
  console.log('\n--- 2. Workflow Activation ---');
  r = await api('POST', '/workflows', {
    name: `Toggle Test ${ts()}`, triggerEvent: 'LEAD_CREATED', conditions: '[]', actions: '[]', isActive: false
  });
  const toggleWfId = r.data?.id;
  if (toggleWfId) createdIds.push(toggleWfId);

  // Inactive shouldn't fire
  r = await api('POST', '/leads', { firstName: 'Toggle', lastName: 'Inactive', email: `t.i.${ts()}@test.com`, source: 'website' });
  if (r.data?.id) leadIds.push(r.data.id);
  await sleep(1000);
  r = await api('GET', `/workflows/${toggleWfId}`);
  check(r.data?.executionCount === 0, 'Inactive workflow never executes');

  // Toggle to active
  r = await api('PATCH', `/workflows/${toggleWfId}/toggle`, { isActive: true });
  check(r.ok, 'Workflow toggled to active successfully');
  
  // Active should fire
  r = await api('POST', '/leads', { firstName: 'Toggle', lastName: 'Active', email: `t.a.${ts()}@test.com`, source: 'website' });
  if (r.data?.id) leadIds.push(r.data.id);
  await sleep(1000);
  r = await api('GET', `/workflows/${toggleWfId}`);
  check(r.data?.executionCount === 1, 'Re-enabling an inactive workflow restores execution');

  // Toggle to inactive again
  await api('PATCH', `/workflows/${toggleWfId}/toggle`, { isActive: false });
  
  // Active should not fire
  r = await api('POST', '/leads', { firstName: 'Toggle', lastName: 'Inactive2', email: `t.i2.${ts()}@test.com`, source: 'website' });
  if (r.data?.id) leadIds.push(r.data.id);
  await sleep(1000);
  r = await api('GET', `/workflows/${toggleWfId}`);
  check(r.data?.executionCount === 1, 'Toggling active -> inactive -> active does not create phantom executions');


  // --- 3 & 4. Condition Engine & Multiple Operators ---
  console.log('\n--- 3 & 4. Condition Engine Validation ---');
  r = await api('POST', '/workflows', {
    name: `Condition Test ${ts()}`,
    triggerEvent: 'LEAD_UPDATED',
    conditions: JSON.stringify([
      { field: 'budget', operator: '>', value: '500' },
      { field: 'budget', operator: '<=', value: '1500' },
      { field: 'status', operator: '==', value: 'qualified' },
      { field: 'firstName', operator: 'contains', value: 'Cond' }
    ]),
    actions: JSON.stringify([{ type: 'LOG_ACTIVITY', params: {} }])
  });
  const condWfId = r.data?.id;
  if (condWfId) createdIds.push(condWfId);

  // Create lead — budget must be a number for POST /leads
  r = await api('POST', '/leads', { firstName: 'CondTest', lastName: 'X', email: `cond.${ts()}@test.com`, source: 'website', budget: 100 });
  const condLeadId = r.data?.id;
  if (condLeadId) leadIds.push(condLeadId);

  // Update 1: Fail conditions (budget too low)
  r = await api('PATCH', `/leads/${condLeadId}`, { status: 'qualified' });
  await sleep(1000);
  r = await api('GET', `/workflows/${condWfId}/executions`);
  const execs0 = Array.isArray(r.data) ? r.data : [];
  check(execs0.length === 0, 'Condition evaluates incorrectly formatted or failing conditions safely (count = 0)');

  // Update 2: Pass all conditions (budget=1000, status=qualified, firstName contains CondTest)
  r = await api('PATCH', `/leads/${condLeadId}`, { budget: 1000 });
  await sleep(4000);
  r = await api('GET', `/workflows/${condWfId}/executions`);
  const execs1 = Array.isArray(r.data) ? r.data : [];
  check(execs1.length === 1, 'Condition engine processes multiple AND rules correctly including numeric bounds and string matching');

  // Update 3: NO-OP Update (Change phone number only — phone is not in eventData so LEAD_UPDATED won't fire)
  r = await api('PATCH', `/leads/${condLeadId}`, { phone: '1234567890' });
  await sleep(2000);
  // Phone change does NOT appear in the automation payload, so LEAD_UPDATED is suppressed entirely
  // The condition workflow should NOT have any additional executions
  r = await api('GET', `/workflows/${condWfId}/executions`);
  const execs2 = Array.isArray(r.data) ? r.data : [];
  check(execs2.length === 1, 'Already true condition does NOT execute again on unrelated NO-OP updates');

  
  // --- 5 & 6. Action Engine & Multi-Action Workflow ---
  console.log('\n--- 5 & 6. Multi-Action Engine Execution ---');
  
  // We need an active agent ID to test ASSIGN_SENIOR_AGENT
  const agentsRes = await api('GET', '/agents');
  const agents = agentsRes.data || [];
  const activeAgent = agents.find(a => a.status === 'active');
  const agentCheckStr = activeAgent ? '' : '(Warning: No active agents found, assignment may fall back differently)';

  r = await api('POST', '/workflows', {
    name: `Multi-Action Test ${ts()}`,
    triggerEvent: 'LEAD_CREATED',
    conditions: JSON.stringify([{ field: 'notes', operator: 'contains', value: 'MULTI' }]),
    actions: JSON.stringify([
      { type: 'ASSIGN_SENIOR_AGENT', params: {} },
      { type: 'CREATE_TASK', params: { title: 'Auto Task', description: 'Test', priority: 'high' } },
      { type: 'NOTIFY_MANAGER', params: { message: 'New big lead' } },
      { type: 'UPDATE_CRM_STATUS', params: { status: 'proposal' } }
    ]),
    isActive: true
  });
  const multiWfId = r.data?.id;
  if (multiWfId) createdIds.push(multiWfId);

  r = await api('POST', '/leads', { firstName: 'Multi', lastName: 'Action', email: `multi.${ts()}@test.com`, source: 'website', notes: 'MULTI' });
  const multiLeadId = r.data?.id;
  if (multiLeadId) leadIds.push(multiLeadId);

  await sleep(3000);

  r = await api('GET', `/workflows/${multiWfId}/executions`);
  const execs = Array.isArray(r.data) ? r.data : [];
  check(execs.length === 1, 'Multi-action workflow executes exactly once');
  const exec = execs[0];
  if (exec) {
    check(exec.status === 'success', 'Workflow execution overall status is success');
    check(exec.actionsExecuted === 4, 'All actions execute exactly once (count = 4)');
    
    // Parse action results
    let actionRes = [];
    try { actionRes = JSON.parse(exec.actionResults); } catch(e) {}
    check(actionRes.length === 4, 'Action results track each action individually');
    // ASSIGN_SENIOR_AGENT may be 'success' or 'skipped' if other pre-existing workflows run first and pre-assign agent
    check(actionRes.some(a => a.action === 'ASSIGN_SENIOR_AGENT' && (a.status === 'success' || a.status === 'skipped')), `ASSIGN_SENIOR_AGENT executed or skipped correctly`);
    check(actionRes.some(a => a.action === 'CREATE_TASK' && a.status === 'success'), 'CREATE_TASK executed');
    check(actionRes.some(a => a.action === 'NOTIFY_MANAGER' && a.status === 'success'), 'NOTIFY_MANAGER executed');
    check(actionRes.some(a => a.action === 'UPDATE_CRM_STATUS' && (a.status === 'success' || a.status === 'skipped')), 'UPDATE_CRM_STATUS executed or skipped correctly');
  } else {
    fail('Multi-action workflow did not log an execution record');
  }

  // Check the actual side effects
  r = await api('GET', `/leads/${multiLeadId}`);
  check(r.data?.status === 'proposal', 'UPDATE_CRM_STATUS successfully updated lead status');
  check(r.data?.assignedAgentId !== null, 'ASSIGN_SENIOR_AGENT successfully assigned an agent');


  // --- 7. Manual Assignment Interaction ---
  console.log('\n--- 7. Manual Assignment Interaction ---');
  
  if (activeAgent) {
    r = await api('POST', '/workflows', {
      name: `Manual Assign Preserved ${ts()}`,
      triggerEvent: 'LEAD_CREATED',
      conditions: JSON.stringify([{ field: 'notes', operator: 'contains', value: 'MANUAL_OVERRIDE' }]),
      actions: JSON.stringify([{ type: 'ASSIGN_SENIOR_AGENT', params: {} }]),
      isActive: true
    });
    const overrideWfId = r.data?.id;
    if (overrideWfId) createdIds.push(overrideWfId);

    // Create lead that ALREADY has an agent assigned
    r = await api('POST', '/leads', { 
      firstName: 'Pre', lastName: 'Assigned', email: `pre.${ts()}@test.com`, source: 'website', notes: 'MANUAL_OVERRIDE',
      assignedAgentId: activeAgent.id
    });
    const preLeadId = r.data?.id;
    if (preLeadId) leadIds.push(preLeadId);
    await sleep(2000);

    r = await api('GET', `/workflows/${overrideWfId}/executions`);
    const overExecs = Array.isArray(r.data) ? r.data : [];
    check(overExecs.length === 1, 'Manual Assignment Interaction workflow executes exactly once');
    
    if (overExecs[0]) {
      let actionRes = [];
      try { actionRes = JSON.parse(overExecs[0].actionResults); } catch(e) {}
      const assignResult = actionRes.find(a => a.action === 'ASSIGN_SENIOR_AGENT');
      check(assignResult?.status === 'skipped', 'ASSIGN_SENIOR_AGENT action correctly yields "skipped" status');
      check(assignResult?.note?.includes('Preserved manual assignment'), 'Execution note accurately indicates preservation of manual assignment');
    } else {
      fail('Execution record not found for Manual Assignment test');
    }
  } else {
    console.log('  [SKIP] No active agent available to test manual assignment override');
  }

  // --- 8. Security / Validation ---
  console.log('\n--- 8. Security / Validation ---');
  r = await api('POST', '/workflows', {
    description: 'Missing name and trigger',
  });
  check(r.status === 400, 'Invalid workflow configuration safely rejected (missing fields)');
  
  
  // --- Cleanup ---
  console.log('\n--- Cleanup ---');
  for (const id of createdIds) {
    await api('DELETE', `/workflows/${id}`);
  }
  for (const id of leadIds) {
    await api('DELETE', `/leads/${id}`);
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
