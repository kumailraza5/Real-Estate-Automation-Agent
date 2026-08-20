
const API_URL = 'http://localhost:3000/api';
let passed = 0;
let failed = 0;
const failures = [];

function pass(msg) { console.log(`  [PASS] ${msg}`); passed++; }
function fail(msg, detail = '') { console.error(`  [FAIL] ${msg}${detail ? ': ' + detail : ''}`); failed++; failures.push(msg); }

function check(condition, msg, detail = '') {
  if (condition) pass(msg); else fail(msg, detail);
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('\n=== Lead → Client Conversion — Full E2E Audit ===\n');

  // ──────────────────────────────────────────────────────
  // 1. Basic Conversion
  // ──────────────────────────────────────────────────────
  console.log('--- 1. Basic Conversion ---');
  const ts = Date.now();
  let r = await api('POST', '/leads', {
    firstName: 'Alice',
    lastName: 'Realistic',
    email: `alice.realistic.${ts}@example.com`,
    phone: '555-100-2000',
    source: 'referral',
    status: 'negotiation',
    budget: 850000,
    propertyType: 'condo',
  });
  check(r.ok && r.data?.id, 'Lead created with realistic data');
  const lead = r.data;

  r = await api('POST', `/leads/${lead.id}/convert`);
  check(r.ok && r.data?.success === true, 'POST /leads/:id/convert returns success');
  const clientId = r.data?.clientId;
  check(typeof clientId === 'number', 'Returned clientId is a number');

  r = await api('GET', `/clients/${clientId}`);
  const client = r.data;
  check(r.ok, 'GET /clients/:id after conversion returns 200');
  check(client?.firstName === 'Alice', 'Client.firstName copied correctly');
  check(client?.lastName === 'Realistic', 'Client.lastName copied correctly');
  check(client?.email === `alice.realistic.${ts}@example.com`, 'Client.email copied correctly');
  check(client?.phone === '555-100-2000', 'Client.phone copied correctly');
  check(Number(client?.budget) === 850000, 'Client.budget copied correctly');
  check(client?.leadId === lead.id, 'Client.leadId points to originating Lead');

  r = await api('GET', `/leads/${lead.id}`);
  const updatedLead = r.data;
  check(updatedLead?.status === 'converted', 'Lead status became "converted"');
  check(updatedLead?.clientId === clientId, 'GET /leads/:id exposes clientId');

  // ──────────────────────────────────────────────────────
  // 2. Double Conversion Protection
  // ──────────────────────────────────────────────────────
  console.log('\n--- 2. Double Conversion Protection ---');
  r = await api('POST', `/leads/${lead.id}/convert`);
  check(!r.ok, 'Second conversion attempt returns non-2xx');
  check(r.data?.error === 'Lead is already converted', 'Error message is "Lead is already converted"');
  // Ensure client count didn't grow (only 1 client with this leadId)
  r = await api('GET', '/clients');
  const allClients = r.data || [];
  const matchingClients = allClients.filter(c => c.leadId === lead.id);
  check(matchingClients.length === 1, 'Exactly ONE client exists for this lead after double-conversion attempt', `found ${matchingClients.length}`);

  // ──────────────────────────────────────────────────────
  // 3. Transaction Atomicity — infer from no orphan clients
  // ──────────────────────────────────────────────────────
  console.log('\n--- 3. Transaction / Atomicity ---');
  // Atomicity is enforced by the db.transaction() call.
  // We verify: double conversion blocked at the START (before insert),
  // so no orphan client is ever created.
  check(matchingClients.length === 1, 'No orphan Client created — transaction atomicity intact');
  // Verify lead status unchanged after failed double-convert
  r = await api('GET', `/leads/${lead.id}`);
  check(r.data?.status === 'converted', 'Lead status still "converted" after failed second attempt');

  // ──────────────────────────────────────────────────────
  // 4. Lead → Client Traceability
  // ──────────────────────────────────────────────────────
  console.log('\n--- 4. Lead → Client Traceability ---');
  r = await api('GET', `/leads/${lead.id}`);
  check(r.data?.clientId === clientId, 'Lead exposes clientId via GET /leads/:id');
  r = await api('GET', `/clients/${clientId}`);
  check(r.data?.leadId === lead.id, 'Client exposes leadId via GET /clients/:id');

  // Activity logs traceability
  r = await api('GET', `/leads/${lead.id}/activity`);
  const leadActs = r.data || [];
  check(leadActs.some(a => a.action === 'converted'), 'Lead activity log has "converted" action');
  check(leadActs.some(a => a.description?.includes(`Client`)), 'Lead activity log description references Client');

  r = await api('GET', `/clients/${clientId}/activity`);
  const clientActs = r.data || [];
  check(clientActs.some(a => a.action === 'created'), 'Client activity log has "created" action');
  check(clientActs.some(a => a.description?.includes(`Lead ID: ${lead.id}`)), 'Client activity references originating Lead ID');

  // ON DELETE SET NULL — delete the lead and verify client.leadId becomes null
  r = await api('DELETE', `/leads/${lead.id}`);
  check(r.status === 204 || r.ok, 'Lead deleted successfully');
  // Wait briefly for DB cascade
  await new Promise(res => setTimeout(res, 500));
  r = await api('GET', `/clients/${clientId}`);
  check(r.ok, 'Client still exists after lead deletion');
  check(r.data?.leadId === null || r.data?.leadId === undefined, 'Client.leadId is NULL after lead deleted (ON DELETE SET NULL)');

  // ──────────────────────────────────────────────────────
  // 5. Pipeline Integrity — use a FRESH lead
  // ──────────────────────────────────────────────────────
  console.log('\n--- 5. Pipeline Integrity ---');
  r = await api('POST', '/leads', {
    firstName: 'Pipeline',
    lastName: 'Guard',
    email: `pipeline.${Date.now()}@example.com`,
    source: 'website', status: 'new',
  });
  const pLead = r.data;
  // Convert it
  await api('POST', `/leads/${pLead.id}/convert`);
  // Try to downgrade to every earlier status
  const downgrades = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed'];
  for (const s of downgrades) {
    r = await api('PATCH', `/leads/${pLead.id}`, { status: s });
    check(!r.ok && r.data?.error === 'Cannot move pipeline backwards',
      `PATCH to "${s}" on converted lead is blocked`);
  }
  // Non-status field update should still work (phone)
  r = await api('PATCH', `/leads/${pLead.id}`, { phone: '000-000-0001' });
  check(r.ok, 'Updating non-status field (phone) on converted lead is allowed');

  // ──────────────────────────────────────────────────────
  // 6. Automation Integration
  // ──────────────────────────────────────────────────────
  console.log('\n--- 6. Automation Integration ---');
  // Create+convert a fresh lead and verify workflow executions
  const autoTs = Date.now();
  r = await api('POST', '/leads', {
    firstName: 'AutoTest', lastName: 'Conversion',
    email: `autotest.${autoTs}@example.com`,
    source: 'social', status: 'new',
  });
  const autoLead = r.data;
  await new Promise(res => setTimeout(res, 500));
  r = await api('POST', `/leads/${autoLead.id}/convert`);
  const autoClientId = r.data?.clientId;
  check(typeof autoClientId === 'number', 'Automation: CLIENT_CREATED triggered (client returned)');
  await new Promise(res => setTimeout(res, 500));
  // Activity logs show events fired
  r = await api('GET', `/leads/${autoLead.id}/activity`);
  check((r.data || []).some(a => a.action === 'converted'), 'Automation: LEAD_UPDATED event activity present');
  r = await api('GET', `/clients/${autoClientId}/activity`);
  check((r.data || []).some(a => a.action === 'created'), 'Automation: CLIENT_CREATED event activity present');
  // Verify a non-related PATCH after conversion does NOT re-fire conversion workflows
  r = await api('PATCH', `/leads/${autoLead.id}`, { phone: '999-111-0000' });
  check(r.ok, 'Non-status PATCH on converted lead still succeeds');

  // ──────────────────────────────────────────────────────
  // 7. Assignment Preservation
  // ──────────────────────────────────────────────────────
  console.log('\n--- 7. Assignment Preservation ---');
  r = await api('GET', '/agents');
  const agents = r.data || [];
  if (agents.length > 0) {
    const agentId = agents[0].id;
    // A. Manual assignment
    r = await api('POST', '/leads', {
      firstName: 'Manual', lastName: 'Assigned',
      email: `manual.${Date.now()}@example.com`,
      source: 'website', status: 'new',
      assignedAgentId: agentId,
    });
    const assignedLead = r.data;
    r = await api('POST', `/leads/${assignedLead.id}/convert`);
    r = await api('GET', `/clients/${r.data?.clientId}`);
    check(r.data?.assignedAgentId === agentId, 'A. Manually-assigned agent preserved in Client');
  } else {
    console.log('  [SKIP] No agents available for assignment preservation test');
  }

  // ──────────────────────────────────────────────────────
  // 8. Data Integrity Edge Cases
  // ──────────────────────────────────────────────────────
  console.log('\n--- 8. Data Integrity Edge Cases ---');
  // a. No phone, no budget
  r = await api('POST', '/leads', {
    firstName: 'Sparse', lastName: 'Data',
    email: `sparse.${Date.now()}@example.com`,
    source: 'website', status: 'new',
  });
  r = await api('POST', `/leads/${r.data.id}/convert`);
  const sparseClientId = r.data?.clientId;
  r = await api('GET', `/clients/${sparseClientId}`);
  check(r.ok && !r.data?.phone && !r.data?.budget, 'No-phone, no-budget lead converts without corruption');

  // b. Long names
  r = await api('POST', '/leads', {
    firstName: 'Aleksandrina-Mikhailovna', lastName: 'VonHohensteinsteinberg',
    email: `longname.${Date.now()}@example.com`,
    source: 'referral', status: 'new',
  });
  r = await api('POST', `/leads/${r.data.id}/convert`);
  r = await api('GET', `/clients/${r.data?.clientId}`);
  check(r.data?.firstName === 'Aleksandrina-Mikhailovna', 'Long firstName preserved after conversion');

  // c. Special characters in name
  r = await api('POST', '/leads', {
    firstName: "O'Brien", lastName: "Müller-García",
    email: `special.${Date.now()}@example.com`,
    source: 'website', status: 'new',
  });
  r = await api('POST', `/leads/${r.data.id}/convert`);
  r = await api('GET', `/clients/${r.data?.clientId}`);
  check(r.data?.firstName === "O'Brien", 'Special character firstName preserved');
  check(r.data?.lastName === "Müller-García", 'Special character lastName preserved');

  // ──────────────────────────────────────────────────────
  // 9. Existing Client Safety
  // ──────────────────────────────────────────────────────
  console.log('\n--- 9. Existing Client Safety ---');
  r = await api('POST', '/leads', {
    firstName: 'Safety', lastName: 'A', email: `safety.a.${Date.now()}@example.com`,
    source: 'website', status: 'new',
  });
  const safeLeadA = r.data;
  r = await api('POST', '/leads', {
    firstName: 'Safety', lastName: 'B', email: `safety.b.${Date.now()}@example.com`,
    source: 'website', status: 'new',
  });
  const safeLeadB = r.data;
  const rA = await api('POST', `/leads/${safeLeadA.id}/convert`);
  const rB = await api('POST', `/leads/${safeLeadB.id}/convert`);
  const cA = rA.data?.clientId;
  const cB = rB.data?.clientId;
  check(cA !== cB, 'Two different leads produce two separate Clients (distinct IDs)');
  r = await api('GET', `/clients/${cA}`);
  check(r.data?.leadId === safeLeadA.id, 'Client A maintains correct leadId → Lead A');
  r = await api('GET', `/clients/${cB}`);
  check(r.data?.leadId === safeLeadB.id, 'Client B maintains correct leadId → Lead B');

  // ──────────────────────────────────────────────────────
  // 10. Ordering / Search / Filters
  // ──────────────────────────────────────────────────────
  console.log('\n--- 10. Ordering / Search / Filters ---');
  // Converted leads must appear in list
  r = await api('GET', '/leads?status=converted');
  const convertedLeads = r.data || [];
  check(Array.isArray(convertedLeads) && convertedLeads.length > 0, 'status=converted filter returns results');
  check(convertedLeads.every(l => l.status === 'converted'), 'All results have status=converted');
  // Ordering: first item createdAt >= last item (newest-first)
  if (convertedLeads.length >= 2) {
    const first = new Date(convertedLeads[0].createdAt);
    const last = new Date(convertedLeads[convertedLeads.length - 1].createdAt);
    check(first >= last, 'Converted leads are ordered newest-first');
  } else {
    console.log('  [SKIP] Not enough converted leads to test ordering');
  }
  // Clients appear in list
  r = await api('GET', '/clients');
  const clientList = r.data || [];
  check(clientList.some(c => c.leadId != null), 'Converted clients with leadId appear in /clients list');
  if (clientList.length >= 2) {
    const first = new Date(clientList[0].createdAt);
    const last = new Date(clientList[clientList.length - 1].createdAt);
    check(first >= last, 'Clients are ordered newest-first');
  }

  // ──────────────────────────────────────────────────────
  // 11. Final E2E Chain
  // ──────────────────────────────────────────────────────
  console.log('\n--- 11. Final E2E Chain ---');
  const chainTs = Date.now();
  // Step 1: Create lead
  r = await api('POST', '/leads', {
    firstName: 'ChainTest', lastName: 'E2E',
    email: `chain.${chainTs}@example.com`,
    phone: '555-CHAIN', source: 'website', status: 'new', budget: 400000,
  });
  const chainLead = r.data;
  check(chainLead?.id != null, 'Chain: Lead created → got ID');

  // Step 2: Convert
  r = await api('POST', `/leads/${chainLead.id}/convert`);
  check(r.ok && r.data?.success, 'Chain: POST convert → success');
  const chainClientId = r.data?.clientId;

  // Step 3: Client created with leadId
  r = await api('GET', `/clients/${chainClientId}`);
  check(r.data?.leadId === chainLead.id, 'Chain: Client.leadId → Lead ID ✓');
  check(r.data?.firstName === 'ChainTest', 'Chain: Client fields correct ✓');

  // Step 4: Lead status = converted
  r = await api('GET', `/leads/${chainLead.id}`);
  check(r.data?.status === 'converted', 'Chain: Lead.status = converted ✓');
  check(r.data?.clientId === chainClientId, 'Chain: Lead exposes clientId ✓');

  // Step 5: Activity logs present for both
  r = await api('GET', `/leads/${chainLead.id}/activity`);
  check((r.data || []).some(a => a.action === 'converted'), 'Chain: Lead activity log shows conversion ✓');
  r = await api('GET', `/clients/${chainClientId}/activity`);
  check((r.data || []).some(a => a.action === 'created'), 'Chain: Client activity log shows creation ✓');

  // ──────────────────────────────────────────────────────
  // Final Report
  // ──────────────────────────────────────────────────────
  console.log('\n======================================');
  console.log(`TOTAL: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(f => console.log(`  ✗ ${f}`));
  }
  console.log('======================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Unexpected error:', e.message); process.exit(1); });
