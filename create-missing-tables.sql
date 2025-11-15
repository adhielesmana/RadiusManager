-- Create all missing ISP Manager tables
-- Run this directly with: docker compose exec -T postgres psql -U ispuser -d ispmanager < create-missing-tables.sql

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  national_id VARCHAR(50) NOT NULL UNIQUE,
  whatsapp VARCHAR(20),
  email VARCHAR(255),
  home_address TEXT,
  maps_location_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Service Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  download_speed INTEGER NOT NULL,
  upload_speed INTEGER NOT NULL,
  data_quota INTEGER,
  fup_threshold INTEGER,
  fup_speed INTEGER,
  validity_days INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  subscription_id VARCHAR(20) NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  company_group_id INTEGER NOT NULL REFERENCES company_groups(id) DEFAULT 1,
  installation_address TEXT NOT NULL,
  ip_address VARCHAR(45),
  mac_address VARCHAR(17),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  activation_date TIMESTAMP DEFAULT NOW(),
  expiry_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  subscription_id INTEGER REFERENCES subscriptions(id),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  due_date TIMESTAMP,
  paid_date TIMESTAMP,
  billing_period_start TIMESTAMP,
  billing_period_end TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
  transaction_reference VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  ticket_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  category VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  resolution TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Activity Logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- PON Ports table
CREATE TABLE IF NOT EXISTS pon_ports (
  id SERIAL PRIMARY KEY,
  olt_id INTEGER NOT NULL REFERENCES olts(id),
  slot INTEGER NOT NULL,
  port INTEGER NOT NULL,
  max_onus INTEGER NOT NULL DEFAULT 128,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(olt_id, slot, port)
);

-- Routers/NAS table (if not already exists as 'nas')
-- nas table already exists from FreeRADIUS

-- Discovery Runs table
CREATE TABLE IF NOT EXISTS discovery_runs (
  id SERIAL PRIMARY KEY,
  olt_id INTEGER NOT NULL REFERENCES olts(id),
  status VARCHAR(20) NOT NULL,
  total_onus INTEGER DEFAULT 0,
  new_onus INTEGER DEFAULT 0,
  updated_onus INTEGER DEFAULT 0,
  errors TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ispuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ispuser;
