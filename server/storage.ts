// Storage layer implementation following the javascript_database blueprint
import { db } from "./db";
import { eq, desc, gte, lte, sql, and } from "drizzle-orm";
import {
  customers,
  subscriptions,
  profiles,
  invoices,
  payments,
  tickets,
  activityLogs,
  settings,
  companyGroups,
  radcheck,
  radreply,
  radusergroup,
  radgroupreply,
  type Customer,
  type InsertCustomer,
  type Subscription,
  type InsertSubscription,
  type Profile,
  type InsertProfile,
  type Invoice,
  type InsertInvoice,
  type Payment,
  type InsertPayment,
  type Ticket,
  type InsertTicket,
  type InsertActivityLog,
  type Settings,
  type InsertSettings,
  type CompanyGroup,
  type InsertCompanyGroup,
} from "@shared/schema";

export interface IStorage {
  // Customer operations
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  
  // Subscription operations
  getSubscriptions(): Promise<Subscription[]>;
  getSubscription(id: number): Promise<Subscription | undefined>;
  getCustomerSubscriptions(customerId: number): Promise<Subscription[]>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: number, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  deleteSubscription(id: number): Promise<void>;
  getExpiringSubscriptions(): Promise<Subscription[]>;
  generateSubscriptionId(companyGroupId: number, activationDate: Date): Promise<string>;
  
  // Company Group operations
  getCompanyGroups(): Promise<CompanyGroup[]>;
  getCompanyGroup(id: number): Promise<CompanyGroup | undefined>;
  createCompanyGroup(companyGroup: InsertCompanyGroup): Promise<CompanyGroup>;
  updateCompanyGroup(id: number, companyGroup: Partial<InsertCompanyGroup>): Promise<CompanyGroup | undefined>;
  
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
  
  // Settings operations
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;
  
  // RADIUS operations
  syncSubscriptionToRadius(subscription: Subscription, customer: Customer): Promise<void>;
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
    
    // Sync credentials to RADIUS
    await this.syncCustomerCredentials(customer, password);
    
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
      // Sync credentials to RADIUS (with password if provided)
      await this.syncCustomerCredentials(customer, password);
      
      // Log activity
      await this.logActivity({
        customerId: customer.id,
        action: "customer_updated",
        description: `Customer ${customer.fullName} information was updated`,
      });
    }
    
    return customer || undefined;
  }

  async getSubscriptions(): Promise<Subscription[]> {
    return await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
  }

  async getSubscription(id: number): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return subscription || undefined;
  }

  async getCustomerSubscriptions(customerId: number): Promise<Subscription[]> {
    return await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.customerId, customerId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async createSubscription(insertSubscription: InsertSubscription): Promise<Subscription> {
    // Generate subscription ID
    const activationDate = insertSubscription.activationDate || new Date();
    const companyGroupId = insertSubscription.companyGroupId || 1;
    const subscriptionId = await this.generateSubscriptionId(companyGroupId, activationDate);
    
    const [subscription] = await db
      .insert(subscriptions)
      .values({ ...insertSubscription, subscriptionId })
      .returning();
    
    // Get customer for RADIUS sync
    const customer = await this.getCustomer(subscription.customerId);
    if (customer) {
      await this.syncSubscriptionToRadius(subscription, customer);
    }
    
    // Log activity
    await this.logActivity({
      customerId: subscription.customerId,
      action: "subscription_created",
      description: `Subscription ${subscriptionId} created at ${subscription.installationAddress}`,
    });
    
    return subscription;
  }

  async updateSubscription(id: number, data: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const [subscription] = await db
      .update(subscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    
    if (subscription) {
      // Get customer for RADIUS sync
      const customer = await this.getCustomer(subscription.customerId);
      if (customer) {
        await this.syncSubscriptionToRadius(subscription, customer);
      }
      
      // Log activity
      await this.logActivity({
        customerId: subscription.customerId,
        action: "subscription_updated",
        description: `Subscription updated at ${subscription.installationAddress}`,
      });
    }
    
    return subscription || undefined;
  }

  async deleteSubscription(id: number): Promise<void> {
    const subscription = await this.getSubscription(id);
    if (subscription) {
      await db.delete(subscriptions).where(eq(subscriptions.id, id));
      
      // Log activity
      await this.logActivity({
        customerId: subscription.customerId,
        action: "subscription_deleted",
        description: `Subscription ${subscription.subscriptionId} deleted`,
      });
    }
  }

  async getExpiringSubscriptions(): Promise<Subscription[]> {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    return await db
      .select()
      .from(subscriptions)
      .where(
        and(
          lte(subscriptions.expiryDate, sevenDaysFromNow),
          gte(subscriptions.expiryDate, new Date())
        )
      )
      .orderBy(subscriptions.expiryDate)
      .limit(5);
  }

  async generateSubscriptionId(companyGroupId: number, activationDate: Date): Promise<string> {
    // Get company group code
    const companyGroup = await this.getCompanyGroup(companyGroupId);
    if (!companyGroup) {
      throw new Error(`Company group ${companyGroupId} not found`);
    }

    // Format: YYMMDDXNNNN
    const year = activationDate.getFullYear().toString().slice(-2);
    const month = (activationDate.getMonth() + 1).toString().padStart(2, '0');
    const day = activationDate.getDate().toString().padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;
    const companyCode = companyGroup.code;

    // Get count of subscriptions on this date with this company group
    const startOfDay = new Date(activationDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(activationDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.companyGroupId, companyGroupId),
          gte(subscriptions.activationDate, startOfDay),
          lte(subscriptions.activationDate, endOfDay)
        )
      );

    const sequence = (Number(existingCount[0]?.count || 0) + 1).toString().padStart(4, '0');
    return `${datePrefix}${companyCode}${sequence}`;
  }

  async getCompanyGroups(): Promise<CompanyGroup[]> {
    return await db.select().from(companyGroups).orderBy(companyGroups.name);
  }

  async getCompanyGroup(id: number): Promise<CompanyGroup | undefined> {
    const [group] = await db.select().from(companyGroups).where(eq(companyGroups.id, id));
    return group || undefined;
  }

  async createCompanyGroup(insertGroup: InsertCompanyGroup): Promise<CompanyGroup> {
    const [group] = await db
      .insert(companyGroups)
      .values(insertGroup)
      .returning();
    return group;
  }

  async updateCompanyGroup(id: number, data: Partial<InsertCompanyGroup>): Promise<CompanyGroup | undefined> {
    const [group] = await db
      .update(companyGroups)
      .set(data)
      .where(eq(companyGroups.id, id))
      .returning();
    return group || undefined;
  }

  async getProfiles(): Promise<Profile[]> {
    return await db.select().from(profiles).orderBy(profiles.name);
  }

  async getProfile(id: number): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
    return profile || undefined;
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    // Convert price to string if it's a number
    const profileData = {
      ...insertProfile,
      price: typeof insertProfile.price === 'number' ? insertProfile.price.toString() : insertProfile.price,
    };

    const [profile] = await db
      .insert(profiles)
      .values(profileData)
      .returning();
    
    // Sync to RADIUS groups
    await this.syncProfileToRadiusGroup(profile);
    
    return profile;
  }

  async updateProfile(id: number, data: Partial<InsertProfile>): Promise<Profile | undefined> {
    // Convert price to string if it's a number
    const updateData = {
      ...data,
      price: data.price !== undefined 
        ? (typeof data.price === 'number' ? data.price.toString() : data.price)
        : undefined,
    };

    const [profile] = await db
      .update(profiles)
      .set(updateData)
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
    // Convert amounts to strings if they're numbers
    const invoiceData = {
      ...insertInvoice,
      amount: typeof insertInvoice.amount === 'number' ? insertInvoice.amount.toString() : insertInvoice.amount,
      tax: insertInvoice.tax !== undefined 
        ? (typeof insertInvoice.tax === 'number' ? insertInvoice.tax.toString() : insertInvoice.tax)
        : undefined,
      total: typeof insertInvoice.total === 'number' ? insertInvoice.total.toString() : insertInvoice.total,
    };

    const [invoice] = await db
      .insert(invoices)
      .values(invoiceData)
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
    // Convert amount to string if it's a number
    const paymentData = {
      ...insertPayment,
      amount: typeof insertPayment.amount === 'number' ? insertPayment.amount.toString() : insertPayment.amount,
    };

    // Create payment record
    const [payment] = await db
      .insert(payments)
      .values(paymentData)
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
      .from(subscriptions)
      .where(
        and(
          lte(subscriptions.expiryDate, sevenDaysFromNow),
          gte(subscriptions.expiryDate, new Date())
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

  // RADIUS Integration - Customer Credentials
  async syncCustomerCredentials(customer: Customer, password?: string): Promise<void> {
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
    
    // Remove existing credential entries (password and auth-type only)
    await db
      .delete(radcheck)
      .where(
        and(
          eq(radcheck.username, customer.username),
          sql`attribute IN ('Cleartext-Password', 'Auth-Type')`
        )
      );
    
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

  // RADIUS Integration - Subscription to RADIUS
  async syncSubscriptionToRadius(subscription: Subscription, customer: Customer): Promise<void> {
    // Clean up old subscription-specific RADIUS entries for this user
    // Remove MAC address check entries
    await db
      .delete(radcheck)
      .where(
        and(
          eq(radcheck.username, customer.username),
          eq(radcheck.attribute, "Calling-Station-Id")
        )
      );
    
    // Remove IP address reply entries
    await db
      .delete(radreply)
      .where(
        and(
          eq(radreply.username, customer.username),
          eq(radreply.attribute, "Framed-IP-Address")
        )
      );
    
    // Remove profile group mappings
    await db.delete(radusergroup).where(eq(radusergroup.username, customer.username));
    
    // Add MAC address authentication if provided
    if (subscription.macAddress) {
      await db.insert(radcheck).values({
        username: customer.username,
        attribute: "Calling-Station-Id",
        op: "==",
        value: subscription.macAddress,
      });
    }
    
    // Add static IP address if provided
    if (subscription.ipAddress) {
      await db.insert(radreply).values({
        username: customer.username,
        attribute: "Framed-IP-Address",
        op: "=",
        value: subscription.ipAddress,
      });
    }
    
    // Map user to profile group
    const profile = await this.getProfile(subscription.profileId);
    if (profile) {
      await db.insert(radusergroup).values({
        username: customer.username,
        groupname: `profile_${profile.id}`,
        priority: 1,
      });
    }
  }

  async getSettings(): Promise<Settings> {
    // Get settings, create default if doesn't exist
    const result = await db.select().from(settings).limit(1);
    
    if (result.length === 0) {
      // Create default settings with IDR currency
      const [newSettings] = await db.insert(settings).values({
        currencyCode: 'IDR',
      }).returning();
      return newSettings;
    }
    
    return result[0];
  }

  async updateSettings(settingsData: Partial<InsertSettings>): Promise<Settings> {
    // Get or create settings
    const currentSettings = await this.getSettings();
    
    // Update settings
    const [updated] = await db
      .update(settings)
      .set({ ...settingsData, updatedAt: new Date() })
      .where(eq(settings.id, currentSettings.id))
      .returning();
    
    return updated;
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
