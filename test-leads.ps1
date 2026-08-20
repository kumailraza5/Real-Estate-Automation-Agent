$ErrorActionPreference = "Continue"
$rnd = (New-Guid).ToString().Substring(0,8)
$base = "http://localhost:3000"
function hr($l) { Write-Host "`n====== $l ======" }
function pass($m) { Write-Host "PASS: $m" }
function fail($m) { Write-Host "FAIL: $m" }

hr "SETUP"
$wf1Body = '{"name":"AutoAssign '+$rnd+'","triggerEvent":"LEAD_CREATED","isActive":true,"conditions":"","actions":"[{\"type\":\"ASSIGN_AGENT\"}]"}'
$wf1 = Invoke-WebRequest "$base/api/workflows" -Method POST -ContentType "application/json" -Body $wf1Body | Select-Object -ExpandProperty Content | ConvertFrom-Json

$wf2Body = '{"name":"Status Qualify '+$rnd+'","triggerEvent":"LEAD_UPDATED","isActive":true,"conditions":"status == ''qualified''","actions":"[{\"type\":\"LOG_ACTIVITY\"}]"}'
$wf2 = Invoke-WebRequest "$base/api/workflows" -Method POST -ContentType "application/json" -Body $wf2Body | Select-Object -ExpandProperty Content | ConvertFrom-Json

$wf3Body = '{"name":"AutoAdvance '+$rnd+'","triggerEvent":"LEAD_CREATED","isActive":true,"conditions":"score >= 80","actions":"[{\"type\":\"UPDATE_CRM_STATUS\",\"params\":{\"status\":\"contacted\"}}]"}'
$wf3 = Invoke-WebRequest "$base/api/workflows" -Method POST -ContentType "application/json" -Body $wf3Body | Select-Object -ExpandProperty Content | ConvertFrom-Json

hr "TEST 1: Create lead & persist & LEAD_CREATED fires"
$l1Body = '{"firstName":"Aud","lastName":"'+$rnd+'","email":"aud_'+$rnd+'@test.com","phone":"555-0000","status":"new","budget":100000,"source":"website","score":50}'
$lead1 = Invoke-WebRequest "$base/api/leads" -Method POST -ContentType "application/json" -Body $l1Body | Select-Object -ExpandProperty Content | ConvertFrom-Json
if ($lead1.id) { pass "Lead created ID=$($lead1.id)" } else { fail "Failed to create lead" }

Start-Sleep -Seconds 1
$execs1 = Invoke-WebRequest "$base/api/workflow-executions" | Select-Object -ExpandProperty Content | ConvertFrom-Json
$wf1Execs = @($execs1 | Where-Object { $_.workflowId -eq $wf1.id -and $_.triggerEntityId -eq $lead1.id })
if ($wf1Execs.Count -eq 1) { pass "LEAD_CREATED fired exactly once." } else { fail "LEAD_CREATED fired $($wf1Execs.Count) times." }
if ($wf1Execs[0].triggerEntityName -match "Aud") { pass "Execution log shows human-readable name." } else { fail "Log missing human-readable name: $($wf1Execs[0].triggerEntityName)" }

hr "TEST 2: Invalid data handled"
try {
  $bad = Invoke-WebRequest "$base/api/leads" -Method POST -ContentType "application/json" -Body '{"lastName":"NoFirst"}' -ErrorAction Stop
  fail "Accepted missing firstName"
} catch {
  pass "Missing firstName returns 400."
}

hr "TEST 3: Automatic Assignment vs Manual Assignment"
$l1Fetch = Invoke-WebRequest "$base/api/leads/$($lead1.id)" | Select-Object -ExpandProperty Content | ConvertFrom-Json
if ($l1Fetch.assignedAgentId) { pass "Unassigned lead got auto-assigned (ID: $($l1Fetch.assignedAgentId))" } else { fail "Unassigned lead did not get auto-assigned." }

$agents = Invoke-WebRequest "$base/api/agents" | Select-Object -ExpandProperty Content | ConvertFrom-Json
$agent1 = $agents | Where-Object { $_.status -eq "active" } | Select-Object -First 1
$l2Body = '{"firstName":"ManAud","lastName":"'+$rnd+'","email":"man_'+$rnd+'@test.com","phone":"555","status":"new","source":"website","assignedAgentId":'+$agent1.id+'}'
$lead2 = Invoke-WebRequest "$base/api/leads" -Method POST -ContentType "application/json" -Body $l2Body | Select-Object -ExpandProperty Content | ConvertFrom-Json
Start-Sleep -Seconds 1
$l2Fetch = Invoke-WebRequest "$base/api/leads/$($lead2.id)" | Select-Object -ExpandProperty Content | ConvertFrom-Json
if ($l2Fetch.assignedAgentId -eq $agent1.id) { pass "Manual assignment preserved (ID: $($agent1.id))" } else { fail "Manual assignment overwritten! Got: $($l2Fetch.assignedAgentId)" }

hr "TEST 4: Pipeline Status progression & Automation"
$l3Body = '{"firstName":"High","lastName":"'+$rnd+'","email":"high_'+$rnd+'@test.com","status":"new","score":95,"phone":"555","source":"website"}'
$lead3 = Invoke-WebRequest "$base/api/leads" -Method POST -ContentType "application/json" -Body $l3Body | Select-Object -ExpandProperty Content | ConvertFrom-Json
Start-Sleep -Seconds 1
$l3Fetch = Invoke-WebRequest "$base/api/leads/$($lead3.id)" | Select-Object -ExpandProperty Content | ConvertFrom-Json
if ($l3Fetch.status -eq "contacted") { pass "Automation advanced new lead to 'contacted'" } else { fail "Lead didn't advance. Status: $($l3Fetch.status)" }

Invoke-WebRequest "$base/api/leads/$($lead3.id)" -Method PATCH -ContentType "application/json" -Body '{"status":"proposal"}' | Out-Null
Start-Sleep -Seconds 1

$wf4Body = '{"name":"AutoDowngrade '+$rnd+'","triggerEvent":"LEAD_UPDATED","isActive":true,"conditions":"","actions":"[{\"type\":\"UPDATE_CRM_STATUS\",\"params\":{\"status\":\"contacted\"}}]"}'
$wf4 = Invoke-WebRequest "$base/api/workflows" -Method POST -ContentType "application/json" -Body $wf4Body | Select-Object -ExpandProperty Content | ConvertFrom-Json

Invoke-WebRequest "$base/api/leads/$($lead3.id)" -Method PATCH -ContentType "application/json" -Body '{"score":99}' | Out-Null
Start-Sleep -Seconds 1
$l3Fetch2 = Invoke-WebRequest "$base/api/leads/$($lead3.id)" | Select-Object -ExpandProperty Content | ConvertFrom-Json
if ($l3Fetch2.status -eq "proposal") { pass "Automation cannot downgrade lead from 'proposal' to 'contacted'." } else { fail "Lead was downgraded to $($l3Fetch2.status)!" }

hr "TEST 5: Duplicate execution on non-status updates"
Invoke-WebRequest "$base/api/leads/$($lead1.id)" -Method PATCH -ContentType "application/json" -Body '{"status":"qualified"}' | Out-Null
Start-Sleep -Seconds 1
$execs2 = Invoke-WebRequest "$base/api/workflow-executions" | Select-Object -ExpandProperty Content | ConvertFrom-Json
$wf2Execs1 = @($execs2 | Where-Object { $_.workflowId -eq $wf2.id -and $_.triggerEntityId -eq $lead1.id })
if ($wf2Execs1.Count -eq 1) { pass "WF2 triggered once on status change." } else { fail "WF2 triggered $($wf2Execs1.Count) times on status change." }

Invoke-WebRequest "$base/api/leads/$($lead1.id)" -Method PATCH -ContentType "application/json" -Body '{"budget":200000}' | Out-Null
Start-Sleep -Seconds 1
$execs3 = Invoke-WebRequest "$base/api/workflow-executions" | Select-Object -ExpandProperty Content | ConvertFrom-Json
$wf2Execs2 = @($execs3 | Where-Object { $_.workflowId -eq $wf2.id -and $_.triggerEntityId -eq $lead1.id })
if ($wf2Execs2.Count -eq 1) { pass "WF2 did NOT trigger again when budget was updated." } else { fail "WF2 triggered $($wf2Execs2.Count) times total (duplicate detected on non-status update)." }

hr "TEST 6: Search / Filters / Ordering"
$list1 = Invoke-WebRequest "$base/api/leads" | Select-Object -ExpandProperty Content | ConvertFrom-Json
if ([datetime]$list1[0].createdAt -ge [datetime]$list1[-1].createdAt) { pass "List ordered newest-first (createdAt DESC)." } else { fail "List NOT newest-first." }

$filtered = Invoke-WebRequest "$base/api/leads?status=qualified" | Select-Object -ExpandProperty Content | ConvertFrom-Json
$wrongStatus = @($filtered | Where-Object { $_.status -ne "qualified" })
if ($wrongStatus.Count -eq 0) { pass "Status filter works." } else { fail "Status filter returned wrong statuses." }

hr "TEST 7: Delete lead"
Invoke-WebRequest "$base/api/leads/$($lead1.id)" -Method DELETE | Out-Null
try {
  Invoke-WebRequest "$base/api/leads/$($lead1.id)" -ErrorAction Stop
  fail "Lead still accessible after delete."
} catch {
  pass "Deleted lead returns 404."
}

$execs4 = Invoke-WebRequest "$base/api/workflow-executions" | Select-Object -ExpandProperty Content | ConvertFrom-Json
$wf2Execs3 = @($execs4 | Where-Object { $_.workflowId -eq $wf2.id -and $_.triggerEntityId -eq $lead1.id })
if ($wf2Execs3.Count -eq 1) { pass "Execution logs for deleted lead preserved." } else { fail "Execution logs missing/extra." }

hr "AUDIT COMPLETE"
