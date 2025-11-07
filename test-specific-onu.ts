import { Telnet } from 'telnet-client';

async function testSpecificOnu() {
  const connection = new Telnet();
  
  const params = {
    host: '103.151.33.158',
    port: 2323,
    timeout: 15000,
    negotiationMandatory: false,
    shellPrompt: /[#>$%]/,
    loginPrompt: /([Ll]ogin|[Uu]sername|[Uu]ser)[: ]*$/,
    passwordPrompt: /[Pp]assword[: ]*$/,
    username: 'kitanet',
    password: 'tehpoci@2022!',
    execTimeout: 20000,
    irs: '\r\n',
    ors: '\n',
    sendTimeout: 3000,
    stripShellPrompt: false,
  };

  try {
    console.log('Connecting to ZTE C320...');
    await connection.connect(params);
    console.log('✓ Connected!\n');

    const testCommands = [
      'show gpon onu detail-info gpon-onu_1/1/1:1',
      'show gpon onu detail-info gpon-onu_1/1/1:2',
      'show gpon onu detail-info gpon-onu_1/1/1:3',
      'show gpon onu detail-info gpon-onu_1/2/1:1',
      'show gpon onu detail-info gpon-onu_1/2/1:2',
    ];

    for (const cmd of testCommands) {
      console.log('\n' + '='.repeat(70));
      console.log(`COMMAND: ${cmd}`);
      console.log('='.repeat(70));
      
      try {
        const response = await connection.exec(cmd);
        if (response && response.length > 0) {
          console.log(response);
          
          // Parse serial number
          const serialMatch = response.match(/Serial\s+number\s*:\s*([A-Z0-9]+)/i);
          if (serialMatch) {
            console.log(`\n✓ FOUND ONU! Serial: ${serialMatch[1]}`);
          }
        } else {
          console.log('(empty response - ONU not found)');
        }
      } catch (err: any) {
        console.log(`ERROR: ${err.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    connection.end();
    console.log('\n✓ Test complete');
  } catch (error: any) {
    console.error('Error:', error.message);
    connection.end();
  }
}

testSpecificOnu();
