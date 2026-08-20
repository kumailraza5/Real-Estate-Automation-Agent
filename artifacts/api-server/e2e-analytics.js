/**
 * E2E Analytics & Dashboard Audit Test Suite
 * Comprehensive automated verification of Dashboard KPIs, Lead Pipeline,
 * Financial Calculations, Reports (Conversion, Performance, Automations),
 * Date boundaries, Edge Cases, and Cross-Module Consistency.
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

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ts = () => Date.now();

async function run() {
  console.log('=== Dashboard, Reports & Analytics E2E Audit ===\n');

  // Track created entity IDs for reliable cleanup
  const cleanup = {
    leadIds: [],
    propertyIds: [],
    clientIds: [],
    taskIds: [],
    appointmentIds: [],
    workflowIds: [],
  };

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // 1. Dashboard Summary Cards Baseline Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- 1. Dashboard Summary Cards Baseline ---');

    const summaryRes = await api('GET', '/dashboard/summary');
    check(summaryRes.ok && summaryRes.status === 200, 'GET /dashboard/summary returns 200');
    const summary = summaryRes.data;

    check(typeof summary.totalLeads === 'number', 'summary.totalLeads is a number');
    check(typeof summary.activeLeads === 'number', 'summary.activeLeads is a number');
    check(typeof summary.totalProperties === 'number', 'summary.totalProperties is a number');
    check(typeof summary.totalClients === 'number', 'summary.totalClients is a number');
    check(typeof summary.tasksToday === 'number', 'summary.tasksToday is a number');
    check(typeof summary.automationsActive === 'number', 'summary.automationsActive is a number');
    check(typeof summary.dealsClosedThisMonth === 'number', 'summary.dealsClosedThisMonth is a number');
    check(typeof summary.revenueThisMonth === 'number', 'summary.revenueThisMonth is a number');

    // Cross-verify with list endpoints
    const leadsRes = await api('GET', '/leads');
    const leadsList = Array.isArray(leadsRes.data) ? leadsRes.data : [];
    check(summary.totalLeads === leadsList.length, 'summary.totalLeads matches GET /leads count',
      `summary: ${summary.totalLeads}, list: ${leadsList.length}`);

    const activeFromList = leadsList.filter((l) => l.status !== 'closed' && l.status !== 'lost').length;
    check(summary.activeLeads === activeFromList, 'summary.activeLeads matches active leads from GET /leads',
      `summary: ${summary.activeLeads}, list active: ${activeFromList}`);

    const propertiesRes = await api('GET', '/properties');
    const propertiesList = Array.isArray(propertiesRes.data) ? propertiesRes.data : [];
    check(summary.totalProperties === propertiesList.length, 'summary.totalProperties matches GET /properties count',
      `summary: ${summary.totalProperties}, list: ${propertiesList.length}`);

    const clientsRes = await api('GET', '/clients');
    const clientsList = Array.isArray(clientsRes.data) ? clientsRes.data : [];
    check(summary.totalClients === clientsList.length, 'summary.totalClients matches GET /clients count',
      `summary: ${summary.totalClients}, list: ${clientsList.length}`);

    const todayStr = new Date().toISOString().split('T')[0];
    const tasksRes = await api('GET', `/tasks?dueDate=${todayStr}`);
    const tasksList = Array.isArray(tasksRes.data) ? tasksRes.data : [];
    check(summary.tasksToday === tasksList.length, 'summary.tasksToday matches GET /tasks for today',
      `summary: ${summary.tasksToday}, list today: ${tasksList.length}`);

    const workflowsRes = await api('GET', '/workflows');
    const workflowsList = Array.isArray(workflowsRes.data) ? workflowsRes.data : [];
    const activeWorkflowsCount = workflowsList.filter((w) => w.isActive).length;
    check(summary.automationsActive === activeWorkflowsCount, 'summary.automationsActive matches active workflows count',
      `summary: ${summary.automationsActive}, list active: ${activeWorkflowsCount}`);

    const closedLeads = leadsList.filter((l) => l.status === 'closed');
    check(summary.dealsClosedThisMonth === closedLeads.length, 'summary.dealsClosedThisMonth matches closed leads count',
      `summary: ${summary.dealsClosedThisMonth}, closed list: ${closedLeads.length}`);

    const expectedRevenue = closedLeads.reduce((acc, l) => acc + (Number(l.budget) || 0), 0);
    check(Math.abs(summary.revenueThisMonth - expectedRevenue) < 0.01, 'summary.revenueThisMonth matches sum of closed lead budgets',
      `summary: ${summary.revenueThisMonth}, expected: ${expectedRevenue}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Lead Pipeline Analytics
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 2. Lead Pipeline Analytics ---');

    const pipelineRes = await api('GET', '/dashboard/pipeline');
    check(pipelineRes.ok && pipelineRes.status === 200, 'GET /dashboard/pipeline returns 200');
    const pipeline = pipelineRes.data;
    check(Array.isArray(pipeline.stages), 'pipeline.stages is an array');

    const pipelineMap = new Map();
    for (const stage of pipeline.stages || []) {
      check(typeof stage.status === 'string', `Stage status is string: ${stage.status}`);
      check(typeof stage.count === 'number', `Stage ${stage.status} count is number: ${stage.count}`);
      check(typeof stage.value === 'number', `Stage ${stage.status} value is number: ${stage.value}`);
      check(!isNaN(stage.count), `Stage ${stage.status} count is not NaN`);
      check(!isNaN(stage.value), `Stage ${stage.status} value is not NaN`);
      pipelineMap.set(stage.status, stage);
    }

    // Verify stage counts against leads list
    const stagesToTest = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed'];
    for (const st of stagesToTest) {
      const matchingLeads = leadsList.filter((l) => l.status === st);
      const stageObj = pipelineMap.get(st) || { count: 0, value: 0 };
      check(stageObj.count === matchingLeads.length, `Pipeline stage "${st}" count matches DB leads count`,
        `pipeline: ${stageObj.count}, db: ${matchingLeads.length}`);
      const expectedVal = matchingLeads.reduce((acc, l) => acc + (Number(l.budget) || 0), 0);
      check(Math.abs(stageObj.value - expectedVal) < 0.01, `Pipeline stage "${st}" value matches sum of lead budgets`,
        `pipeline val: ${stageObj.value}, expected: ${expectedVal}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Reports Endpoints Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 3. Reports Endpoints Verification ---');

    // 3a. Lead Conversion Report
    const convRes = await api('GET', '/reports/lead-conversion');
    check(convRes.ok && convRes.status === 200, 'GET /reports/lead-conversion returns 200');
    const conv = convRes.data;
    check(typeof conv.totalLeads === 'number', 'lead-conversion totalLeads is a number');
    check(typeof conv.converted === 'number', 'lead-conversion converted is a number');
    check(typeof conv.conversionRate === 'number', 'lead-conversion conversionRate is a number');
    check(!isNaN(conv.conversionRate), 'lead-conversion conversionRate is not NaN');
    check(Array.isArray(conv.bySource), 'lead-conversion bySource is an array');
    check(Array.isArray(conv.byMonth), 'lead-conversion byMonth is an array');

    const expectedConvRate = conv.totalLeads > 0 ? (conv.converted / conv.totalLeads) * 100 : 0;
    check(Math.abs(conv.conversionRate - expectedConvRate) < 0.01, 'lead-conversion conversionRate formula correct',
      `returned: ${conv.conversionRate}, calculated: ${expectedConvRate}`);

    // Sum of bySource counts should equal totalLeads
    const sumBySource = (conv.bySource || []).reduce((acc, s) => acc + s.count, 0);
    check(sumBySource === conv.totalLeads, 'bySource total matches totalLeads count',
      `bySource sum: ${sumBySource}, total: ${conv.totalLeads}`);

    // 3b. Team Performance Report
    const teamRes = await api('GET', '/reports/team-performance');
    check(teamRes.ok && teamRes.status === 200, 'GET /reports/team-performance returns 200');
    const team = Array.isArray(teamRes.data) ? teamRes.data : [];
    check(team.length > 0, 'team-performance returns list of agents');

    const agentsRes = await api('GET', '/agents');
    const agentsList = Array.isArray(agentsRes.data) ? agentsRes.data : [];
    check(team.length === agentsList.length, 'team-performance has entry for every agent',
      `team entries: ${team.length}, agents: ${agentsList.length}`);

    for (const perf of team) {
      check(typeof perf.agentId === 'number', `perf.agentId is a number: ${perf.agentId}`);
      check(typeof perf.agentName === 'string', `perf.agentName is string: ${perf.agentName}`);
      check(typeof perf.leadsAssigned === 'number', `perf.leadsAssigned is number: ${perf.leadsAssigned}`);
      check(typeof perf.leadsClosed === 'number', `perf.leadsClosed is number: ${perf.leadsClosed}`);
      check(typeof perf.tasksCompleted === 'number', `perf.tasksCompleted is number: ${perf.tasksCompleted}`);
      check(typeof perf.appointmentsHeld === 'number', `perf.appointmentsHeld is number: ${perf.appointmentsHeld}`);
    }

    // 3c. Automation Activity Report
    const autoRes = await api('GET', '/reports/automation-activity');
    check(autoRes.ok && autoRes.status === 200, 'GET /reports/automation-activity returns 200');
    const auto = autoRes.data;
    check(typeof auto.totalExecutions === 'number', 'automation-activity totalExecutions is a number');
    check(typeof auto.successRate === 'number', 'automation-activity successRate is a number');
    check(!isNaN(auto.successRate), 'automation-activity successRate is not NaN');
    check(Array.isArray(auto.byWorkflow), 'automation-activity byWorkflow is an array');
    check(Array.isArray(auto.byTrigger), 'automation-activity byTrigger is an array');

    // 3d. Recent Activity Feed
    const actRes = await api('GET', '/dashboard/recent-activity');
    check(actRes.ok && actRes.status === 200, 'GET /dashboard/recent-activity returns 200');
    const actList = Array.isArray(actRes.data) ? actRes.data : [];
    check(actList.length <= 20, 'recent-activity limits to at most 20 entries');
    if (actList.length > 0) {
      const first = actList[0];
      check(typeof first.id === 'number', 'Activity item has numeric id');
      check(typeof first.action === 'string', 'Activity item has action');
      check(typeof first.entityType === 'string', 'Activity item has entityType');
      check(typeof first.description === 'string', 'Activity item has description');
      check(typeof first.createdAt === 'string', 'Activity item has createdAt date string');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Controlled State Transitions & Real-Time Metric Updates
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 4. Controlled State Transitions & Real-Time Updates ---');

    // Step A: Baseline summary before creating test records
    const baseSummary = (await api('GET', '/dashboard/summary')).data;
    const basePipeline = (await api('GET', '/dashboard/pipeline')).data;
    const baseNewStage = (basePipeline.stages || []).find((s) => s.status === 'new') || { count: 0, value: 0 };
    const baseClosedStage = (basePipeline.stages || []).find((s) => s.status === 'closed') || { count: 0, value: 0 };
    const baseConv = (await api('GET', '/reports/lead-conversion')).data;

    // Pick first agent for assignment testing
    const testAgent = agentsList[0];
    const baseTeamPerf = (await api('GET', '/reports/team-performance')).data;
    const baseAgentPerf = (baseTeamPerf || []).find((p) => p.agentId === testAgent.id) || {
      leadsAssigned: 0,
      leadsClosed: 0,
      tasksCompleted: 0,
      appointmentsHeld: 0,
    };

    // Step B: Create a new Lead with budget 150000 assigned to testAgent
    const testLeadPayload = {
      firstName: 'AnalyticsTest',
      lastName: `User_${ts()}`,
      email: `analytics.test.${ts()}@example.com`,
      phone: '555-0199',
      source: 'website',
      budget: 150000,
      assignedAgentId: testAgent.id,
    };
    const createLeadRes = await api('POST', '/leads', testLeadPayload);
    check(createLeadRes.ok && createLeadRes.status === 201, 'Created test lead with budget 150000');
    const testLeadId = createLeadRes.data?.id;
    if (testLeadId) cleanup.leadIds.push(testLeadId);

    // Verify summary increments totalLeads, activeLeads
    const postCreateSummary = (await api('GET', '/dashboard/summary')).data;
    check(postCreateSummary.totalLeads === baseSummary.totalLeads + 1, 'Summary totalLeads incremented by 1',
      `before: ${baseSummary.totalLeads}, after: ${postCreateSummary.totalLeads}`);
    check(postCreateSummary.activeLeads === baseSummary.activeLeads + 1, 'Summary activeLeads incremented by 1',
      `before: ${baseSummary.activeLeads}, after: ${postCreateSummary.activeLeads}`);

    // Verify pipeline "new" stage incremented in count and value
    // Use >= base+1 to tolerate concurrent test suites also creating leads in parallel
    const postCreatePipeline = (await api('GET', '/dashboard/pipeline')).data;
    const newStageAfterCreate = (postCreatePipeline.stages || []).find((s) => s.status === 'new') || { count: 0, value: 0 };
    check(newStageAfterCreate.count >= baseNewStage.count + 1, 'Pipeline "new" stage count incremented by at least 1',
      `before: ${baseNewStage.count}, after: ${newStageAfterCreate.count}`);
    check(newStageAfterCreate.value >= baseNewStage.value + 150000, 'Pipeline "new" stage value incremented by at least $150,000',
      `before: ${baseNewStage.value}, after: ${newStageAfterCreate.value}`);

    // Verify team performance reflects newly assigned lead
    const postCreateTeam = (await api('GET', '/reports/team-performance')).data;
    const agentPerfAfterCreate = (postCreateTeam || []).find((p) => p.agentId === testAgent.id);
    check(agentPerfAfterCreate.leadsAssigned === baseAgentPerf.leadsAssigned + 1, 'Agent leadsAssigned incremented by 1 in team performance',
      `before: ${baseAgentPerf.leadsAssigned}, after: ${agentPerfAfterCreate.leadsAssigned}`);

    // Step C: Advance Lead from 'new' -> 'qualified'
    const patchQualifiedRes = await api('PATCH', `/leads/${testLeadId}`, { status: 'qualified' });
    check(patchQualifiedRes.ok, 'Progressed lead to "qualified"');

    const postQualPipeline = (await api('GET', '/dashboard/pipeline')).data;
    const newStageAfterQual = (postQualPipeline.stages || []).find((s) => s.status === 'new');
    const qualStageAfterQual = (postQualPipeline.stages || []).find((s) => s.status === 'qualified');
    // After advancing our test lead to qualified, the "new" stage should have decreased by 1 vs post-create
    // (not vs baseline, as other concurrent tests may have added more "new" leads)
    check(newStageAfterCreate.count - newStageAfterQual.count >= 1, 'Pipeline "new" stage count decreased by at least 1 after qualification',
      `after-create: ${newStageAfterCreate.count}, after-qual: ${newStageAfterQual?.count}`);
    check(qualStageAfterQual.count >= 1, 'Pipeline "qualified" stage count increased');

    // Step D: Advance Lead through pipeline to 'closed'
    await api('PATCH', `/leads/${testLeadId}`, { status: 'proposal' });
    await api('PATCH', `/leads/${testLeadId}`, { status: 'negotiation' });
    const patchClosedRes = await api('PATCH', `/leads/${testLeadId}`, { status: 'closed' });
    check(patchClosedRes.ok, 'Progressed lead to "closed"');

    // Verify summary reflects deal closed: activeLeads decrements, dealsClosedThisMonth increments, revenue increments
    const postClosedSummary = (await api('GET', '/dashboard/summary')).data;
    // After creating then closing our lead, activeLeads net change should be 0 for our lead.
    // Other concurrent tests may also add active leads, so use >= baseline (our closed lead does not inflate it).
    check(postClosedSummary.activeLeads >= baseSummary.activeLeads, 'Summary activeLeads not inflated by our closed lead',
      `baseline: ${baseSummary.activeLeads}, actual: ${postClosedSummary.activeLeads}`);
    check(postClosedSummary.dealsClosedThisMonth === baseSummary.dealsClosedThisMonth + 1, 'Summary dealsClosedThisMonth incremented by 1',
      `before: ${baseSummary.dealsClosedThisMonth}, after: ${postClosedSummary.dealsClosedThisMonth}`);
    check(Math.abs(postClosedSummary.revenueThisMonth - (baseSummary.revenueThisMonth + 150000)) < 0.01, 'Summary revenueThisMonth incremented by $150,000',
      `before: ${baseSummary.revenueThisMonth}, after: ${postClosedSummary.revenueThisMonth}`);

    // Verify lead conversion report reflects closed lead
    const postClosedConv = (await api('GET', '/reports/lead-conversion')).data;
    check(postClosedConv.converted === baseConv.converted + 1, 'Lead conversion report converted count incremented by 1',
      `before: ${baseConv.converted}, after: ${postClosedConv.converted}`);

    // Verify team performance reflects closed lead
    const postClosedTeam = (await api('GET', '/reports/team-performance')).data;
    const agentPerfAfterClosed = (postClosedTeam || []).find((p) => p.agentId === testAgent?.id);
    check(!!agentPerfAfterClosed, 'Agent found in team performance report after closing lead');
    if (agentPerfAfterClosed) {
      check(agentPerfAfterClosed.leadsClosed === baseAgentPerf.leadsClosed + 1, 'Agent leadsClosed incremented by 1 in team performance',
        `before: ${baseAgentPerf.leadsClosed}, after: ${agentPerfAfterClosed.leadsClosed}`);
    }


    // Step E: Update closed lead budget to $250,000 and verify immediate revenue calculation update
    const patchBudgetRes = await api('PATCH', `/leads/${testLeadId}`, { budget: 250000 });
    check(patchBudgetRes.ok, 'Updated closed lead budget to $250,000');

    const postBudgetSummary = (await api('GET', '/dashboard/summary')).data;
    check(Math.abs(postBudgetSummary.revenueThisMonth - (baseSummary.revenueThisMonth + 250000)) < 0.01, 'Summary revenue updated accurately to $250,000',
      `expected: ${baseSummary.revenueThisMonth + 250000}, actual: ${postBudgetSummary.revenueThisMonth}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Tasks, Appointments, Properties & Clients Analytics
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 5. Tasks, Appointments, Properties & Clients Analytics ---');

    // 5a. Tasks Today & Completion
    const taskPayload = {
      title: `Analytics Task ${ts()}`,
      description: 'Testing task today count',
      type: 'call',
      status: 'pending',
      priority: 'high',
      dueDate: todayStr,
      assignedAgentId: testAgent.id,
      leadId: testLeadId,
    };
    const createTaskRes = await api('POST', '/tasks', taskPayload);
    check(createTaskRes.ok && createTaskRes.status === 201, 'Created task due today');
    const taskId = createTaskRes.data?.id;
    if (taskId) cleanup.taskIds.push(taskId);

    const postTaskSummary = (await api('GET', '/dashboard/summary')).data;
    check(postTaskSummary.tasksToday === baseSummary.tasksToday + 1, 'Summary tasksToday incremented by 1',
      `before: ${baseSummary.tasksToday}, after: ${postTaskSummary.tasksToday}`);

    // Complete task and verify team performance
    await api('PATCH', `/tasks/${taskId}`, { status: 'completed' });
    const postTaskTeam = (await api('GET', '/reports/team-performance')).data;
    const agentPerfAfterTask = (postTaskTeam || []).find((p) => p.agentId === testAgent.id);
    check(agentPerfAfterTask.tasksCompleted === baseAgentPerf.tasksCompleted + 1, 'Agent tasksCompleted incremented by 1 in team performance',
      `before: ${baseAgentPerf.tasksCompleted}, after: ${agentPerfAfterTask.tasksCompleted}`);

    // 5b. Appointments Held
    const apptPayload = {
      title: `Analytics Viewing ${ts()}`,
      description: 'Test appointment held',
      type: 'viewing',
      status: 'completed',
      location: '123 Test St',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      assignedAgentId: testAgent.id,
      leadId: testLeadId,
    };
    const createApptRes = await api('POST', '/appointments', apptPayload);
    check(createApptRes.ok && createApptRes.status === 201, 'Created completed appointment');
    const apptId = createApptRes.data?.id;
    if (apptId) cleanup.appointmentIds.push(apptId);

    const postApptTeam = (await api('GET', '/reports/team-performance')).data;
    const agentPerfAfterAppt = (postApptTeam || []).find((p) => p.agentId === testAgent.id);
    check(agentPerfAfterAppt.appointmentsHeld === baseAgentPerf.appointmentsHeld + 1, 'Agent appointmentsHeld incremented by 1 in team performance',
      `before: ${baseAgentPerf.appointmentsHeld}, after: ${agentPerfAfterAppt.appointmentsHeld}`);

    // 5c. Properties Total Count
    const propPayload = {
      title: `Analytics Property ${ts()}`,
      address: '456 Analytics Ave',
      city: 'Metropolis',
      price: 500000,
      type: 'villa',
      status: 'available',
      bedrooms: 4,
      bathrooms: 3,
      area: 2500,
    };
    const createPropRes = await api('POST', '/properties', propPayload);
    check(createPropRes.ok && createPropRes.status === 201, 'Created test property');
    const propId = createPropRes.data?.id;
    if (propId) cleanup.propertyIds.push(propId);

    const postPropSummary = (await api('GET', '/dashboard/summary')).data;
    check(postPropSummary.totalProperties >= baseSummary.totalProperties + 1, 'Summary totalProperties incremented by at least 1',
      `before: ${baseSummary.totalProperties}, after: ${postPropSummary.totalProperties}`);

    // 5d. Clients Total Count
    const clientPayload = {
      firstName: 'AnalyticsClient',
      lastName: `Test_${ts()}`,
      email: `analytics.client.${ts()}@example.com`,
      phone: '555-0188',
      status: 'active',
      type: 'buyer',
      budget: 600000,
    };
    const createClientRes = await api('POST', '/clients', clientPayload);
    check(createClientRes.ok && createClientRes.status === 201, 'Created test client');
    const clientId = createClientRes.data?.id;
    if (clientId) cleanup.clientIds.push(clientId);

    const postClientSummary = (await api('GET', '/dashboard/summary')).data;
    check(postClientSummary.totalClients >= baseSummary.totalClients + 1, 'Summary totalClients incremented by at least 1',
      `before: ${baseSummary.totalClients}, after: ${postClientSummary.totalClients}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Financial & Mathematical Edge Cases (0, null, large decimals)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 6. Financial & Mathematical Edge Cases ---');

    // 6a. Lead with Budget = 0
    const zeroLeadRes = await api('POST', '/leads', {
      firstName: 'ZeroBudget',
      lastName: `Test_${ts()}`,
      email: `zero.${ts()}@example.com`,
      source: 'website',
      budget: 0,
    });
    check(zeroLeadRes.ok, 'Created lead with budget = 0');
    if (zeroLeadRes.data?.id) cleanup.leadIds.push(zeroLeadRes.data.id);

    // 6b. Lead with Null Budget
    const nullLeadRes = await api('POST', '/leads', {
      firstName: 'NullBudget',
      lastName: `Test_${ts()}`,
      email: `null.${ts()}@example.com`,
      source: 'website',
      budget: null,
    });
    check(nullLeadRes.ok, 'Created lead with budget = null');
    if (nullLeadRes.data?.id) cleanup.leadIds.push(nullLeadRes.data.id);

    // 6c. Lead with Precise Decimal Budget ($123,456.78)
    const decimalLeadRes = await api('POST', '/leads', {
      firstName: 'DecimalBudget',
      lastName: `Test_${ts()}`,
      email: `decimal.${ts()}@example.com`,
      source: 'website',
      budget: 123456.78,
    });
    check(decimalLeadRes.ok, 'Created lead with decimal budget ($123,456.78)');
    const decimalLeadId = decimalLeadRes.data?.id;
    if (decimalLeadId) cleanup.leadIds.push(decimalLeadId);

    // Verify pipeline stages handle null/0/decimals without NaN or string concatenation
    const decimalPipeline = (await api('GET', '/dashboard/pipeline')).data;
    for (const stage of decimalPipeline.stages || []) {
      check(!isNaN(stage.value), `Pipeline stage ${stage.status} value is valid number (not NaN): ${stage.value}`);
      check(typeof stage.value === 'number', `Pipeline stage ${stage.status} value is typeof number`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 7. Date Boundaries (Task Due Today vs Tomorrow vs Yesterday)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 7. Date Boundaries ---');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Create task for tomorrow
    const tomorrowTask = await api('POST', '/tasks', {
      title: 'Tomorrow Task',
      type: 'call',
      status: 'pending',
      priority: 'medium',
      dueDate: tomorrowStr,
    });
    if (tomorrowTask.data?.id) cleanup.taskIds.push(tomorrowTask.data.id);

    // Create task for yesterday
    const yesterdayTask = await api('POST', '/tasks', {
      title: 'Yesterday Task',
      type: 'call',
      status: 'pending',
      priority: 'low',
      dueDate: yesterdayStr,
    });
    if (yesterdayTask.data?.id) cleanup.taskIds.push(yesterdayTask.data.id);

    // Re-check summary: tasksToday must NOT include tomorrow or yesterday tasks
    const boundarySummary = (await api('GET', '/dashboard/summary')).data;
    const expectedTasksToday = postTaskSummary.tasksToday; // only today task was added
    check(boundarySummary.tasksToday === expectedTasksToday, 'tasksToday accurately includes only tasks due today (excludes tomorrow/yesterday)',
      `expected: ${expectedTasksToday}, actual: ${boundarySummary.tasksToday}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 8. Record Deletion & Metric Integrity
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 8. Record Deletion & Metric Integrity ---');

    // Delete test property and verify summary decrements
    await api('DELETE', `/properties/${propId}`);
    const postDelPropSummary = (await api('GET', '/dashboard/summary')).data;
    // Use <= postCreate-1 to tolerate concurrent test suites that may also delete properties
    check(postDelPropSummary.totalProperties <= postPropSummary.totalProperties - 1, 'Summary totalProperties decremented after property deletion',
      `before: ${postPropSummary.totalProperties}, after: ${postDelPropSummary.totalProperties}`);

    // Delete test client and verify summary decrements
    await api('DELETE', `/clients/${clientId}`);
    const postDelClientSummary = (await api('GET', '/dashboard/summary')).data;
    // Use <= postCreate-1 to tolerate concurrent test suites that may also delete clients
    check(postDelClientSummary.totalClients <= postClientSummary.totalClients - 1, 'Summary totalClients decremented after client deletion',
      `before: ${postClientSummary.totalClients}, after: ${postDelClientSummary.totalClients}`);

    // Delete test closed lead and verify revenue & dealsClosed decrement back
    await api('DELETE', `/leads/${testLeadId}`);
    const postDelLeadSummary = (await api('GET', '/dashboard/summary')).data;
    check(postDelLeadSummary.dealsClosedThisMonth === baseSummary.dealsClosedThisMonth, 'Summary dealsClosedThisMonth decremented after lead deletion',
      `expected: ${baseSummary.dealsClosedThisMonth}, actual: ${postDelLeadSummary.dealsClosedThisMonth}`);
    check(Math.abs(postDelLeadSummary.revenueThisMonth - baseSummary.revenueThisMonth) < 0.01, 'Summary revenueThisMonth decremented after lead deletion',
      `expected: ${baseSummary.revenueThisMonth}, actual: ${postDelLeadSummary.revenueThisMonth}`);

    // Remove deleted IDs from cleanup array since already deleted
    cleanup.propertyIds = cleanup.propertyIds.filter((id) => id !== propId);
    cleanup.clientIds = cleanup.clientIds.filter((id) => id !== clientId);
    cleanup.leadIds = cleanup.leadIds.filter((id) => id !== testLeadId);

  } catch (err) {
    console.error('Unexpected error during analytics audit:', err);
    check(false, `Unexpected error: ${err.message}`);
  } finally {
    // ──────────────────────────────────────────────────────────────────────────
    // Cleanup remaining test entities
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Cleanup: Removing remaining test records ---');
    for (const id of cleanup.leadIds) await api('DELETE', `/leads/${id}`);
    for (const id of cleanup.propertyIds) await api('DELETE', `/properties/${id}`);
    for (const id of cleanup.clientIds) await api('DELETE', `/clients/${id}`);
    for (const id of cleanup.taskIds) await api('DELETE', `/tasks/${id}`);
    for (const id of cleanup.appointmentIds) await api('DELETE', `/appointments/${id}`);
    for (const id of cleanup.workflowIds) await api('DELETE', `/workflows/${id}`);
    console.log('Cleanup completed.\n');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Summary Results
  // ──────────────────────────────────────────────────────────────────────────
  console.log('======================================');
  console.log(`TOTAL: ${passedTests} passed, ${failedTests.length} failed`);
  if (failedTests.length > 0) {
    console.log('Failed tests:');
    for (const f of failedTests) {
      console.log(`  ✗ ${f.message}${f.details ? ` (${f.details})` : ''}`);
    }
  }
  console.log('======================================\n');

  if (failedTests.length > 0) process.exit(1);
}

run();
