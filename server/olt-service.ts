import { Telnet } from 'telnet-client';
import type { Olt } from '@shared/schema';

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

  async discoverOnus(olt: Olt): Promise<DiscoveredOnu[]> {
    if (!olt.telnetEnabled) {
      throw new Error('Telnet is not enabled for this OLT');
    }

    const vendor = olt.vendor.toLowerCase();
    
    if (vendor.includes('zte')) {
      return await this.discoverZteOnus(olt);
    } else if (vendor.includes('hioso')) {
      return await this.discoverHiosoOnus(olt);
    } else {
      throw new Error(`Unsupported OLT vendor: ${olt.vendor}`);
    }
  }

  private async discoverZteOnus(olt: Olt): Promise<DiscoveredOnu[]> {
    const connection = await this.connectTelnet(olt);
    const onus: DiscoveredOnu[] = [];
    const errors: string[] = [];

    try {
      if (olt.enablePassword) {
        await connection.send('enable');
        await connection.send(olt.enablePassword);
      }

      const totalSlots = olt.totalPonSlots || 16;
      const portsPerSlot = olt.portsPerSlot || 16;

      for (let slot = 1; slot <= totalSlots; slot++) {
        for (let port = 1; port <= portsPerSlot; port++) {
          const ponPort = `gpon-olt_1/${slot}/${port}`;
          const command = `show gpon onu state ${ponPort}`;
          
          try {
            const response = await connection.exec(command);
            const discovered = await this.parseZteOnuResponse(response, `1/${slot}/${port}`, connection, olt);
            onus.push(...discovered);
          } catch (err: any) {
            errors.push(`Port ${ponPort}: ${err.message}`);
            continue;
          }
        }
      }

      if (errors.length > 0) {
        console.warn(`ZTE OLT ${olt.name} discovery warnings:`, errors.slice(0, 5));
      }
    } finally {
      connection.end();
    }

    return onus;
  }

  private async parseZteOnuResponse(response: string, ponPort: string, connection: Telnet, olt: Olt): Promise<DiscoveredOnu[]> {
    const onus: DiscoveredOnu[] = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      if (line.includes('gpon-onu_')) {
        const match = line.match(/gpon-onu_\d+\/\d+\/\d+:(\d+)/);
        if (match) {
          const onuId = parseInt(match[1]);
          const statusMatch = line.match(/(enable|disable|working|lost|offline|online)/i);
          const status = statusMatch ? statusMatch[1].toLowerCase() : 'unknown';
          
          let ponSerial = `UNKNOWN_${ponPort}_${onuId}`;
          let macAddress = null;
          let signalRx = null;
          let signalTx = null;

          try {
            const onuInterface = `gpon-onu_${ponPort}:${onuId}`;
            const detailCmd = `show gpon remote-onu interface ${onuInterface}`;
            const detailResponse = await connection.exec(detailCmd);
            
            const serialMatch = detailResponse.match(/SN\s*:\s*([A-Z0-9]+)/i);
            const macMatch = detailResponse.match(/MAC\s*:\s*([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i);
            const rxMatch = detailResponse.match(/Rx\s*[Pp]ower\s*:\s*([-+]?\d+\.?\d*)/);
            const txMatch = detailResponse.match(/Tx\s*[Pp]ower\s*:\s*([-+]?\d+\.?\d*)/);

            if (serialMatch) ponSerial = serialMatch[1];
            if (macMatch) macAddress = macMatch[0].split(':')[1].trim().replace(/-/g, ':').toUpperCase();
            if (rxMatch) signalRx = parseFloat(rxMatch[1]);
            if (txMatch) signalTx = parseFloat(txMatch[1]);
          } catch (detailErr) {
            console.warn(`Could not fetch details for ONU ${ponPort}:${onuId}`);
          }
          
          onus.push({
            ponSerial,
            ponPort,
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
            await new Promise(resolve => setTimeout(resolve, 500));
            
            for (let onuId = 1; onuId <= maxOnusPerPort; onuId++) {
              try {
                const command = `show onu ${onuId}`;
                const response = await connection.exec(command);
                
                if (response && !response.toLowerCase().includes('invalid') && 
                    !response.toLowerCase().includes('not found') &&
                    !response.toLowerCase().includes('error')) {
                  
                  const discovered = this.parseHiosoOnuResponse(response, ponPort, onuId);
                  if (discovered) {
                    onus.push(discovered);
                    console.log(`[HIOSO] Found ONU on ${ponPort}:${onuId}`);
                  }
                } else if (onuId === 1) {
                  break;
                }
              } catch (err: any) {
                if (onuId > 10) break;
                continue;
              }
            }
            
            await connection.send('exit\n');
            await new Promise(resolve => setTimeout(resolve, 300));
            
          } catch (err: any) {
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
