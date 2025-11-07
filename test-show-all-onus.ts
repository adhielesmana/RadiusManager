import { Telnet } from 'telnet-client';

async function testShowAllOnus() {
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
    console.log('✓ Connected successfully!\n');

    console.log('='.repeat(70));
    console.log('EXECUTING: show gpon onu state');
    console.log('='.repeat(70));
    
    const response = await connection.exec('show gpon onu state');
    console.log(response);
    console.log('='.repeat(70));
    console.log(`\nResponse length: ${response.length} characters`);
    
    if (response.includes('gpon-onu')) {
      const onuMatches = response.match(/gpon-onu_\d+\/\d+\/\d+:\d+/g);
      if (onuMatches) {
        console.log(`\n✓ Found ${onuMatches.length} ONU(s)!`);
        console.log('ONUs:', onuMatches);
      }
    }

    connection.end();
  } catch (error: any) {
    console.error('Error:', error.message);
    connection.end();
  }
}

testShowAllOnus();
