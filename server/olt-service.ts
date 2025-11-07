import { Telnet } from 'telnet-client';
import type { Olt } from '@shared/schema';
import { snmpService } from './snmp-service';

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
  async discoverOnus(olt: Olt): Promise<DiscoveredOnu[]> {
    // Try SNMP first if enabled, fallback to Telnet on any failure
    if (olt.snmpEnabled) {
      try {
        console.log(`[OLT Service] Attempting SNMP discovery for ${olt.name}`);
        const onus = await snmpService.discoverOnus(olt);
        console.log(`[OLT Service] SNMP discovery successful: ${onus.length} ONUs found`);
        return onus;
      } catch (snmpError: any) {
        console.error(`[OLT Service] SNMP discovery failed for ${olt.name}:`, snmpError.message);
        
        if (olt.telnetEnabled) {
          console.log(`[OLT Service] Falling back to Telnet discovery for ${olt.name}`);
          try {
            return await this.discoverOnusByTelnet(olt);
          } catch (telnetError: any) {
            throw new Error(`Both SNMP and Telnet discovery failed. SNMP: ${snmpError.message}, Telnet: ${telnetError.message}`);
          }
        } else {
          throw new Error(`SNMP discovery failed and Telnet is not enabled: ${snmpError.message}`);
        }
      }
    } else if (olt.telnetEnabled) {
      console.log(`[OLT Service] Using Telnet discovery for ${olt.name} (SNMP not enabled)`);
      return await this.discoverOnusByTelnet(olt);
    } else {
      throw new Error(`Neither SNMP nor Telnet is enabled for OLT: ${olt.name}`);
    }
  }

  private async discoverOnusByTelnet(olt: Olt): Promise<DiscoveredOnu[]> {
    const vendor = olt.vendor.toLowerCase();
    
    if (vendor.includes('zte')) {
      return await this.discoverZteOnus(olt);
    } else if (vendor.includes('hioso')) {
      return await this.discoverHiosoOnus(olt);
    } else {
      throw new Error(`Unsupported OLT vendor: ${olt.vendor}`);
    }
  }
  private async connectTelnet(olt: Olt): Promise<Telnet> {
    const connection = new Telnet();
    
    const params = {
      host: olt.ipAddress,
      port: olt.telnetPort || 23,
      timeout: 15000,
      negotiationMandatory: false,
      shellPrompt: /[#>$%]/,
      loginPrompt: /([Ll]ogin|[Uu]sername|[Uu]ser)[: ]*$/,
      passwordPrompt: /[Pp]assword[: ]*$/,
      username: olt.telnetUsername || olt.username || '',
      password: olt.telnetPassword || olt.password || '',
      execTimeout: 10000,
      irs: '\r\n',
      ors: '\n',
      sendTimeout: 2000,
      stripShellPrompt: false,
    };

    console.log(`[Telnet] Connecting to ${olt.vendor} OLT ${olt.name} at ${olt.ipAddress}:${olt.telnetPort || 23}`);
    console.log(`[Telnet] Using credentials - Username: ${params.username}`);
    await connection.connect(params);
    console.log(`[Telnet] Connected successfully to ${olt.name}`);
    
    // ZTE-specific: Stay in exec mode (do NOT enter config mode)
    // ZTE C320 show commands work in privileged exec mode, not config mode
    if (olt.vendor.toLowerCase().includes('zte')) {
      console.log(`[Telnet] ZTE detected - staying in privileged exec mode for show commands`);
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
    
    // Test command to verify we're authenticated properly
    try {
      const versionResponse = await connection.exec('show version');
      console.log(`[Telnet] Version response (${versionResponse.length} chars):`, versionResponse.substring(0, 200));
    } catch (err: any) {
      console.warn(`[Telnet] Show version failed:`, err.message);
    }
    
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

  private async discoverZteOnus(olt: Olt): Promise<DiscoveredOnu[]> {
    const connection = await this.connectTelnet(olt);
    const onus: DiscoveredOnu[] = [];
    const errors: string[] = [];

    try {
      const totalSlots = olt.totalPonSlots || 2;
      const portsPerSlot = olt.portsPerSlot || 16;

      console.log(`[ZTE Discovery] Scanning ${totalSlots} slots x ${portsPerSlot} ports`);

      for (let slot = 1; slot <= totalSlots; slot++) {
        for (let port = 1; port <= portsPerSlot; port++) {
          const ponPort = `gpon-olt_1/${slot}/${port}`;
          const command = `show gpon onu state ${ponPort}`;
          
          try {
            const response = await connection.exec(command);
            
            if (!response || response.trim().length === 0) {
              continue;
            }

            const discovered = await this.parseZteOnuResponse(response, slot, port, connection);
            if (discovered.length > 0) {
              console.log(`[ZTE Discovery] Found ${discovered.length} ONUs on port ${slot}/${port}`);
              onus.push(...discovered);
            }
          } catch (err: any) {
            if (!err.message.includes('socket not writable')) {
              errors.push(`Port ${ponPort}: ${err.message}`);
            }
            continue;
          }
        }
      }

      console.log(`[ZTE Discovery] Total ONUs found: ${onus.length}`);
      if (errors.length > 0) {
        console.warn(`[ZTE Discovery] Warnings:`, errors.slice(0, 10));
      }
    } finally {
      connection.end();
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

  private async discoverHiosoOnus(olt: Olt): Promise<DiscoveredOnu[]> {
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
            
            console.log(`[HIOSO] Querying ONUs on port ${ponPort}...`);
            for (let onuId = 1; onuId <= maxOnusPerPort; onuId++) {
              try {
                const command = `show onu ${onuId}`;
                console.log(`[HIOSO] Executing: ${command}`);
                const response = await connection.exec(command);
                console.log(`[HIOSO] Response for ${ponPort}:${onuId} (${response.length} chars):`, response.substring(0, 200));
                
                if (response && !response.toLowerCase().includes('invalid') && 
                    !response.toLowerCase().includes('not found') &&
                    !response.toLowerCase().includes('error') &&
                    response.trim().length > 0) {
                  
                  const discovered = this.parseHiosoOnuResponse(response, ponPort, onuId);
                  if (discovered) {
                    onus.push(discovered);
                    console.log(`[HIOSO] ✓ Found ONU on ${ponPort}:${onuId} - MAC: ${discovered.macAddress || 'N/A'}, Status: ${discovered.status}`);
                  }
                } else {
                  console.log(`[HIOSO] No valid ONU at ${ponPort}:${onuId}, stopping port scan`);
                  if (onuId === 1) break;
                }
              } catch (err: any) {
                console.log(`[HIOSO] Error querying ${ponPort}:${onuId}: ${err.message}`);
                if (onuId > 10) break;
                continue;
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

  private parseHiosoOnuResponse(response: string, ponPort: string, onuId: number): DiscoveredOnu | null {
    // Parse the response from "show onu {onuId}" command
    const lines = response.split('\n');
    
    let macAddress: string | null = null;
    let ponSerial: string | null = null;
    let status = 'unknown';
    let signalRx: number | null = null;
    let signalTx: number | null = null;

    for (const line of lines) {
      // Look for MAC address
      const macMatch = line.match(/([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i);
      if (macMatch) {
        macAddress = macMatch[0].replace(/-/g, ':').toUpperCase();
      }
      
      // Look for serial number
      const serialMatch = line.match(/Serial\s*[Nn]umber\s*:\s*([A-Z0-9]+)/i) || 
                          line.match(/SN\s*:\s*([A-Z0-9]+)/i);
      if (serialMatch) {
        ponSerial = serialMatch[1];
      }
      
      // Look for status
      const statusMatch = line.match(/(online|offline|silent|registered|active|working)/i);
      if (statusMatch) {
        status = statusMatch[1].toLowerCase();
      }
      
      // Look for signal strength
      const rxMatch = line.match(/Rx\s*[Pp]ower\s*:\s*([-+]?\d+\.?\d*)/);
      if (rxMatch) signalRx = parseFloat(rxMatch[1]);
      
      const txMatch = line.match(/Tx\s*[Pp]ower\s*:\s*([-+]?\d+\.?\d*)/);
      if (txMatch) signalTx = parseFloat(txMatch[1]);
    }

    // If we found some identifying information, create the ONU record
    if (macAddress || ponSerial || status !== 'unknown') {
      return {
        ponSerial: ponSerial || macAddress || `UNKNOWN_${ponPort}_${onuId}`,
        ponPort,
        onuId,
        macAddress,
        signalRx,
        signalTx,
        status: status === 'online' || status === 'registered' || status === 'active' || status === 'working' ? 'online' : 'offline',
      };
    }

    return null;
  }

}

export const oltService = new OltService();
