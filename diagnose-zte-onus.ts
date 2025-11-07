import { Telnet } from 'telnet-client';

async function diagnoseZteOnus() {
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
    console.log('='.repeat(70));
    console.log('ZTE C320 ONU Discovery Diagnostic Tool');
    console.log('='.repeat(70));
    console.log('\n[1] Connecting to OLT...');
    await connection.connect(params);
    console.log('✓ Connected successfully!\n');

    // Check for unconfigured ONUs (waiting to be registered)
    console.log('[2] Checking for unconfigured ONUs (not yet registered)...');
    try {
      const uncfgResponse = await connection.exec('show gpon onu uncfg');
      console.log('--- UNCONFIGURED ONUs ---');
      console.log(uncfgResponse);
      console.log('-------------------------\n');
    } catch (err: any) {
      console.log('⚠ Could not check unconfigured ONUs:', err.message, '\n');
    }

    // Check each port for configured ONUs
    console.log('[3] Scanning ports for configured ONUs...\n');
    const portsWithOnus: string[] = [];
    
    for (let slot = 1; slot <= 2; slot++) {
      for (let port = 1; port <= 16; port++) {
        const ponPort = `gpon-olt_1/${slot}/${port}`;
        const command = `show gpon onu state ${ponPort}`;
        
        try {
          const response = await connection.exec(command);
          
          // Check if response contains actual ONU data
          if (response && response.includes('gpon-onu_1/')) {
            const onuCount = (response.match(/gpon-onu_1\//g) || []).length;
            console.log(`✓ Port ${slot}/${port}: ${onuCount} ONU(s) found`);
            console.log(response);
            console.log('-'.repeat(70));
            portsWithOnus.push(`${slot}/${port}`);
          }
        } catch (err: any) {
          // Silently skip errors for ports with no ONUs
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    if (portsWithOnus.length > 0) {
      console.log(`✓ Found ONUs on ${portsWithOnus.length} port(s):`);
      portsWithOnus.forEach(port => console.log(`  - Port ${port}`));
    } else {
      console.log('✗ No configured ONUs found on any port');
      console.log('\nPossible reasons:');
      console.log('  1. No ONUs are physically connected to the OLT');
      console.log('  2. ONUs are connected but not configured/registered yet');
      console.log('  3. ONUs need to be authorized first (check unconfigured list above)');
    }
    console.log('='.repeat(70));

    connection.end();
  } catch (error: any) {
    console.error('\n✗ Error:', error.message);
    connection.end();
  }
}

diagnoseZteOnus();
