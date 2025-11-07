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

interface DetailJob {
  ponSerial: string;
  attempts: number;
  enqueuedAt: Date;
}

interface DetailWorker {
  oltId: number;
  queue: DetailJob[];
  isRunning: boolean;
  maxConcurrency: number;
  activePromises: Set<Promise<void>>;
}

class DiscoveryManager {
  private static instance: DiscoveryManager;
  private loops: Map<number, DiscoveryLoop> = new Map();
  private detailWorkers: Map<number, DetailWorker> = new Map();
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
    
    this.startDetailWorker(oltId);
  }

  private startDetailWorker(oltId: number) {
    if (this.detailWorkers.has(oltId)) {
      return;
    }

    const worker: DetailWorker = {
      oltId,
      queue: [],
      isRunning: true,
      maxConcurrency: 3,
      activePromises: new Set(),
    };

    this.detailWorkers.set(oltId, worker);
    console.log(`[DetailWorker] Started detail enrichment worker for OLT ${oltId}`);
    
    this.processDetailQueue(worker);
  }

  private enqueueDetailFetch(oltId: number, ponSerial: string) {
    const worker = this.detailWorkers.get(oltId);
    if (!worker) {
      console.warn(`[DetailWorker] No worker found for OLT ${oltId}, skipping detail fetch for ${ponSerial}`);
      return;
    }

    const existingJob = worker.queue.find(job => job.ponSerial === ponSerial);
    if (existingJob) {
      return;
    }

    worker.queue.push({
      ponSerial,
      attempts: 0,
      enqueuedAt: new Date(),
    });

    console.log(`[DetailWorker] Enqueued detail fetch for ${ponSerial} (queue size: ${worker.queue.length})`);
  }

  private async processDetailQueue(worker: DetailWorker): Promise<void> {
    while (worker.isRunning && !this.isShuttingDown) {
      if (worker.queue.length === 0) {
        await this.sleep(2000);
        continue;
      }

      while (worker.activePromises.size < worker.maxConcurrency && worker.queue.length > 0) {
        const job = worker.queue.shift();
        if (!job) break;

        const promise = this.fetchOnuDetails(worker.oltId, job)
          .finally(() => {
            worker.activePromises.delete(promise);
          });
        
        worker.activePromises.add(promise);
      }

      if (worker.activePromises.size > 0) {
        await Promise.race(worker.activePromises);
      } else {
        await this.sleep(1000);
      }
    }

    console.log(`[DetailWorker] Worker stopped for OLT ${worker.oltId}`);
  }

  private async fetchOnuDetails(oltId: number, job: DetailJob): Promise<void> {
    try {
      const onu = await db.query.onus.findFirst({
        where: eq(onus.ponSerial, job.ponSerial),
      });

      if (!onu) {
        console.warn(`[DetailWorker] ONU ${job.ponSerial} not found in database`);
        return;
      }

      if (!onu.onuId) {
        console.log(`[DetailWorker] Skipping ${job.ponSerial} - no ONU ID assigned yet`);
        return;
      }

      const olt = await db.query.olts.findFirst({
        where: eq(olts.id, oltId),
      });

      if (!olt) {
        console.error(`[DetailWorker] OLT ${oltId} not found`);
        return;
      }

      console.log(`[DetailWorker] Fetching details for ${job.ponSerial} (${onu.ponPort}:${onu.onuId})`);
      
      const detailInfo = await oltService.getOnuDetailInfo(olt, onu.ponPort, onu.onuId);
      
      const updateData: any = {
        detailsRawOutput: detailInfo.rawOutput,
      };

      if (detailInfo.name) updateData.onuName = detailInfo.name;
      if (detailInfo.deviceType) updateData.deviceType = detailInfo.deviceType;
      if (detailInfo.state) updateData.state = detailInfo.state;
      if (detailInfo.adminState) updateData.adminState = detailInfo.adminState;
      if (detailInfo.phaseState) updateData.phaseState = detailInfo.phaseState;
      if (detailInfo.configState) updateData.configState = detailInfo.configState;
      if (detailInfo.authenticationMode) updateData.authenticationMode = detailInfo.authenticationMode;
      if (detailInfo.snBind) updateData.snBind = detailInfo.snBind;
      if (detailInfo.password) updateData.onuPassword = detailInfo.password;
      if (detailInfo.vportMode) updateData.vportMode = detailInfo.vportMode;
      if (detailInfo.dbaMode) updateData.dbaMode = detailInfo.dbaMode;
      if (detailInfo.onuStatus) updateData.onuStatusDetail = detailInfo.onuStatus;
      if (detailInfo.fec) updateData.fec = detailInfo.fec;
      if (detailInfo.onlineDuration) updateData.onlineDuration = detailInfo.onlineDuration;
      
      if (detailInfo.lastAuthpassTime) {
        try {
          const authDate = new Date(detailInfo.lastAuthpassTime);
          if (!isNaN(authDate.getTime())) {
            updateData.lastAuthpassTime = authDate;
          }
        } catch (err) {
          console.log(`[DetailWorker] Invalid lastAuthpassTime: ${detailInfo.lastAuthpassTime}`);
        }
      }
      
      if (detailInfo.lastOfflineTime) {
        try {
          const offlineDate = new Date(detailInfo.lastOfflineTime);
          if (!isNaN(offlineDate.getTime())) {
            updateData.lastOfflineTime = offlineDate;
          }
        } catch (err) {
          console.log(`[DetailWorker] Invalid lastOfflineTime: ${detailInfo.lastOfflineTime}`);
        }
      }
      
      if (detailInfo.lastDownCause) updateData.lastDownCause = detailInfo.lastDownCause;
      if (detailInfo.currentChannel) updateData.currentChannel = detailInfo.currentChannel;
      if (detailInfo.lineProfile) updateData.lineProfile = detailInfo.lineProfile;
      if (detailInfo.serviceProfile) updateData.serviceProfile = detailInfo.serviceProfile;
      if (detailInfo.distance) updateData.distance = detailInfo.distance;
      if (detailInfo.description) updateData.description = detailInfo.description;

      await db.update(onus)
        .set(updateData)
        .where(eq(onus.ponSerial, job.ponSerial));

      console.log(`[DetailWorker] ✓ Enriched ${job.ponSerial} with details`);
    } catch (error: any) {
      console.error(`[DetailWorker] Error fetching details for ${job.ponSerial}:`, error.message);
      
      job.attempts++;
      if (job.attempts < 3) {
        const worker = this.detailWorkers.get(oltId);
        if (worker) {
          worker.queue.push(job);
          console.log(`[DetailWorker] Requeued ${job.ponSerial} (attempt ${job.attempts}/3)`);
        }
      }
    }
  }

  async stopDiscovery(oltId: number): Promise<void> {
    const loop = this.loops.get(oltId);
    if (!loop) {
      console.log(`[DiscoveryManager] No active discovery found for OLT ${oltId}`);
      return;
    }

    console.log(`[DiscoveryManager] Stopping discovery for OLT ${oltId}`);
    loop.shouldStop = true;

    const worker = this.detailWorkers.get(oltId);
    if (worker) {
      worker.isRunning = false;
      await Promise.all(worker.activePromises);
      this.detailWorkers.delete(oltId);
    }

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

              let needsDetails = false;

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
                  
                  needsDetails = !existing.onuName && discoveredOnu.onuId !== null;
                }
              } else {
                await db.insert(onus).values(dbPayload);
                updatedCount++;
                console.log(`[DiscoveryManager] Inserted new ONU ${discoveredOnu.ponSerial}`);
                
                needsDetails = discoveredOnu.onuId !== null;
              }

              if (needsDetails) {
                this.enqueueDetailFetch(loop.oltId, discoveredOnu.ponSerial);
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

  async initializeAllActiveOlts(): Promise<void> {
    try {
      console.log('[DiscoveryManager] Initializing discovery for all active OLTs...');
      
      const activeOlts = await db.query.olts.findMany();
      
      if (activeOlts.length === 0) {
        console.log('[DiscoveryManager] No OLTs found in database');
        return;
      }

      console.log(`[DiscoveryManager] Found ${activeOlts.length} OLTs to initialize`);

      for (const olt of activeOlts) {
        try {
          console.log(`[DiscoveryManager] Starting discovery for OLT ${olt.id} (${olt.name})`);
          await this.startDiscovery(olt.id);
          
          console.log(`[DiscoveryManager] Enqueuing existing ONUs without details for OLT ${olt.id}`);
          await this.enqueueExistingOnusWithoutDetails(olt.id);
        } catch (error: any) {
          console.error(`[DiscoveryManager] Failed to start discovery for OLT ${olt.id} (${olt.name}):`, error.message);
          
          await db.insert(discoveryRuns).values({
            oltId: olt.id,
            status: 'error',
            startedAt: new Date(),
            completedAt: new Date(),
            errorMessage: `Initialization failed: ${error.message}`,
            discoveredCount: 0,
            updatedCount: 0,
            skippedCount: 0,
          }).onConflictDoUpdate({
            target: discoveryRuns.oltId,
            set: {
              status: 'error',
              errorMessage: `Initialization failed: ${error.message}`,
              completedAt: new Date(),
            },
          });
        }
      }

      console.log('[DiscoveryManager] Discovery initialization complete');
    } catch (error: any) {
      console.error('[DiscoveryManager] Error during initialization:', error.message);
    }
  }

  private async enqueueExistingOnusWithoutDetails(oltId: number): Promise<void> {
    try {
      const onusWithoutDetails = await db.query.onus.findMany({
        where: (table, { eq, and, isNull }) => and(
          eq(table.oltId, oltId),
          isNull(table.onuName)
        ),
      });

      console.log(`[DiscoveryManager] Found ${onusWithoutDetails.length} ONUs without details for OLT ${oltId}`);

      for (const onu of onusWithoutDetails) {
        if (onu.onuId) {
          this.enqueueDetailFetch(oltId, onu.ponSerial);
        }
      }

      console.log(`[DiscoveryManager] Enqueued ${onusWithoutDetails.filter(o => o.onuId).length} ONUs for detail enrichment`);
    } catch (error: any) {
      console.error(`[DiscoveryManager] Error enqueuing existing ONUs: ${error.message}`);
    }
  }

  async shutdown(): Promise<void> {
    console.log('[DiscoveryManager] Shutting down all discovery loops and detail workers...');
    this.isShuttingDown = true;

    const workers = Array.from(this.detailWorkers.values());
    for (const worker of workers) {
      worker.isRunning = false;
    }

    const detailWorkerPromises = workers.map(
      worker => Promise.all(worker.activePromises)
    );
    await Promise.all(detailWorkerPromises);

    const stopPromises = Array.from(this.loops.keys()).map(oltId => this.stopDiscovery(oltId));
    await Promise.all(stopPromises);

    console.log('[DiscoveryManager] All discovery loops and detail workers stopped');
  }
}

export default DiscoveryManager.getInstance();
