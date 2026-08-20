/**
 * E2E Security & Reliability Audit Suite
 * 
 * Comprehensive automated verification of:
 * 1. HTTP Security Headers (nosniff, frame-options, referrer-policy, xss-protection, no x-powered-by)
 * 2. Payload Parsing & Memory Protection (Malformed JSON 400, Oversized payload 413)
 * 3. Parameter Validation & Boundary Guarding (Non-numeric IDs, Negative IDs, Non-existent IDs)
 * 4. SQL Injection & Special Character Resilience in Queries and Filters
 * 5. XSS Payload Storage and Sanitization Safety
 * 6. Global JSON 404 & Error Handler (No stack traces or driver errors leaked)
 * 7. Business Logic Authorization & Pipeline Integrity Protection
 * 8. Concurrent Load & Request Throttling Safety
 * 9. Production Health Endpoint Availability
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

async function api(method, endpoint, body, customHeaders = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...customHeaders };
  const opts = { method, headers };
  if (body !== undefined) {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

async function run() {
  console.log('=== Production Security & Reliability Audit ===\n');

  const cleanup = {
    leadIds: [],
    propertyIds: [],
    taskIds: [],
    clientIds: [],
    workflowIds: [],
  };

  try {
    // -------------------------------------------------------------
    // 1. HTTP Security Headers
    // -------------------------------------------------------------
    console.log('--- 1. HTTP Security Headers ---');
    const healthRes = await api('GET', '/healthz');
    check(healthRes.status === 200, 'GET /api/healthz returns 200');
    check(healthRes.data?.status === 'ok', 'Health response is { status: "ok" }');

    const headers = healthRes.headers;
    check(headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options is "nosniff"');
    check(headers.get('x-frame-options') === 'SAMEORIGIN', 'X-Frame-Options is "SAMEORIGIN"');
    check(headers.get('x-xss-protection') === '1; mode=block', 'X-XSS-Protection is "1; mode=block"');
    check(headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Referrer-Policy is configured');
    check(!headers.get('x-powered-by'), 'X-Powered-By header is removed / suppressed');

    // -------------------------------------------------------------
    // 2. Payload Parsing & Memory / DoS Protection
    // -------------------------------------------------------------
    console.log('\n--- 2. Payload Parsing & Body Limits ---');

    // 2a. Malformed JSON Body
    const malformedRes = await fetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ "firstName": "Invalid", "lastName": ', // syntax error
    });
    const malformedData = await malformedRes.json().catch(() => null);
    check(malformedRes.status === 400, 'Malformed JSON returns HTTP 400');
    check(malformedData?.error === 'Invalid JSON in request body', 'Malformed JSON returns clean error message without stack traces');

    // 2b. Oversized Payload (>1MB protection)
    const largeString = 'A'.repeat(1.5 * 1024 * 1024); // 1.5MB
    const oversizedRes = await fetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Big', lastName: 'Payload', notes: largeString }),
    });
    check(oversizedRes.status === 413, 'Oversized payload (>1MB) rejected with HTTP 413');

    // -------------------------------------------------------------
    // 3. Route Parameter Validation & Boundary Guarding
    // -------------------------------------------------------------
    console.log('\n--- 3. Parameter Validation & Route Boundary Guarding ---');

    // 3a. Non-numeric ID validation
    const nonNumericLead = await api('GET', '/leads/not-a-number');
    check(nonNumericLead.status === 400, 'GET /leads/not-a-number returns 400');
    check(!!nonNumericLead.data?.error, 'Non-numeric lead ID returns validation error');

    const nonNumericProp = await api('GET', '/properties/invalid-id');
    check(nonNumericProp.status === 400, 'GET /properties/invalid-id returns 400');

    const nonNumericTask = await api('GET', '/tasks/abc');
    check(nonNumericTask.status === 400, 'GET /tasks/abc returns 400');

    // 3b. Negative / Zero ID handling
    const negLead = await api('GET', '/leads/-999');
    check(negLead.status === 400 || negLead.status === 404, 'Negative lead ID rejected safely (400/404)');

    // 3c. Non-existent ID handling
    const nonExistentLead = await api('GET', '/leads/999999999');
    check(nonExistentLead.status === 404, 'Non-existent lead ID returns 404');
    check(nonExistentLead.data?.error === 'Lead not found', 'Non-existent lead returns clean JSON error (no stack trace)');

    const nonExistentProp = await api('GET', '/properties/999999999');
    check(nonExistentProp.status === 404, 'Non-existent property ID returns 404');

    const nonExistentTask = await api('GET', '/tasks/999999999');
    check(nonExistentTask.status === 404, 'Non-existent task ID returns 404');

    // -------------------------------------------------------------
    // 4. SQL Injection Resilience
    // -------------------------------------------------------------
    console.log('\n--- 4. SQL Injection & Special Character Resilience ---');

    const sqliQueries = [
      "' OR '1'='1",
      "'; DROP TABLE leads; --",
      "1; SELECT * FROM users;",
      "' UNION SELECT NULL, NULL, NULL--",
      "\" OR 1=1 --",
    ];

    for (const sqli of sqliQueries) {
      const sqliLeadRes = await api('GET', `/leads?status=${encodeURIComponent(sqli)}`);
      check(sqliLeadRes.status === 400 || sqliLeadRes.status === 200, `SQL injection in status filter handled safely: ${sqli}`);
      if (sqliLeadRes.status === 200) {
        check(Array.isArray(sqliLeadRes.data), 'Query returned safe array without database error or bypass');
      }

      const sqliPropRes = await api('GET', `/properties?type=${encodeURIComponent(sqli)}`);
      check(sqliPropRes.status === 400 || sqliPropRes.status === 200, `SQL injection in property type filter handled safely: ${sqli}`);
    }

    // -------------------------------------------------------------
    // 5. XSS Payload Storage & Sanitization Safety
    // -------------------------------------------------------------
    console.log('\n--- 5. XSS Payload Handling ---');

    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert(1)>',
      'javascript:alert(1)',
      '"><svg onload=alert(1)>',
    ];

    for (let i = 0; i < xssPayloads.length; i++) {
      const xss = xssPayloads[i];
      const createRes = await api('POST', '/leads', {
        firstName: `XSS_${i}`,
        lastName: xss,
        email: `xss.${Date.now()}.${i}@example.com`,
        source: 'website',
        notes: xss,
      });

      check(createRes.status === 201, `Lead with XSS payload created safely: ${xss.substring(0, 20)}...`);
      if (createRes.data?.id) {
        cleanup.leadIds.push(createRes.data.id);
        const fetched = await api('GET', `/leads/${createRes.data.id}`);
        check(fetched.status === 200, 'Fetched lead with XSS string correctly');
        check(fetched.data?.notes === xss, 'XSS string preserved literally (no server-side evaluation or crash)');
      }
    }

    // -------------------------------------------------------------
    // 6. Global JSON 404 & Error Handler
    // -------------------------------------------------------------
    console.log('\n--- 6. Global 404 & Error Response Uniformity ---');

    const notFoundRoutes = [
      '/api/non-existent-route',
      '/api/leads/999/unknown-subroute',
      '/api/v2/unsupported',
      '/unknown-path',
    ];

    for (const route of notFoundRoutes) {
      const res = await fetch(`http://localhost:3000${route}`);
      const data = await res.json().catch(() => null);
      check(res.status === 404, `Unmatched route ${route} returns HTTP 404`);
      check(data?.error === 'Not Found', `Unmatched route ${route} returns structured JSON { error: "Not Found" }`);
    }

    // -------------------------------------------------------------
    // 7. Business Logic Authorization & Pipeline Integrity
    // -------------------------------------------------------------
    console.log('\n--- 7. Business Logic Authorization & State Protections ---');

    // 7a. Lead Pipeline Forward-Only Guard
    const leadRes = await api('POST', '/leads', {
      firstName: 'Pipeline',
      lastName: `Guard_${Date.now()}`,
      email: `pipeline.guard.${Date.now()}@test.com`,
      source: 'website',
    });
    const leadId = leadRes.data?.id;
    if (leadId) cleanup.leadIds.push(leadId);

    // Advance to proposal
    await api('PATCH', `/leads/${leadId}`, { status: 'proposal' });

    // Attempt invalid downgrade to contacted
    const downgradeRes = await api('PATCH', `/leads/${leadId}`, { status: 'contacted' });
    check(downgradeRes.status === 400, 'Attempting to move pipeline backwards rejected with 400');
    check(downgradeRes.data?.error === 'Cannot move pipeline backwards', 'Clean error: Cannot move pipeline backwards');

    // 7b. Double Conversion Protection
    const conv1 = await api('POST', `/leads/${leadId}/convert`);
    check(conv1.status === 200, 'First conversion to client succeeds');
    if (conv1.data?.clientId) cleanup.clientIds.push(conv1.data.clientId);

    const conv2 = await api('POST', `/leads/${leadId}/convert`);
    check(conv2.status === 400, 'Second conversion attempt blocked with 400');
    check(conv2.data?.error === 'Lead is already converted', 'Error: Lead is already converted');

    // -------------------------------------------------------------
    // 8. Concurrent Load & Deadlock Resilience
    // -------------------------------------------------------------
    console.log('\n--- 8. Concurrent Load & Deadlock Resilience ---');

    // Fire 20 concurrent parallel requests across multiple endpoints
    const concurrentRequests = [];
    for (let i = 0; i < 20; i++) {
      if (i % 4 === 0) concurrentRequests.push(api('GET', '/dashboard/summary'));
      else if (i % 4 === 1) concurrentRequests.push(api('GET', '/leads'));
      else if (i % 4 === 2) concurrentRequests.push(api('GET', '/properties'));
      else concurrentRequests.push(api('GET', '/tasks'));
    }

    const concurrentResults = await Promise.all(concurrentRequests);
    const allSuccessful = concurrentResults.every((r) => r.status === 200);
    check(allSuccessful, '20 simultaneous concurrent queries executed without errors or connection exhaustion');

  } catch (err) {
    console.error('Unexpected error during security audit:', err);
    check(false, `Unexpected error: ${err.message}`);
  } finally {
    // Cleanup
    console.log('\n--- Cleanup: Removing test records ---');
    for (const lid of cleanup.leadIds) {
      await api('DELETE', `/leads/${lid}`);
    }
    for (const cid of cleanup.clientIds) {
      await api('DELETE', `/clients/${cid}`);
    }
    for (const pid of cleanup.propertyIds) {
      await api('DELETE', `/properties/${pid}`);
    }
    for (const tid of cleanup.taskIds) {
      await api('DELETE', `/tasks/${tid}`);
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
