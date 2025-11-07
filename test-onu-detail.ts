import { db } from './server/db';
import { olts } from './shared/schema';
import { eq } from 'drizzle-orm';
import { oltService } from './server/olt-service';

async function testOnuDetail() {
  try {
    console.log('[Test] Fetching OLT data...');
    
    // Get OLT Pajang
    const olt = await db.query.olts.findFirst({
      where: eq(olts.id, 4)
    });
    
    if (!olt) {
      console.error('[Test] OLT not found');
      process.exit(1);
    }
    
    console.log(`[Test] OLT: ${olt.name} (${olt.ipAddress}:${olt.port})`);
    
    // Test command for ONU on port 1/5, ONU ID 27
    const ponPort = '1/5';
    const onuId = 27;
    
    console.log(`[Test] Getting detailed info for ONU ${ponPort}:${onuId}`);
    console.log('='.repeat(80));
    
    const details = await oltService.getOnuDetailInfo(olt, ponPort, onuId);
    
    console.log(JSON.stringify(details, null, 2));
    console.log('='.repeat(80));
    console.log('[Test] Success!');
    
    process.exit(0);
  } catch (error: any) {
    console.error('[Test] Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testOnuDetail();
