-- Complete ISP Manager Database Schema
-- Creates all tables for fresh installations
-- Safe to run multiple times (uses IF NOT EXISTS)

-- ============================================
-- Core Business Tables (no dependencies)
-- ============================================

CREATE TABLE IF NOT EXISTS company_groups (
  id SERIAL PRIMARY KEY,
  code VARCHAR(1) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  currency_code VARCHAR(3) NOT NULL DEFAULT 'IDR',
  logo_url TEXT,
  radius_host VARCHAR(255),
  radius_secret VARCHAR(255),
  radius_auth_port INTEGER,
  radius_acct_port INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Session table (express-session)
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);

-- ============================================
-- Customer & Service Tables
-- ============================================

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

-- ============================================
-- Billing Tables
-- ============================================

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

-- ============================================
-- Support Tables
-- ============================================

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

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- FreeRADIUS Tables
-- ============================================

CREATE TABLE IF NOT EXISTS radcheck (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  attribute VARCHAR(64) NOT NULL,
  op VARCHAR(2) NOT NULL DEFAULT '==',
  value VARCHAR(253) NOT NULL
);
CREATE INDEX IF NOT EXISTS radcheck_username_idx ON radcheck (username);

CREATE TABLE IF NOT EXISTS radreply (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  attribute VARCHAR(64) NOT NULL,
  op VARCHAR(2) NOT NULL DEFAULT '=',
  value VARCHAR(253) NOT NULL
);
CREATE INDEX IF NOT EXISTS radreply_username_idx ON radreply (username);

CREATE TABLE IF NOT EXISTS radgroupcheck (
  id SERIAL PRIMARY KEY,
  groupname VARCHAR(64) NOT NULL,
  attribute VARCHAR(64) NOT NULL,
  op VARCHAR(2) NOT NULL DEFAULT '==',
  value VARCHAR(253) NOT NULL
);
CREATE INDEX IF NOT EXISTS radgroupcheck_groupname_idx ON radgroupcheck (groupname);

CREATE TABLE IF NOT EXISTS radgroupreply (
  id SERIAL PRIMARY KEY,
  groupname VARCHAR(64) NOT NULL,
  attribute VARCHAR(64) NOT NULL,
  op VARCHAR(2) NOT NULL DEFAULT '=',
  value VARCHAR(253) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS radgroupreply_groupname_idx ON radgroupreply (groupname);

CREATE TABLE IF NOT EXISTS radusergroup (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  groupname VARCHAR(64) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS radusergroup_username_idx ON radusergroup (username);

CREATE TABLE IF NOT EXISTS radacct (
  radacctid BIGSERIAL PRIMARY KEY,
  acctsessionid VARCHAR(64) NOT NULL,
  acctuniqueid VARCHAR(32) NOT NULL UNIQUE,
  username VARCHAR(64),
  groupname VARCHAR(64),
  realm VARCHAR(64),
  nasipaddress INET NOT NULL,
  nasportid VARCHAR(15),
  nasporttype VARCHAR(32),
  acctstarttime TIMESTAMP,
  acctupdatetime TIMESTAMP,
  acctstoptime TIMESTAMP,
  acctinterval INTEGER,
  acctsessiontime INTEGER,
  acctauthentic VARCHAR(32),
  connectinfo_start VARCHAR(50),
  connectinfo_stop VARCHAR(50),
  acctinputoctets BIGINT,
  acctoutputoctets BIGINT,
  calledstationid VARCHAR(50),
  callingstationid VARCHAR(50),
  acctterminatecause VARCHAR(32),
  servicetype VARCHAR(32),
  framedprotocol VARCHAR(32),
  framedipaddress INET
);
CREATE INDEX IF NOT EXISTS radacct_username_idx ON radacct (username);
CREATE INDEX IF NOT EXISTS radacct_acctsessionid_idx ON radacct (acctsessionid);
CREATE INDEX IF NOT EXISTS radacct_acctstarttime_idx ON radacct (acctstarttime);

CREATE TABLE IF NOT EXISTS radpostauth (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  pass VARCHAR(64),
  reply VARCHAR(32),
  authdate TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nas (
  id SERIAL PRIMARY KEY,
  nasname VARCHAR(128) NOT NULL UNIQUE,
  shortname VARCHAR(32),
  type VARCHAR(30) NOT NULL DEFAULT 'other',
  ports INTEGER DEFAULT 1812,
  secret VARCHAR(60) NOT NULL,
  server VARCHAR(64),
  community VARCHAR(50),
  description VARCHAR(200) DEFAULT 'RADIUS Client'
);

-- ============================================
-- FTTH Infrastructure Tables
-- ============================================

CREATE TABLE IF NOT EXISTS pops (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  address TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  contact_person VARCHAR(100),
  contact_phone VARCHAR(20),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS olts (
  id SERIAL PRIMARY KEY,
  pop_id INTEGER NOT NULL REFERENCES pops(id),
  name VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  vendor VARCHAR(50) NOT NULL,
  model VARCHAR(100),
  olt_type VARCHAR(20),
  management_type VARCHAR(20) DEFAULT 'telnet',
  port INTEGER DEFAULT 23,
  username VARCHAR(100),
  password VARCHAR(255),
  enable_password VARCHAR(255),
  snmp_community VARCHAR(50) DEFAULT 'public',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  telnet_enabled BOOLEAN NOT NULL DEFAULT true,
  telnet_port INTEGER NOT NULL DEFAULT 23,
  telnet_username VARCHAR(100) DEFAULT '',
  telnet_password VARCHAR(255) DEFAULT '',
  snmp_enabled BOOLEAN NOT NULL DEFAULT true,
  snmp_port INTEGER NOT NULL DEFAULT 161,
  total_pon_slots INTEGER NOT NULL DEFAULT 16,
  ports_per_slot INTEGER NOT NULL DEFAULT 16,
  is_active BOOLEAN NOT NULL DEFAULT true,
  snmp_config TEXT,
  snmp_config_fetched_at TIMESTAMP,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS distribution_boxes (
  id SERIAL PRIMARY KEY,
  olt_id INTEGER NOT NULL REFERENCES olts(id),
  pon_port VARCHAR(20) NOT NULL,
  pon_slot_index INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  address TEXT,
  max_onus INTEGER NOT NULL DEFAULT 16,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  installed_at TIMESTAMP,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(olt_id, pon_port, pon_slot_index)
);

CREATE TABLE IF NOT EXISTS onus (
  id SERIAL PRIMARY KEY,
  olt_id INTEGER NOT NULL REFERENCES olts(id),
  distribution_box_id INTEGER REFERENCES distribution_boxes(id),
  subscription_id INTEGER REFERENCES subscriptions(id),
  pon_serial VARCHAR(50) NOT NULL UNIQUE,
  mac_address VARCHAR(17),
  pon_port VARCHAR(20) NOT NULL,
  onu_id INTEGER,
  onu_type VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'offline',
  signal_rx DECIMAL(5, 2),
  signal_tx DECIMAL(5, 2),
  distance INTEGER,
  vlan_id INTEGER,
  bandwidth_profile VARCHAR(100),
  description TEXT,
  data_hash VARCHAR(64),
  last_online TIMESTAMP,
  registration_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

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

-- ============================================
-- Permissions
-- ============================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ispuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ispuser;

-- ============================================
-- Insert Default Data
-- ============================================

-- Default company group
INSERT INTO company_groups (id, code, name, description, is_active)
VALUES (1, '1', 'Default Company', 'Default company group', true)
ON CONFLICT (id) DO NOTHING;

-- Default settings
INSERT INTO settings (id, currency_code)
VALUES (1, 'IDR')
ON CONFLICT (id) DO NOTHING;
