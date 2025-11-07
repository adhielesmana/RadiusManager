import snmp from 'snmp-native';
import type { Olt } from '@shared/schema';

export interface DiscoveredOnu {
  ponSerial: string;
  ponPort: string;
  onuId: number;
  macAddress: string | null;
  signalRx: number | null;
  signalTx: number | null;
  status: 'online' | 'offline';
  distance?: number | null;
  onuType?: string | null;
}

// SNMP OID mappings for different OLT vendors
const SNMP_OIDS = {
  zte_c320: {
    // ZTE C320 GPON OLT - Base OID: .1.3.6.1.4.1.3902.1012
    baseOid: '.1.3.6.1.4.1.3902.1012',
    gponOntPhaseState: '.1.3.6.1.4.1.3902.1012.3.28.1.1.2', // ONU status (3=working, 2=los)
    gponOntOpticalDdmRxPower: '.1.3.6.1.4.1.3902.1012.3.50.12.1.1.10', // RX power (0.01 dBm units)
    gponOntOpticalDdmTxPower: '.1.3.6.1.4.1.3902.1012.3.50.12.1.1.9', // TX power (0.01 dBm units)
    gponOntDistance: '.1.3.6.1.4.1.3902.1012.3.28.2.1.5', // Distance in meters
    gponOntSerialNumber: '.1.3.6.1.4.1.3902.1012.3.28.1.1.5', // Serial number (hex string)
    gponOntMacAddress: '.1.3.6.1.4.1.3902.1012.3.28.1.1.3', // MAC address (different from serial)
  },
  hioso_epon: {
    // HIOSO EPON OLT - Standard EPON OIDs (BDCOM/CData compatible)
    baseOid: '.1.3.6.1.4.1.3320.101',
    eponOnuOnlineStatus: '.1.3.6.1.4.1.3320.101.11.4.1.5', // 1=online, 2=offline
    eponOnuMacAddress: '.1.3.6.1.4.1.3320.101.10.1.1.76', // ONU MAC address
    eponOnuRxPower: '.1.3.6.1.4.1.3320.101.10.5.1.5', // RX power in 0.1 dBm units
    eponOnuTxPower: '.1.3.6.1.4.1.3320.101.10.5.1.6', // TX power in 0.1 dBm units
    eponOnuDescription: '.1.3.6.1.4.1.3320.101.10.1.1.3', // ONU description
  },
};

class SnmpService {
  private session: any;

  constructor() {
    // Create reusable SNMP session
    this.session = new snmp.Session({ timeout: 5000, retries: 2 });
  }

  async discoverOnus(olt: Olt): Promise<DiscoveredOnu[]> {
    if (!olt.snmpEnabled) {
      throw new Error(`SNMP is not enabled for OLT: ${olt.name}`);
    }

    const vendor = olt.vendor.toLowerCase();

    if (vendor.includes('zte')) {
      return await this.discoverZteOnus(olt);
    } else if (vendor.includes('hioso')) {
      return await this.discoverHiosoOnus(olt);
    } else {
      throw new Error(`Unsupported OLT vendor for SNMP: ${olt.vendor}`);
    }
  }

  private async discoverZteOnus(olt: Olt): Promise<DiscoveredOnu[]> {
    const onus: DiscoveredOnu[] = [];

    try {
      console.log(`[SNMP] Starting ZTE C320 ONU discovery for ${olt.name} at ${olt.ipAddress}:${olt.snmpPort}`);

      // Get all ONU phase states (online/offline status)
      const stateOid = SNMP_OIDS.zte_c320.gponOntPhaseState;
      console.log(`[SNMP] Querying ONU states: ${stateOid}`);

      const stateResults = await this.snmpWalk(olt, stateOid);
      console.log(`[SNMP] Found ${stateResults.length} ONU state entries`);

      for (const result of stateResults) {
        try {
          // OID format: .1.3.6.1.4.1.3902.1012.3.28.1.1.2.{ifIndex}
          // ifIndex encodes: shelf.slot.port.onuid (e.g., 269025792 = 0x10010100)
          const ifIndex = this.extractIfIndexFromOid(result.oid);
          const { shelf, slot, port, onuId } = this.decodeZteIfIndex(ifIndex);
          const ponPort = `${shelf}/${slot}/${port}`;

          const phaseState = parseInt(result.value);
          const status: 'online' | 'offline' = phaseState === 3 ? 'online' : 'offline';

          // Get additional ONU details
          let ponSerial = `UNKNOWN_${ponPort}_${onuId}`;
          let macAddress = null;
          let signalRx = null;
          let signalTx = null;
          let distance = null;

          // Try to get serial number
          try {
            const serialOid = `${SNMP_OIDS.zte_c320.gponOntSerialNumber}.${ifIndex}`;
            const serialResult = await this.snmpGet(olt, serialOid);
            if (serialResult && serialResult.value) {
              ponSerial = this.parseHexString(serialResult.value);
            }
          } catch (err) {
            console.warn(`[SNMP] Could not get serial for ${ponPort}:${onuId}`);
          }

          // Try to get optical power levels
          try {
            const rxOid = `${SNMP_OIDS.zte_c320.gponOntOpticalDdmRxPower}.${ifIndex}`;
            const rxResult = await this.snmpGet(olt, rxOid);
            if (rxResult && rxResult.value) {
              signalRx = parseInt(rxResult.value) / 100; // Convert from 0.01 dBm to dBm
            }
          } catch (err) {
            console.warn(`[SNMP] Could not get RX power for ${ponPort}:${onuId}`);
          }

          try {
            const txOid = `${SNMP_OIDS.zte_c320.gponOntOpticalDdmTxPower}.${ifIndex}`;
            const txResult = await this.snmpGet(olt, txOid);
            if (txResult && txResult.value) {
              signalTx = parseInt(txResult.value) / 100; // Convert from 0.01 dBm to dBm
            }
          } catch (err) {
            console.warn(`[SNMP] Could not get TX power for ${ponPort}:${onuId}`);
          }

          // Try to get distance
          try {
            const distanceOid = `${SNMP_OIDS.zte_c320.gponOntDistance}.${ifIndex}`;
            const distanceResult = await this.snmpGet(olt, distanceOid);
            if (distanceResult && distanceResult.value) {
              distance = parseInt(distanceResult.value);
            }
          } catch (err) {
            console.warn(`[SNMP] Could not get distance for ${ponPort}:${onuId}`);
          }

          onus.push({
            ponSerial,
            ponPort,
            onuId,
            macAddress,
            signalRx,
            signalTx,
            status,
            distance,
          });

          console.log(`[SNMP] ✓ Found ZTE ONU: ${ponPort}:${onuId}, Status: ${status}, RX: ${signalRx}`);
        } catch (err: any) {
          console.error(`[SNMP] Error processing ZTE ONU entry:`, err.message);
          continue;
        }
      }
    } catch (err: any) {
      console.error(`[SNMP] ZTE discovery error:`, err.message);
      throw err;
    }

    console.log(`[SNMP] ZTE discovery complete: ${onus.length} ONUs found`);
    return onus;
  }

  private async discoverHiosoOnus(olt: Olt): Promise<DiscoveredOnu[]> {
    const onus: DiscoveredOnu[] = [];

    try {
      console.log(`[SNMP] Starting HIOSO EPON ONU discovery for ${olt.name} at ${olt.ipAddress}:${olt.snmpPort}`);

      // Get all ONU online statuses
      const statusOid = SNMP_OIDS.hioso_epon.eponOnuOnlineStatus;
      console.log(`[SNMP] Querying ONU statuses: ${statusOid}`);

      const statusResults = await this.snmpWalk(olt, statusOid);
      console.log(`[SNMP] Found ${statusResults.length} ONU status entries`);

      for (const result of statusResults) {
        try {
          // Extract ifIndex from OID
          const ifIndex = this.extractIfIndexFromOid(result.oid);
          const { slot, port, onuId } = this.decodeHiosoIfIndex(ifIndex);
          const ponPort = `${slot}/${port}`;

          const onlineStatus = parseInt(result.value);
          const status: 'online' | 'offline' = onlineStatus === 1 ? 'online' : 'offline';

          // Get additional ONU details
          let macAddress = null;
          let ponSerial = null;
          let signalRx = null;
          let signalTx = null;

          // Try to get MAC address
          try {
            const macOid = `${SNMP_OIDS.hioso_epon.eponOnuMacAddress}.${ifIndex}`;
            const macResult = await this.snmpGet(olt, macOid);
            if (macResult && macResult.value) {
              macAddress = this.formatMacAddress(macResult.value);
              ponSerial = macAddress; // For EPON, MAC often serves as serial
            }
          } catch (err) {
            console.warn(`[SNMP] Could not get MAC for ${ponPort}:${onuId}`);
          }

          // Try to get RX power
          try {
            const rxOid = `${SNMP_OIDS.hioso_epon.eponOnuRxPower}.${ifIndex}`;
            const rxResult = await this.snmpGet(olt, rxOid);
            if (rxResult && rxResult.value) {
              signalRx = parseInt(rxResult.value) / 10; // Convert from 0.1 dBm to dBm
            }
          } catch (err) {
            console.warn(`[SNMP] Could not get RX power for ${ponPort}:${onuId}`);
          }

          // Try to get TX power
          try {
            const txOid = `${SNMP_OIDS.hioso_epon.eponOnuTxPower}.${ifIndex}`;
            const txResult = await this.snmpGet(olt, txOid);
            if (txResult && txResult.value) {
              signalTx = parseInt(txResult.value) / 10; // Convert from 0.1 dBm to dBm
            }
          } catch (err) {
            console.warn(`[SNMP] Could not get TX power for ${ponPort}:${onuId}`);
          }

          onus.push({
            ponSerial: ponSerial || `UNKNOWN_${ponPort}_${onuId}`,
            ponPort,
            onuId,
            macAddress,
            signalRx,
            signalTx,
            status,
          });

          console.log(`[SNMP] ✓ Found HIOSO ONU: ${ponPort}:${onuId}, Status: ${status}, MAC: ${macAddress}`);
        } catch (err: any) {
          console.error(`[SNMP] Error processing HIOSO ONU entry:`, err.message);
          continue;
        }
      }
    } catch (err: any) {
      console.error(`[SNMP] HIOSO discovery error:`, err.message);
      throw err;
    }

    console.log(`[SNMP] HIOSO discovery complete: ${onus.length} ONUs found`);
    return onus;
  }

  // Helper method to perform SNMP walk
  private async snmpWalk(olt: Olt, oid: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];

      this.session.getSubtree({
        host: olt.ipAddress,
        port: olt.snmpPort,
        community: olt.snmpCommunity || 'public',
        oid,
      }, (error: any, varbinds: any[]) => {
        if (error) {
          reject(new Error(`SNMP walk failed: ${error.message || error}`));
        } else {
          results.push(...varbinds);
          resolve(results);
        }
      });
    });
  }

  // Helper method to perform SNMP get
  private async snmpGet(olt: Olt, oid: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.session.get({
        host: olt.ipAddress,
        port: olt.snmpPort,
        community: olt.snmpCommunity || 'public',
        oid,
      }, (error: any, varbinds: any[]) => {
        if (error) {
          reject(new Error(`SNMP get failed: ${error.message || error}`));
        } else if (varbinds && varbinds.length > 0) {
          resolve(varbinds[0]);
        } else {
          resolve(null);
        }
      });
    });
  }

  // Extract ifIndex from OID (last part of the OID)
  private extractIfIndexFromOid(oid: string): number {
    const parts = oid.split('.');
    return parseInt(parts[parts.length - 1]);
  }

  // Decode ZTE C320 ifIndex to get shelf/slot/port/onuid
  // ZTE uses 32-bit ifIndex: shelf(8bit).slot(8bit).port(8bit).onuid(8bit)
  private decodeZteIfIndex(ifIndex: number): { shelf: number; slot: number; port: number; onuId: number } {
    const shelf = (ifIndex >> 24) & 0xFF;
    const slot = (ifIndex >> 16) & 0xFF;
    const port = (ifIndex >> 8) & 0xFF;
    const onuId = ifIndex & 0xFF;

    return { shelf, slot, port, onuId };
  }

  // Decode HIOSO EPON ifIndex to get slot/port/onuid
  // HIOSO typically uses simpler encoding
  private decodeHiosoIfIndex(ifIndex: number): { slot: number; port: number; onuId: number } {
    // This is a simplified decoding - adjust based on actual HIOSO OLT behavior
    // Format may be: (slot << 16) | (port << 8) | onuId
    const slot = (ifIndex >> 16) & 0xFF;
    const port = (ifIndex >> 8) & 0xFF;
    const onuId = ifIndex & 0xFF;

    return { slot: slot || 1, port: port || 1, onuId };
  }

  // Parse hex string from SNMP response (for serial numbers)
  private parseHexString(hexString: string): string {
    // Handle hex string like "48 47 55 ..." - convert to ASCII
    if (typeof hexString === 'string' && hexString.includes(' ')) {
      return hexString.split(' ')
        .map(hex => String.fromCharCode(parseInt(hex, 16)))
        .join('');
    }
    return hexString;
  }

  // Format MAC address from SNMP response
  private formatMacAddress(value: any): string | null {
    if (!value) return null;

    // If value is a hex string like "00 11 22 33 44 55"
    if (typeof value === 'string') {
      if (value.includes(' ')) {
        return value.split(' ')
          .map(hex => hex.toUpperCase())
          .join(':');
      } else if (value.includes(':')) {
        return value.toUpperCase();
      }
    }

    // If value is a Buffer
    if (Buffer.isBuffer(value)) {
      return Array.from(value)
        .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
        .join(':');
    }

    return null;
  }

  // Close SNMP session
  close() {
    if (this.session) {
      this.session.close();
    }
  }
}

export const snmpService = new SnmpService();
