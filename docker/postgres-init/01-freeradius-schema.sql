-- FreeRADIUS PostgreSQL Schema
-- This script initializes the FreeRADIUS tables in the shared ISP Manager database
-- These tables work alongside the ISP Manager tables

-- Note: The ISP Manager application already creates its own tables via Drizzle ORM
-- This script only adds the FreeRADIUS-specific tables

-- Check if tables exist before creating
DO $$ 
BEGIN
    -- Create radcheck table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'radcheck') THEN
        CREATE TABLE radcheck (
            id SERIAL PRIMARY KEY,
            username VARCHAR(64) NOT NULL DEFAULT '',
            attribute VARCHAR(64) NOT NULL DEFAULT '',
            op CHAR(2) NOT NULL DEFAULT '==',
            value VARCHAR(253) NOT NULL DEFAULT ''
        );
        CREATE INDEX radcheck_username_idx ON radcheck(username);
        CREATE INDEX radcheck_username_attribute_idx ON radcheck(username, attribute);
    END IF;

    -- Create radreply table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'radreply') THEN
        CREATE TABLE radreply (
            id SERIAL PRIMARY KEY,
            username VARCHAR(64) NOT NULL DEFAULT '',
            attribute VARCHAR(64) NOT NULL DEFAULT '',
            op CHAR(2) NOT NULL DEFAULT '=',
            value VARCHAR(253) NOT NULL DEFAULT ''
        );
        CREATE INDEX radreply_username_idx ON radreply(username);
        CREATE INDEX radreply_username_attribute_idx ON radreply(username, attribute);
    END IF;

    -- Create radgroupcheck table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'radgroupcheck') THEN
        CREATE TABLE radgroupcheck (
            id SERIAL PRIMARY KEY,
            groupname VARCHAR(64) NOT NULL DEFAULT '',
            attribute VARCHAR(64) NOT NULL DEFAULT '',
            op CHAR(2) NOT NULL DEFAULT '==',
            value VARCHAR(253) NOT NULL DEFAULT ''
        );
        CREATE INDEX radgroupcheck_groupname_idx ON radgroupcheck(groupname);
    END IF;

    -- Create radgroupreply table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'radgroupreply') THEN
        CREATE TABLE radgroupreply (
            id SERIAL PRIMARY KEY,
            groupname VARCHAR(64) NOT NULL DEFAULT '',
            attribute VARCHAR(64) NOT NULL DEFAULT '',
            op CHAR(2) NOT NULL DEFAULT '=',
            value VARCHAR(253) NOT NULL DEFAULT ''
        );
        CREATE INDEX radgroupreply_groupname_idx ON radgroupreply(groupname);
    END IF;

    -- Create radusergroup table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'radusergroup') THEN
        CREATE TABLE radusergroup (
            id SERIAL PRIMARY KEY,
            username VARCHAR(64) NOT NULL DEFAULT '',
            groupname VARCHAR(64) NOT NULL DEFAULT '',
            priority INT NOT NULL DEFAULT 1
        );
        CREATE INDEX radusergroup_username_idx ON radusergroup(username);
    END IF;

    -- Create radacct table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'radacct') THEN
        CREATE TABLE radacct (
            radacctid BIGSERIAL PRIMARY KEY,
            acctsessionid VARCHAR(64) NOT NULL DEFAULT '',
            acctuniqueid VARCHAR(32) NOT NULL DEFAULT '',
            username VARCHAR(64) NOT NULL DEFAULT '',
            realm VARCHAR(64) DEFAULT '',
            nasipaddress INET NOT NULL,
            nasportid VARCHAR(32) DEFAULT NULL,
            nasporttype VARCHAR(32) DEFAULT NULL,
            acctstarttime TIMESTAMP(0) NULL,
            acctupdatetime TIMESTAMP(0) NULL,
            acctstoptime TIMESTAMP(0) NULL,
            acctinterval INT DEFAULT NULL,
            acctsessiontime BIGINT DEFAULT NULL,
            acctauthentic VARCHAR(32) DEFAULT NULL,
            connectinfo_start VARCHAR(128) DEFAULT NULL,
            connectinfo_stop VARCHAR(128) DEFAULT NULL,
            acctinputoctets BIGINT DEFAULT NULL,
            acctoutputoctets BIGINT DEFAULT NULL,
            calledstationid VARCHAR(50) NOT NULL DEFAULT '',
            callingstationid VARCHAR(50) NOT NULL DEFAULT '',
            acctterminatecause VARCHAR(32) NOT NULL DEFAULT '',
            servicetype VARCHAR(32) DEFAULT NULL,
            framedprotocol VARCHAR(32) DEFAULT NULL,
            framedipaddress INET DEFAULT NULL,
            framedipv6address VARCHAR(45) DEFAULT NULL,
            framedipv6prefix VARCHAR(45) DEFAULT NULL,
            framedinterfaceid VARCHAR(44) DEFAULT NULL,
            delegatedipv6prefix VARCHAR(45) DEFAULT NULL
        );
        CREATE INDEX radacct_username_idx ON radacct(username);
        CREATE INDEX radacct_acctsessionid_idx ON radacct(acctsessionid);
        CREATE INDEX radacct_acctstarttime_idx ON radacct(acctstarttime);
        CREATE INDEX radacct_acctstoptime_idx ON radacct(acctstoptime);
        CREATE INDEX radacct_nasipaddress_idx ON radacct(nasipaddress);
    END IF;

    -- Create radpostauth table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'radpostauth') THEN
        CREATE TABLE radpostauth (
            id BIGSERIAL PRIMARY KEY,
            username VARCHAR(64) NOT NULL DEFAULT '',
            pass VARCHAR(64) NOT NULL DEFAULT '',
            reply VARCHAR(32) NOT NULL DEFAULT '',
            authdate TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX radpostauth_username_idx ON radpostauth(username);
        CREATE INDEX radpostauth_authdate_idx ON radpostauth(authdate);
    END IF;

    -- Create nas table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nas') THEN
        CREATE TABLE nas (
            id SERIAL PRIMARY KEY,
            nasname VARCHAR(128) NOT NULL,
            shortname VARCHAR(32),
            type VARCHAR(30) DEFAULT 'other',
            ports INT DEFAULT NULL,
            secret VARCHAR(60) NOT NULL DEFAULT 'secret',
            server VARCHAR(64) DEFAULT NULL,
            community VARCHAR(50) DEFAULT NULL,
            description VARCHAR(200) DEFAULT 'RADIUS Client'
        );
        CREATE INDEX nas_nasname_idx ON nas(nasname);
        CREATE UNIQUE INDEX nas_nasname_unique ON nas(nasname);
    END IF;
END $$;

-- Insert default NAS client for testing (localhost)
INSERT INTO nas (nasname, shortname, type, ports, secret, description)
VALUES ('127.0.0.1', 'localhost', 'other', 0, 'testing123', 'Local NAS for testing')
ON CONFLICT (nasname) DO NOTHING;

-- Grant permissions to the database user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ispuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ispuser;
