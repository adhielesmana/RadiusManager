import { Session } from 'snmp-native';

const host = '103.166.234.44';
const port = 1661;
const community = 'public';

console.log(`\n========================================`);
console.log(`SNMP Walk for OLT GAWOK 01 (HIOSO EPON)`);
console.log(`Host: ${host}:${port}`);
console.log(`Community: ${community}`);
console.log(`========================================\n`);

const session = new Session({ host, port, community });

// Walk the entire HIOSO base OID
const baseOid = '.1.3.6.1.4.1.3320.101';

console.log(`Walking base OID: ${baseOid}\n`);

// Use getSubtree with callback (async API)
session.getSubtree({ oid: baseOid, combinedTimeout: 30000 }, (error, varbinds) => {
  if (error) {
    console.error(`\nSNMP Walk failed:`, error.message);
    console.error(`Error details:`, error);
    process.exit(1);
  }
  
  console.log(`Total OIDs found: ${varbinds.length}\n`);
  
  // Show first 200 entries
  const displayCount = Math.min(200, varbinds.length);
  for (let i = 0; i < displayCount; i++) {
    const vb = varbinds[i];
    console.log(`OID: ${vb.oid} = ${JSON.stringify(vb.value)} (type: ${vb.type})`);
  }
  
  if (varbinds.length > 200) {
    console.log(`\n... (showing first 200 of ${varbinds.length} entries)\n`);
  }
  
  // Now let's specifically query known EPON OIDs
  console.log(`\n========================================`);
  console.log(`Querying specific EPON ONU OIDs:`);
  console.log(`========================================\n`);
  
  const specificOids = [
    '.1.3.6.1.4.1.3320.101.11.4.1.5',  // eponOnuOnlineStatus
    '.1.3.6.1.4.1.3320.101.10.1.1.76', // eponOnuMacAddress
    '.1.3.6.1.4.1.3320.101.10.5.1.5',  // eponOnuOpticalPower
  ];
  
  let completedQueries = 0;
  
  specificOids.forEach(oid => {
    console.log(`\nQuerying OID: ${oid}`);
    session.getSubtree({ oid, combinedTimeout: 10000 }, (err, subtreeVarbinds) => {
      if (err) {
        console.log(`  Error: ${err.message}`);
      } else if (subtreeVarbinds.length === 0) {
        console.log(`  No data found`);
      } else {
        const showCount = Math.min(20, subtreeVarbinds.length);
        for (let i = 0; i < showCount; i++) {
          const vb = subtreeVarbinds[i];
          console.log(`  ${vb.oid} = ${JSON.stringify(vb.value)} (type: ${vb.type})`);
        }
        if (subtreeVarbinds.length > 20) {
          console.log(`  ... (showing first 20 of ${subtreeVarbinds.length} entries)`);
        }
      }
      
      completedQueries++;
      if (completedQueries === specificOids.length) {
        console.log(`\n========================================`);
        console.log(`SNMP Walk Complete!`);
        console.log(`========================================\n`);
        process.exit(0);
      }
    });
  });
});
