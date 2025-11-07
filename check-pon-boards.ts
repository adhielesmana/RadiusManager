import { Telnet } from 'telnet-client';

async function checkPonBoards() {
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
    execTimeout: 10000,
    irs: '\r\n',
    ors: '\n',
    sendTimeout: 2000,
    stripShellPrompt: false,
  };

  try {
    console.log('Connecting to ZTE C320...');
    await connection.connect(params);
    console.log('Connected!\n');

    // Check card/board status
    console.log('=== CHECKING CARD STATUS ===');
    const cardResponse = await connection.exec('show card');
    console.log(cardResponse);
    console.log('\n' + '='.repeat(70) + '\n');

    // Check gpon-olt_1/1 (Slot 1)
    console.log('=== CHECKING gpon-olt_1/1 (SLOT 1) ===');
    for (let port = 1; port <= 16; port++) {
      try {
        const response = await connection.exec(`show gpon onu state gpon-olt_1/1/${port}`);
        if (response && response.includes('gpon-onu_1/1/')) {
          const onuCount = (response.match(/gpon-onu_1\/1\//g) || []).length;
          console.log(`\n✓ Port 1/${port}: ${onuCount} ONU(s)`);
          console.log(response);
          console.log('-'.repeat(70));
        }
      } catch (err: any) {
        // Skip empty ports
      }
    }

    // Check gpon-olt_1/2 (Slot 2)
    console.log('\n=== CHECKING gpon-olt_1/2 (SLOT 2) ===');
    for (let port = 1; port <= 16; port++) {
      try {
        const response = await connection.exec(`show gpon onu state gpon-olt_1/2/${port}`);
        if (response && response.includes('gpon-onu_1/2/')) {
          const onuCount = (response.match(/gpon-onu_1\/2\//g) || []).length;
          console.log(`\n✓ Port 2/${port}: ${onuCount} ONU(s)`);
          console.log(response);
          console.log('-'.repeat(70));
        }
      } catch (err: any) {
        // Skip empty ports
      }
    }

    // Try alternative commands
    console.log('\n=== TRYING ALTERNATIVE COMMANDS ===');
    
    const altCommands = [
      'show gpon onu uncfg',
      'show running-config interface gpon-olt_1/1/1',
      'show interface gpon-olt_1/1/1',
    ];

    for (const cmd of altCommands) {
      console.log(`\nCommand: ${cmd}`);
      try {
        const response = await connection.exec(cmd);
        console.log(response.substring(0, 500));
      } catch (err: any) {
        console.log('Error:', err.message);
      }
    }

    connection.end();
    console.log('\n✓ Scan complete');
  } catch (error: any) {
    console.error('Error:', error.message);
    connection.end();
  }
}

checkPonBoards();
