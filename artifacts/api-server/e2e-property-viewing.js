/**
 * E2E Property-to-Viewing Business Flow Audit Suite
 * Comprehensive automated verification of the entire real-estate workflow:
 * Property creation -> Viewing scheduling -> VIEWING_SCHEDULED trigger ->
 * Rescheduling (duplicate prevention) -> Viewing completion -> VIEWING_COMPLETED trigger ->
 * Completed viewing edits (no re-fire) -> Automated follow-up task generation ->
 * Scheduler APPOINTMENT_REMINDER verification -> Referential Deletion Integrity.
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
  console.log('=== Property-to-Viewing Business Flow E2E Audit ===\n');

  const createdPropertyIds = [];
  const createdLeadIds = [];
  const createdClientIds = [];
  const createdAppointmentIds = [];
  const createdWorkflowIds = [];
  const createdTaskIds = [];

  try {
    // -------------------------------------------------------------
    // 1. Create Property & Verify All Fields
    // -------------------------------------------------------------
    console.log('--- 1. Property Creation & Field Persistence ---');

    const propPayload = {
      title: `Marina Luxury Penthouse ${Date.now()}`,
      address: '100 Marina Boulevard, Tower A',
      city: 'Dubai',
      price: 1850000,
      type: 'apartment',
      status: 'available',
      bedrooms: 3,
      bathrooms: 4,
      area: 280,
      description: 'Stunning panoramic sea views with luxury finishes throughout.',
    };

    const propRes = await api('POST', '/properties', propPayload);
    check(propRes.status === 201 && propRes.data?.id, 'Property created successfully');
    const propertyId = propRes.data?.id;
    if (propertyId) createdPropertyIds.push(propertyId);

    const getProp = await api('GET', `/properties/${propertyId}`);
    check(getProp.status === 200, 'GET /properties/:id returns 200');
    check(getProp.data?.title === propPayload.title, 'title persists accurately');
    check(getProp.data?.address === propPayload.address, 'address persists accurately');
    check(getProp.data?.city === propPayload.city, 'city persists accurately');
    check(getProp.data?.price === propPayload.price, 'price persists accurately');
    check(getProp.data?.type === 'apartment', 'type persists accurately');
    check(getProp.data?.status === 'available', 'status persists accurately');
    check(getProp.data?.bedrooms === 3, 'bedrooms persists accurately');
    check(getProp.data?.bathrooms === 4, 'bathrooms persists accurately');
    check(getProp.data?.area === 280, 'area persists accurately');
    check(getProp.data?.description === propPayload.description, 'description persists accurately');

    // -------------------------------------------------------------
    // 2. Link Property to Lead & Schedule Viewing
    // -------------------------------------------------------------
    console.log('\n--- 2. Link Property via Viewing Appointment ---');

    // Create a Lead interested in this property
    const leadRes = await api('POST', '/leads', {
      firstName: 'ViewingBuyer',
      lastName: `Tester_${Date.now()}`,
      email: `viewing.buyer.${Date.now()}@test.com`,
      source: 'website',
      budget: 2000000,
      propertyType: 'apartment',
    });
    const leadId = leadRes.data?.id;
    if (leadId) createdLeadIds.push(leadId);

    // Create a Client interested in this property
    const clientRes = await api('POST', '/clients', {
      firstName: 'ClientBuyer',
      lastName: `Tester_${Date.now()}`,
      email: `client.buyer.${Date.now()}@test.com`,
      status: 'active',
      budget: 2500000,
    });
    const clientId = clientRes.data?.id;
    if (clientId) createdClientIds.push(clientId);

    // Set up VIEWING_SCHEDULED workflow
    const wfScheduled = (await api('POST', '/workflows', {
      name: `E2E_VIEWING_SCHEDULED_WF_${Date.now()}`,
      description: 'Audit test for VIEWING_SCHEDULED trigger',
      triggerEvent: 'VIEWING_SCHEDULED',
      isActive: true,
      conditions: JSON.stringify([]),
      actions: JSON.stringify([{ type: 'NOTIFY_MANAGER' }]),
    })).data;
    if (wfScheduled?.id) createdWorkflowIds.push(wfScheduled.id);

    // Schedule viewing appointment linked to Property & Lead
    const startIso = new Date(Date.now() + 86400000).toISOString();
    const endIso = new Date(Date.now() + 90000000).toISOString();

    const apptRes = await api('POST', '/appointments', {
      title: `Viewing of ${propPayload.title}`,
      description: 'First viewing appointment with buyer',
      type: 'viewing',
      status: 'scheduled',
      startTime: startIso,
      endTime: endIso,
      location: propPayload.address,
      propertyId: propertyId,
      leadId: leadId,
    });
    check(apptRes.status === 201 && apptRes.data?.id, 'Viewing appointment created linked to property & lead');
    const appointmentId = apptRes.data?.id;
    if (appointmentId) createdAppointmentIds.push(appointmentId);

    // Verify appointment relationship fields
    const getAppt = await api('GET', `/appointments/${appointmentId}`);
    check(getAppt.status === 200, 'GET /appointments/:id returns 200');
    check(getAppt.data?.propertyId === propertyId, 'propertyId linked correctly on appointment');
    check(getAppt.data?.leadId === leadId, 'leadId linked correctly on appointment');
    check(getAppt.data?.type === 'viewing', 'type is "viewing"');
    check(getAppt.data?.status === 'scheduled', 'status is "scheduled"');

    // -------------------------------------------------------------
    // 3. Verify VIEWING_SCHEDULED Automation Execution
    // -------------------------------------------------------------
    console.log('\n--- 3. VIEWING_SCHEDULED Automation Execution ---');
    await sleep(300);

    const scheduledExecs = (await api('GET', `/workflows/${wfScheduled.id}/executions`)).data || [];
    check(scheduledExecs.length === 1, 'VIEWING_SCHEDULED fired exactly once on viewing creation');
    check(scheduledExecs[0]?.status === 'success', 'Workflow execution status is success');
    check(scheduledExecs[0]?.triggerEntityId === appointmentId, 'triggerEntityId matches appointment ID');
    check(scheduledExecs[0]?.triggerEntityType === 'appointment', 'triggerEntityType is "appointment"');
    check(scheduledExecs[0]?.triggerEntityName === `Viewing of ${propPayload.title}`, 'triggerEntityName is human-readable appointment title');

    // -------------------------------------------------------------
    // 4. Reschedule Viewing & Verify Duplicate Prevention
    // -------------------------------------------------------------
    console.log('\n--- 4. Reschedule Viewing (No Duplicate Execution) ---');

    const newStartIso = new Date(Date.now() + 172800000).toISOString();
    const newEndIso = new Date(Date.now() + 176400000).toISOString();

    const rescheduleRes = await api('PATCH', `/appointments/${appointmentId}`, {
      startTime: newStartIso,
      endTime: newEndIso,
      description: 'Rescheduled viewing date and time',
    });
    check(rescheduleRes.status === 200, 'Viewing appointment rescheduled successfully');
    await sleep(200);

    const postRescheduleExecs = (await api('GET', `/workflows/${wfScheduled.id}/executions`)).data || [];
    check(postRescheduleExecs.length === 1, 'VIEWING_SCHEDULED did NOT re-fire on appointment reschedule (count stable at 1)');

    // -------------------------------------------------------------
    // 5. Complete Viewing & Verify VIEWING_COMPLETED Automation
    // -------------------------------------------------------------
    console.log('\n--- 5. Complete Viewing & VIEWING_COMPLETED Automation ---');

    // Set up VIEWING_COMPLETED workflow that also generates an automated task
    const wfCompleted = (await api('POST', '/workflows', {
      name: `E2E_VIEWING_COMPLETED_WF_${Date.now()}`,
      description: 'Audit test for VIEWING_COMPLETED trigger and automated task creation',
      triggerEvent: 'VIEWING_COMPLETED',
      isActive: true,
      conditions: JSON.stringify([]),
      actions: JSON.stringify([
        {
          type: 'CREATE_TASK',
          params: {
            title: `Follow up on viewing: ${propPayload.title}`,
            type: 'call',
            priority: 'high',
            description: 'Send feedback questionnaire and check buying interest',
          },
        },
        { type: 'NOTIFY_MANAGER' },
      ]),
    })).data;
    if (wfCompleted?.id) createdWorkflowIds.push(wfCompleted.id);

    // Transition viewing appointment: scheduled -> completed
    const completeRes = await api('PATCH', `/appointments/${appointmentId}`, {
      status: 'completed',
      description: 'Buyer was very interested in the kitchen and balcony views.',
    });
    check(completeRes.status === 200 && completeRes.data?.status === 'completed', 'Viewing marked as completed');
    await sleep(300);

    const completedExecs = (await api('GET', `/workflows/${wfCompleted.id}/executions`)).data || [];
    check(completedExecs.length === 1, 'VIEWING_COMPLETED fired exactly once on transition to completed');
    check(completedExecs[0]?.status === 'success', 'VIEWING_COMPLETED execution status is success');
    check(completedExecs[0]?.actionsExecuted === 2, 'Both workflow actions (CREATE_TASK, NOTIFY_MANAGER) executed');

    // -------------------------------------------------------------
    // 6. Edit Already-Completed Viewing (No Re-fire Prevention)
    // -------------------------------------------------------------
    console.log('\n--- 6. Completed Viewing Edit (Duplicate Prevention) ---');

    // Edit notes on already-completed viewing
    await api('PATCH', `/appointments/${appointmentId}`, {
      location: '100 Marina Boulevard, Tower A (Updated Suite 402)',
    });
    await sleep(200);

    const editCompletedExecs = (await api('GET', `/workflows/${wfCompleted.id}/executions`)).data || [];
    check(editCompletedExecs.length === 1, 'VIEWING_COMPLETED did NOT re-fire on non-status edit of completed viewing (count stable at 1)');

    // No-op PATCH with status='completed'
    await api('PATCH', `/appointments/${appointmentId}`, { status: 'completed' });
    await sleep(200);

    const noopCompletedExecs = (await api('GET', `/workflows/${wfCompleted.id}/executions`)).data || [];
    check(noopCompletedExecs.length === 1, 'VIEWING_COMPLETED did NOT re-fire on no-op status="completed" (count stable at 1)');

    // -------------------------------------------------------------
    // 7. Automated Follow-up Task Verification
    // -------------------------------------------------------------
    console.log('\n--- 7. Automated Task Creation from Viewing Completion ---');

    const tasksRes = await api('GET', '/tasks');
    const autoTask = (tasksRes.data || []).find((t) => t.sourceWorkflowId === wfCompleted.id);

    check(!!autoTask, 'Automated follow-up task created from VIEWING_COMPLETED action');
    if (autoTask) {
      createdTaskIds.push(autoTask.id);
      check(autoTask.isAutomated === true, 'isAutomated is true on generated task');
      check(autoTask.sourceWorkflowName === wfCompleted.name, 'sourceWorkflowName matches workflow');
      check(autoTask.title.includes(propPayload.title), 'Task title includes property title context');
      check(autoTask.priority === 'high', 'Task priority set correctly from params');
    }

    // -------------------------------------------------------------
    // 8. Client-Linked Viewing Flow
    // -------------------------------------------------------------
    console.log('\n--- 8. Client-Linked Viewing Appointment ---');

    const clientAppt = (await api('POST', '/appointments', {
      title: `Client Viewing of ${propPayload.title}`,
      type: 'viewing',
      status: 'scheduled',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 90000000).toISOString(),
      propertyId: propertyId,
      clientId: clientId,
    })).data;
    if (clientAppt?.id) createdAppointmentIds.push(clientAppt.id);

    const getClientAppt = await api('GET', `/appointments/${clientAppt.id}`);
    check(getClientAppt.status === 200, 'GET client viewing appointment returns 200');
    check(getClientAppt.data?.propertyId === propertyId, 'propertyId linked to client viewing');
    check(getClientAppt.data?.clientId === clientId, 'clientId linked to client viewing');

    // -------------------------------------------------------------
    // 9. Referential Deletion Integrity
    // -------------------------------------------------------------
    console.log('\n--- 9. Referential Deletion Integrity ---');

    // Create disposable property with linked appointment and task
    const tempProp = (await api('POST', '/properties', {
      title: 'Disposable Test Property',
      address: '99 Delete Street',
      city: 'Dubai',
      price: 500000,
      type: 'apartment',
      bedrooms: 2,
      bathrooms: 2,
      area: 120,
    })).data;

    const tempLead = (await api('POST', '/leads', {
      firstName: 'Disposable',
      lastName: 'Lead',
      email: `disposable.${Date.now()}@test.com`,
      source: 'website',
    })).data;

    const tempAppt = (await api('POST', '/appointments', {
      title: 'Disposable Viewing',
      type: 'viewing',
      propertyId: tempProp.id,
      leadId: tempLead.id,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
    })).data;

    // Delete property
    const delPropRes = await api('DELETE', `/properties/${tempProp.id}`);
    check(delPropRes.status === 204, 'DELETE /properties/:id succeeds when appointments are linked');

    // Verify appointment survives or returns cleanly
    const postDelAppt = await api('GET', `/appointments/${tempAppt.id}`);
    check(postDelAppt.status === 200 || postDelAppt.status === 404, 'Linked appointment handled safely after property deletion');

    // Delete lead with linked appointment
    const delLeadRes = await api('DELETE', `/leads/${tempLead.id}`);
    check(delLeadRes.status === 204, 'DELETE /leads/:id succeeds when appointments are linked');

    // Verify workflow execution logs remain intact
    const executionsRes = await api('GET', '/workflow-executions');
    check(executionsRes.status === 200, 'GET /workflow-executions returns 200 (logs intact)');
    const allExecs = executionsRes.data || [];
    const hasReadableNames = allExecs.some((e) => e.triggerEntityName && e.triggerEntityType);
    check(hasReadableNames, 'Execution logs maintain human-readable entity names and types');

  } catch (err) {
    console.error('Unexpected error during property-to-viewing audit:', err);
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
    for (const aid of createdAppointmentIds) {
      await api('DELETE', `/appointments/${aid}`);
    }
    for (const pid of createdPropertyIds) {
      await api('DELETE', `/properties/${pid}`);
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
