import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, serial, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Customers table - ISP customer database (password stored in radcheck only for security)
// One customer (unique by nationalId) can have multiple subscriptions
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  fullName: text("full_name").notNull(),
  nationalId: varchar("national_id", { length: 50 }).notNull().unique(), // Unique constraint - one national ID per customer
  whatsapp: varchar("whatsapp", { length: 20 }),
  email: varchar("email", { length: 255 }),
  homeAddress: text("home_address"),
  mapsLocationUrl: text("maps_location_url"),
  status: varchar("status", { length: 20 }).notNull().default('active'), // active, suspended, expired
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscriptions table - Links customers to profiles at specific locations
// One customer can have multiple subscriptions (different locations or profiles)
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  subscriptionId: varchar("subscription_id", { length: 20 }).notNull().unique(), // Format: YYMMDDXNNNN (auto-generated)
  customerId: integer("customer_id").notNull().references(() => customers.id),
  profileId: integer("profile_id").notNull().references(() => profiles.id),
  companyGroupId: integer("company_group_id").notNull().references(() => companyGroups.id).default(1), // Company group
  installationAddress: text("installation_address").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }), // Optional static IP (IPv4/IPv6), if empty router auto-assigns
  macAddress: varchar("mac_address", { length: 17 }), // Optional MAC address binding
  status: varchar("status", { length: 20 }).notNull().default('active'), // active, new_request, suspend, dismantle
  activationDate: timestamp("activation_date").defaultNow(),
  expiryDate: timestamp("expiry_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Service Profiles - Speed plans, quotas, pricing
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  downloadSpeed: integer("download_speed").notNull(), // in Mbps
  uploadSpeed: integer("upload_speed").notNull(), // in Mbps
  dataQuota: integer("data_quota"), // in GB, null for unlimited
  fupThreshold: integer("fup_threshold"), // percentage when FUP kicks in
  fupSpeed: integer("fup_speed"), // speed after FUP in Mbps
  validityDays: integer("validity_days").notNull(), // subscription duration
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices - Linked to specific subscription (not just customer)
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id), // Link to specific subscription
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default('0'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, paid, overdue, partial
  dueDate: timestamp("due_date"),
  paidDate: timestamp("paid_date"),
  billingPeriodStart: timestamp("billing_period_start"),
  billingPeriodEnd: timestamp("billing_period_end"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payments - Track all payments against invoices
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // cash, bank_transfer, card, upi, etc.
  paymentDate: timestamp("payment_date").notNull().defaultNow(),
  transactionReference: varchar("transaction_reference", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Support Tickets
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: varchar("ticket_number", { length: 50 }).notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  category: varchar("category", { length: 50 }).notNull(), // connection, speed, billing, profile_change, installation, technical
  priority: varchar("priority", { length: 20 }).notNull().default('medium'), // low, medium, high, urgent
  status: varchar("status", { length: 20 }).notNull().default('open'), // open, in_progress, resolved, closed
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Activity Logs
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id),
  action: varchar("action", { length: 100 }).notNull(),
  description: text("description").notNull(),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow(),
});

// Company Groups - For multi-company ISP operations
export const companyGroups = pgTable("company_groups", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 1 }).notNull().unique(), // Single digit code (1-9)
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Settings - Application-wide configuration (single row)
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('IDR'), // ISO 4217 currency code
  logoUrl: text("logo_url"), // Changed to text to support base64 encoded images
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users - System users with authentication (superadmin hardcoded, others in database)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(), // bcrypt hashed
  role: varchar("role", { length: 20 }).notNull().default('user'), // superadmin, admin, user
  fullName: text("full_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Permissions - Menu access control for users
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  menuId: varchar("menu_id", { length: 50 }).notNull(), // dashboard, customers, subscriptions, profiles, invoices, tickets, settings
  canAccess: boolean("can_access").notNull().default(true),
});

// Session table for connect-pg-simple (persistent login sessions)
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: text("sess").notNull(), // JSON session data
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

// FreeRADIUS Tables
// radcheck - User authentication (username/password)
export const radcheck = pgTable("radcheck", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull(),
  attribute: varchar("attribute", { length: 64 }).notNull(),
  op: varchar("op", { length: 2 }).notNull().default('=='),
  value: varchar("value", { length: 253 }).notNull(),
});

// radreply - User-specific RADIUS reply attributes
export const radreply = pgTable("radreply", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull(),
  attribute: varchar("attribute", { length: 64 }).notNull(),
  op: varchar("op", { length: 2 }).notNull().default('='),
  value: varchar("value", { length: 253 }).notNull(),
});

// radgroupcheck - Group authentication attributes
export const radgroupcheck = pgTable("radgroupcheck", {
  id: serial("id").primaryKey(),
  groupname: varchar("groupname", { length: 64 }).notNull(),
  attribute: varchar("attribute", { length: 64 }).notNull(),
  op: varchar("op", { length: 2 }).notNull().default('=='),
  value: varchar("value", { length: 253 }).notNull(),
});

// radgroupreply - Group reply attributes (speed limits, quotas)
export const radgroupreply = pgTable("radgroupreply", {
  id: serial("id").primaryKey(),
  groupname: varchar("groupname", { length: 64 }).notNull(),
  attribute: varchar("attribute", { length: 64 }).notNull(),
  op: varchar("op", { length: 2 }).notNull().default('='),
  value: varchar("value", { length: 253 }).notNull(),
  priority: integer("priority").notNull().default(1),
});

// radusergroup - User to group mapping
export const radusergroup = pgTable("radusergroup", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull(),
  groupname: varchar("groupname", { length: 64 }).notNull(),
  priority: integer("priority").notNull().default(1),
});

// nas - Network Access Server (Routers) for FreeRADIUS
export const nas = pgTable("nas", {
  id: serial("id").primaryKey(),
  nasname: varchar("nasname", { length: 128 }).notNull().unique(), // IP address or hostname
  shortname: varchar("shortname", { length: 32 }), // Short identifier
  type: varchar("type", { length: 30 }).notNull().default('other'), // mikrotik, cisco, ubiquiti, other
  ports: integer("ports").default(1812), // RADIUS port (default 1812)
  secret: varchar("secret", { length: 60 }).notNull(), // RADIUS shared secret (REQUIRED - no default for security)
  server: varchar("server", { length: 64 }), // Optional server
  community: varchar("community", { length: 50 }), // SNMP community
  description: varchar("description", { length: 200 }).default('RADIUS Client'), // Description
});

// FTTH Management Tables
// pops - Point of Presence (OLT locations)
export const pops = pgTable("pops", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  code: varchar("code", { length: 20 }).notNull().unique(), // Short code for identification
  address: text("address"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  contactPerson: varchar("contact_person", { length: 100 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// olts - Optical Line Terminals (OLT devices)
export const olts = pgTable("olts", {
  id: serial("id").primaryKey(),
  popId: integer("pop_id").notNull().references(() => pops.id),
  name: varchar("name", { length: 100 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull().unique(), // IPv4/IPv6
  vendor: varchar("vendor", { length: 50 }).notNull(), // zte, huawei, fiberhome, bdcom, vsol, hioso, etc.
  model: varchar("model", { length: 100 }),
  
  // Legacy fields (kept for backward compatibility)
  oltType: varchar("olt_type", { length: 20 }), // gpon, epon
  managementType: varchar("management_type", { length: 20 }).default('telnet'), // telnet, ssh, snmp
  port: integer("port").default(23), // 23 for telnet, 22 for ssh
  username: varchar("username", { length: 100 }),
  password: varchar("password", { length: 255 }), // Encrypted
  enablePassword: varchar("enable_password", { length: 255 }), // For privileged mode (ZTE, Huawei)
  snmpCommunity: varchar("snmp_community", { length: 50 }).default('public'), // For SNMP access (legacy)
  status: varchar("status", { length: 20 }).notNull().default('active'), // active, inactive, maintenance
  
  // New fields for enhanced management
  telnetEnabled: boolean("telnet_enabled").notNull().default(true),
  telnetPort: integer("telnet_port").notNull().default(23),
  telnetUsername: varchar("telnet_username", { length: 100 }).default(''),
  telnetPassword: varchar("telnet_password", { length: 255 }).default(''),
  snmpEnabled: boolean("snmp_enabled").notNull().default(true),
  snmpPort: integer("snmp_port").notNull().default(161),
  totalPonSlots: integer("total_pon_slots").notNull().default(16),
  portsPerSlot: integer("ports_per_slot").notNull().default(16),
  isActive: boolean("is_active").notNull().default(true),
  
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// distribution_boxes - Optical Distribution Points (ODP)
export const distributionBoxes = pgTable("distribution_boxes", {
  id: serial("id").primaryKey(),
  oltId: integer("olt_id").notNull().references(() => olts.id),
  ponPort: varchar("pon_port", { length: 20 }).notNull(), // e.g., "0/1" (slot/port)
  ponSlotIndex: integer("pon_slot_index").notNull(), // 0-7 (8 boxes per PON)
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(), // Unique identifier
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  address: text("address"),
  maxOnus: integer("max_onus").notNull().default(16), // Capacity (default 16)
  status: varchar("status", { length: 20 }).notNull().default('active'), // active, inactive, full
  installedAt: timestamp("installed_at"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint: one box per PON slot
  uniqueOltPonSlot: unique().on(table.oltId, table.ponPort, table.ponSlotIndex),
}));

// onus - Optical Network Units (Customer ONUs/ONTs)
export const onus = pgTable("onus", {
  id: serial("id").primaryKey(),
  oltId: integer("olt_id").notNull().references(() => olts.id),
  distributionBoxId: integer("distribution_box_id").references(() => distributionBoxes.id), // Link to distribution box
  subscriptionId: integer("subscription_id").references(() => subscriptions.id), // Link to customer subscription
  ponSerial: varchar("pon_serial", { length: 50 }).notNull().unique(), // PON Serial Number (GPON) or MAC (EPON)
  macAddress: varchar("mac_address", { length: 17 }),
  ponPort: varchar("pon_port", { length: 20 }).notNull(), // e.g., "0/1" (slot/port) or "gpon-olt_1/1/1"
  onuId: integer("onu_id"), // ONU ID on the PON port (e.g., 1-128)
  onuType: varchar("onu_type", { length: 50 }), // HGU, SFU, etc.
  status: varchar("status", { length: 20 }).notNull().default('offline'), // online, offline, silent
  signalRx: decimal("signal_rx", { precision: 5, scale: 2 }), // Received signal strength in dBm
  signalTx: decimal("signal_tx", { precision: 5, scale: 2 }), // Transmitted signal strength in dBm
  distance: integer("distance"), // Distance from OLT in meters
  vlanId: integer("vlan_id"), // Service VLAN
  bandwidthProfile: varchar("bandwidth_profile", { length: 100 }),
  description: text("description"), // Customer name or identifier
  dataHash: varchar("data_hash", { length: 64 }), // SHA256 hash for change detection
  lastOnline: timestamp("last_online"),
  registrationDate: timestamp("registration_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // Detailed ONU Information from 'show gpon onu detail-info' command
  onuName: varchar("onu_name", { length: 255 }), // ONU name configured on OLT
  deviceType: varchar("device_type", { length: 100 }), // Device manufacturer/model from OLT
  state: varchar("state", { length: 50 }), // ready, offline, etc.
  adminState: varchar("admin_state", { length: 20 }), // enable, disable
  phaseState: varchar("phase_state", { length: 50 }), // working, offline, DyingGasp, etc.
  configState: varchar("config_state", { length: 50 }), // success, failed, etc.
  authenticationMode: varchar("authentication_mode", { length: 20 }), // sn, password, loid, etc.
  snBind: varchar("sn_bind", { length: 100 }), // SN binding status
  onuPassword: varchar("onu_password", { length: 100 }), // ONU authentication password
  vportMode: varchar("vport_mode", { length: 20 }), // gemport, ethernet
  dbaMode: varchar("dba_mode", { length: 20 }), // Hybrid, SR, NSR
  onuStatusDetail: varchar("onu_status_detail", { length: 20 }), // enable, disable from OLT
  fec: varchar("fec", { length: 20 }), // Forward Error Correction: none, enable
  onlineDuration: varchar("online_duration", { length: 50 }), // e.g., "34h 25m 53s"
  lastAuthpassTime: timestamp("last_authpass_time"), // Last authentication time
  lastOfflineTime: timestamp("last_offline_time"), // Last offline timestamp
  lastDownCause: varchar("last_down_cause", { length: 100 }), // DyingGasp, LOS, PowerOff, etc.
  currentChannel: varchar("current_channel", { length: 50 }), // Current PON channel
  lineProfile: varchar("line_profile", { length: 100 }), // Line profile name
  serviceProfile: varchar("service_profile", { length: 100 }), // Service profile name
  detailsRawOutput: text("details_raw_output"), // Full raw output from detail-info command for debugging
});

// Discovery Runs - Track background OLT discovery state
export const discoveryRuns = pgTable("discovery_runs", {
  id: serial("id").primaryKey(),
  oltId: integer("olt_id").notNull().references(() => olts.id).unique(), // One active discovery per OLT
  status: varchar("status", { length: 20 }).notNull().default('running'), // running, stopped, error
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  lastRunAt: timestamp("last_run_at"),
  errorMessage: text("error_message"),
  discoveredCount: integer("discovered_count").default(0),
  updatedCount: integer("updated_count").default(0),
  skippedCount: integer("skipped_count").default(0),
});

// Relations
export const customersRelations = relations(customers, ({ many }) => ({
  subscriptions: many(subscriptions),
  invoices: many(invoices),
  payments: many(payments),
  tickets: many(tickets),
  activityLogs: many(activityLogs),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  customer: one(customers, {
    fields: [subscriptions.customerId],
    references: [customers.id],
  }),
  profile: one(profiles, {
    fields: [subscriptions.profileId],
    references: [profiles.id],
  }),
  companyGroup: one(companyGroups, {
    fields: [subscriptions.companyGroupId],
    references: [companyGroups.id],
  }),
  invoices: many(invoices),
}));

export const profilesRelations = relations(profiles, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  customer: one(customers, {
    fields: [tickets.customerId],
    references: [customers.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  customer: one(customers, {
    fields: [activityLogs.customerId],
    references: [customers.id],
  }),
}));

export const companyGroupsRelations = relations(companyGroups, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const usersRelations = relations(users, ({ many }) => ({
  permissions: many(permissions),
}));

export const permissionsRelations = relations(permissions, ({ one }) => ({
  user: one(users, {
    fields: [permissions.userId],
    references: [users.id],
  }),
}));

// FTTH Relations
export const popsRelations = relations(pops, ({ many }) => ({
  olts: many(olts),
}));

export const oltsRelations = relations(olts, ({ one, many }) => ({
  pop: one(pops, {
    fields: [olts.popId],
    references: [pops.id],
  }),
  distributionBoxes: many(distributionBoxes),
  onus: many(onus),
}));

export const distributionBoxesRelations = relations(distributionBoxes, ({ one, many }) => ({
  olt: one(olts, {
    fields: [distributionBoxes.oltId],
    references: [olts.id],
  }),
  onus: many(onus),
}));

export const onusRelations = relations(onus, ({ one }) => ({
  olt: one(olts, {
    fields: [onus.oltId],
    references: [olts.id],
  }),
  distributionBox: one(distributionBoxes, {
    fields: [onus.distributionBoxId],
    references: [distributionBoxes.id],
  }),
  subscription: one(subscriptions, {
    fields: [onus.subscriptionId],
    references: [subscriptions.id],
  }),
}));

// Insert Schemas
export const insertCustomerSchema = createInsertSchema(customers, {
  email: z.string().email().optional().or(z.literal('')),
  whatsapp: z.string().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  password: z.string().min(4).optional(), // Password handled separately, not stored in customers table
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions, {
  ipAddress: z.string().ip().optional().or(z.literal('')), // Optional static IP
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).optional().or(z.literal('')),
  expiryDate: z.coerce.date().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true, activationDate: true, subscriptionId: true }); // subscriptionId auto-generated

export const insertCompanyGroupSchema = createInsertSchema(companyGroups).omit({ 
  id: true, 
  createdAt: true,
});

export const insertProfileSchema = createInsertSchema(profiles, {
  price: z.string().or(z.number()),
}).omit({ id: true, createdAt: true });

export const insertInvoiceSchema = createInsertSchema(invoices, {
  amount: z.string().or(z.number()),
  tax: z.string().or(z.number()).optional(),
  total: z.string().or(z.number()),
  dueDate: z.coerce.date().optional(),
  paidDate: z.coerce.date().optional(),
  billingPeriodStart: z.coerce.date().optional(),
  billingPeriodEnd: z.coerce.date().optional(),
}).omit({ id: true, createdAt: true, invoiceNumber: true }); // invoiceNumber auto-generated

export const insertTicketSchema = createInsertSchema(tickets).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  ticketNumber: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ 
  id: true, 
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments, {
  amount: z.string().or(z.number()),
  paymentDate: z.coerce.date().optional(),
}).omit({ id: true, createdAt: true });

export const insertSettingsSchema = createInsertSchema(settings).omit({ 
  id: true, 
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({ 
  id: true,
});

export const insertNasSchema = createInsertSchema(nas).omit({ 
  id: true,
}).extend({
  type: z.enum(['mikrotik', 'cisco', 'ubiquiti', 'other']),
  secret: z.string().min(8, "Secret must be at least 8 characters"),
  ports: z.number().int().positive().optional().default(1812),
});

// FTTH Insert Schemas
export const insertPopSchema = createInsertSchema(pops, {
  latitude: z.string().or(z.number()).optional().or(z.literal('')),
  longitude: z.string().or(z.number()).optional().or(z.literal('')),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
});

export const insertOltSchema = createInsertSchema(olts, {
  ipAddress: z.string().ip(),
  telnetPort: z.number().int().positive().optional().default(23),
  snmpPort: z.number().int().positive().optional().default(161),
  totalPonSlots: z.number().int().positive().optional().default(16),
  portsPerSlot: z.number().int().positive().optional().default(16),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  // Omit legacy fields from insert (keep for backward compat reading)
  oltType: true,
  managementType: true,
  port: true,
  username: true,
  password: true,
  enablePassword: true,
  status: true,
});

export const insertDistributionBoxSchema = createInsertSchema(distributionBoxes, {
  latitude: z.string().or(z.number()).optional().or(z.literal('')),
  longitude: z.string().or(z.number()).optional().or(z.literal('')),
  ponSlotIndex: z.number().int().min(0).max(7), // 0-7 (8 boxes per PON)
  installedAt: z.coerce.date().optional(),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
});

export const insertOnuSchema = createInsertSchema(onus, {
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).optional().or(z.literal('')),
  signalRx: z.string().or(z.number()).optional().or(z.literal('')),
  signalTx: z.string().or(z.number()).optional().or(z.literal('')),
  lastOnline: z.coerce.date().optional(),
  registrationDate: z.coerce.date().optional(),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
});

export const insertDiscoveryRunSchema = createInsertSchema(discoveryRuns, {
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  lastRunAt: z.coerce.date().optional(),
}).omit({ 
  id: true,
});

// Types
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export type CompanyGroup = typeof companyGroups.$inferSelect;
export type InsertCompanyGroup = z.infer<typeof insertCompanyGroupSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

export type Radcheck = typeof radcheck.$inferSelect;
export type Radreply = typeof radreply.$inferSelect;
export type Radgroupcheck = typeof radgroupcheck.$inferSelect;
export type Radgroupreply = typeof radgroupreply.$inferSelect;
export type Radusergroup = typeof radusergroup.$inferSelect;

export type Nas = typeof nas.$inferSelect;
export type InsertNas = z.infer<typeof insertNasSchema>;

export type Pop = typeof pops.$inferSelect;
export type InsertPop = z.infer<typeof insertPopSchema>;

export type Olt = typeof olts.$inferSelect;
export type InsertOlt = z.infer<typeof insertOltSchema>;

export type DistributionBox = typeof distributionBoxes.$inferSelect;
export type InsertDistributionBox = z.infer<typeof insertDistributionBoxSchema>;

export type Onu = typeof onus.$inferSelect;
export type InsertOnu = z.infer<typeof insertOnuSchema>;

export type DiscoveryRun = typeof discoveryRuns.$inferSelect;
export type InsertDiscoveryRun = z.infer<typeof insertDiscoveryRunSchema>;
