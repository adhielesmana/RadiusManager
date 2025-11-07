import { db } from './db';
import { discoveryRuns, olts, onus, type Olt } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { oltService, type DiscoveredOnu } from './olt-service';
import crypto from 'crypto';

interface DiscoveryLoop {
  oltId: number;
  isRunning: boolean;
  shouldStop: boolean;
  currentPromise: Promise<void> | null;
}

class DiscoveryManager {
  private static instance: DiscoveryManager;
  private loops: Map<number, DiscoveryLoop> = new Map();
  private isShuttingDown: boolean = false;

  private constructor() {}

  static getInstance(): DiscoveryManager {
    if (!DiscoveryManager.instance) {
      DiscoveryManager.instance = new DiscoveryManager();
    }
    return DiscoveryManager.instance;
  }

  generateOnuHash(onu: {
    ponSerial: string;
    macAddress: string | null;
    ponPort: string;
    onuId: number | null;
    status: string;
    signalRx: string | number | null;
    signalTx: string | number | null;
  }): string {
    const data = {
      ponSerial: onu.ponSerial,
      macAddress: onu.macAddress || '',
      ponPort: onu.ponPort,
      onuId: onu.onuId || 0,
      status: onu.status,
      signalRx: onu.signalRx?.toString() || '',
      signalTx: onu.signalTx?.toString() || '',
    };
    const jsonString = JSON.stringify(data);
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }

  private mapDiscoveredOnuToDbPayload(oltId: number, discovered: DiscoveredOnu) {
    const hash = this.generateOnuHash(discovered);
    return {
      oltId,
      ponSerial: discovered.ponSerial,
      macAddress: discovered.macAddress,
      ponPort: discovered.ponPort,
      onuId: discovered.onuId,
      status: discovered.status,
      signalRx: discovered.signalRx?.toString() || null,
      signalTx: discovered.signalTx?.toString() || null,
      dataHash: hash,
    };
  }

  async startDiscovery(oltId: number): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Discovery manager is shutting down');
    }

    const existingLoop = this.loops.get(oltId);
    if (existingLoop?.isRunning) {
      console.log(`[DiscoveryManager] Discovery already running for OLT ${oltId}`);
      return;
    }

    const olt = await db.query.olts.findFirst({
      where: eq(olts.id, oltId),
    });

    if (!olt) {
      throw new Error(`OLT ${oltId} not found`);
    }

    console.log(`[DiscoveryManager] Starting background discovery for OLT ${oltId} (${olt.name})`);

    await db.insert(discoveryRuns).values({
      oltId,
      status: 'running',
      startedAt: new Date(),
      discoveredCount: 0,
      updatedCount: 0,
      skippedCount: 0,
    }).onConflictDoUpdate({
      target: discoveryRuns.oltId,
      set: {
        status: 'running',
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
        discoveredCount: 0,
        updatedCount: 0,
        skippedCount: 0,
      },
    });

    const loop: DiscoveryLoop = {
      oltId,
      isRunning: true,
      shouldStop: false,
      currentPromise: null,
    };

    this.loops.set(oltId, loop);
    loop.currentPromise = this.runDiscoveryLoop(loop, olt);
  }

  async stopDiscovery(oltId: number): Promise<void> {
    const loop = this.loops.get(oltId);
    if (!loop) {
      console.log(`[DiscoveryManager] No active discovery found for OLT ${oltId}`);
      return;
    }

    console.log(`[DiscoveryManager] Stopping discovery for OLT ${oltId}`);
    loop.shouldStop = true;

    await db.update(discoveryRuns)
      .set({ status: 'stopped', completedAt: new Date() })
      .where(eq(discoveryRuns.oltId, oltId));

    if (loop.currentPromise) {
      await loop.currentPromise;
    }

    this.loops.delete(oltId);
  }

  async getStatus(oltId?: number) {
    if (oltId) {
      const run = await db.query.discoveryRuns.findFirst({
        where: eq(discoveryRuns.oltId, oltId),
      });
      return run || null;
    }

    const allRuns = await db.query.discoveryRuns.findMany();
    return allRuns;
  }

  private async runDiscoveryLoop(loop: DiscoveryLoop, olt: Olt): Promise<void> {
    while (!loop.shouldStop && !this.isShuttingDown) {
      try {
        console.log(`[DiscoveryManager] Starting discovery cycle for OLT ${loop.oltId} (${olt.name})`);
        
        const startTime = Date.now();
        let discoveredCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        await oltService.discoverOnus(
          olt,
          async (batch: DiscoveredOnu[]) => {
            for (const discoveredOnu of batch) {
              discoveredCount++;
              
              const dbPayload = this.mapDiscoveredOnuToDbPayload(loop.oltId, discoveredOnu);
              
              const existing = await db.query.onus.findFirst({
                where: eq(onus.ponSerial, discoveredOnu.ponSerial),
              });

              if (existing) {
                if (existing.dataHash === dbPayload.dataHash) {
                  skippedCount++;
                  console.log(`[DiscoveryManager] Skipped ONU ${discoveredOnu.ponSerial} (no changes)`);
                } else {
                  await db.update(onus)
                    .set({
                      ...dbPayload,
                      updatedAt: new Date(),
                    })
                    .where(eq(onus.ponSerial, discoveredOnu.ponSerial));
                  updatedCount++;
                  console.log(`[DiscoveryManager] Updated ONU ${discoveredOnu.ponSerial}`);
                }
              } else {
                await db.insert(onus).values(dbPayload);
                updatedCount++;
                console.log(`[DiscoveryManager] Inserted new ONU ${discoveredOnu.ponSerial}`);
              }
            }

            await db.update(discoveryRuns)
              .set({
                discoveredCount,
                updatedCount,
                skippedCount,
                lastRunAt: new Date(),
              })
              .where(eq(discoveryRuns.oltId, loop.oltId));
          }
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(
          `[DiscoveryManager] Discovery cycle completed for OLT ${loop.oltId} in ${duration}s. ` +
          `Discovered: ${discoveredCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`
        );

        await db.update(discoveryRuns)
          .set({
            discoveredCount,
            updatedCount,
            skippedCount,
            completedAt: new Date(),
            lastRunAt: new Date(),
          })
          .where(eq(discoveryRuns.oltId, loop.oltId));

        if (!loop.shouldStop && !this.isShuttingDown) {
          console.log(`[DiscoveryManager] Waiting 5 seconds before next cycle for OLT ${loop.oltId}...`);
          await this.sleep(5000);
        }

      } catch (error: any) {
        console.error(`[DiscoveryManager] Error in discovery loop for OLT ${loop.oltId}:`, error.message);
        
        await db.update(discoveryRuns)
          .set({
            status: 'error',
            errorMessage: error.message,
            completedAt: new Date(),
          })
          .where(eq(discoveryRuns.oltId, loop.oltId));

        console.log(`[DiscoveryManager] Waiting 30 seconds before retry due to error...`);
        await this.sleep(30000);

        await db.update(discoveryRuns)
          .set({ status: 'running', errorMessage: null })
          .where(eq(discoveryRuns.oltId, loop.oltId));
      }
    }

    loop.isRunning = false;
    console.log(`[DiscoveryManager] Discovery loop stopped for OLT ${loop.oltId}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async shutdown(): Promise<void> {
    console.log('[DiscoveryManager] Shutting down all discovery loops...');
    this.isShuttingDown = true;

    const stopPromises = Array.from(this.loops.keys()).map(oltId => this.stopDiscovery(oltId));
    await Promise.all(stopPromises);

    console.log('[DiscoveryManager] All discovery loops stopped');
  }
}

export default DiscoveryManager.getInstance();
