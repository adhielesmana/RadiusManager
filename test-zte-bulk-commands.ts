import { Telnet } from 'telnet-client';

async function testZteBulkCommands() {
  const connection = new Telnet();
  
  const params = {
    host: '103.151.33.158',
    port: 2323,
    username: 'kitanet',
    password: 'tehpoci@2022!',
    timeout: 30000,
    shellPrompt: /[#>]/,
    loginPrompt: /Username:/i,
    passwordPrompt: /Password:/i,
    ors: '\r\n',
    sendTimeout: 10000,
    execTimeout: 10000,
  };

  try {
    console.log('Connecting to ZTE C320...');
    await connection.connect(params);
    console.log('Connected!');
    
    // Disable pagination
    await connection.exec('terminal length 0');
    console.log('Pagination disabled\n');
    
    // Test bulk commands
    const bulkCommands = [
      'show gpon onu detail-info all',
      'show gpon onu detail-info gpon-onu_1/1/1',
      'show gpon onu detail-info gpon-onu_1/1',
      'show pon power attenuation gpon-onu_1/1/1',
      'show pon power attenuation all',
    ];
    
    for (const cmd of bulkCommands) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Testing: ${cmd}`);
      console.log('='.repeat(80));
      
      try {
        const response = await connection.exec(cmd);
        console.log(`Response length: ${response?.length || 0} chars`);
        
        if (response && response.length > 0) {
          console.log('First 500 chars:');
          console.log(response.substring(0, 500));
          
          // Check if it's an error
          if (response.includes('Invalid') || response.includes('Error') || response.includes('Unrecognized')) {
            console.log('❌ Command not supported');
          } else {
            console.log('✅ Command works!');
          }
        } else {
          console.log('⚠️  Empty response');
        }
      } catch (error: any) {
        console.log(`❌ Error: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error: any) {
    console.error('Connection error:', error.message);
  } finally {
    await connection.end();
  }
}

testZteBulkCommands().catch(console.error);
