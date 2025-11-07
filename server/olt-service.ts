import { Telnet } from 'telnet-client';
import type { Olt } from '@shared/schema';
import { snmpService } from './snmp-service';
import { TelnetSession } from './telnet-session';

export interface DiscoveredOnu {
  ponSerial: string;
  ponPort: string;
  onuId: number | null;
  macAddress: string | null;
  signalRx: number | null;
  signalTx: number | null;
  status: string;
}

export class OltService {
  async discoverOnus(
    olt: Olt,
    onBatch?: (onus: DiscoveredOnu[], progress: { discovered: number, total: number }) => Promise<void>
  ): Promise<DiscoveredOnu[]> {
    // Try SNMP first if enabled, fallback to Telnet on any failure
    if (olt.snmpEnabled) {
      try {
        console.log(`[OLT Service] Attempting SNMP discovery for ${olt.name}`);
        const onus = await snmpService.discoverOnus(olt);
        console.log(`[OLT Service] SNMP discovery successful: ${onus.length} ONUs found`);
        
        // Call onBatch for SNMP results if provided
        if (onBatch && onus.length > 0) {
          await onBatch(onus, { discovered: onus.length, total: onus.length });
        }
        
        return onus;
      } catch (snmpError: any) {
        console.error(`[OLT Service] SNMP discovery failed for ${olt.name}:`, snmpError.message);
        
        if (olt.telnetEnabled) {
          console.log(`[OLT Service] Falling back to Telnet discovery for ${olt.name}`);
          try {
            return await this.discoverOnusByTelnet(olt, onBatch);
          } catch (telnetError: any) {
            throw new Error(`Both SNMP and Telnet discovery failed. SNMP: ${snmpError.message}, Telnet: ${telnetError.message}`);
          }
        } else {
          throw new Error(`SNMP discovery failed and Telnet is not enabled: ${snmpError.message}`);
        }
      }
    } else if (olt.telnetEnabled) {
      console.log(`[OLT Service] Using Telnet discovery for ${olt.name} (SNMP not enabled)`);
      return await this.discoverOnusByTelnet(olt, onBatch);
    } else {
      throw new Error(`Neither SNMP nor Telnet is enabled for OLT: ${olt.name}`);
    }
  }

  private async discoverOnusByTelnet(
    olt: Olt,
    onBatch?: (onus: DiscoveredOnu[], progress: { discovered: number, total: number }) => Promise<void>
  ): Promise<DiscoveredOnu[]> {
    const vendor = olt.vendor.toLowerCase();
    
    if (vendor.includes('zte')) {
      return await this.discoverZteOnus(olt, onBatch);
    } else if (vendor.includes('hioso')) {
      return await this.discoverHiosoOnus(olt, onBatch);
    } else {
      throw new Error(`Unsupported OLT vendor: ${olt.vendor}`);
    }
  }
  private async execZteCommand(connection: Telnet, command: string, timeoutMs: number = 6000): Promise<string> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      let promptCount = 0;
      const promptPattern = /[A-Z0-9\-_]+[#>]\s*$/m;
      
      const socket = connection.getSocket();
      if (!socket) {
        return reject(new Error('Socket not available'));
      }

      const dataHandler = (data: Buffer) => {
        const chunk = data.toString();
        buffer += chunk;
        
        // Check if we hit a prompt
        if (promptPattern.test(buffer)) {
          promptCount++;
          
          // First prompt is the leftover from previous command, skip it
          // Second prompt means command finished
          if (promptCount >= 2) {
            socket.removeListener('data', dataHandler);
            clearTimeout(timeout);
            
            // Extract output between prompts
            const lines = buffer.split('\n');
            const output = lines.slice(1, -1).join('\n').trim();
            resolve(output);
          }
        }
      };

      const timeout = setTimeout(() => {
        socket.removeListener('data', dataHandler);
        // Even if timeout, return what we got
        const lines = buffer.split('\n');
        const output = lines.slice(1, -1).join('\n').trim();
        resolve(output || buffer);
      }, timeoutMs);

      socket.on('data', dataHandler);
      
      // Send the command
      connection.send(command + '\n').catch(reject);
    });
  }

  private async connectTelnet(olt: Olt): Promise<Telnet> {
    const connection = new Telnet();
    
    const params = {
      host: olt.ipAddress,
      port: olt.telnetPort || 23,
      timeout: 15000,
      negotiationMandatory: false,
      shellPrompt: /[#>]/,  // Simple prompt matcher
      loginPrompt: /([Ll]ogin|[Uu]sername|[Uu]ser)[: ]*$/,
      passwordPrompt: /[Pp]assword[: ]*$/,
      username: olt.telnetUsername || olt.username || '',
      password: olt.telnetPassword || olt.password || '',
      execTimeout: 20000,  // Longer timeout for slow responses
      irs: '\r\n',
      ors: '\r\n',  // CRITICAL: Use CRLF for ZTE CLI
      sendTimeout: 3000,  // Longer send timeout
      stripShellPrompt: false,
      removeEcho: false,  // Keep echo for debugging
    };

    console.log(`[Telnet] Connecting to ${olt.vendor} OLT ${olt.name} at ${olt.ipAddress}:${olt.telnetPort || 23}`);
    console.log(`[Telnet] Using credentials - Username: ${params.username}`);
    await connection.connect(params);
    console.log(`[Telnet] Connected successfully to ${olt.name}`);
    
    // Flush initial prompt buffer
    await connection.send('\n');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // ZTE-specific: Disable pagination and stay in exec mode
    if (olt.vendor.toLowerCase().includes('zte')) {
      console.log(`[Telnet] ZTE detected - disabling pagination`);
      try {
        await connection.exec('terminal length 0');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`[Telnet] Pagination disabled successfully`);
      } catch (err: any) {
        console.warn(`[Telnet] Could not disable pagination:`, err.message);
      }
    }
    
    // HIOSO-specific authentication: access password + enable config
    if (olt.vendor.toLowerCase().includes('hioso')) {
      console.log(`[Telnet] HIOSO detected - performing additional authentication steps`);
      
      // Step 1: Enter access password
      try {
        console.log(`[Telnet] Sending access password...`);
        await connection.send('admin\n');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`[Telnet] Access password sent`);
      } catch (err: any) {
        console.warn(`[Telnet] Access password step warning:`, err.message);
      }
      
      // Step 2: Enter enable mode
      try {
        console.log(`[Telnet] Entering enable mode...`);
        await connection.send('enable\n');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`[Telnet] Enable command sent, sending password...`);
        await connection.send('admin\n');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`[Telnet] Enable password sent`);
      } catch (err: any) {
        console.warn(`[Telnet] Enable mode warning:`, err.message);
      }
      
      // Step 3: Enter configure terminal mode
      try {
        console.log(`[Telnet] Entering configure terminal mode...`);
        await connection.send('configure terminal\n');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`[Telnet] Configure terminal mode entered`);
      } catch (err: any) {
        console.warn(`[Telnet] Configure terminal mode warning:`, err.message);
      }
      
      // Step 4: Enter EPON mode
      try {
        console.log(`[Telnet] Entering EPON mode...`);
        await connection.send('epon\n');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`[Telnet] EPON mode entered`);
      } catch (err: any) {
        console.warn(`[Telnet] EPON mode warning:`, err.message);
      }
    }
    
    // Small delay after authentication to let the session stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For HIOSO, discover available commands in EPON mode using "?"
    if (olt.vendor.toLowerCase().includes('hioso')) {
      try {
        console.log(`[Telnet] Discovering available EPON commands with "?"...`);
        const helpResponse = await connection.exec('?');
        console.log(`[Telnet] ========== AVAILABLE EPON COMMANDS ==========`);
        console.log(helpResponse);
        console.log(`[Telnet] ==========================================`);
      } catch (err: any) {
        console.warn(`[Telnet] Help command failed:`, err.message);
      }
    }
    
    return connection;
  }

  private async discoverZteOnus(
    olt: Olt,
    onBatch?: (onus: DiscoveredOnu[], progress: { discovered: number, total: number }) => Promise<void>
  ): Promise<DiscoveredOnu[]> {
    const POOL_SIZE = 8; // Create 8 Telnet sessions for parallel processing (optimized for 1000+ ONUs)
    const BATCH_SIZE = 20; // Save every 20 ONUs
    const SERIAL_BATCH_SIZE = 10; // Fetch serials in batches of 10 per port
    const sessions: TelnetSession[] = [];
    const onus: DiscoveredOnu[] = [];

    // Shared buffer for batching across workers
    const sharedBuffer: DiscoveredOnu[] = [];
    let totalDiscovered = 0;
    let totalOnuCount = 0;

    // Mutex-like function to safely push to shared buffer
    const addToBuffer = async (newOnus: DiscoveredOnu[]) => {
      sharedBuffer.push(...newOnus);
      totalDiscovered += newOnus.length;
      
      // If buffer reaches batch size, save and clear
      if (sharedBuffer.length >= BATCH_SIZE && onBatch) {
        const batch = sharedBuffer.splice(0, BATCH_SIZE);
        await onBatch(batch, { discovered: totalDiscovered, total: totalOnuCount });
      }
    };

    try {
      // Step 1: Get ONU list using a temporary session
      console.log(`[ZTE Discovery] Step 1: Getting ONU list with 'show gpon onu state'`);
      const tempSession = new TelnetSession();
      await this.connectTelnetSession(tempSession, olt);
      
      const stateResponse = await tempSession.execute('show gpon onu state', 8000);
      await tempSession.close();
      
      console.log(`[ZTE Discovery] Response length: ${stateResponse?.length || 0} chars`);
      
      if (!stateResponse || stateResponse.length === 0) {
        console.log(`[ZTE Discovery] No ONUs found (empty response)`);
        return onus;
      }

      console.log(`[ZTE Discovery] First 300 chars:`, stateResponse.substring(0, 300));

      const onuList: Array<{slot: number, port: number, onuId: number, status: string}> = [];
      const lines = stateResponse.split('\n');
      
      for (const line of lines) {
        const match = line.match(/(\d+)\/(\d+)\/(\d+):(\d+)\s+(\w+)\s+(\w+)\s+(\w+)/);
        if (match) {
          const slot = parseInt(match[2]);
          const port = parseInt(match[3]);
          const onuId = parseInt(match[4]);
          const phaseState = match[7];
          
          onuList.push({ slot, port, onuId, status: phaseState.toLowerCase() });
        }
      }

      totalOnuCount = onuList.length;
      console.log(`[ZTE Discovery] Found ${totalOnuCount} ONUs in state list`);

      if (onuList.length === 0) {
        return onus;
      }

      // Step 2: Create connection pool
      console.log(`[ZTE Discovery] Step 2: Creating pool of ${POOL_SIZE} Telnet sessions`);
      for (let i = 0; i < POOL_SIZE; i++) {
        const session = new TelnetSession();
        await this.connectTelnetSession(session, olt);
        sessions.push(session);
      }

      // Step 3: Group ONUs by port for bulk querying
      const portMap = new Map<string, typeof onuList>();
      for (const onu of onuList) {
        const portKey = `${onu.slot}/${onu.port}`;
        if (!portMap.has(portKey)) {
          portMap.set(portKey, []);
        }
        portMap.get(portKey)!.push(onu);
      }

      const ports = Array.from(portMap.keys());
      console.log(`[ZTE Discovery] Step 3: Processing ${totalOnuCount} ONUs across ${ports.length} ports using ${POOL_SIZE} sessions`);
      
      // Distribute ports across workers for parallel processing
      const portChunks: string[][] = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        portChunks.push([]);
      }
      
      ports.forEach((port, index) => {
        portChunks[index % POOL_SIZE].push(port);
      });

      // Process ports in parallel using bulk queries
      const chunkResults = await Promise.all(
        portChunks.map((portChunk, index) => 
          this.processPortsWithBulkQuery(portChunk, portMap, sessions[index], index, addToBuffer)
        )
      );

      // Flatten results
      for (const chunkOnus of chunkResults) {
        onus.push(...chunkOnus);
      }

      // Save remaining ONUs in buffer
      if (sharedBuffer.length > 0 && onBatch) {
        await onBatch(sharedBuffer, { discovered: totalDiscovered, total: totalOnuCount });
        sharedBuffer.length = 0;
      }

      console.log(`[ZTE Discovery] Total ONUs discovered: ${onus.length}`);
    } finally {
      // Close all sessions
      for (const session of sessions) {
        await session.close();
      }
    }

    return onus;
  }

  private async connectTelnetSession(session: TelnetSession, olt: Olt): Promise<void> {
    const params = {
      host: olt.ipAddress,
      port: olt.telnetPort || 23,
      username: olt.telnetUsername!,
      password: olt.telnetPassword!,
      timeout: 15000,
      shellPrompt: /[#>]/,
      loginPrompt: /Username:/i,
      passwordPrompt: /Password:/i,
      ors: '\r\n',
      sendTimeout: 10000,
      execTimeout: 10000,
    };

    await session.connect(params);
    
    // Disable pagination for ZTE
    if (olt.vendor.toLowerCase().includes('zte')) {
      await session.execute('terminal length 0', 5000);
    }
  }

  private async processOnuChunk(
    onuList: Array<{slot: number, port: number, onuId: number, status: string}>,
    session: TelnetSession,
    workerId: number
  ): Promise<DiscoveredOnu[]> {
    const onus: DiscoveredOnu[] = [];
    
    for (const onu of onuList) {
      const onuInterface = `gpon-onu_1/${onu.slot}/${onu.port}:${onu.onuId}`;
      
      try {
        const detailResponse = await session.execute(`show gpon onu detail-info ${onuInterface}`, 6000);
        
        const serialMatch = detailResponse.match(/Serial\s+number\s*:\s*([A-Z0-9]+)/i);
        const ponSerial = serialMatch ? serialMatch[1] : `UNKNOWN_${onu.slot}_${onu.port}_${onu.onuId}`;
        
        let signalRx = null;
        let signalTx = null;

        try {
          const powerResponse = await session.execute(`show pon power attenuation ${onuInterface}`, 6000);
          
          const rxMatch = powerResponse.match(/up\s+Rx\s*:\s*([-+]?\d+\.?\d*)\(dbm\)/i);
          const txMatch = powerResponse.match(/down\s+Tx\s*:\s*([-+]?\d+\.?\d*)\(dbm\)/i);
          
          if (rxMatch) signalRx = parseFloat(rxMatch[1]);
          if (txMatch) signalTx = parseFloat(txMatch[1]);
        } catch (powerErr) {
          // Skip power if unavailable
        }

        onus.push({
          ponSerial,
          ponPort: `${onu.slot}/${onu.port}`,
          onuId: onu.onuId,
          macAddress: null,
          signalRx,
          signalTx,
          status: onu.status === 'working' ? 'online' : 'offline',
        });

        console.log(`[ZTE Worker ${workerId}] ✓ ${onu.slot}/${onu.port}:${onu.onuId} - ${ponSerial}`);
      } catch (err: any) {
        console.warn(`[ZTE Worker ${workerId}] Failed to get details for ${onuInterface}:`, err.message);
      }
    }

    return onus;
  }

  private async processPortsWithBulkQuery(
    ports: string[],
    portMap: Map<string, Array<{slot: number, port: number, onuId: number, status: string}>>,
    session: TelnetSession,
    workerId: number,
    addToBuffer: (onus: DiscoveredOnu[]) => Promise<void>
  ): Promise<DiscoveredOnu[]> {
    const onus: DiscoveredOnu[] = [];
    
    for (const portKey of ports) {
      const onusOnPort = portMap.get(portKey) || [];
      if (onusOnPort.length === 0) continue;

      const firstOnu = onusOnPort[0];
      const slot = firstOnu.slot;
      const port = firstOnu.port;

      try {
        const portStartTime = Date.now();
        console.log(`[ZTE Worker ${workerId}] Querying port ${slot}/${port} with ${onusOnPort.length} ONUs...`);
        
        const bulkStateCmd = `show gpon onu state gpon-olt_1/${slot}/${port}`;
        console.log(`[ZTE Worker ${workerId}] Executing: ${bulkStateCmd}`);
        
        const bulkStateResponse = await session.execute(bulkStateCmd, 10000);
        console.log(`[ZTE Worker ${workerId}] Response length: ${bulkStateResponse?.length || 0} chars`);
        
        const serialFetchStartTime = Date.now();
        const portOnus = await this.parseZteBulkPortResponse(
          bulkStateResponse,
          slot,
          port,
          onusOnPort,
          session
        );
        const serialFetchDuration = ((Date.now() - serialFetchStartTime) / 1000).toFixed(2);

        onus.push(...portOnus);
        await addToBuffer(portOnus);

        const portDuration = ((Date.now() - portStartTime) / 1000).toFixed(2);
        const onuPerSec = (portOnus.length / parseFloat(portDuration)).toFixed(1);
        console.log(`[ZTE Worker ${workerId}] ✓ Port ${slot}/${port}: ${portOnus.length}/${onusOnPort.length} ONUs in ${portDuration}s (${onuPerSec} ONU/s, serial fetch: ${serialFetchDuration}s)`);
      } catch (err: any) {
        console.warn(`[ZTE Worker ${workerId}] Failed bulk query for port ${slot}/${port}:`, err.message);
        console.warn(`[ZTE Worker ${workerId}] Falling back to individual queries for port ${slot}/${port}`);
        
        const fallbackOnus = await this.processOnuListFallback(onusOnPort, session, workerId);
        onus.push(...fallbackOnus);
        await addToBuffer(fallbackOnus);
        
        console.log(`[ZTE Worker ${workerId}] Fallback completed for port ${slot}/${port}: ${fallbackOnus.length} ONUs`);
      }
    }

    return onus;
  }

  private async parseZteBulkPortResponse(
    response: string,
    slot: number,
    port: number,
    expectedOnus: Array<{slot: number, port: number, onuId: number, status: string}>,
    session: TelnetSession
  ): Promise<DiscoveredOnu[]> {
    const onus: DiscoveredOnu[] = [];
    const PARALLEL_LIMIT = 5; // Fetch up to 5 serial numbers in parallel per session
    
    // Import p-limit for concurrency control
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(PARALLEL_LIMIT);
    
    // Process ONUs in parallel batches
    const fetchPromises = expectedOnus.map(expectedOnu => 
      limit(async () => {
        const onuInterface = `gpon-onu_1/${slot}/${port}:${expectedOnu.onuId}`;
        
        try {
          const detailResponse = await session.execute(`show gpon onu detail-info ${onuInterface}`, 5000);
          
          const serialMatch = detailResponse.match(/Serial\s+number\s*:\s*([A-Z0-9]+)/i);
          const ponSerial = serialMatch ? serialMatch[1] : `UNKNOWN_${slot}_${port}_${expectedOnu.onuId}`;

          return {
            ponSerial,
            ponPort: `${slot}/${port}`,
            onuId: expectedOnu.onuId,
            macAddress: null,
            signalRx: null,
            signalTx: null,
            status: expectedOnu.status === 'working' ? 'online' : 'offline',
          };
        } catch (err: any) {
          console.warn(`[ZTE Bulk] Failed to get serial for ${onuInterface}:`, err.message);
          return null; // Skip this ONU if we can't get its serial
        }
      })
    );
    
    const results = await Promise.all(fetchPromises);
    
    // Filter out null results (failed fetches)
    for (const result of results) {
      if (result) {
        onus.push(result);
      }
    }

    return onus;
  }

  private async processOnuListFallback(
    onuList: Array<{slot: number, port: number, onuId: number, status: string}>,
    session: TelnetSession,
    workerId: number
  ): Promise<DiscoveredOnu[]> {
    const onus: DiscoveredOnu[] = [];
    
    for (const onu of onuList) {
      const onuInterface = `gpon-onu_1/${onu.slot}/${onu.port}:${onu.onuId}`;
      
      try {
        const detailResponse = await session.execute(`show gpon onu detail-info ${onuInterface}`, 6000);
        
        const serialMatch = detailResponse.match(/Serial\s+number\s*:\s*([A-Z0-9]+)/i);
        const ponSerial = serialMatch ? serialMatch[1] : `UNKNOWN_${onu.slot}_${onu.port}_${onu.onuId}`;

        onus.push({
          ponSerial,
          ponPort: `${onu.slot}/${onu.port}`,
          onuId: onu.onuId,
          macAddress: null,
          signalRx: null,
          signalTx: null,
          status: onu.status === 'working' ? 'online' : 'offline',
        });
      } catch (err: any) {
        console.warn(`[ZTE Worker ${workerId}] Fallback failed for ${onuInterface}:`, err.message);
      }
    }

    return onus;
  }

  private async parseZteOnuResponse(response: string, slot: number, port: number, connection: Telnet): Promise<DiscoveredOnu[]> {
    const onus: DiscoveredOnu[] = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      const onuMatch = line.match(/gpon-onu_1\/(\d+)\/(\d+):(\d+)/);
      if (onuMatch) {
        const onuId = parseInt(onuMatch[3]);
        const phaseMatch = line.match(/\s+(working|LOS|offline|online)\s*$/i);
        const status = phaseMatch ? phaseMatch[1].toLowerCase() : 'unknown';
        
        let ponSerial = '';
        let macAddress = null;
        let signalRx = null;
        let signalTx = null;

        try {
          const onuInterface = `gpon-onu_1/${slot}/${port}:${onuId}`;
          
          const detailCmd = `show gpon onu detail-info ${onuInterface}`;
          const detailResponse = await connection.exec(detailCmd);
          
          const serialMatch = detailResponse.match(/Serial\s+number\s*:\s*([A-Z0-9]+)/i);
          if (serialMatch) {
            ponSerial = serialMatch[1];
          }

          const equipCmd = `show gpon remote-onu equip ${onuInterface}`;
          const equipResponse = await connection.exec(equipCmd);
          const snMatch = equipResponse.match(/SN\s*:\s*([A-Z0-9]+)/i);
          if (snMatch && !ponSerial) {
            ponSerial = snMatch[1];
          }

          const powerCmd = `show pon power attenuation ${onuInterface}`;
          const powerResponse = await connection.exec(powerCmd);
          const rxMatch = powerResponse.match(/up\s+Rx\s*:\s*([-+]?\d+\.?\d*)\(dbm\)/i);
          const txMatch = powerResponse.match(/down\s+Tx\s*:\s*([-+]?\d+\.?\d*)\(dbm\)/i);
          
          if (rxMatch) signalRx = parseFloat(rxMatch[1]);
          if (txMatch) signalTx = parseFloat(txMatch[1]);

        } catch (detailErr: any) {
          console.warn(`[ZTE] Could not fetch details for ONU ${slot}/${port}:${onuId}:`, detailErr.message);
        }

        if (ponSerial) {
          onus.push({
            ponSerial,
            ponPort: `${slot}/${port}`,
            onuId,
            macAddress,
            signalRx,
            signalTx,
            status: status === 'working' || status === 'online' ? 'online' : 'offline',
          });
        }
      }
    }

    return onus;
  }

  private async discoverHiosoOnus(
    olt: Olt,
    onBatch?: (onus: DiscoveredOnu[], progress: { discovered: number, total: number }) => Promise<void>
  ): Promise<DiscoveredOnu[]> {
    const connection = await this.connectTelnet(olt);
    const onus: DiscoveredOnu[] = [];
    const errors: string[] = [];

    try {
      const totalSlots = olt.totalPonSlots || 1;
      const portsPerSlot = olt.portsPerSlot || 4;
      const maxOnusPerPort = 128;
      
      console.log(`[HIOSO Discovery] OLT: ${olt.name}, Scanning ${totalSlots} slots x ${portsPerSlot} ports`);

      for (let slot = 1; slot <= totalSlots; slot++) {
        for (let port = 1; port <= portsPerSlot; port++) {
          const ponPort = `${slot}/${port}`;
          
          try {
            console.log(`[HIOSO] Entering pon${ponPort}...`);
            await connection.send(`pon${ponPort}\n`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log(`[HIOSO] Querying ONU brief list on port ${ponPort}...`);
            const briefResponse = await connection.exec('show onu brief');
            console.log(`[HIOSO] Brief response length: ${briefResponse.length} chars`);
            console.log(`[HIOSO] Raw brief response for ${ponPort}:\n${briefResponse}`);
            console.log(`[HIOSO] ========== END RAW RESPONSE ==========`);
            
            const activeOnuIds = this.parseHiosoBriefResponse(briefResponse, ponPort);
            console.log(`[HIOSO] Found ${activeOnuIds.length} active ONUs on port ${ponPort}`);
            
            for (const { onuId, ponSerial, status } of activeOnuIds) {
              try {
                const command = `show onu detail ${ponPort} ${onuId}`;
                console.log(`[HIOSO] Executing: ${command}`);
                const response = await connection.exec(command);
                console.log(`[HIOSO] Detail response for ${ponPort}:${onuId} (${response.length} chars)`);
                
                const discovered = this.parseHiosoOnuDetailResponse(response, ponPort, onuId, ponSerial, status);
                if (discovered) {
                  onus.push(discovered);
                  console.log(`[HIOSO] ✓ Found ONU on ${ponPort}:${onuId} - MAC: ${discovered.macAddress || 'N/A'}, SN: ${discovered.ponSerial}, Status: ${discovered.status}`);
                }
              } catch (err: any) {
                console.log(`[HIOSO] Error querying details for ${ponPort}:${onuId}: ${err.message}`);
                const fallbackOnu: DiscoveredOnu = {
                  ponSerial,
                  ponPort,
                  onuId,
                  macAddress: null,
                  signalRx: null,
                  signalTx: null,
                  status: status === 'online' || status === 'working' ? 'online' : 'offline',
                };
                onus.push(fallbackOnu);
                console.log(`[HIOSO] Added ONU ${ponPort}:${onuId} with basic info (SN: ${ponSerial})`);
              }
            }
            
            console.log(`[HIOSO] Exiting pon${ponPort}...`);
            await connection.send('exit\n');
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (err: any) {
            console.error(`[HIOSO] Port pon${ponPort} error: ${err.message}`);
            errors.push(`Port pon${ponPort}: ${err.message}`);
            continue;
          }
        }
      }

      console.log(`[HIOSO Discovery] OLT: ${olt.name}, Total ONUs discovered: ${onus.length}`);
      if (errors.length > 0) {
        console.warn(`HIOSO OLT ${olt.name} discovery warnings:`, errors.slice(0, 10));
      }
    } finally {
      connection.end();
    }

    return onus;
  }

  private parseHiosoBriefResponse(response: string, ponPort: string): Array<{ onuId: number; ponSerial: string; status: string }> {
    const onus: Array<{ onuId: number; ponSerial: string; status: string }> = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('-') || trimmed.toLowerCase().includes('onu') && trimmed.toLowerCase().includes('id')) {
        continue;
      }
      
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 3) {
        const onuIdMatch = parts[0].match(/(\d+)/);
        if (onuIdMatch) {
          const onuId = parseInt(onuIdMatch[1]);
          const status = parts.find(p => p.toLowerCase().match(/online|offline|working|active/i)) || 'unknown';
          const serialMatch = line.match(/([A-Z0-9]{8,16})/);
          const ponSerial = serialMatch ? serialMatch[1] : `EPON_${ponPort.replace('/', '_')}_${onuId}`;
          
          if (onuId >= 1 && onuId <= 128) {
            onus.push({ onuId, ponSerial, status: status.toLowerCase() });
          }
        }
      }
    }
    
    return onus;
  }

  private parseHiosoOnuDetailResponse(
    response: string,
    ponPort: string,
    onuId: number,
    ponSerial: string,
    basicStatus: string
  ): DiscoveredOnu | null {
    const lines = response.split('\n');
    
    let macAddress: string | null = null;
    let status = basicStatus;
    let signalRx: number | null = null;
    let signalTx: number | null = null;

    for (const line of lines) {
      const macMatch = line.match(/([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i);
      if (macMatch) {
        macAddress = macMatch[0].replace(/-/g, ':').toUpperCase();
      }
      
      const statusMatch = line.match(/(online|offline|silent|registered|active|working)/i);
      if (statusMatch) {
        status = statusMatch[1].toLowerCase();
      }
      
      const rxMatch = line.match(/Rx\s*[Pp]ower\s*:\s*([-+]?\d+\.?\d*)/);
      if (rxMatch) signalRx = parseFloat(rxMatch[1]);
      
      const txMatch = line.match(/Tx\s*[Pp]ower\s*:\s*([-+]?\d+\.?\d*)/);
      if (txMatch) signalTx = parseFloat(txMatch[1]);
    }

    return {
      ponSerial,
      ponPort,
      onuId,
      macAddress,
      signalRx,
      signalTx,
      status: status === 'online' || status === 'registered' || status === 'active' || status === 'working' ? 'online' : 'offline',
    };
  }

  async getOnuDetailInfo(olt: Olt, ponPort: string, onuId: number): Promise<any> {
    const vendor = olt.vendor.toLowerCase();
    
    if (!vendor.includes('zte')) {
      throw new Error(`Detailed ONU info only supported for ZTE OLTs (vendor: ${olt.vendor})`);
    }

    if (!olt.telnetEnabled) {
      throw new Error(`Telnet is not enabled for OLT: ${olt.name}`);
    }

    const connection = await this.connectTelnet(olt);

    try {
      // ZTE C320 format: gpon-onu_<rack>/<shelf>/<slot>:<onu_id>
      // If ponPort is "1/5", convert to "1/1/5" (rack 1, shelf 1, slot 5)
      const fullPonPort = ponPort.split('/').length === 2 ? `1/${ponPort}` : ponPort;
      const command = `show gpon onu detail-info gpon-onu_${fullPonPort}:${onuId}`;
      console.log(`[OLT Service] Getting detailed info: ${command}`);
      
      const output = await this.execZteCommand(connection, command);
      
      const details: any = {
        ponPort,
        onuId,
        rawOutput: output,
      };

      const lines = output.split('\n');
      
      // Parse event history table for last authpass/offline times
      let inEventTable = false;
      let lastValidAuthpass: string | null = null;
      let lastValidOffline: string | null = null;
      let lastValidCause: string | null = null;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Detect event history table
        if (trimmed.includes('Authpass Time') && trimmed.includes('OfflineTime')) {
          inEventTable = true;
          continue;
        }
        
        // Parse event table rows
        if (inEventTable) {
          // Match: "1   2007-01-05 07:28:17    2007-01-08 21:32:09     DyingGasp"
          const eventMatch = trimmed.match(/^\d+\s+([\d\-:\s]+)\s+([\d\-:\s]+)\s+(.*)$/);
          if (eventMatch) {
            const authTime = eventMatch[1].trim();
            const offTime = eventMatch[2].trim();
            const cause = eventMatch[3].trim();
            
            // Only store non-zero timestamps
            if (authTime && !authTime.startsWith('0000-00-00')) {
              lastValidAuthpass = authTime;
            }
            if (offTime && !offTime.startsWith('0000-00-00')) {
              lastValidOffline = offTime;
              if (cause) lastValidCause = cause;
            }
          }
          
          // Exit table when we see empty line or next section
          if (!trimmed || trimmed.startsWith('C320-') || trimmed.startsWith('#')) {
            inEventTable = false;
          }
        }
        
        // Parse all ONU detail fields
        if (trimmed.includes('Name:')) {
          const match = trimmed.match(/Name:\s*(.+)/);
          if (match) details.name = match[1].trim();
        }
        if (trimmed.includes('Type:')) {
          const match = trimmed.match(/Type:\s*(.+)/);
          if (match) details.deviceType = match[1].trim();
        }
        if (trimmed.includes('State:') && !trimmed.includes('Phase') && !trimmed.includes('Config') && !trimmed.includes('Admin')) {
          const match = trimmed.match(/State:\s*(.+)/);
          if (match) details.state = match[1].trim();
        }
        if (trimmed.includes('Admin state:')) {
          const match = trimmed.match(/Admin state:\s*(.+)/);
          if (match) details.adminState = match[1].trim();
        }
        if (trimmed.includes('Phase state:')) {
          const match = trimmed.match(/Phase state:\s*(.+)/);
          if (match) details.phaseState = match[1].trim();
        }
        if (trimmed.includes('Config state:')) {
          const match = trimmed.match(/Config state:\s*(.+)/);
          if (match) details.configState = match[1].trim();
        }
        if (trimmed.includes('Authentication mode:')) {
          const match = trimmed.match(/Authentication mode:\s*(.+)/);
          if (match) details.authenticationMode = match[1].trim();
        }
        if (trimmed.includes('SN Bind:')) {
          const match = trimmed.match(/SN Bind:\s*(.+)/);
          if (match) details.snBind = match[1].trim();
        }
        if (trimmed.includes('Serial number:')) {
          const match = trimmed.match(/Serial number:\s*([A-Z0-9]+)/);
          if (match) details.serialNumber = match[1].trim();
        }
        if (trimmed.includes('Password:')) {
          const match = trimmed.match(/Password:\s*(.+)/);
          const pwd = match ? match[1].trim() : '';
          if (pwd) details.password = pwd;
        }
        if (trimmed.includes('Description:')) {
          const match = trimmed.match(/Description:\s*(.+)/);
          if (match) details.description = match[1].trim();
        }
        if (trimmed.includes('Vport mode:')) {
          const match = trimmed.match(/Vport mode:\s*(.+)/);
          if (match) details.vportMode = match[1].trim();
        }
        if (trimmed.includes('DBA Mode:')) {
          const match = trimmed.match(/DBA Mode:\s*(.+)/);
          if (match) details.dbaMode = match[1].trim();
        }
        if (trimmed.includes('ONU Status:')) {
          const match = trimmed.match(/ONU Status:\s*(.+)/);
          if (match) details.onuStatus = match[1].trim();
        }
        if (trimmed.includes('ONU Distance:')) {
          const match = trimmed.match(/ONU Distance:\s*(\d+)m?/);
          if (match) details.distance = parseInt(match[1]);
        }
        if (trimmed.includes('Online Duration:')) {
          const match = trimmed.match(/Online Duration:\s*(.+)/);
          if (match) details.onlineDuration = match[1].trim();
        }
        if (trimmed.includes('FEC:') && !trimmed.includes('actual')) {
          const match = trimmed.match(/FEC:\s*(.+)/);
          if (match) details.fec = match[1].trim();
        }
        if (trimmed.includes('Current channel:')) {
          const match = trimmed.match(/Current channel:\s*(.+)/);
          if (match) details.currentChannel = match[1].trim();
        }
        if (trimmed.includes('Line Profile:')) {
          const match = trimmed.match(/Line Profile:\s*(.+)/);
          if (match) details.lineProfile = match[1].trim();
        }
        if (trimmed.includes('Service Profile:')) {
          const match = trimmed.match(/Service Profile:\s*(.+)/);
          if (match) details.serviceProfile = match[1].trim();
        }
      }
      
      // Add parsed event history
      if (lastValidAuthpass) details.lastAuthpassTime = lastValidAuthpass;
      if (lastValidOffline) details.lastOfflineTime = lastValidOffline;
      if (lastValidCause) details.lastDownCause = lastValidCause;

      return details;

    } finally {
      await connection.end();
    }
  }

}

export const oltService = new OltService();
