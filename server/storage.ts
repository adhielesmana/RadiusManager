// Storage layer implementation following the javascript_database blueprint
import { db } from "./db";
import { eq, desc, gte, lte, sql, and, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
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
  users,
  permissions,
  radcheck,
  radreply,
  radusergroup,
  radgroupreply,
  nas,
  pops,
  olts,
  distributionBoxes,
  onus,
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
  type User,
  type InsertUser,
  type Permission,
  type InsertPermission,
  type Nas,
  type InsertNas,
  type Pop,
  type InsertPop,
  type Olt,
  type InsertOlt,
  type DistributionBox,
  type InsertDistributionBox,
  type Onu,
  type InsertOnu,
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
    totalSubscriptions: number;
    activeTickets: number;
    networkPerformance: number;
  }>;
  
  // Activity log
  logActivity(log: InsertActivityLog): Promise<void>;
  
  // Settings operations
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;
  
  // User operations
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  
  // Permission operations
  getUserPermissions(userId: number): Promise<Permission[]>;
  setUserPermissions(userId: number, menuIds: string[]): Promise<void>;
  
  // NAS (Router) operations
  getNasList(): Promise<Nas[]>;
  getNas(id: number): Promise<Nas | undefined>;
  createNas(nas: InsertNas): Promise<Nas>;
  updateNas(id: number, nas: Partial<InsertNas>): Promise<Nas | undefined>;
  deleteNas(id: number): Promise<void>;
  
  // FTTH POP operations
  getPops(): Promise<Pop[]>;
  getPop(id: number): Promise<Pop | undefined>;
  createPop(pop: InsertPop): Promise<Pop>;
  updatePop(id: number, pop: Partial<InsertPop>): Promise<Pop | undefined>;
  deletePop(id: number): Promise<void>;
  
  // FTTH OLT operations
  getOlts(): Promise<Olt[]>;
  getOlt(id: number): Promise<Olt | undefined>;
  getPopOlts(popId: number): Promise<Olt[]>;
  createOlt(olt: InsertOlt): Promise<Olt>;
  updateOlt(id: number, olt: Partial<InsertOlt>): Promise<Olt | undefined>;
  deleteOlt(id: number): Promise<void>;
  
  // FTTH Distribution Box operations
  getDistributionBoxes(): Promise<DistributionBox[]>;
  getDistributionBox(id: number): Promise<DistributionBox | undefined>;
  getOltDistributionBoxes(oltId: number): Promise<DistributionBox[]>;
  getPonDistributionBoxes(oltId: number, ponPort: string): Promise<DistributionBox[]>;
  createDistributionBox(box: InsertDistributionBox): Promise<DistributionBox>;
  updateDistributionBox(id: number, box: Partial<InsertDistributionBox>): Promise<DistributionBox | undefined>;
  deleteDistributionBox(id: number): Promise<void>;
  
  // FTTH ONU operations
  getOnus(): Promise<Onu[]>;
  getOnu(id: number): Promise<Onu | undefined>;
  getOltOnus(oltId: number): Promise<Onu[]>;
  getSubscriptionOnu(subscriptionId: number): Promise<Onu | undefined>;
  getOnuCountsByOlt(): Promise<Record<number, number>>;
  createOnu(onu: InsertOnu): Promise<Onu>;
  updateOnu(id: number, onu: Partial<InsertOnu>): Promise<Onu | undefined>;
  deleteOnu(id: number): Promise<void>;
  
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
    // Generate subscription ID atomically within the insert to prevent race conditions
    const activationDate = new Date();
    const companyGroupId = insertSubscription.companyGroupId || 1;
    
    // Format date as YYMMDD
    const year = activationDate.getFullYear().toString().slice(-2);
    const month = (activationDate.getMonth() + 1).toString().padStart(2, '0');
    const day = activationDate.getDate().toString().padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;
    
    // Get company group code
    const [companyGroup] = await db
      .select()
      .from(companyGroups)
      .where(eq(companyGroups.id, companyGroupId));
    
    if (!companyGroup) {
      throw new Error('Company group not found');
    }
    
    // Use a CTE to calculate the next sequence number and insert atomically
    // This prevents race conditions by having the database calculate the sequence in a single query
    const result = await db.execute<Subscription>(sql`
      WITH next_seq AS (
        SELECT COALESCE(MAX(CAST(SUBSTRING(subscription_id FROM 8 FOR 4) AS INTEGER)), 0) + 1 AS seq
        FROM subscriptions
        WHERE subscription_id LIKE ${datePrefix + companyGroup.code}||'%'
      )
      INSERT INTO subscriptions (
        customer_id, profile_id, company_group_id, installation_address,
        ip_address, mac_address, status, expiry_date, subscription_id
      )
      SELECT 
        ${insertSubscription.customerId},
        ${insertSubscription.profileId},
        ${companyGroupId},
        ${insertSubscription.installationAddress},
        ${insertSubscription.ipAddress || null},
        ${insertSubscription.macAddress || null},
        ${insertSubscription.status || 'active'},
        ${insertSubscription.expiryDate || null},
        ${datePrefix}||${companyGroup.code}||LPAD(seq::text, 4, '0')
      FROM next_seq
      RETURNING *
    `);
    
    const subscription = result.rows[0] as Subscription;
    
    // Get customer for RADIUS sync
    const customer = await this.getCustomer(subscription.customerId);
    if (customer) {
      await this.syncSubscriptionToRadius(subscription, customer);
    }
    
    // Log activity
    await this.logActivity({
      customerId: subscription.customerId,
      action: "subscription_created",
      description: `Subscription ${subscription.subscriptionId} created at ${subscription.installationAddress}`,
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
    // Format date as YYMMDD
    const year = activationDate.getFullYear().toString().slice(-2);
    const month = (activationDate.getMonth() + 1).toString().padStart(2, '0');
    const day = activationDate.getDate().toString().padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;
    
    // Get company group code
    const [companyGroup] = await db
      .select()
      .from(companyGroups)
      .where(eq(companyGroups.id, companyGroupId));
    
    if (!companyGroup) {
      throw new Error('Company group not found');
    }
    
    // Get next sequence number for this date and company
    const [result] = await db.execute<{ seq: number }>(sql`
      SELECT COALESCE(MAX(CAST(SUBSTRING(subscription_id FROM 8 FOR 4) AS INTEGER)), 0) + 1 AS seq
      FROM subscriptions
      WHERE subscription_id LIKE ${datePrefix + companyGroup.code}||'%'
    `);
    
    const sequence = result?.seq || 1;
    const sequenceStr = sequence.toString().padStart(4, '0');
    
    return `${datePrefix}${companyGroup.code}${sequenceStr}`;
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

    // Generate invoice number atomically using INVYYMMDDNNNNN format
    // This uses a CTE to atomically find the next sequence number for today
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const datePrefix = `${yy}${mm}${dd}`;
    
    const result = await db.execute(sql`
      WITH next_seq AS (
        SELECT COALESCE(
          MAX(CAST(SUBSTRING(invoice_number FROM 10 FOR 5) AS INTEGER)),
          0
        ) + 1 as seq
        FROM invoices
        WHERE invoice_number LIKE ${'INV' + datePrefix + '%'}
      )
      INSERT INTO invoices (
        customer_id, 
        subscription_id, 
        invoice_number, 
        amount, 
        tax, 
        total, 
        status, 
        due_date,
        paid_date,
        billing_period_start,
        billing_period_end,
        notes
      )
      SELECT 
        ${invoiceData.customerId}::integer,
        ${invoiceData.subscriptionId || null}::integer,
        'INV' || ${datePrefix} || LPAD(seq::text, 5, '0'),
        ${invoiceData.amount}::numeric,
        ${invoiceData.tax || '0'}::numeric,
        ${invoiceData.total}::numeric,
        ${invoiceData.status || 'pending'}::varchar,
        ${invoiceData.dueDate || null}::timestamp,
        ${invoiceData.paidDate || null}::timestamp,
        ${invoiceData.billingPeriodStart || null}::timestamp,
        ${invoiceData.billingPeriodEnd || null}::timestamp,
        ${invoiceData.notes || null}::text
      FROM next_seq
      RETURNING *
    `);
    
    const invoice = result.rows[0] as Invoice;
    
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
    
    const [totalSubscriptionsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptions);
    
    const [activeTicketsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(
        or(
          eq(tickets.status, 'open'),
          eq(tickets.status, 'in_progress')
        )
      );
    
    const totalCustomers = totalCustomersResult?.count || 0;
    const activeTickets = activeTicketsResult?.count || 0;
    
    // Calculate network performance: 100% - (active tickets / total customers × 100%)
    const networkPerformance = totalCustomers > 0 
      ? 100 - ((activeTickets / totalCustomers) * 100)
      : 100;
    
    return {
      totalCustomers,
      totalSubscriptions: totalSubscriptionsResult?.count || 0,
      activeTickets,
      networkPerformance: Math.max(0, Math.min(100, networkPerformance)), // Clamp between 0-100
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

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash password before storing
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword,
      })
      .returning();
    
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    // Hash password if provided
    const updateData = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    
    const [user] = await db
      .update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    return user || undefined;
  }

  async deleteUser(id: number): Promise<void> {
    // Delete user permissions first
    await db.delete(permissions).where(eq(permissions.userId, id));
    // Delete user
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserPermissions(userId: number): Promise<Permission[]> {
    return await db.select().from(permissions).where(eq(permissions.userId, userId));
  }

  async setUserPermissions(userId: number, menuIds: string[]): Promise<void> {
    // Delete existing permissions
    await db.delete(permissions).where(eq(permissions.userId, userId));
    
    // Insert new permissions
    if (menuIds.length > 0) {
      const permissionsToInsert = menuIds.map(menuId => ({
        userId,
        menuId,
        canAccess: true,
      }));
      
      await db.insert(permissions).values(permissionsToInsert);
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

  // NAS (Router) operations
  async getNasList(): Promise<Nas[]> {
    return await db.select().from(nas).orderBy(nas.nasname);
  }

  async getNas(id: number): Promise<Nas | undefined> {
    const [nasDevice] = await db.select().from(nas).where(eq(nas.id, id));
    return nasDevice || undefined;
  }

  async createNas(insertNas: InsertNas): Promise<Nas> {
    const [nasDevice] = await db
      .insert(nas)
      .values(insertNas)
      .returning();
    
    return nasDevice;
  }

  async updateNas(id: number, data: Partial<InsertNas>): Promise<Nas | undefined> {
    const [nasDevice] = await db
      .update(nas)
      .set(data)
      .where(eq(nas.id, id))
      .returning();
    
    return nasDevice || undefined;
  }

  async deleteNas(id: number): Promise<void> {
    await db.delete(nas).where(eq(nas.id, id));
  }
  
  // FTTH POP operations
  async getPops(): Promise<Pop[]> {
    return await db.select().from(pops).orderBy(pops.name);
  }

  async getPop(id: number): Promise<Pop | undefined> {
    const [pop] = await db.select().from(pops).where(eq(pops.id, id));
    return pop || undefined;
  }

  async createPop(insertPop: InsertPop): Promise<Pop> {
    // Convert latitude/longitude to string for decimal columns
    const popData = {
      ...insertPop,
      latitude: insertPop.latitude ? String(insertPop.latitude) : insertPop.latitude,
      longitude: insertPop.longitude ? String(insertPop.longitude) : insertPop.longitude,
    };
    const [pop] = await db.insert(pops).values(popData as any).returning();
    return pop;
  }

  async updatePop(id: number, updatePop: Partial<InsertPop>): Promise<Pop | undefined> {
    // Convert latitude/longitude to string for decimal columns
    const popData = {
      ...updatePop,
      latitude: updatePop.latitude ? String(updatePop.latitude) : updatePop.latitude,
      longitude: updatePop.longitude ? String(updatePop.longitude) : updatePop.longitude,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };
    const [pop] = await db
      .update(pops)
      .set(popData as any)
      .where(eq(pops.id, id))
      .returning();
    return pop || undefined;
  }

  async deletePop(id: number): Promise<void> {
    await db.delete(pops).where(eq(pops.id, id));
  }
  
  // FTTH OLT operations
  async getOlts(): Promise<Olt[]> {
    return await db.select().from(olts).orderBy(olts.name);
  }

  async getOlt(id: number): Promise<Olt | undefined> {
    const [olt] = await db.select().from(olts).where(eq(olts.id, id));
    return olt || undefined;
  }

  async getPopOlts(popId: number): Promise<Olt[]> {
    return await db.select().from(olts).where(eq(olts.popId, popId)).orderBy(olts.name);
  }

  async createOlt(insertOlt: InsertOlt): Promise<Olt> {
    const [olt] = await db.insert(olts).values(insertOlt).returning();
    return olt;
  }

  async updateOlt(id: number, updateOlt: Partial<InsertOlt>): Promise<Olt | undefined> {
    const [olt] = await db
      .update(olts)
      .set({ ...updateOlt, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(olts.id, id))
      .returning();
    return olt || undefined;
  }

  async deleteOlt(id: number): Promise<void> {
    await db.delete(olts).where(eq(olts.id, id));
  }
  
  // FTTH Distribution Box operations
  async getDistributionBoxes(): Promise<DistributionBox[]> {
    return await db.select().from(distributionBoxes).orderBy(desc(distributionBoxes.createdAt));
  }

  async getDistributionBox(id: number): Promise<DistributionBox | undefined> {
    const [box] = await db.select().from(distributionBoxes).where(eq(distributionBoxes.id, id));
    return box || undefined;
  }

  async getOltDistributionBoxes(oltId: number): Promise<DistributionBox[]> {
    return await db.select().from(distributionBoxes).where(eq(distributionBoxes.oltId, oltId)).orderBy(distributionBoxes.ponPort, distributionBoxes.ponSlotIndex);
  }

  async getPonDistributionBoxes(oltId: number, ponPort: string): Promise<DistributionBox[]> {
    return await db.select().from(distributionBoxes).where(
      and(
        eq(distributionBoxes.oltId, oltId),
        eq(distributionBoxes.ponPort, ponPort)
      )
    ).orderBy(distributionBoxes.ponSlotIndex);
  }

  async createDistributionBox(box: InsertDistributionBox): Promise<DistributionBox> {
    // Validate PON slot index (0-7)
    if (box.ponSlotIndex < 0 || box.ponSlotIndex > 7) {
      throw new Error("PON slot index must be between 0 and 7");
    }

    // Check if we already have 8 boxes on this PON
    const existingBoxes = await this.getPonDistributionBoxes(box.oltId, box.ponPort);
    if (existingBoxes.length >= 8) {
      throw new Error("Maximum of 8 distribution boxes per PON port reached");
    }

    // Convert decimal strings to proper format
    const boxData = {
      ...box,
      latitude: box.latitude ? String(box.latitude) : null,
      longitude: box.longitude ? String(box.longitude) : null,
    };

    const [created] = await db.insert(distributionBoxes).values(boxData).returning();
    return created;
  }

  async updateDistributionBox(id: number, box: Partial<InsertDistributionBox>): Promise<DistributionBox | undefined> {
    // Validate PON slot index if provided
    if (box.ponSlotIndex !== undefined && (box.ponSlotIndex < 0 || box.ponSlotIndex > 7)) {
      throw new Error("PON slot index must be between 0 and 7");
    }

    // Convert decimal strings to proper format
    const boxData = {
      ...box,
      latitude: box.latitude !== undefined ? String(box.latitude) : undefined,
      longitude: box.longitude !== undefined ? String(box.longitude) : undefined,
    };

    const [updated] = await db
      .update(distributionBoxes)
      .set(boxData)
      .where(eq(distributionBoxes.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDistributionBox(id: number): Promise<void> {
    await db.delete(distributionBoxes).where(eq(distributionBoxes.id, id));
  }
  
  // FTTH ONU operations
  async getOnus(): Promise<Onu[]> {
    return await db.select().from(onus).orderBy(desc(onus.createdAt));
  }

  async getOnu(id: number): Promise<Onu | undefined> {
    const [onu] = await db.select().from(onus).where(eq(onus.id, id));
    return onu || undefined;
  }

  async getOltOnus(oltId: number): Promise<Onu[]> {
    return await db.select().from(onus).where(eq(onus.oltId, oltId)).orderBy(onus.ponPort, onus.onuId);
  }

  async getSubscriptionOnu(subscriptionId: number): Promise<Onu | undefined> {
    const [onu] = await db.select().from(onus).where(eq(onus.subscriptionId, subscriptionId));
    return onu || undefined;
  }

  async getOnuCountsByOlt(): Promise<Record<number, number>> {
    const results = await db
      .select({
        oltId: onus.oltId,
        count: sql<number>`count(*)::int`,
      })
      .from(onus)
      .groupBy(onus.oltId);
    
    const counts: Record<number, number> = {};
    for (const result of results) {
      counts[result.oltId] = result.count;
    }
    return counts;
  }

  async createOnu(insertOnu: InsertOnu): Promise<Onu> {
    // Convert signalRx/signalTx to string for decimal columns
    const onuData = {
      ...insertOnu,
      signalRx: insertOnu.signalRx ? String(insertOnu.signalRx) : insertOnu.signalRx,
      signalTx: insertOnu.signalTx ? String(insertOnu.signalTx) : insertOnu.signalTx,
    };
    const [onu] = await db.insert(onus).values(onuData as any).returning();
    return onu;
  }

  async updateOnu(id: number, updateOnu: Partial<InsertOnu>): Promise<Onu | undefined> {
    // Convert signalRx/signalTx to string for decimal columns
    const onuData = {
      ...updateOnu,
      signalRx: updateOnu.signalRx ? String(updateOnu.signalRx) : updateOnu.signalRx,
      signalTx: updateOnu.signalTx ? String(updateOnu.signalTx) : updateOnu.signalTx,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };
    const [onu] = await db
      .update(onus)
      .set(onuData as any)
      .where(eq(onus.id, id))
      .returning();
    return onu || undefined;
  }

  async deleteOnu(id: number): Promise<void> {
    await db.delete(onus).where(eq(onus.id, id));
  }
}

export const storage = new DatabaseStorage();
