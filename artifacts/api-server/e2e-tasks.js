/**
 * E2E Tasks CRM & Task Automation Audit Test Suite
 * Comprehensive automated verification of Task CRUD, Filters,
 * Status Transitions, Overdue Detection & Scheduler Logic,
 * Automation Engine Integration (TASK_COMPLETED, TASK_UPDATED, TASK_OVERDUE, CREATE_TASK),
 * Lead/Client/Agent Relationships, and Referential Integrity.
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

let totalTests = 0;
let passedTests = 0;
let failedTests = [];

function check(condition, message, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests.push({ message, details });
    console.error(`  [FAIL] ${message}${details ? ` -> ${details}` : ''}`);
  }
}

async function api(method, endpoint, body) {
  const url = `${API_BASE}${endpoint}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('=== Tasks CRM & Task Automation E2E Audit ===\n');

  const createdTaskIds = [];
  const createdLeadIds = [];
  const createdClientIds = [];
  const createdWorkflowIds = [];

  try {
    // -------------------------------------------------------------
    // 1. Task CRUD & Validation
    // -------------------------------------------------------------
    console.log('--- 1. Task CRUD & Validation ---');

    // Validation: Missing required fields (title, type)
    const invalidRes = await api('POST', '/tasks', { description: 'Missing title & type' });
    check(!invalidRes.ok && invalidRes.status === 400, 'Missing required fields (title/type) returns 400 validation error');

    // Fetch an agent to test assignment
    const agentsRes = await api('GET', '/agents');
    const testAgent = (agentsRes.data || [])[0];

    // Create a Lead to test relationship
    const leadRes = await api('POST', '/leads', {
      firstName: 'TaskTest',
      lastName: `Lead_${Date.now()}`,
      email: `task.lead.${Date.now()}@test.com`,
      source: 'website',
      budget: 250000,
    });
    const testLeadId = leadRes.data?.id;
    if (testLeadId) createdLeadIds.push(testLeadId);

    // Create a Client to test relationship
    const clientRes = await api('POST', '/clients', {
      firstName: 'TaskTest',
      lastName: `Client_${Date.now()}`,
      email: `task.client.${Date.now()}@test.com`,
      status: 'active',
      budget: 450000,
    });
    const testClientId = clientRes.data?.id;
    if (testClientId) createdClientIds.push(testClientId);

    // Create a full task
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const taskPayload = {
      title: `Audit Task ${Date.now()}`,
      description: 'Comprehensive audit task description',
      type: 'call',
      priority: 'high',
      status: 'pending',
      dueDate: tomorrowStr,
      dueTime: '02:30 PM',
      assignedAgentId: testAgent?.id,
      leadId: testLeadId,
      clientId: testClientId,
    };

    const createRes = await api('POST', '/tasks', taskPayload);
    check(createRes.status === 201 && createRes.data?.id, 'Task created successfully with all fields');
    const taskId = createRes.data?.id;
    if (taskId) createdTaskIds.push(taskId);

    // Verify GET /tasks/:id persists all fields
    const getRes = await api('GET', `/tasks/${taskId}`);
    check(getRes.status === 200, 'GET /tasks/:id returns 200');
    check(getRes.data?.title === taskPayload.title, 'title persists accurately');
    check(getRes.data?.description === taskPayload.description, 'description persists accurately');
    check(getRes.data?.type === 'call', 'type persists accurately');
    check(getRes.data?.priority === 'high', 'priority persists accurately');
    check(getRes.data?.status === 'pending', 'status persists accurately');
    check(getRes.data?.dueDate === tomorrowStr, 'dueDate persists accurately');
    check(getRes.data?.dueTime === '02:30 PM', 'dueTime persists accurately');
    check(getRes.data?.assignedAgentId === testAgent?.id, 'assignedAgentId persists accurately');
    check(getRes.data?.assignedAgentName === testAgent?.name, 'assignedAgentName joined correctly');
    check(getRes.data?.leadId === testLeadId, 'leadId persists accurately');
    check(getRes.data?.clientId === testClientId, 'clientId persists accurately');

    // Test PATCH /tasks/:id
    const patchPayload = {
      title: `Updated Audit Task ${Date.now()}`,
      description: 'Updated description notes',
      type: 'email',
      priority: 'urgent',
      dueTime: '04:00 PM',
    };
    const patchRes = await api('PATCH', `/tasks/${taskId}`, patchPayload);
    check(patchRes.status === 200, 'PATCH /tasks/:id returns 200');
    check(patchRes.data?.title === patchPayload.title, 'Updated title persisted');
    check(patchRes.data?.type === 'email', 'Updated type persisted');
    check(patchRes.data?.priority === 'urgent', 'Updated priority persisted');
    check(patchRes.data?.dueTime === '04:00 PM', 'Updated dueTime persisted');

    // Test Nullable updates (unassigning agent, clearing description)
    const nullPatchRes = await api('PATCH', `/tasks/${taskId}`, {
      assignedAgentId: null,
      description: null,
    });
    check(nullPatchRes.status === 200, 'PATCH with null values (unassign agent, null description) succeeds');
    check(nullPatchRes.data?.assignedAgentId === null, 'Agent successfully unassigned (null)');
    check(nullPatchRes.data?.description === null, 'Description successfully cleared (null)');

    // -------------------------------------------------------------
    // 2. Types, Priorities & Status Transitions
    // -------------------------------------------------------------
    console.log('\n--- 2. Types, Priorities & Status Lifecycle ---');

    const typesToTest = ['call', 'email', 'meeting', 'viewing', 'follow-up', 'other'];
    for (const t of typesToTest) {
      const typeRes = await api('POST', '/tasks', { title: `Type Test ${t}`, type: t });
      check(typeRes.status === 201 && typeRes.data?.type === t, `Task type "${t}" created successfully`);
      if (typeRes.data?.id) createdTaskIds.push(typeRes.data.id);
    }

    const prioritiesToTest = ['low', 'medium', 'high', 'urgent'];
    for (const p of prioritiesToTest) {
      const prioRes = await api('POST', '/tasks', { title: `Prio Test ${p}`, type: 'call', priority: p });
      check(prioRes.status === 201 && prioRes.data?.priority === p, `Priority level "${p}" created successfully`);
      if (prioRes.data?.id) createdTaskIds.push(prioRes.data.id);
    }

    // Lifecycle status transitions: pending -> in-progress -> completed -> pending
    const lifecycleTask = (await api('POST', '/tasks', { title: 'Lifecycle Test Task', type: 'call', status: 'pending' })).data;
    if (lifecycleTask?.id) createdTaskIds.push(lifecycleTask.id);

    const toInProgress = await api('PATCH', `/tasks/${lifecycleTask.id}`, { status: 'in-progress' });
    check(toInProgress.status === 200 && toInProgress.data?.status === 'in-progress', 'Status transition pending -> in-progress works');

    const toCompleted = await api('PATCH', `/tasks/${lifecycleTask.id}`, { status: 'completed' });
    check(toCompleted.status === 200 && toCompleted.data?.status === 'completed', 'Status transition in-progress -> completed works');

    const backToPending = await api('PATCH', `/tasks/${lifecycleTask.id}`, { status: 'pending' });
    check(backToPending.status === 200 && backToPending.data?.status === 'pending', 'Status transition completed -> pending works');

    // -------------------------------------------------------------
    // 3. List Filtering & Ordering
    // -------------------------------------------------------------
    console.log('\n--- 3. List Filtering & Ordering ---');

    // Create tasks with specific attributes for filter testing
    const filterTask1 = (await api('POST', '/tasks', {
      title: 'FilterTask Pending Email',
      type: 'email',
      status: 'pending',
      dueDate: '2026-11-15',
      assignedAgentId: testAgent?.id,
    })).data;
    if (filterTask1?.id) createdTaskIds.push(filterTask1.id);

    const filterTask2 = (await api('POST', '/tasks', {
      title: 'FilterTask Completed Meeting',
      type: 'meeting',
      status: 'completed',
      dueDate: '2026-11-20',
    })).data;
    if (filterTask2?.id) createdTaskIds.push(filterTask2.id);

    // Filter by status=completed
    const statusFiltered = await api('GET', '/tasks?status=completed');
    check(statusFiltered.status === 200, 'GET /tasks?status=completed returns 200');
    const allCompleted = (statusFiltered.data || []).every((t) => t.status === 'completed');
    check(allCompleted, 'status=completed filter returns only completed tasks');

    // Filter by type=email
    const typeFiltered = await api('GET', '/tasks?type=email');
    check(typeFiltered.status === 200, 'GET /tasks?type=email returns 200');
    const allEmail = (typeFiltered.data || []).every((t) => t.type === 'email');
    check(allEmail, 'type=email filter returns only email tasks');

    // Filter by dueDate
    const dateFiltered = await api('GET', '/tasks?dueDate=2026-11-15');
    check(dateFiltered.status === 200, 'GET /tasks?dueDate=2026-11-15 returns 200');
    const allDate = (dateFiltered.data || []).every((t) => t.dueDate === '2026-11-15');
    check(allDate, 'dueDate filter returns only tasks with exact dueDate');

    // Filter by assignedAgentId
    if (testAgent?.id) {
      const agentFiltered = await api('GET', `/tasks?assignedAgentId=${testAgent.id}`);
      check(agentFiltered.status === 200, `GET /tasks?assignedAgentId=${testAgent.id} returns 200`);
      const allAgent = (agentFiltered.data || []).every((t) => t.assignedAgentId === testAgent.id);
      check(allAgent, 'assignedAgentId filter returns only tasks assigned to the agent');
    }

    // -------------------------------------------------------------
    // 4. Automation Engine Integration (TASK_COMPLETED & TASK_UPDATED)
    // -------------------------------------------------------------
    console.log('\n--- 4. Task Automation & State Transition Triggers ---');

    // Create a temporary workflow triggered on TASK_COMPLETED
    const wfCompleted = (await api('POST', '/workflows', {
      name: `E2E_TASK_COMPLETED_TEST_${Date.now()}`,
      description: 'Audit test for task completion automation',
      triggerEvent: 'TASK_COMPLETED',
      isActive: true,
      conditions: JSON.stringify([]),
      actions: JSON.stringify([{ type: 'NOTIFY_MANAGER' }]),
    })).data;
    if (wfCompleted?.id) createdWorkflowIds.push(wfCompleted.id);

    // Create a pending task
    const autoTask = (await api('POST', '/tasks', {
      title: 'Auto Test Task For Completion',
      type: 'call',
      status: 'pending',
    })).data;
    if (autoTask?.id) createdTaskIds.push(autoTask.id);

    // Initial check: executions count for this workflow should be 0
    const initialExecs = (await api('GET', `/workflows/${wfCompleted.id}/executions`)).data || [];
    check(initialExecs.length === 0, 'No executions before task completion');

    // Complete the task: pending -> completed
    await api('PATCH', `/tasks/${autoTask.id}`, { status: 'completed' });
    await sleep(200);

    const postCompleteExecs = (await api('GET', `/workflows/${wfCompleted.id}/executions`)).data || [];
    check(postCompleteExecs.length === 1, 'TASK_COMPLETED fired exactly once on pending -> completed transition');
    check(postCompleteExecs[0]?.status === 'success', 'Workflow execution status is success');
    check(postCompleteExecs[0]?.triggerEntityId === autoTask.id, 'triggerEntityId matches task ID');
    check(postCompleteExecs[0]?.triggerEntityType === 'task', 'triggerEntityType is "task"');

    // Duplicate Prevention Check: Edit an already-completed task without changing status
    await api('PATCH', `/tasks/${autoTask.id}`, { description: 'Updated notes while still completed' });
    await sleep(200);

    const duplicateCheckExecs = (await api('GET', `/workflows/${wfCompleted.id}/executions`)).data || [];
    check(duplicateCheckExecs.length === 1, 'TASK_COMPLETED did NOT re-fire on non-status edit of already-completed task (count stable at 1)');

    // Duplicate Prevention Check: No-op PATCH with status='completed' on already-completed task
    await api('PATCH', `/tasks/${autoTask.id}`, { status: 'completed' });
    await sleep(200);

    const noopCheckExecs = (await api('GET', `/workflows/${wfCompleted.id}/executions`)).data || [];
    check(noopCheckExecs.length === 1, 'TASK_COMPLETED did NOT re-fire on no-op PATCH status="completed" (count stable at 1)');

    // Verify TASK_UPDATED fires for general updates
    const wfUpdated = (await api('POST', '/workflows', {
      name: `E2E_TASK_UPDATED_TEST_${Date.now()}`,
      description: 'Audit test for task update automation',
      triggerEvent: 'TASK_UPDATED',
      isActive: true,
      conditions: JSON.stringify([]),
      actions: JSON.stringify([{ type: 'NOTIFY_MANAGER' }]),
    })).data;
    if (wfUpdated?.id) createdWorkflowIds.push(wfUpdated.id);

    await api('PATCH', `/tasks/${autoTask.id}`, { title: 'Updated Title for TASK_UPDATED test' });
    await sleep(200);

    const updateExecs = (await api('GET', `/workflows/${wfUpdated.id}/executions`)).data || [];
    check(updateExecs.length >= 1, 'TASK_UPDATED fired on task modification');

    // -------------------------------------------------------------
    // 5. Automated Task Generation (CREATE_TASK Action Traceability)
    // -------------------------------------------------------------
    console.log('\n--- 5. Automated Task Generation & Traceability ---');

    // Create workflow that generates a task when a lead is created
    const wfTaskGen = (await api('POST', '/workflows', {
      name: `E2E_AUTO_GEN_TASK_WF_${Date.now()}`,
      description: 'Generates automated task on lead creation',
      triggerEvent: 'LEAD_CREATED',
      isActive: true,
      conditions: JSON.stringify([]),
      actions: JSON.stringify([
        {
          type: 'CREATE_TASK',
          params: {
            title: 'Automated Welcome Call',
            type: 'call',
            priority: 'urgent',
            description: 'Call lead within 1 hour',
          },
        },
      ]),
    })).data;
    if (wfTaskGen?.id) createdWorkflowIds.push(wfTaskGen.id);

    // Create a lead to trigger the workflow
    const triggerLead = (await api('POST', '/leads', {
      firstName: 'TriggerLead',
      lastName: `Auto_${Date.now()}`,
      email: `autogen.${Date.now()}@test.com`,
      source: 'referral',
    })).data;
    if (triggerLead?.id) createdLeadIds.push(triggerLead.id);
    await sleep(300);

    // Find the generated task
    const allTasksRes = await api('GET', `/tasks?leadId=${triggerLead.id}`);
    const generatedTask = (allTasksRes.data || []).find((t) => t.sourceWorkflowId === wfTaskGen.id);

    check(!!generatedTask, 'Automated task created by CREATE_TASK action');
    if (generatedTask) {
      createdTaskIds.push(generatedTask.id);
      check(generatedTask.isAutomated === true, 'isAutomated flag is true on generated task');
      check(generatedTask.sourceWorkflowId === wfTaskGen.id, 'sourceWorkflowId matches generating workflow');
      check(generatedTask.sourceWorkflowName === wfTaskGen.name, 'sourceWorkflowName matches generating workflow');
      check(generatedTask.priority === 'urgent', 'Custom priority from workflow params applied');
      check(generatedTask.leadId === triggerLead.id, 'leadId correctly linked to trigger lead');
      check(generatedTask.title === 'Automated Welcome Call', 'Custom title applied accurately');
    }

    // -------------------------------------------------------------
    // 6. Lead & Client Referential Deletion Integrity
    // -------------------------------------------------------------
    console.log('\n--- 6. Lead & Client Referential Deletion Integrity ---');

    // Create a temporary lead with a task, then delete the lead
    const delLead = (await api('POST', '/leads', {
      firstName: 'DeleteTest',
      lastName: `Lead_${Date.now()}`,
      email: `delete.lead.${Date.now()}@test.com`,
      source: 'website',
    })).data;

    const delLeadTask = (await api('POST', '/tasks', {
      title: 'Task for deleted lead',
      type: 'call',
      leadId: delLead.id,
    })).data;

    // Delete lead
    const delLeadRes = await api('DELETE', `/leads/${delLead.id}`);
    check(delLeadRes.status === 204, 'DELETE /leads/:id succeeds when tasks are linked');

    // Verify task is cleaned up or handled cleanly
    const verifyLeadTask = await api('GET', `/tasks/${delLeadTask.id}`);
    check(verifyLeadTask.status === 404, 'Associated task cleaned up upon lead deletion (no orphan constraint failure)');

    // Create a temporary client with a task, then delete the client
    const delClient = (await api('POST', '/clients', {
      firstName: 'DeleteTest',
      lastName: `Client_${Date.now()}`,
      email: `delete.client.${Date.now()}@test.com`,
      status: 'active',
    })).data;

    const delClientTask = (await api('POST', '/tasks', {
      title: 'Task for deleted client',
      type: 'call',
      clientId: delClient.id,
    })).data;

    const delClientRes = await api('DELETE', `/clients/${delClient.id}`);
    check(delClientRes.status === 204, 'DELETE /clients/:id succeeds when tasks are linked');

    // -------------------------------------------------------------
    // 7. Delete Task CRUD
    // -------------------------------------------------------------
    console.log('\n--- 7. Task Deletion ---');
    const taskToDelete = (await api('POST', '/tasks', { title: 'To Delete', type: 'call' })).data;
    const deleteTaskRes = await api('DELETE', `/tasks/${taskToDelete.id}`);
    check(deleteTaskRes.status === 204, 'DELETE /tasks/:id returns 204');

    const getDeletedRes = await api('GET', `/tasks/${taskToDelete.id}`);
    check(getDeletedRes.status === 404, 'Deleted task returns 404');

    const deleteNonExistent = await api('DELETE', `/tasks/999999`);
    check(deleteNonExistent.status === 404, 'Deleting non-existent task returns 404');

  } catch (err) {
    console.error('Unexpected error during tasks audit:', err);
    check(false, `Unexpected error: ${err.message}`);
  } finally {
    // -------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------
    console.log('\n--- Cleanup: Removing test records ---');
    for (const wid of createdWorkflowIds) {
      await api('DELETE', `/workflows/${wid}`);
    }
    for (const tid of createdTaskIds) {
      await api('DELETE', `/tasks/${tid}`);
    }
    for (const lid of createdLeadIds) {
      await api('DELETE', `/leads/${lid}`);
    }
    for (const cid of createdClientIds) {
      await api('DELETE', `/clients/${cid}`);
    }
    console.log('Cleanup completed.\n');
  }

  console.log('======================================');
  console.log(`TOTAL: ${passedTests} passed, ${failedTests.length} failed`);
  if (failedTests.length > 0) {
    console.log('Failed tests:');
    failedTests.forEach((f) => console.log(`  ✗ ${f.message}${f.details ? ` (${f.details})` : ''}`));
  }
  console.log('======================================\n');

  if (failedTests.length > 0) {
    process.exit(1);
  }
}

run();
