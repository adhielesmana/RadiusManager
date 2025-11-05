import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Customers table - ISP customer database (password stored in radcheck only for security)
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  fullName: text("full_name").notNull(),
  nationalId: varchar("national_id", { length: 50 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  email: varchar("email", { length: 255 }),
  homeAddress: text("home_address"),
  installationAddress: text("installation_address"),
  mapsLocationUrl: text("maps_location_url"),
  macAddress: varchar("mac_address", { length: 17 }),
  profileId: integer("profile_id").references(() => profiles.id),
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

// Invoices
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default('0'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, paid, overdue
  dueDate: timestamp("due_date"),
  paidDate: timestamp("paid_date"),
  profileId: integer("profile_id").references(() => profiles.id),
  billingPeriodStart: timestamp("billing_period_start"),
  billingPeriodEnd: timestamp("billing_period_end"),
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
export const customersRelations = relations(customers, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [customers.profileId],
    references: [profiles.id],
  }),
  invoices: many(invoices),
  tickets: many(tickets),
  activityLogs: many(activityLogs),
}));

export const profilesRelations = relations(profiles, ({ many }) => ({
  customers: many(customers),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  profile: one(profiles, {
    fields: [invoices.profileId],
    references: [profiles.id],
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
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).optional().or(z.literal('')),
}).omit({ id: true, createdAt: true, updatedAt: true, activationDate: true }).extend({
  password: z.string().min(4).optional(), // Password handled separately, not stored in customers table
});

export const insertProfileSchema = createInsertSchema(profiles, {
  price: z.string().or(z.number()),
}).omit({ id: true, createdAt: true });

export const insertInvoiceSchema = createInsertSchema(invoices, {
  amount: z.string().or(z.number()),
  tax: z.string().or(z.number()).optional(),
  total: z.string().or(z.number()),
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

// Types
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export type Radcheck = typeof radcheck.$inferSelect;
export type Radreply = typeof radreply.$inferSelect;
export type Radgroupcheck = typeof radgroupcheck.$inferSelect;
export type Radgroupreply = typeof radgroupreply.$inferSelect;
export type Radusergroup = typeof radusergroup.$inferSelect;
