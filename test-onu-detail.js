import { Telnet } from 'telnet-client';

async function testOnuDetail() {
  const connection = new Telnet();

  const params = {
    host: '103.151.33.158',
    port: 2323,
    username: 'kitanet',
    password: 'tehpoci@2022!',
    timeout: 10000,
    shellPrompt: /[A-Z0-9\-_]+[#>]\s*$/m,
    loginPrompt: /Username:/i,
    passwordPrompt: /Password:/i,
    negotiationMandatory: false,
    ors: '\r\n',
    debug: false
  };

  try {
    console.log('[Test] Connecting to ZTE OLT...');
    await connection.connect(params);
    console.log('[Test] Connected successfully!');

    // Disable pagination
    console.log('[Test] Disabling pagination...');
    await connection.send('terminal length 0');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test command for ONU on port 1/5, ONU ID 27
    const command = 'show gpon onu detail-info gpon-onu_1/5:27';
    console.log(`[Test] Executing: ${command}`);
    console.log('='.repeat(80));
    
    // Send command and wait for response
    await connection.send(command);
    
    // Wait for output
    let output = '';
    let attempts = 0;
    const maxAttempts = 30; // 15 seconds total
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const data = await connection.shell((response) => {
        return response; // Return immediately
      });
      
      if (data && data.trim()) {
        output = data;
        break;
      }
      attempts++;
    }
    
    console.log(output || '[No output received]');
    console.log('='.repeat(80));

    await connection.end();
    console.log('[Test] Connection closed');
    
  } catch (error) {
    console.error('[Test] Error:', error.message);
    try {
      await connection.end();
    } catch (e) {}
  }
}

testOnuDetail();
