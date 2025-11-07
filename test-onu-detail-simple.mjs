import { oltService } from './server/olt-service.js';
import { db } from './server/db.js';

async function test() {
  try {
    console.log('[Test] Fetching OLT and ONU data...');
    
    // Get OLT
    const olt = await db.query.olts.findFirst({
      where: (table, { eq }) => eq(table.id, 4)
    });
    
    if (!olt) {
      console.error('[Test] OLT not found');
      return;
    }
    
    console.log(`[Test] OLT: ${olt.name} (${olt.ipAddress})`);
    console.log('[Test] Testing command: show gpon onu detail-info gpon-onu_1/5:27');
    console.log('='.repeat(80));
    
    // Get detailed info for ONU on port 1/5, ONU ID 27
    const details = await oltService.getOnuDetailInfo(olt, '1/5', 27);
    
    console.log(JSON.stringify(details, null, 2));
    console.log('='.repeat(80));
    console.log('[Test] Success!');
    
    process.exit(0);
  } catch (error) {
    console.error('[Test] Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
