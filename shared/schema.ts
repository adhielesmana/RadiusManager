import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, serial } from "drizzle-orm/pg-core";
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
  customerId: integer("customer_id").notNull().references(() => customers.id),
  profileId: integer("profile_id").notNull().references(() => profiles.id),
  installationAddress: text("installation_address").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }), // Optional static IP (IPv4/IPv6), if empty router auto-assigns
  macAddress: varchar("mac_address", { length: 17 }), // Optional MAC address binding
  status: varchar("status", { length: 20 }).notNull().default('active'), // active, suspended, expired
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

// Settings - Application-wide configuration (single row)
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('IDR'), // ISO 4217 currency code
  updatedAt: timestamp("updated_at").defaultNow(),
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
}).omit({ id: true, createdAt: true, updatedAt: true, activationDate: true });

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
}).omit({ id: true, createdAt: true });

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

export type Radcheck = typeof radcheck.$inferSelect;
export type Radreply = typeof radreply.$inferSelect;
export type Radgroupcheck = typeof radgroupcheck.$inferSelect;
export type Radgroupreply = typeof radgroupreply.$inferSelect;
export type Radusergroup = typeof radusergroup.$inferSelect;
