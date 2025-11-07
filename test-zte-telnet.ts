import { Telnet } from 'telnet-client';

const oltConfig = {
  name: 'OLT Pajang',
  host: '103.151.33.158',
  port: 2323,
  username: 'kitanet',
  password: '',
  enablePassword: '', // Try without first
};

console.log(`\n========================================`);
console.log(`Testing ZTE C320 OLT: ${oltConfig.name}`);
console.log(`Host: ${oltConfig.host}:${oltConfig.port}`);
console.log(`Username: ${oltConfig.username}`);
console.log(`========================================\n`);

async function testZteOlt() {
  const connection = new Telnet();
  
  const params = {
    host: oltConfig.host,
    port: oltConfig.port,
    timeout: 15000,
    shellPrompt: /[#>$]/,
    loginPrompt: /[Uu]sername[: ]*$/,
    passwordPrompt: /[Pp]assword[: ]*$/,
    execTimeout: 10000,
  };
  
  try {
    console.log(`Step 1: Connecting to OLT...`);
    await connection.connect(params);
    console.log(`✅ Connected!\n`);
    
    console.log(`Step 2: Sending username...`);
    await connection.send(oltConfig.username, { waitFor: /[Pp]assword/ });
    console.log(`✅ Username sent\n`);
    
    console.log(`Step 3: Sending password...`);
    await connection.send(oltConfig.password || '', { waitFor: /[#>$]/ });
    console.log(`✅ Logged in!\n`);
    
    // Try enable mode (some ZTE OLTs require this)
    console.log(`Step 4: Checking if enable mode is needed...`);
    try {
      const enableCheck = await connection.exec('enable');
      console.log(`Enable response: ${enableCheck.substring(0, 100)}`);
      
      if (enableCheck.toLowerCase().includes('password')) {
        console.log(`⚠️  Enable password required but not configured`);
      }
    } catch (err: any) {
      console.log(`Enable mode check: ${err.message}`);
    }
    
    // Get system info
    console.log(`\nStep 5: Getting system information...`);
    const versionInfo = await connection.exec('show version');
    console.log(`Version Info (first 300 chars):\n${versionInfo.substring(0, 300)}\n`);
    
    // Check ONU state on first few ports
    console.log(`Step 6: Checking for ONUs on PON ports...`);
    const portsToCheck = [
      'gpon-olt_1/1/1',
      'gpon-olt_1/1/2',
      'gpon-olt_1/1/3',
      'gpon-olt_1/1/4',
      'gpon-olt_1/2/1',
      'gpon-olt_1/2/2',
    ];
    
    for (const port of portsToCheck) {
      try {
        console.log(`\nChecking port ${port}...`);
        const onuState = await connection.exec(`show gpon onu state ${port}`);
        
        if (onuState.includes('ONU') || onuState.includes('onu') || onuState.toLowerCase().includes('working')) {
          console.log(`✅ Found ONUs on ${port}!`);
          console.log(`Response:\n${onuState}\n`);
        } else if (onuState.toLowerCase().includes('no onu') || onuState.toLowerCase().includes('not found')) {
          console.log(`  No ONUs on ${port}`);
        } else {
          console.log(`  Response (first 200 chars): ${onuState.substring(0, 200)}`);
        }
      } catch (err: any) {
        console.log(`  ❌ Error checking ${port}: ${err.message}`);
      }
    }
    
    console.log(`\n========================================`);
    console.log(`Diagnostic Complete!`);
    console.log(`========================================\n`);
    
    connection.end();
    process.exit(0);
    
  } catch (error: any) {
    console.error(`\n❌ Connection failed: ${error.message}`);
    console.error(`Error details:`, error);
    connection.end();
    process.exit(1);
  }
}

testZteOlt();
