import { Telnet } from 'telnet-client';

async function testZteCommands() {
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
    console.log('Connecting to ZTE C320 OLT...');
    await connection.connect(params);
    console.log('Connected successfully\n');

    // Enter configuration mode
    console.log('Sending "conf t"...');
    await connection.send('conf t\n');
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('Configuration mode entered\n');

    // Test commands
    const testCommands = [
      'show ?',  // Show available commands
      'show gpon ?',  // Show GPON commands
      'show gpon onu state ?',  // Show ONU state command syntax
      'show gpon onu state gpon-olt_1/1/1',  // Query first port
      'show gpon onu state gpon-olt_1/1/2',  // Query second port
      'show running-config interface gpon-olt_1/1/1',  // Alternative command
    ];

    for (const cmd of testCommands) {
      console.log(`\n=== Executing: ${cmd} ===`);
      try {
        const response = await connection.exec(cmd);
        console.log(`Response (${response.length} chars):`);
        console.log(response);
        console.log('='.repeat(60));
      } catch (err: any) {
        console.error(`Error executing "${cmd}":`, err.message);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    connection.end();
    console.log('\nConnection closed');
  } catch (error: any) {
    console.error('Error:', error.message);
    connection.end();
  }
}

testZteCommands();
