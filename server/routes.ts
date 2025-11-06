import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCustomerSchema, insertSubscriptionSchema, insertProfileSchema, insertInvoiceSchema, insertPaymentSchema, insertTicketSchema, insertSettingsSchema, insertCompanyGroupSchema } from "@shared/schema";
import { db } from "./db";
import { customers, subscriptions, profiles, invoices, tickets } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Dashboard Stats
  app.get("/api/dashboard/stats", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Customers Endpoints
  app.get("/api/customers", async (_req, res) => {
    try {
      const allCustomers = await storage.getCustomers();
      res.json(allCustomers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/customers/expiring", async (_req, res) => {
    try {
      const expiringSubscriptions = await storage.getExpiringSubscriptions();
      res.json(expiringSubscriptions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomer(id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(id, validatedData);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Subscriptions Endpoints
  app.get("/api/subscriptions", async (_req, res) => {
    try {
      const allSubscriptions = await storage.getSubscriptions();
      res.json(allSubscriptions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/subscriptions/expiring", async (_req, res) => {
    try {
      const expiringSubscriptions = await storage.getExpiringSubscriptions();
      res.json(expiringSubscriptions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/subscriptions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subscription = await storage.getSubscription(id);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      res.json(subscription);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/subscriptions/customer/:customerId", async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      const subscriptions = await storage.getCustomerSubscriptions(customerId);
      res.json(subscriptions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subscriptions", async (req, res) => {
    try {
      const validatedData = insertSubscriptionSchema.parse(req.body);
      
      // Calculate expiry date based on profile validity
      if (validatedData.profileId) {
        const profile = await storage.getProfile(validatedData.profileId);
        if (profile) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + profile.validityDays);
          validatedData.expiryDate = expiryDate;
        }
      }
      
      const subscription = await storage.createSubscription(validatedData);
      res.status(201).json(subscription);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/subscriptions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertSubscriptionSchema.partial().parse(req.body);
      
      // Calculate new expiry date if profile is changed
      if (validatedData.profileId) {
        const profile = await storage.getProfile(validatedData.profileId);
        if (profile) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + profile.validityDays);
          validatedData.expiryDate = expiryDate;
        }
      }
      
      const subscription = await storage.updateSubscription(id, validatedData);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      res.json(subscription);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/subscriptions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSubscription(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Company Groups Endpoints
  app.get("/api/company-groups", async (_req, res) => {
    try {
      const groups = await storage.getCompanyGroups();
      res.json(groups);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/company-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const group = await storage.getCompanyGroup(id);
      if (!group) {
        return res.status(404).json({ error: "Company group not found" });
      }
      res.json(group);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/company-groups", async (req, res) => {
    try {
      const validatedData = insertCompanyGroupSchema.parse(req.body);
      const group = await storage.createCompanyGroup(validatedData);
      res.status(201).json(group);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/company-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCompanyGroupSchema.partial().parse(req.body);
      const group = await storage.updateCompanyGroup(id, validatedData);
      if (!group) {
        return res.status(404).json({ error: "Company group not found" });
      }
      res.json(group);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Profiles Endpoints
  app.get("/api/profiles", async (_req, res) => {
    try {
      const allProfiles = await storage.getProfiles();
      res.json(allProfiles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const profile = await storage.getProfile(id);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/profiles", async (req, res) => {
    try {
      const validatedData = insertProfileSchema.parse(req.body);
      const profile = await storage.createProfile(validatedData);
      res.status(201).json(profile);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertProfileSchema.partial().parse(req.body);
      const profile = await storage.updateProfile(id, validatedData);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Invoices Endpoints
  app.get("/api/invoices", async (_req, res) => {
    try {
      const allInvoices = await storage.getInvoices();
      // Join with customers and subscriptions/profiles
      const invoicesWithDetails = await Promise.all(
        allInvoices.map(async (invoice) => {
          const customer = await storage.getCustomer(invoice.customerId);
          let profileName = null;
          if (invoice.subscriptionId) {
            const subscription = await storage.getSubscription(invoice.subscriptionId);
            if (subscription) {
              const profile = await storage.getProfile(subscription.profileId);
              profileName = profile?.name;
            }
          }
          return {
            ...invoice,
            customerName: customer?.fullName || 'Unknown',
            profileName,
          };
        })
      );
      res.json(invoicesWithDetails);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/invoices/recent", async (_req, res) => {
    try {
      const recentInvoices = await storage.getRecentInvoices(5);
      // Join with customers
      const invoicesWithCustomers = await Promise.all(
        recentInvoices.map(async (invoice) => {
          const customer = await storage.getCustomer(invoice.customerId);
          return {
            ...invoice,
            customerName: customer?.fullName || 'Unknown',
          };
        })
      );
      res.json(invoicesWithCustomers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
      
      const validatedData = insertInvoiceSchema.parse({
        ...req.body,
        invoiceNumber,
      });
      
      const invoice = await storage.createInvoice(validatedData);
      res.status(201).json(invoice);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Payments Endpoints
  app.get("/api/payments", async (_req, res) => {
    try {
      const allPayments = await storage.getPayments();
      res.json(allPayments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/payments/invoice/:invoiceId", async (req, res) => {
    try {
      const invoiceId = parseInt(req.params.invoiceId);
      const payments = await storage.getInvoicePayments(invoiceId);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/payments/customer/:customerId", async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      const payments = await storage.getCustomerPayments(customerId);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const validatedData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(validatedData);
      res.status(201).json(payment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Tickets Endpoints
  app.get("/api/tickets", async (_req, res) => {
    try {
      const allTickets = await storage.getTickets();
      // Join with customers
      const ticketsWithCustomers = await Promise.all(
        allTickets.map(async (ticket) => {
          const customer = await storage.getCustomer(ticket.customerId);
          return {
            ...ticket,
            customerName: customer?.fullName || 'Unknown',
          };
        })
      );
      res.json(ticketsWithCustomers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tickets/open", async (_req, res) => {
    try {
      const openTickets = await storage.getOpenTickets(5);
      // Join with customers
      const ticketsWithCustomers = await Promise.all(
        openTickets.map(async (ticket) => {
          const customer = await storage.getCustomer(ticket.customerId);
          return {
            ...ticket,
            customerName: customer?.fullName || 'Unknown',
          };
        })
      );
      res.json(ticketsWithCustomers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tickets", async (req, res) => {
    try {
      const validatedData = insertTicketSchema.parse(req.body);
      const ticket = await storage.createTicket(validatedData);
      res.status(201).json(ticket);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/tickets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertTicketSchema.partial().parse(req.body);
      const ticket = await storage.updateTicket(id, validatedData);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      res.json(ticket);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Settings Endpoints
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const validatedData = insertSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateSettings(validatedData);
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
