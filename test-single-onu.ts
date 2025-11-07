import { Telnet } from 'telnet-client';

async function testSingleOnu() {
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
    console.log('Connecting...');
    await connection.connect(params);
    console.log('✓ Connected\n');

    console.log('Executing: show gpon onu detail-info gpon-onu_1/1/1:1');
    console.log('='.repeat(70));
    
    const response = await connection.exec('show gpon onu detail-info gpon-onu_1/1/1:1');
    
    console.log(`Response length: ${response?.length || 0} characters`);
    console.log('='.repeat(70));
    console.log(response || '(empty)');
    console.log('='.repeat(70));

    connection.end();
  } catch (error: any) {
    console.error('Error:', error.message);
    connection.end();
  }
}

testSingleOnu();
