import { Session } from 'snmp-native';

const oltConfig = {
  name: 'OLT Pajang',
  vendor: 'ZTE',
  host: '103.151.33.158',
  port: 161,
  community: 'public'
};

console.log(`\n========================================`);
console.log(`Testing ZTE C320 OLT: ${oltConfig.name}`);
console.log(`Host: ${oltConfig.host}:${oltConfig.port}`);
console.log(`Community: ${oltConfig.community}`);
console.log(`========================================\n`);

const session = new Session({ 
  host: oltConfig.host, 
  port: oltConfig.port, 
  community: oltConfig.community,
  timeouts: [3000, 5000, 10000]
});

// First, test basic connectivity with sysDescr
const sysDescrOid = '.1.3.6.1.2.1.1.1.0';

console.log(`Step 1: Testing basic SNMP connectivity...`);
session.get({ oid: sysDescrOid }, (error, varbinds) => {
  if (error) {
    console.log(`❌ Basic connectivity test failed: ${error.message}`);
    console.log(`\nPossible issues:`);
    console.log(`  1. SNMP is not enabled on the OLT`);
    console.log(`  2. Firewall blocking SNMP traffic`);
    console.log(`  3. Wrong community string`);
    console.log(`  4. Wrong port number\n`);
    process.exit(1);
  }
  
  console.log(`✅ SNMP connection successful!`);
  console.log(`System Description: ${varbinds[0].value}\n`);
  
  // Now test ZTE-specific OIDs
  console.log(`Step 2: Testing ZTE C320 GPON ONU discovery OIDs...\n`);
  
  const zteOids = {
    'ONU Serial Number': '.1.3.6.1.4.1.3902.1012.3.28.1.1.5',
    'ONU Status': '.1.3.6.1.4.1.3902.1012.3.28.1.1.2',
    'ONU MAC Address': '.1.3.6.1.4.1.3902.1012.3.28.1.1.3',
  };
  
  let completedTests = 0;
  const totalTests = Object.keys(zteOids).length;
  
  Object.entries(zteOids).forEach(([name, oid]) => {
    console.log(`Testing ${name} (${oid})...`);
    
    session.getSubtree({ oid, combinedTimeout: 15000 }, (err, subtreeVarbinds) => {
      if (err) {
        console.log(`  ❌ Failed: ${err.message}`);
      } else if (subtreeVarbinds.length === 0) {
        console.log(`  ⚠️  No ONUs found (OID returned no data)`);
      } else {
        console.log(`  ✅ Found ${subtreeVarbinds.length} ONU entries`);
        console.log(`  Sample data (first 5):`);
        
        for (let i = 0; i < Math.min(5, subtreeVarbinds.length); i++) {
          const vb = subtreeVarbinds[i];
          console.log(`    ${vb.oid} = ${JSON.stringify(vb.value)} (type: ${vb.type})`);
        }
      }
      
      completedTests++;
      if (completedTests === totalTests) {
        console.log(`\n========================================`);
        console.log(`ZTE OLT Testing Complete!`);
        console.log(`========================================\n`);
        process.exit(0);
      }
    });
  });
});
