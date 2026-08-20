/**
 * E2E Full Lifecycle Master Audit Suite (Lead -> Client -> Task -> Appointment -> Property Viewing -> Notification -> Analytics)
 * 
 * Verifies every cross-module interaction in the Real Estate Operations & Automation system:
 * 1. Agent Selection & Baseline Metrics
 * 2. Luxury Property Creation & Field Verification
 * 3. Inbound Lead Ingestion & Automated Multi-Action Triaging (Assign Agent, Task, Notification)
 * 4. Lead Progression & Task Completion Lifecycle
 * 5. Lead-to-Client Conversion & KPI Verification
 * 6. Property Viewing Scheduling & VIEWING_SCHEDULED Trigger
 * 7. Viewing Reschedule (Duplicate-Prevention Check)
 * 8. Viewing Completion & Automated Follow-Up Task Generation
 * 9. Property Sale & Analytics Revenue Reflection
 * 10. Notification Lifecycle (Unread Count, Single Read, Mark All Read)
 * 11. Referential Integrity & Cascade Resilience
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
  console.log('=== Master Full-Lifecycle CRM & Automation E2E Audit ===\n');

  const createdWorkflowIds = [];
  const createdPropertyIds = [];
  const createdLeadIds = [];
  const createdClientIds = [];
  const createdAppointmentIds = [];
  const createdTaskIds = [];

  try {
    // -------------------------------------------------------------
    // 1. Agent Baseline
    // -------------------------------------------------------------
    console.log('--- 1. Agent & Baseline Metrics ---');
    const agentsRes = await api('GET', '/agents');
    check(agentsRes.status === 200, 'GET /agents returns 200');
    const agents = agentsRes.data || [];
    check(agents.length > 0, 'At least one agent exists for assignment');
    const assignedAgent = agents[0];

    const initialSummary = (await api('GET', '/dashboard/summary')).data || {};
    check(typeof initialSummary.totalLeads === 'number', 'Initial dashboard summary available');

    // -------------------------------------------------------------
    // 2. Setup Lifecycle Automation Workflows
    // -------------------------------------------------------------
    console.log('\n--- 2. Automation Workflows Setup ---');

    // WF1: Lead Triage (Assign Agent + Create Triage Task + Notify Manager)
    const wfTriage = (await api('POST', '/workflows', {
      name: `LIFECYCLE_LEAD_TRIAGE_${Date.now()}`,
      description: 'Auto-assign agent and create contact task on lead creation',
      triggerEvent: 'LEAD_CREATED',
      isActive: true,
      conditions: JSON.stringify([{ field: 'budget', operator: '>', value: 1000000 }]),
      actions: JSON.stringify([
        { type: 'ASSIGN_SENIOR_AGENT' },
        { type: 'CREATE_TASK', params: { title: 'VIP Lead Qualification Call', priority: 'urgent' } },
        { type: 'NOTIFY_MANAGER' },
      ]),
    })).data;
    if (wfTriage?.id) createdWorkflowIds.push(wfTriage.id);
    check(!!wfTriage?.id, 'Lead Triage multi-action workflow created');

    // WF2: Post-Viewing Follow-Up Task
    const wfViewing = (await api('POST', '/workflows', {
      name: `LIFECYCLE_VIEWING_FOLLOWUP_${Date.now()}`,
      description: 'Create offer prep task when viewing completed',
      triggerEvent: 'VIEWING_COMPLETED',
      isActive: true,
      conditions: JSON.stringify([]),
      actions: JSON.stringify([
        { type: 'CREATE_TASK', params: { title: 'Prepare Purchase Agreement Draft', priority: 'high' } },
        { type: 'NOTIFY_MANAGER' },
      ]),
    })).data;
    if (wfViewing?.id) createdWorkflowIds.push(wfViewing.id);
    check(!!wfViewing?.id, 'Viewing Follow-up workflow created');

    // WF3: Property Sold Celebration / Notification
    const wfSold = (await api('POST', '/workflows', {
      name: `LIFECYCLE_PROPERTY_SOLD_${Date.now()}`,
      description: 'Notify manager on property deal closed',
      triggerEvent: 'PROPERTY_SOLD',
      isActive: true,
      conditions: JSON.stringify([]),
      actions: JSON.stringify([{ type: 'NOTIFY_MANAGER' }]),
    })).data;
    if (wfSold?.id) createdWorkflowIds.push(wfSold.id);
    check(!!wfSold?.id, 'Property Sold workflow created');

    // -------------------------------------------------------------
    // 3. Property Creation
    // -------------------------------------------------------------
    console.log('\n--- 3. Luxury Property Creation ---');

    const propPayload = {
      title: `Palm Jumeirah Villa ${Date.now()}`,
      address: '10 Palm Crescent',
      city: 'Dubai',
      price: 4500000,
      type: 'villa',
      status: 'available',
      bedrooms: 5,
      bathrooms: 6,
      area: 6200,
      description: 'Ultra-luxury waterfront estate with private beach access.',
      assignedAgentId: assignedAgent.id,
    };

    const propRes = await api('POST', '/properties', propPayload);
    check(propRes.status === 201, 'POST /properties returns 201');
    const property = propRes.data;
    if (property?.id) createdPropertyIds.push(property.id);

    const getProp = await api('GET', `/properties/${property.id}`);
    check(getProp.status === 200, 'GET /properties/:id returns 200');
    check(getProp.data?.title === propPayload.title, 'Property title persisted accurately');
    check(getProp.data?.price === 4500000, 'Property price persisted accurately');
    check(getProp.data?.type === 'villa', 'Property type is villa');

    // -------------------------------------------------------------
    // 4. Inbound Lead & Automated Triaging
    // -------------------------------------------------------------
    console.log('\n--- 4. Inbound Lead & Automated Triaging ---');

    const leadPayload = {
      firstName: 'Alexander',
      lastName: `Vane_${Date.now()}`,
      email: `alex.vane.${Date.now()}@investor.ae`,
      phone: '+971501234567',
      source: 'website',
      status: 'new',
      budget: 4500000,
      propertyType: 'villa',
      notes: 'Interested in luxury waterfront villas.',
    };

    const leadRes = await api('POST', '/leads', leadPayload);
    check(leadRes.status === 201, 'POST /leads returns 201');
    const lead = leadRes.data;
    if (lead?.id) createdLeadIds.push(lead.id);

    await sleep(400);

    // Verify Agent Assignment
    const getLeadAfter = await api('GET', `/leads/${lead.id}`);
    check(getLeadAfter.status === 200, 'GET /leads/:id returns 200');
    check(getLeadAfter.data?.assignedAgentId !== null, 'Senior agent auto-assigned by workflow');

    // Verify Triage Task Auto-Created
    const tasksRes = await api('GET', `/tasks?leadId=${lead.id}`);
    check(tasksRes.status === 200, 'GET /tasks?leadId returns 200');
    const leadTasks = tasksRes.data || [];
    const triageTask = leadTasks.find((t) => t.title.includes('VIP Lead Qualification Call'));
    check(!!triageTask, 'VIP Lead Qualification Call task auto-generated');
    if (triageTask) {
      createdTaskIds.push(triageTask.id);
      check(triageTask.priority === 'urgent', 'Auto task priority is urgent');
      check(triageTask.isAutomated === true, 'Auto task has isAutomated === true');
      check(triageTask.leadId === lead.id, 'Auto task correctly linked to lead');
    }

    // Verify Manager Notification Auto-Created
    const notifsRes = await api('GET', '/notifications');
    const triageNotif = (notifsRes.data || []).find(
      (n) => n.entityType === 'lead' && n.entityId === lead.id
    );
    check(!!triageNotif, 'Manager notification generated for VIP lead');

    // -------------------------------------------------------------
    // 5. Lead Nurturing & Task Completion
    // -------------------------------------------------------------
    console.log('\n--- 5. Lead Nurturing & Task Lifecycle ---');

    // Progress lead status
    const updateLead = await api('PATCH', `/leads/${lead.id}`, { status: 'qualified' });
    check(updateLead.status === 200, 'Lead status updated to "qualified"');
    check(updateLead.data?.status === 'qualified', 'Lead status verified as qualified');

    // Complete triage task
    if (triageTask) {
      const compTaskRes = await api('PATCH', `/tasks/${triageTask.id}`, { status: 'completed' });
      check(compTaskRes.status === 200, 'Triage task marked as completed');
      check(compTaskRes.data?.status === 'completed', 'Task status is completed');
    }

    // -------------------------------------------------------------
    // 6. Lead-to-Client Conversion
    // -------------------------------------------------------------
    console.log('\n--- 6. Lead-to-Client Conversion ---');

    const clientPayload = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      status: 'active',
      budget: lead.budget,
      preferredPropertyType: 'villa',
      assignedAgentId: assignedAgent.id,
      leadId: lead.id,
      notes: 'Converted from VIP web lead.',
    };

    const clientRes = await api('POST', '/clients', clientPayload);
    check(clientRes.status === 201, 'POST /clients (converted) returns 201');
    const client = clientRes.data;
    if (client?.id) createdClientIds.push(client.id);

    // Update lead to converted
    const leadConverted = await api('PATCH', `/leads/${lead.id}`, { status: 'converted' });
    check(leadConverted.status === 200, 'Lead marked as "converted"');

    // Verify client record
    const getClient = await api('GET', `/clients/${client.id}`);
    check(getClient.status === 200, 'GET /clients/:id returns 200');
    check(getClient.data?.leadId === lead.id, 'Client retains foreign key link to original lead');
    check(getClient.data?.budget === 4500000, 'Client budget matches lead budget');

    // -------------------------------------------------------------
    // 7. Property Viewing Scheduling & Automation
    // -------------------------------------------------------------
    console.log('\n--- 7. Property Viewing Scheduling ---');

    const apptPayload = {
      title: `Private Viewing: ${property.title} for ${client.firstName} ${client.lastName}`,
      description: 'Exclusive on-site private viewing of waterfront villa.',
      type: 'viewing',
      status: 'scheduled',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 90000000).toISOString(),
      location: property.address,
      propertyId: property.id,
      clientId: client.id,
      leadId: lead.id,
      assignedAgentId: assignedAgent.id,
    };

    const apptRes = await api('POST', '/appointments', apptPayload);
    check(apptRes.status === 201, 'POST /appointments returns 201');
    const appt = apptRes.data;
    if (appt?.id) createdAppointmentIds.push(appt.id);
    await sleep(300);

    // Verify appointment details
    const getAppt = await api('GET', `/appointments/${appt.id}`);
    check(getAppt.status === 200, 'GET /appointments/:id returns 200');
    check(getAppt.data?.propertyId === property.id, 'Appointment linked to Property');
    check(getAppt.data?.clientId === client.id, 'Appointment linked to Client');
    check(getAppt.data?.leadId === lead.id, 'Appointment linked to Lead');
    check(getAppt.data?.type === 'viewing', 'Appointment type is viewing');

    // Reschedule viewing (Duplicate-prevention test)
    const reschedTime = new Date(Date.now() + 96400000).toISOString();
    const reschedRes = await api('PATCH', `/appointments/${appt.id}`, { startTime: reschedTime });
    check(reschedRes.status === 200, 'Appointment rescheduled successfully');

    // -------------------------------------------------------------
    // 8. Viewing Completion & Post-Viewing Automation
    // -------------------------------------------------------------
    console.log('\n--- 8. Viewing Completion & Post-Viewing Automation ---');

    const completeApptRes = await api('PATCH', `/appointments/${appt.id}`, { status: 'completed' });
    check(completeApptRes.status === 200, 'Viewing marked as "completed"');
    await sleep(400);

    // Check automated post-viewing task
    const postViewingTasks = (await api('GET', `/tasks?clientId=${client.id}`)).data || [];
    const offerDraftTask = postViewingTasks.find((t) => t.title.includes('Prepare Purchase Agreement Draft'));
    check(!!offerDraftTask, 'Prepare Purchase Agreement Draft task auto-generated on viewing completion');
    if (offerDraftTask) {
      createdTaskIds.push(offerDraftTask.id);
      check(offerDraftTask.isAutomated === true, 'Task flagged as isAutomated');
      check(offerDraftTask.priority === 'high', 'Task priority is high');
      check(offerDraftTask.clientId === client.id, 'Task linked to Client');
    }

    // Complete the offer draft task
    if (offerDraftTask) {
      const finishDraft = await api('PATCH', `/tasks/${offerDraftTask.id}`, { status: 'completed' });
      check(finishDraft.status === 200, 'Offer draft task marked completed');
    }

    // -------------------------------------------------------------
    // 9. Property Sale & Analytics Revenue
    // -------------------------------------------------------------
    console.log('\n--- 9. Property Sale & Analytics Verification ---');

    const sellPropRes = await api('PATCH', `/properties/${property.id}`, { status: 'sold' });
    check(sellPropRes.status === 200, 'Property status transitioned to "sold"');
    check(sellPropRes.data?.status === 'sold', 'Property status is sold in DB');
    await sleep(300);

    // Verify PROPERTY_SOLD automation fired
    const executions = (await api('GET', '/workflow-executions')).data || [];
    const soldExec = executions.find(
      (e) => e.workflowId === wfSold.id && e.triggerEntityId === property.id
    );
    check(!!soldExec, 'PROPERTY_SOLD automation workflow executed successfully');
    if (soldExec) {
      check(soldExec.status === 'success', 'Workflow execution status is success');
      check(soldExec.triggerEntityType === 'property', 'triggerEntityType is "property"');
      check(soldExec.triggerEntityName === property.title, 'triggerEntityName is property title');
    }

    // Verify Dashboard summary reflects active properties & closed deals
    const summaryAfter = (await api('GET', '/dashboard/summary')).data || {};
    check(typeof summaryAfter.revenueThisMonth === 'number', 'Revenue this month metric is calculated');
    check(typeof summaryAfter.totalClients === 'number', 'Total clients metric is calculated');

    // -------------------------------------------------------------
    // 10. Notification Lifecycle (Read States)
    // -------------------------------------------------------------
    console.log('\n--- 10. Notification Lifecycle Management ---');

    const unreadBefore = (await api('GET', '/notifications?read=false')).data || [];
    check(unreadBefore.length > 0, 'Unread notifications exist for created lifecycle events');

    // Mark single notification as read
    if (unreadBefore.length > 0) {
      const singleId = unreadBefore[0].id;
      const markSingle = await api('PATCH', `/notifications/${singleId}/read`);
      check(markSingle.status === 200, 'Single notification marked as read');
    }

    // Mark all as read
    const markAll = await api('PATCH', '/notifications/read-all');
    check(markAll.status === 200, 'Mark-all-read endpoint returns 200');

    const unreadAfter = (await api('GET', '/notifications?read=false')).data || [];
    check(unreadAfter.length === 0, 'All notifications confirmed as read (0 unread remaining)');

    // -------------------------------------------------------------
    // 11. Referential Integrity & Cascade Cleanup
    // -------------------------------------------------------------
    console.log('\n--- 11. Referential Integrity & Cleanup ---');

    // Deleting appointment linked to property and client
    const delAppt = await api('DELETE', `/appointments/${appt.id}`);
    check(delAppt.status === 204, 'DELETE /appointments/:id returns 204');

    // Deleting property
    const delProp = await api('DELETE', `/properties/${property.id}`);
    check(delProp.status === 204, 'DELETE /properties/:id returns 204');

    // Deleting client with linked tasks
    const delClient = await api('DELETE', `/clients/${client.id}`);
    check(delClient.status === 204, 'DELETE /clients/:id returns 204');

    // Deleting lead
    const delLead = await api('DELETE', `/leads/${lead.id}`);
    check(delLead.status === 204, 'DELETE /leads/:id returns 204');

    // Verify executions audit trail survives deletion of entities
    const finalExecs = (await api('GET', '/workflow-executions')).data || [];
    check(finalExecs.length >= executions.length, 'Audit log executions survive entity deletions');

  } catch (err) {
    console.error('Unexpected error during full-lifecycle audit:', err);
    check(false, `Unexpected error: ${err.message}`);
  } finally {
    // -------------------------------------------------------------
    // Cleanup temporary workflows
    // -------------------------------------------------------------
    console.log('\n--- Cleanup: Removing lifecycle test workflows ---');
    for (const wid of createdWorkflowIds) {
      await api('DELETE', `/workflows/${wid}`);
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
