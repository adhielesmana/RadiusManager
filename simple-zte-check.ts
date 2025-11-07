import { Telnet } from 'telnet-client';

async function simpleZteCheck() {
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
    execTimeout: 15000,
    irs: '\r\n',
    ors: '\n',
    sendTimeout: 3000,
    stripShellPrompt: false,
  };

  try {
    console.log('Connecting...');
    await connection.connect(params);
    console.log('✓ Connected\n');

    const commands = [
      'show card',
      'show gpon onu uncfg',
      'show gpon onu state gpon-olt_1/1/1',
      'show gpon onu state gpon-olt_1/1/2',
      'show gpon onu state gpon-olt_1/1/3',
      'show gpon onu state gpon-olt_1/2/1',
      'show gpon onu state gpon-olt_1/2/2',
      'show gpon onu state gpon-olt_1/2/3',
    ];

    for (const cmd of commands) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`COMMAND: ${cmd}`);
      console.log('='.repeat(70));
      
      try {
        const response = await connection.exec(cmd);
        console.log(response || '(empty response)');
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err: any) {
        console.log(`ERROR: ${err.message}`);
      }
    }

    connection.end();
  } catch (error: any) {
    console.error('Connection error:', error.message);
    connection.end();
  }
}

simpleZteCheck();
