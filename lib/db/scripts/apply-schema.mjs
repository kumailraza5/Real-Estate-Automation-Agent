import pg from "pg";

let url = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("No database URL found");
// Supabase transaction pooler (6543) is often blocked; use session pooler (5432) instead
url = url.replace(/:6543\//, ":5432/");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log("Connected to Supabase ✓");

const ddl = `
CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'agent',
  status TEXT NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  score INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'website',
  budget NUMERIC(12,2),
  property_type TEXT,
  notes TEXT,
  assigned_agent_id INTEGER REFERENCES agents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  price NUMERIC(14,2) NOT NULL,
  type TEXT NOT NULL DEFAULT 'apartment',
  status TEXT NOT NULL DEFAULT 'available',
  bedrooms INTEGER NOT NULL DEFAULT 0,
  bathrooms INTEGER NOT NULL DEFAULT 0,
  area NUMERIC(10,2) NOT NULL,
  description TEXT,
  image_url TEXT,
  assigned_agent_id INTEGER REFERENCES agents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'prospect',
  budget NUMERIC(12,2),
  preferred_property_type TEXT,
  assigned_agent_id INTEGER REFERENCES agents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'follow-up',
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  due_time TEXT,
  assigned_agent_id INTEGER REFERENCES agents(id),
  lead_id INTEGER REFERENCES leads(id),
  client_id INTEGER REFERENCES clients(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'meeting',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  location TEXT,
  assigned_agent_id INTEGER REFERENCES agents(id),
  lead_id INTEGER REFERENCES leads(id),
  client_id INTEGER REFERENCES clients(id),
  property_id INTEGER REFERENCES properties(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  conditions TEXT,
  actions TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id),
  status TEXT NOT NULL DEFAULT 'success',
  triggered_by TEXT NOT NULL,
  trigger_entity_id INTEGER,
  actions_executed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  entity_type TEXT,
  entity_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  performed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

await client.query(ddl);
console.log("Schema applied ✓");

// Seed data
const { rows: existingAgents } = await client.query("SELECT id FROM agents LIMIT 1");
if (existingAgents.length > 0) {
  console.log("Data already seeded, skipping.");
  await client.end();
  process.exit(0);
}

await client.query(`
  INSERT INTO agents (name, email, phone, role, status) VALUES
  ('Sarah Mitchell', 'sarah.mitchell@reoa.com', '+1-555-0101', 'senior-agent', 'active'),
  ('James Crawford', 'james.crawford@reoa.com', '+1-555-0102', 'agent', 'active'),
  ('Diana Park', 'diana.park@reoa.com', '+1-555-0103', 'manager', 'active'),
  ('Tyler Brooks', 'tyler.brooks@reoa.com', '+1-555-0104', 'agent', 'active')
`);
console.log("Agents seeded ✓");

await client.query(`
  INSERT INTO leads (first_name, last_name, email, phone, status, score, source, budget, property_type, assigned_agent_id) VALUES
  ('Michael', 'Thompson', 'michael.t@email.com', '+1-555-0201', 'qualified', 82, 'website', 850000, 'villa', 1),
  ('Jennifer', 'Walsh', 'j.walsh@email.com', '+1-555-0202', 'proposal', 74, 'referral', 1200000, 'apartment', 2),
  ('Robert', 'Chen', 'r.chen@email.com', '+1-555-0203', 'new', 45, 'portal', 500000, 'apartment', 2),
  ('Amanda', 'Rivera', 'a.rivera@email.com', '+1-555-0204', 'contacted', 61, 'social', 750000, 'villa', 1),
  ('Daniel', 'Kim', 'd.kim@email.com', '+1-555-0205', 'negotiation', 91, 'referral', 2200000, 'commercial', 3),
  ('Sophie', 'Laurent', 's.laurent@email.com', '+1-555-0206', 'closed', 95, 'website', 980000, 'apartment', 4),
  ('Marcus', 'Johnson', 'm.johnson@email.com', '+1-555-0207', 'lost', 32, 'portal', 400000, 'apartment', 2),
  ('Priya', 'Sharma', 'p.sharma@email.com', '+1-555-0208', 'new', 55, 'website', 650000, 'villa', 1)
`);
console.log("Leads seeded ✓");

await client.query(`
  INSERT INTO properties (title, address, city, price, type, status, bedrooms, bathrooms, area, description, assigned_agent_id) VALUES
  ('Sunset Heights Villa', '142 Palm Drive', 'Miami', 1450000, 'villa', 'available', 5, 4, 4200, 'Stunning ocean-view villa with modern finishes and private pool', 1),
  ('Downtown Loft 12A', '88 Financial Blvd', 'New York', 890000, 'apartment', 'available', 2, 2, 1850, 'Premium downtown loft with floor-to-ceiling windows', 2),
  ('The Commerce Center', '500 Business Park', 'Chicago', 3200000, 'commercial', 'available', 0, 4, 12000, 'Class A commercial space in prime business district', 3),
  ('Bayview Penthouse', '210 Harbor View', 'San Francisco', 2750000, 'apartment', 'under-offer', 3, 3, 3200, 'Exclusive penthouse with panoramic bay views', 1),
  ('Garden Terrace Apt', '55 Bloom Street', 'Los Angeles', 680000, 'apartment', 'sold', 2, 2, 1400, 'Charming apartment with private garden terrace', 4)
`);
console.log("Properties seeded ✓");

await client.query(`
  INSERT INTO clients (first_name, last_name, email, phone, status, budget, preferred_property_type, assigned_agent_id) VALUES
  ('Alex', 'Turner', 'alex.turner@email.com', '+1-555-0301', 'active', 1500000, 'villa', 1),
  ('Linda', 'Foster', 'linda.f@email.com', '+1-555-0302', 'active', 800000, 'apartment', 2),
  ('George', 'Navarro', 'g.navarro@email.com', '+1-555-0303', 'prospect', 2000000, 'commercial', 3),
  ('Emma', 'Collins', 'emma.c@email.com', '+1-555-0304', 'closed', 950000, 'apartment', 4)
`);
console.log("Clients seeded ✓");

await client.query(`
  INSERT INTO tasks (title, type, status, priority, due_date, due_time, assigned_agent_id, lead_id) VALUES
  ('Follow up with Michael Thompson', 'follow-up', 'pending', 'high', CURRENT_DATE, '10:00', 1, 1),
  ('Schedule viewing for Jennifer Walsh', 'viewing', 'pending', 'urgent', CURRENT_DATE, '14:00', 2, 2),
  ('Call Robert Chen', 'call', 'pending', 'medium', CURRENT_DATE + 1, '09:30', 2, 3),
  ('Prepare proposal for Daniel Kim', 'meeting', 'in-progress', 'urgent', CURRENT_DATE, '16:00', 3, 5),
  ('Send reminder to Amanda Rivera', 'reminder', 'completed', 'medium', CURRENT_DATE - 1, '11:00', 1, 4)
`);
console.log("Tasks seeded ✓");

await client.query(`
  INSERT INTO appointments (title, type, start_time, end_time, status, location, assigned_agent_id, lead_id) VALUES
  ('Sunset Heights Villa Viewing', 'viewing', NOW() + interval '2 hours', NOW() + interval '3 hours', 'scheduled', '142 Palm Drive, Miami', 1, 1),
  ('Jennifer Walsh Strategy Meeting', 'meeting', NOW() + interval '1 day', NOW() + interval '1 day' + interval '1 hour', 'scheduled', 'Office - Conference Room A', 2, 2),
  ('Daniel Kim Negotiation', 'meeting', NOW() + interval '3 hours', NOW() + interval '4 hours', 'scheduled', 'Zoom', 3, 5),
  ('Robert Chen Initial Call', 'follow-up', NOW() - interval '2 hours', NOW() - interval '1 hour', 'completed', 'Phone', 2, 3)
`);
console.log("Appointments seeded ✓");

await client.query(`
  INSERT INTO workflows (name, description, trigger_event, conditions, actions, is_active) VALUES
  ('High-Value Lead Assignment', 'Auto-assign leads with budget over $500k to senior agents', 'lead_created', '{"field":"budget","operator":"greater_than","value":"500000"}', '[{"type":"assign_agent","params":{"role":"senior-agent"}},{"type":"create_task","params":{"type":"follow-up","priority":"high"}},{"type":"send_notification","params":{"message":"High-value lead assigned"}}]', true),
  ('No Response Follow-up', 'Create reminder when lead has no response for 48 hours', 'no_response_48h', NULL, '[{"type":"create_task","params":{"type":"reminder","priority":"medium"}},{"type":"send_notification","params":{"message":"Lead needs follow-up"}}]', true),
  ('Viewing Completed CRM Update', 'Update CRM and create next follow-up after viewing', 'viewing_scheduled', NULL, '[{"type":"update_lead_status","params":{"status":"qualified"}},{"type":"create_task","params":{"type":"follow-up"}},{"type":"send_notification","params":{"message":"Viewing completed - CRM updated"}}]', true),
  ('Deal Closed Workflow', 'Notify team and update records when deal closes', 'deal_closed', NULL, '[{"type":"send_notification","params":{"message":"Deal closed!"}},{"type":"update_lead_status","params":{"status":"closed"}}]', false)
`);
console.log("Workflows seeded ✓");

await client.query(`
  INSERT INTO workflow_executions (workflow_id, status, triggered_by, trigger_entity_id, actions_executed) VALUES
  (1, 'success', 'lead_created', 1, 3),
  (1, 'success', 'lead_created', 2, 3),
  (2, 'success', 'no_response_48h', 4, 2),
  (3, 'success', 'viewing_scheduled', 1, 3),
  (1, 'failed', 'lead_created', 8, 1)
`);
console.log("Workflow executions seeded ✓");

await client.query(`
  INSERT INTO notifications (title, message, type, is_read, entity_type, entity_id) VALUES
  ('New Lead Assigned', 'High-value lead Michael Thompson has been assigned to your pipeline', 'info', false, 'lead', 1),
  ('Workflow Triggered', 'No-response workflow activated for Amanda Rivera', 'warning', false, 'lead', 4),
  ('Deal Closed', 'Sophie Laurent deal successfully closed for $980,000', 'success', true, 'lead', 6),
  ('Task Overdue', 'Follow-up with Robert Chen is overdue', 'error', false, 'task', 3),
  ('Viewing Scheduled', 'Property viewing scheduled for Sunset Heights Villa', 'info', true, 'appointment', 1)
`);
console.log("Notifications seeded ✓");

await client.query(`
  INSERT INTO activity_logs (action, entity_type, entity_id, description, performed_by) VALUES
  ('created', 'lead', 1, 'Lead Michael Thompson was created from website', 'system'),
  ('updated', 'lead', 1, 'Lead status changed to qualified', 'Sarah Mitchell'),
  ('created', 'lead', 2, 'Lead Jennifer Walsh was created via referral', 'system'),
  ('assigned', 'lead', 5, 'Lead Daniel Kim assigned to Diana Park', 'system'),
  ('workflow_triggered', 'lead', 4, 'No-response workflow triggered for Amanda Rivera', 'automation'),
  ('created', 'client', 1, 'Client Alex Turner added to CRM', 'system'),
  ('updated', 'client', 4, 'Client Emma Collins marked as closed', 'Tyler Brooks')
`);
console.log("Activity logs seeded ✓");

await client.end();
console.log("\nAll done! Supabase database is ready.");
