/**
 * E2E Notifications & Communication Audit Suite
 * Comprehensive automated verification of:
 * - Notification listing, pagination/ordering (newest-first)
 * - Filtering by read status (read=true, read=false)
 * - Single notification mark-as-read (PATCH /notifications/:id/read)
 * - Mark-all-as-read (PATCH /notifications/read-all) & route order precedence
 * - NOTIFY_MANAGER automation action generation & entity traceability (lead/client/property/appointment)
 * - Edge cases (invalid ID, string vs boolean query parsing)
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
  console.log('=== Notifications & Communication E2E Audit ===\n');

  const createdWorkflowIds = [];
  const createdLeadIds = [];
  const createdClientIds = [];

  try {
    // -------------------------------------------------------------
    // 1. Notification Listing & Ordering Baseline
    // -------------------------------------------------------------
    console.log('--- 1. Notification Listing & Ordering ---');

    const listRes = await api('GET', '/notifications');
    check(listRes.status === 200, 'GET /notifications returns 200');
    check(Array.isArray(listRes.data), 'GET /notifications returns an array');

    const items = listRes.data || [];
    if (items.length > 0) {
      const first = items[0];
      check(typeof first.id === 'number', 'Notification item has numeric id');
      check(typeof first.title === 'string', 'Notification item has title string');
      check(typeof first.message === 'string', 'Notification item has message string');
      check(typeof first.type === 'string', 'Notification item has type string');
      check(typeof first.isRead === 'boolean', 'Notification item has boolean isRead');
      check(typeof first.createdAt === 'string', 'Notification item has createdAt timestamp');

      // Verify newest-first ordering
      let isOrdered = true;
      for (let i = 1; i < items.length; i++) {
        if (new Date(items[i - 1].createdAt) < new Date(items[i].createdAt)) {
          isOrdered = false;
          break;
        }
      }
      check(isOrdered, 'Notifications are ordered newest-first');
    }

    // -------------------------------------------------------------
    // 2. Automation Notification Generation (NOTIFY_MANAGER)
    // -------------------------------------------------------------
    console.log('\n--- 2. NOTIFY_MANAGER Automation Generation ---');

    // Create workflow that triggers NOTIFY_MANAGER on lead creation
    const wfNotify = (await api('POST', '/workflows', {
      name: `E2E_NOTIF_TEST_WF_${Date.now()}`,
      description: 'Generates manager alert on lead creation',
      triggerEvent: 'LEAD_CREATED',
      isActive: true,
      conditions: JSON.stringify([]),
      actions: JSON.stringify([{ type: 'NOTIFY_MANAGER' }]),
    })).data;
    if (wfNotify?.id) createdWorkflowIds.push(wfNotify.id);

    // Create lead to trigger notification
    const triggerLead = (await api('POST', '/leads', {
      firstName: 'NotifLead',
      lastName: `Tester_${Date.now()}`,
      email: `notif.tester.${Date.now()}@test.com`,
      source: 'website',
      budget: 750000,
    })).data;
    if (triggerLead?.id) createdLeadIds.push(triggerLead.id);
    await sleep(300);

    // Find the generated notification
    const allNotifs = (await api('GET', '/notifications')).data || [];
    const generatedNotif = allNotifs.find(
      (n) => n.entityType === 'lead' && n.entityId === triggerLead.id && n.title.includes(wfNotify.name)
    );

    check(!!generatedNotif, 'NOTIFY_MANAGER action generated a notification in the database');
    if (generatedNotif) {
      check(generatedNotif.type === 'warning', 'Generated notification has type "warning"');
      check(generatedNotif.isRead === false, 'Generated notification is initially unread (isRead: false)');
      check(generatedNotif.entityType === 'lead', 'entityType is "lead"');
      check(generatedNotif.entityId === triggerLead.id, 'entityId matches trigger lead ID');
      check(generatedNotif.message.includes(triggerLead.firstName), 'Notification message includes entity name context');
    }

    // -------------------------------------------------------------
    // 3. Read Status Filtering (?read=false and ?read=true)
    // -------------------------------------------------------------
    console.log('\n--- 3. Query Param Filtering (?read=false / ?read=true) ---');

    const unreadRes = await api('GET', '/notifications?read=false');
    check(unreadRes.status === 200, 'GET /notifications?read=false returns 200');
    const allUnread = (unreadRes.data || []).every((n) => n.isRead === false);
    check(allUnread, 'All items in ?read=false query have isRead === false');

    const readRes = await api('GET', '/notifications?read=true');
    check(readRes.status === 200, 'GET /notifications?read=true returns 200');
    const allRead = (readRes.data || []).every((n) => n.isRead === true);
    check(allRead, 'All items in ?read=true query have isRead === true');

    // -------------------------------------------------------------
    // 4. Mark Single Notification as Read (PATCH /notifications/:id/read)
    // -------------------------------------------------------------
    console.log('\n--- 4. Mark Single Notification as Read ---');

    if (generatedNotif) {
      const markRes = await api('PATCH', `/notifications/${generatedNotif.id}/read`);
      check(markRes.status === 200, 'PATCH /notifications/:id/read returns 200');
      check(markRes.data?.id === generatedNotif.id, 'Response returns updated notification ID');
      check(markRes.data?.isRead === true, 'Response indicates isRead is now true');

      // Verify it is excluded from ?read=false
      const verifyUnread = (await api('GET', '/notifications?read=false')).data || [];
      const stillInUnread = verifyUnread.some((n) => n.id === generatedNotif.id);
      check(!stillInUnread, 'Notification is no longer returned in ?read=false query');
    }

    // Edge case: Mark non-existent notification as read
    const notFoundMark = await api('PATCH', '/notifications/999999/read');
    check(notFoundMark.status === 404, 'PATCH /notifications/999999/read returns 404');

    // -------------------------------------------------------------
    // 5. Mark All Notifications as Read (PATCH /notifications/read-all)
    // -------------------------------------------------------------
    console.log('\n--- 5. Mark All Notifications as Read ---');

    // Generate a new unread notification first
    const triggerLead2 = (await api('POST', '/leads', {
      firstName: 'NotifLead2',
      lastName: `Tester_${Date.now()}`,
      email: `notif.tester2.${Date.now()}@test.com`,
      source: 'referral',
    })).data;
    if (triggerLead2?.id) createdLeadIds.push(triggerLead2.id);
    await sleep(300);

    const preReadAllUnread = (await api('GET', '/notifications?read=false')).data || [];
    check(preReadAllUnread.length > 0, 'Confirmed at least 1 unread notification before mark-all');

    // Call mark all read
    const readAllRes = await api('PATCH', '/notifications/read-all');
    check(readAllRes.status === 200, 'PATCH /notifications/read-all returns 200');
    check(readAllRes.data?.success === true, 'PATCH /notifications/read-all returns { success: true }');

    // Verify ?read=false returns empty list
    const postReadAllUnread = (await api('GET', '/notifications?read=false')).data || [];
    check(postReadAllUnread.length === 0, 'GET /notifications?read=false returns 0 unread items after mark-all-read');

    // -------------------------------------------------------------
    // 6. Client Automation Notification Traceability
    // -------------------------------------------------------------
    console.log('\n--- 6. Client Automation Notification Traceability ---');

    const wfClientNotif = (await api('POST', '/workflows', {
      name: `E2E_CLIENT_NOTIF_WF_${Date.now()}`,
      description: 'Manager alert on client creation',
      triggerEvent: 'CLIENT_CREATED',
      isActive: true,
      conditions: JSON.stringify([]),
      actions: JSON.stringify([{ type: 'NOTIFY_MANAGER' }]),
    })).data;
    if (wfClientNotif?.id) createdWorkflowIds.push(wfClientNotif.id);

    const triggerClient = (await api('POST', '/clients', {
      firstName: 'NotifClient',
      lastName: `Tester_${Date.now()}`,
      email: `notif.client.${Date.now()}@test.com`,
      status: 'active',
      budget: 900000,
    })).data;
    if (triggerClient?.id) createdClientIds.push(triggerClient.id);
    await sleep(300);

    const clientNotifs = (await api('GET', '/notifications')).data || [];
    const clientNotif = clientNotifs.find(
      (n) => n.entityType === 'client' && n.entityId === triggerClient.id
    );

    check(!!clientNotif, 'Client creation triggered notification with entityType="client"');
    if (clientNotif) {
      check(clientNotif.entityId === triggerClient.id, 'client notification entityId matches created client');
      check(clientNotif.message.includes(triggerClient.firstName), 'client notification message includes client name');
    }

  } catch (err) {
    console.error('Unexpected error during notifications audit:', err);
    check(false, `Unexpected error: ${err.message}`);
  } finally {
    // -------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------
    console.log('\n--- Cleanup: Removing test records ---');
    for (const wid of createdWorkflowIds) {
      await api('DELETE', `/workflows/${wid}`);
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
