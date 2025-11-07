import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCustomerSchema, insertSubscriptionSchema, insertProfileSchema, insertInvoiceSchema, insertPaymentSchema, insertTicketSchema, insertSettingsSchema, insertCompanyGroupSchema, insertUserSchema, insertNasSchema, insertPopSchema, insertOltSchema, insertDistributionBoxSchema, insertOnuSchema } from "@shared/schema";
import { db } from "./db";
import { customers, subscriptions, profiles, invoices, tickets } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { oltService } from "./olt-service";

// Hardcoded superadmin credentials
const SUPERADMIN = {
  username: 'adhielesmana',
  // Hashed 'admin123' using bcrypt with salt rounds 10
  password: '$2b$10$XNBu96OksPSohRuOOvAq0Ocl7unTC6qt1lISWXEqgY8ugrEqAOwii',
  role: 'superadmin',
  fullName: 'Super Administrator',
};

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Superadmin-only middleware
function requireSuperadmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || req.session.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden: Superadmin access required' });
  }
  next();
}

// Admin or Superadmin middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || (req.session.role !== 'superadmin' && req.session.role !== 'admin')) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication Endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // Check hardcoded superadmin first
      if (username === SUPERADMIN.username) {
        const isValid = await bcrypt.compare(password, SUPERADMIN.password);
        if (isValid) {
          req.session.userId = -1; // Special ID for superadmin
          req.session.username = SUPERADMIN.username;
          req.session.role = SUPERADMIN.role;
          return res.json({
            id: -1,
            username: SUPERADMIN.username,
            role: SUPERADMIN.role,
            fullName: SUPERADMIN.fullName,
          });
        }
      }
      
      // Check database users
      const user = await storage.getUserByUsername(username);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Set session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      
      // Return user (without password)
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to logout' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      // Return hardcoded superadmin
      if (req.session.userId === -1) {
        return res.json({
          id: -1,
          username: SUPERADMIN.username,
          role: SUPERADMIN.role,
          fullName: SUPERADMIN.fullName,
        });
      }
      
      // Get user from database
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Users Management (Superadmin only)
  app.get("/api/users", requireSuperadmin, async (_req, res) => {
    try {
      const allUsers = await storage.getUsers();
      // Remove passwords from response
      const usersWithoutPasswords = allUsers.map(({ password: _, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users", requireSuperadmin, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(validatedData);
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/users/:id", requireSuperadmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(id, validatedData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/users/:id", requireSuperadmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteUser(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Permissions Management (Superadmin only)
  app.get("/api/users/:id/permissions", requireSuperadmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const permissions = await storage.getUserPermissions(userId);
      res.json(permissions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users/:id/permissions", requireSuperadmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { menuIds } = req.body;
      await storage.setUserPermissions(userId, menuIds);
      res.status(200).json({ message: 'Permissions updated' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get current user's permissions
  app.get("/api/auth/permissions", requireAuth, async (req, res) => {
    try {
      // Superadmin has access to everything
      if (req.session.role === 'superadmin') {
        const allMenus = ['dashboard', 'customers', 'subscriptions', 'profiles', 'invoices', 'tickets', 'settings'];
        return res.json(allMenus.map(menuId => ({ menuId, canAccess: true })));
      }
      
      const permissions = await storage.getUserPermissions(req.session.userId!);
      res.json(permissions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


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
      const validatedData = insertInvoiceSchema.parse(req.body);
      
      // Generate invoice number atomically using INVYYMMDDNNNNN format
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

  // NAS (Router) Endpoints - Admin only
  app.get("/api/nas", requireAdmin, async (_req, res) => {
    try {
      const nasList = await storage.getNasList();
      res.json(nasList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/nas/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const nasDevice = await storage.getNas(id);
      if (!nasDevice) {
        return res.status(404).json({ error: "NAS device not found" });
      }
      res.json(nasDevice);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/nas", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertNasSchema.parse(req.body);
      const nasDevice = await storage.createNas(validatedData);
      res.status(201).json(nasDevice);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/nas/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertNasSchema.partial().parse(req.body);
      const nasDevice = await storage.updateNas(id, validatedData);
      if (!nasDevice) {
        return res.status(404).json({ error: "NAS device not found" });
      }
      res.json(nasDevice);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/nas/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteNas(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // FTTH POP Endpoints - Admin only
  app.get("/api/pops", requireAdmin, async (_req, res) => {
    try {
      const popsList = await storage.getPops();
      res.json(popsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pops/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pop = await storage.getPop(id);
      if (!pop) {
        return res.status(404).json({ error: "POP not found" });
      }
      res.json(pop);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pops", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertPopSchema.parse(req.body);
      const pop = await storage.createPop(validatedData);
      res.status(201).json(pop);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/pops/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertPopSchema.partial().parse(req.body);
      const pop = await storage.updatePop(id, validatedData);
      if (!pop) {
        return res.status(404).json({ error: "POP not found" });
      }
      res.json(pop);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/pops/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePop(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // FTTH OLT Endpoints - Admin only
  app.get("/api/olts", requireAdmin, async (_req, res) => {
    try {
      const oltsList = await storage.getOlts();
      res.json(oltsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/olts/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const olt = await storage.getOlt(id);
      if (!olt) {
        return res.status(404).json({ error: "OLT not found" });
      }
      res.json(olt);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pops/:popId/olts", requireAdmin, async (req, res) => {
    try {
      const popId = parseInt(req.params.popId);
      const olts = await storage.getPopOlts(popId);
      res.json(olts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/olts", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertOltSchema.parse(req.body);
      const olt = await storage.createOlt(validatedData);
      res.status(201).json(olt);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/olts/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertOltSchema.partial().parse(req.body);
      const olt = await storage.updateOlt(id, validatedData);
      if (!olt) {
        return res.status(404).json({ error: "OLT not found" });
      }
      res.json(olt);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/olts/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteOlt(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/olts/stats/onu-counts", requireAdmin, async (_req, res) => {
    try {
      const onuCounts = await storage.getOnuCountsByOlt();
      res.json(onuCounts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/olts/:id/discover-onus", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const olt = await storage.getOlt(id);
      
      if (!olt) {
        return res.status(404).json({ error: "OLT not found" });
      }

      const discoveredOnus = await oltService.discoverOnus(olt);
      
      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const discoveredOnu of discoveredOnus) {
        try {
          const existingOnu = await storage.getOnuBySerial(discoveredOnu.ponSerial);
          
          if (existingOnu) {
            await storage.updateOnu(existingOnu.id, {
              ponPort: discoveredOnu.ponPort,
              onuId: discoveredOnu.onuId ?? undefined,
              macAddress: discoveredOnu.macAddress ?? undefined,
              signalRx: discoveredOnu.signalRx?.toString() ?? undefined,
              signalTx: discoveredOnu.signalTx?.toString() ?? undefined,
              status: discoveredOnu.status,
            });
            updated++;
          } else {
            if (!discoveredOnu.ponSerial.startsWith('UNKNOWN_')) {
              await storage.createOnu({
                oltId: olt.id,
                ponSerial: discoveredOnu.ponSerial,
                ponPort: discoveredOnu.ponPort,
                onuId: discoveredOnu.onuId ?? undefined,
                macAddress: discoveredOnu.macAddress ?? undefined,
                signalRx: discoveredOnu.signalRx?.toString() ?? undefined,
                signalTx: discoveredOnu.signalTx?.toString() ?? undefined,
                status: discoveredOnu.status,
                subscriptionId: undefined,
                distributionBoxId: undefined,
              });
              created++;
            }
          }
        } catch (error: any) {
          errors.push(`Error processing ONU ${discoveredOnu.ponSerial}: ${error.message}`);
        }
      }

      res.json({
        success: true,
        message: `Discovery complete: ${created} ONUs created, ${updated} ONUs updated`,
        discovered: discoveredOnus.length,
        created,
        updated,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // FTTH Distribution Box Endpoints - Admin only
  app.get("/api/distribution-boxes", requireAdmin, async (_req, res) => {
    try {
      const boxes = await storage.getDistributionBoxes();
      res.json(boxes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/distribution-boxes/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const box = await storage.getDistributionBox(id);
      if (!box) {
        return res.status(404).json({ error: "Distribution box not found" });
      }
      res.json(box);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/olts/:oltId/distribution-boxes", requireAdmin, async (req, res) => {
    try {
      const oltId = parseInt(req.params.oltId);
      const boxes = await storage.getOltDistributionBoxes(oltId);
      res.json(boxes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/olts/:oltId/pons/:ponPort/distribution-boxes", requireAdmin, async (req, res) => {
    try {
      const oltId = parseInt(req.params.oltId);
      const ponPort = req.params.ponPort;
      const boxes = await storage.getPonDistributionBoxes(oltId, ponPort);
      res.json(boxes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/distribution-boxes", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertDistributionBoxSchema.parse(req.body);
      const box = await storage.createDistributionBox(validatedData);
      res.status(201).json(box);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/distribution-boxes/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertDistributionBoxSchema.partial().parse(req.body);
      const box = await storage.updateDistributionBox(id, validatedData);
      if (!box) {
        return res.status(404).json({ error: "Distribution box not found" });
      }
      res.json(box);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/distribution-boxes/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDistributionBox(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // FTTH ONU Endpoints - Admin only
  app.get("/api/onus", requireAdmin, async (_req, res) => {
    try {
      const onusList = await storage.getOnus();
      res.json(onusList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/onus/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const onu = await storage.getOnu(id);
      if (!onu) {
        return res.status(404).json({ error: "ONU not found" });
      }
      res.json(onu);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/olts/:oltId/onus", requireAdmin, async (req, res) => {
    try {
      const oltId = parseInt(req.params.oltId);
      const onus = await storage.getOltOnus(oltId);
      res.json(onus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/onus", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertOnuSchema.parse(req.body);
      const onu = await storage.createOnu(validatedData);
      res.status(201).json(onu);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/onus/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertOnuSchema.partial().parse(req.body);
      const onu = await storage.updateOnu(id, validatedData);
      if (!onu) {
        return res.status(404).json({ error: "ONU not found" });
      }
      res.json(onu);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/onus/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteOnu(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
