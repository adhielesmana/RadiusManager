import { Telnet } from 'telnet-client';

async function testPromptPattern() {
  const connection = new Telnet();
  
  // Test with more lenient prompt pattern
  const params = {
    host: '103.151.33.158',
    port: 2323,
    timeout: 15000,
    negotiationMandatory: false,
    shellPrompt: /[#>]/,  // Very simple - just look for # or >
    loginPrompt: /([Ll]ogin|[Uu]sername|[Uu]ser)[: ]*$/,
    passwordPrompt: /[Pp]assword[: ]*$/,
    username: 'kitanet',
    password: 'tehpoci@2022!',
    execTimeout: 15000,
    irs: '\r\n',
    ors: '\r\n',
    sendTimeout: 2000,
    stripShellPrompt: false,
    removeEcho: true,
  };

  try {
    console.log('Connecting with simple prompt pattern: /[#>]/');
    await connection.connect(params);
    console.log('✓ Connected\n');

    // Flush buffer
    await connection.send('\n');
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Testing: terminal length 0');
    const termResponse = await connection.exec('terminal length 0');
    console.log(`Response: "${termResponse}"`);

    console.log('\nTesting: show gpon onu state');
    const stateResponse = await connection.exec('show gpon onu state');
    console.log(`Response length: ${stateResponse.length} chars`);
    console.log(`First 500 chars:`, stateResponse.substring(0, 500));

    connection.end();
  } catch (error: any) {
    console.error('Error:', error.message);
    connection.end();
  }
}

testPromptPattern();
