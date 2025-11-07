import { Session } from 'snmp-native';

const host = '103.166.234.44';
const communities = ['public', 'private', 'admin'];
const ports = [161, 1661, 162];

console.log(`\n========================================`);
console.log(`Testing SNMP connectivity to ${host}`);
console.log(`========================================\n`);

// Test standard system OID (.1.3.6.1.2.1.1.1.0) - sysDescr
const sysDescrOid = '.1.3.6.1.2.1.1.1.0';

async function testConnection(port: number, community: string) {
  return new Promise<boolean>((resolve) => {
    console.log(`\nTrying port ${port} with community '${community}'...`);
    
    const session = new Session({ 
      host, 
      port, 
      community,
      timeouts: [2000, 3000]  // Shorter timeouts for testing
    });
    
    session.get({ oid: sysDescrOid }, (error, varbinds) => {
      if (error) {
        console.log(`  ❌ Failed: ${error.message}`);
        resolve(false);
      } else if (varbinds && varbinds.length > 0) {
        console.log(`  ✅ SUCCESS!`);
        console.log(`  System Description: ${varbinds[0].value}`);
        console.log(`\n  This is the correct configuration:`);
        console.log(`    Host: ${host}`);
        console.log(`    Port: ${port}`);
        console.log(`    Community: ${community}`);
        resolve(true);
      } else {
        console.log(`  ❌ No data returned`);
        resolve(false);
      }
    });
    
    // Add timeout to prevent hanging
    setTimeout(() => {
      resolve(false);
    }, 6000);
  });
}

async function runTests() {
  for (const port of ports) {
    for (const community of communities) {
      const success = await testConnection(port, community);
      if (success) {
        console.log(`\n========================================`);
        console.log(`Found working SNMP configuration!`);
        console.log(`========================================\n`);
        process.exit(0);
      }
    }
  }
  
  console.log(`\n========================================`);
  console.log(`❌ No working SNMP configuration found`);
  console.log(`Tested combinations:`);
  console.log(`  Ports: ${ports.join(', ')}`);
  console.log(`  Communities: ${communities.join(', ')}`);
  console.log(`\nPlease verify:`);
  console.log(`  1. SNMP is enabled on the OLT`);
  console.log(`  2. The correct port number`);
  console.log(`  3. The correct community string`);
  console.log(`  4. Firewall rules allow SNMP traffic`);
  console.log(`========================================\n`);
  process.exit(1);
}

runTests();
