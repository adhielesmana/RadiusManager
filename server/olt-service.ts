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
      shellPrompt: /[#>$]/,
      loginPrompt: /login[: ]*$/i,
      passwordPrompt: /password[: ]*$/i,
      username: olt.telnetUsername || olt.username || '',
      password: olt.telnetPassword || olt.password || '',
      execTimeout: 10000,
      irs: '\r\n',
      ors: '\n',
      sendTimeout: 2000,
    };

    console.log(`[Telnet] Connecting to ${olt.vendor} OLT ${olt.name} at ${olt.ipAddress}:${olt.telnetPort || 23}`);
    await connection.connect(params);
    console.log(`[Telnet] Connected successfully to ${olt.name}`);
    
    // Try to send a simple test command to verify connection
    try {
      const testResponse = await connection.exec('show version');
      console.log(`[Telnet] Test command response:`, testResponse.substring(0, 100));
    } catch (err: any) {
      console.warn(`[Telnet] Test command failed (might be normal):`, err.message);
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
      const totalPorts = (olt.totalPonSlots || 1) * (olt.portsPerSlot || 8);
      console.log(`[HIOSO Discovery] OLT: ${olt.name}, Scanning ${totalPorts} PON ports`);

      // Try different command variations
      const commandVariations = [
        (port: number) => `show epon onu-information interface epon 0/${port}`,
        (port: number) => `show epon onu-information epon 0/${port}`,
        (port: number) => `show onu running config epon 0/${port}`,
        (port: number) => `show epon interface epon 0/${port}`,
      ];

      for (let port = 1; port <= totalPorts; port++) {
        const ponPort = `0/${port}`;
        let foundOnus = false;

        for (const cmdFunc of commandVariations) {
          const command = cmdFunc(port);
          
          try {
            console.log(`[HIOSO] Trying command: ${command}`);
            const response = await connection.exec(command);
            console.log(`[HIOSO] Port ${ponPort} response (${response.length} chars):`, response.substring(0, 300));
            
            if (response.length > 0 && !response.includes('Invalid') && !response.includes('Error')) {
              const discovered = await this.parseHiosoOnuResponse(response, ponPort, connection);
              console.log(`[HIOSO] Port ${ponPort} found ${discovered.length} ONUs with this command`);
              if (discovered.length > 0) {
                onus.push(...discovered);
                foundOnus = true;
                break; // Found working command, move to next port
              }
            }
          } catch (err: any) {
            console.error(`[HIOSO] Port ${ponPort} command "${command}" error:`, err.message);
            continue; // Try next command variation
          }
        }

        if (!foundOnus) {
          errors.push(`Port ${ponPort}: No working command found`);
        }
      }

      console.log(`[HIOSO Discovery] OLT: ${olt.name}, Total ONUs discovered: ${onus.length}`);
      if (errors.length > 0) {
        console.warn(`HIOSO OLT ${olt.name} discovery warnings:`, errors.slice(0, 10));
      }
    } catch (topErr: any) {
      console.error(`[HIOSO Discovery] Fatal error for OLT ${olt.name}:`, topErr.message);
      throw topErr;
    } finally {
      connection.end();
    }

    return onus;
  }

  private async parseHiosoOnuResponse(response: string, ponPort: string, connection: Telnet): Promise<DiscoveredOnu[]> {
    const onus: DiscoveredOnu[] = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      const macMatch = line.match(/([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i);
      const onuIdMatch = line.match(/\d+\/\d+:(\d+)/);
      const statusMatch = line.match(/(online|offline|silent|registered)/i);

      if (macMatch || onuIdMatch) {
        let macAddress = macMatch ? macMatch[0].replace(/-/g, ':').toUpperCase() : null;
        const onuId = onuIdMatch ? parseInt(onuIdMatch[1]) : null;
        const status = statusMatch ? statusMatch[1].toLowerCase() : 'unknown';
        let signalRx = null;
        let signalTx = null;

        if (onuId && !macAddress) {
          try {
            const detailCmd = `show epon interface epon ${ponPort}:${onuId} onu basic-info`;
            const detailResponse = await connection.exec(detailCmd);
            
            const detailMacMatch = detailResponse.match(/MAC\s*[Aa]ddress\s*:\s*([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i);
            const rxMatch = detailResponse.match(/Rx\s*[Pp]ower\s*:\s*([-+]?\d+\.?\d*)/);
            const txMatch = detailResponse.match(/Tx\s*[Pp]ower\s*:\s*([-+]?\d+\.?\d*)/);

            if (detailMacMatch) macAddress = detailMacMatch[0].split(':')[1].trim().replace(/-/g, ':').toUpperCase();
            if (rxMatch) signalRx = parseFloat(rxMatch[1]);
            if (txMatch) signalTx = parseFloat(txMatch[1]);
          } catch (detailErr) {
            console.warn(`Could not fetch details for ONU ${ponPort}:${onuId}`);
          }
        }

        onus.push({
          ponSerial: macAddress || `UNKNOWN_${ponPort}_${onuId}`,
          ponPort,
          onuId,
          macAddress,
          signalRx,
          signalTx,
          status: status === 'online' || status === 'registered' ? 'online' : 'offline',
        });
      }
    }

    return onus;
  }

}

export const oltService = new OltService();
