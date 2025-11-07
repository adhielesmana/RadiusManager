import { SNMPService } from './server/snmp-service';

async function testSnmp() {
  const snmpService = new SNMPService();
  
  console.log('🧪 Testing SNMP with pajangro community...');
  try {
    const result = await snmpService.discoverZteOnus({
      ipAddress: '103.151.33.158',
      snmpPort: 161,
      snmpCommunity: 'pajangro'
    } as any);
    
    console.log(`✅ SUCCESS! Found ${result.length} ONUs via SNMP`);
    console.log('First 5 ONUs:', result.slice(0, 5));
  } catch (error: any) {
    console.error('❌ SNMP Failed:', error.message);
  }
}

testSnmp();
