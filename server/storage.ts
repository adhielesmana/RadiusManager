// Storage layer implementation following the javascript_database blueprint
import { db } from "./db";
import { eq, desc, gte, lte, sql, and } from "drizzle-orm";
import {
  customers,
  profiles,
  invoices,
  payments,
  tickets,
  activityLogs,
  radcheck,
  radreply,
  radusergroup,
  radgroupreply,
  type Customer,
  type InsertCustomer,
  type Profile,
  type InsertProfile,
  type Invoice,
  type InsertInvoice,
  type Payment,
  type InsertPayment,
  type Ticket,
  type InsertTicket,
  type InsertActivityLog,
} from "@shared/schema";

export interface IStorage {
  // Customer operations
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  getExpiringCustomers(): Promise<Customer[]>;
  
  // Profile operations
  getProfiles(): Promise<Profile[]>;
  getProfile(id: number): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(id: number, profile: Partial<InsertProfile>): Promise<Profile | undefined>;
  
  // Invoice operations
  getInvoices(): Promise<Invoice[]>;
  getRecentInvoices(limit: number): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  
  // Payment operations
  getPayments(): Promise<Payment[]>;
  getInvoicePayments(invoiceId: number): Promise<Payment[]>;
  getCustomerPayments(customerId: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  
  // Ticket operations
  getTickets(): Promise<Ticket[]>;
  getOpenTickets(limit: number): Promise<Ticket[]>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: number, ticket: Partial<InsertTicket>): Promise<Ticket | undefined>;
  
  // Dashboard stats
  getDashboardStats(): Promise<{
    totalCustomers: number;
    activeCustomers: number;
    revenue: number;
    pendingTickets: number;
    expiringAccounts: number;
  }>;
  
  // Activity log
  logActivity(log: InsertActivityLog): Promise<void>;
  
  // RADIUS operations
  syncCustomerToRadius(customer: Customer): Promise<void>;
  syncProfileToRadiusGroup(profile: Profile): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    // Separate password from customer data
    const { password, ...customerData } = insertCustomer;
    
    const [customer] = await db
      .insert(customers)
      .values(customerData)
      .returning();
    
    // Sync to RADIUS with password
    await this.syncCustomerToRadius(customer, password);
    
    // Log activity
    await this.logActivity({
      customerId: customer.id,
      action: "customer_created",
      description: `Customer ${customer.fullName} (${customer.username}) was created`,
    });
    
    return customer;
  }

  async updateCustomer(id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    // Separate password from customer data
    const { password, ...customerData } = data;
    
    const [customer] = await db
      .update(customers)
      .set({ ...customerData, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    
    if (customer) {
      // Sync to RADIUS (with password if provided)
      await this.syncCustomerToRadius(customer, password);
      
      // Log activity
      await this.logActivity({
        customerId: customer.id,
        action: "customer_updated",
        description: `Customer ${customer.fullName} information was updated`,
      });
    }
    
    return customer || undefined;
  }

  async getExpiringCustomers(): Promise<Customer[]> {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    return await db
      .select()
      .from(customers)
      .where(
        and(
          lte(customers.expiryDate, sevenDaysFromNow),
          gte(customers.expiryDate, new Date())
        )
      )
      .orderBy(customers.expiryDate)
      .limit(5);
  }

  async getProfiles(): Promise<Profile[]> {
    return await db.select().from(profiles).orderBy(profiles.name);
  }

  async getProfile(id: number): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
    return profile || undefined;
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const [profile] = await db
      .insert(profiles)
      .values(insertProfile)
      .returning();
    
    // Sync to RADIUS groups
    await this.syncProfileToRadiusGroup(profile);
    
    return profile;
  }

  async updateProfile(id: number, data: Partial<InsertProfile>): Promise<Profile | undefined> {
    const [profile] = await db
      .update(profiles)
      .set(data)
      .where(eq(profiles.id, id))
      .returning();
    
    if (profile) {
      // Sync to RADIUS groups
      await this.syncProfileToRadiusGroup(profile);
    }
    
    return profile || undefined;
  }

  async getInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getRecentInvoices(limit: number): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .orderBy(desc(invoices.createdAt))
      .limit(limit);
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db
      .insert(invoices)
      .values(insertInvoice)
      .returning();
    
    // Log activity
    await this.logActivity({
      customerId: invoice.customerId,
      action: "invoice_created",
      description: `Invoice ${invoice.invoiceNumber} created for $${invoice.total}`,
    });
    
    return invoice;
  }

  async getPayments(): Promise<Payment[]> {
    return await db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async getInvoicePayments(invoiceId: number): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.paymentDate));
  }

  async getCustomerPayments(customerId: number): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.customerId, customerId))
      .orderBy(desc(payments.paymentDate));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    // Create payment record
    const [payment] = await db
      .insert(payments)
      .values(insertPayment)
      .returning();
    
    // Get invoice and all its payments to calculate status
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, insertPayment.invoiceId));
    
    if (invoice) {
      // Get all payments for this invoice
      const allPayments = await this.getInvoicePayments(insertPayment.invoiceId);
      
      // Calculate total paid
      const totalPaid = allPayments.reduce((sum, p) => {
        const amount = typeof p.amount === 'string' ? parseFloat(p.amount) : p.amount;
        return sum + amount;
      }, 0);
      
      const invoiceTotal = typeof invoice.total === 'string' ? parseFloat(invoice.total) : invoice.total;
      
      // Update invoice status based on payment
      let newStatus = invoice.status;
      let paidDate = invoice.paidDate;
      
      if (totalPaid >= invoiceTotal) {
        newStatus = 'paid';
        paidDate = new Date();
      } else if (totalPaid > 0) {
        newStatus = 'partial';
      }
      
      // Update invoice
      await db
        .update(invoices)
        .set({ status: newStatus, paidDate })
        .where(eq(invoices.id, insertPayment.invoiceId));
    }
    
    // Log activity
    await this.logActivity({
      customerId: payment.customerId,
      action: "payment_recorded",
      description: `Payment of $${payment.amount} recorded via ${payment.paymentMethod}`,
    });
    
    return payment;
  }

  async getTickets(): Promise<Ticket[]> {
    return await db.select().from(tickets).orderBy(desc(tickets.createdAt));
  }

  async getOpenTickets(limit: number): Promise<Ticket[]> {
    return await db
      .select()
      .from(tickets)
      .where(eq(tickets.status, 'open'))
      .orderBy(desc(tickets.createdAt))
      .limit(limit);
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    // Generate ticket number
    const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    
    const [ticket] = await db
      .insert(tickets)
      .values({ ...insertTicket, ticketNumber })
      .returning();
    
    // Log activity
    await this.logActivity({
      customerId: ticket.customerId,
      action: "ticket_created",
      description: `Ticket ${ticket.ticketNumber} created: ${ticket.subject}`,
    });
    
    return ticket;
  }

  async updateTicket(id: number, data: Partial<InsertTicket>): Promise<Ticket | undefined> {
    const [ticket] = await db
      .update(tickets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();
    
    if (ticket) {
      // Log activity
      await this.logActivity({
        customerId: ticket.customerId,
        action: "ticket_updated",
        description: `Ticket ${ticket.ticketNumber} updated`,
      });
    }
    
    return ticket || undefined;
  }

  async getDashboardStats() {
    const [totalCustomersResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers);
    
    const [activeCustomersResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(eq(customers.status, 'active'));
    
    const [revenueResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)::decimal` })
      .from(invoices)
      .where(eq(invoices.status, 'paid'));
    
    const [pendingTicketsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(eq(tickets.status, 'open'));
    
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const [expiringAccountsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(
        and(
          lte(customers.expiryDate, sevenDaysFromNow),
          gte(customers.expiryDate, new Date())
        )
      );
    
    return {
      totalCustomers: totalCustomersResult?.count || 0,
      activeCustomers: activeCustomersResult?.count || 0,
      revenue: Number(revenueResult?.total) || 0,
      pendingTickets: pendingTicketsResult?.count || 0,
      expiringAccounts: expiringAccountsResult?.count || 0,
    };
  }

  async logActivity(log: InsertActivityLog): Promise<void> {
    await db.insert(activityLogs).values(log);
  }

  // RADIUS Integration
  async syncCustomerToRadius(customer: Customer, password?: string): Promise<void> {
    // Fetch existing password BEFORE deleting (to preserve it if no new password provided)
    let existingPasswordValue: string | null = null;
    if (!password) {
      const [existingPassword] = await db
        .select()
        .from(radcheck)
        .where(
          and(
            eq(radcheck.username, customer.username),
            eq(radcheck.attribute, "Cleartext-Password")
          )
        );
      existingPasswordValue = existingPassword?.value || null;
    }
    
    // Remove existing entries
    await db.delete(radcheck).where(eq(radcheck.username, customer.username));
    await db.delete(radreply).where(eq(radreply.username, customer.username));
    await db.delete(radusergroup).where(eq(radusergroup.username, customer.username));
    
    // Add password authentication
    const passwordToUse = password || existingPasswordValue;
    if (passwordToUse) {
      await db.insert(radcheck).values({
        username: customer.username,
        attribute: "Cleartext-Password",
        op: ":=",
        value: passwordToUse,
      });
    }
    
    // Add MAC address authentication if provided
    if (customer.macAddress) {
      await db.insert(radcheck).values({
        username: customer.username,
        attribute: "Calling-Station-Id",
        op: "==",
        value: customer.macAddress,
      });
    }
    
    // Map user to profile group if assigned
    if (customer.profileId) {
      const profile = await this.getProfile(customer.profileId);
      if (profile) {
        await db.insert(radusergroup).values({
          username: customer.username,
          groupname: `profile_${profile.id}`,
          priority: 1,
        });
      }
    }
    
    // Add status-based restrictions
    if (customer.status !== 'active') {
      await db.insert(radcheck).values({
        username: customer.username,
        attribute: "Auth-Type",
        op: ":=",
        value: "Reject",
      });
    }
  }

  async syncProfileToRadiusGroup(profile: Profile): Promise<void> {
    const groupname = `profile_${profile.id}`;
    
    // Remove existing group attributes
    await db.delete(radgroupreply).where(eq(radgroupreply.groupname, groupname));
    
    // Add download speed limit (using Mikrotik attributes)
    await db.insert(radgroupreply).values({
      groupname,
      attribute: "Mikrotik-Rate-Limit",
      op: "=",
      value: `${profile.uploadSpeed}M/${profile.downloadSpeed}M`,
      priority: 1,
    });
    
    // Add session timeout (validity in seconds)
    const sessionTimeout = profile.validityDays * 24 * 60 * 60;
    await db.insert(radgroupreply).values({
      groupname,
      attribute: "Session-Timeout",
      op: "=",
      value: sessionTimeout.toString(),
      priority: 1,
    });
    
    // Add data quota if specified
    if (profile.dataQuota) {
      const quotaBytes = profile.dataQuota * 1024 * 1024 * 1024; // Convert GB to bytes
      await db.insert(radgroupreply).values({
        groupname,
        attribute: "ChilliSpot-Max-Total-Octets",
        op: "=",
        value: quotaBytes.toString(),
        priority: 1,
      });
    }
  }
}

export const storage = new DatabaseStorage();
