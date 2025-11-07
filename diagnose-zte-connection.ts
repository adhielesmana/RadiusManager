import { Telnet } from 'telnet-client';

const connection = new Telnet();

const params = {
  host: '103.151.33.158',
  port: 2323,
  timeout: 15000,
  shellPrompt: /[#>$%]/,
  loginPrompt: /[Uu]sername[:\s]*$/,
  passwordPrompt: /[Pp]assword[:\s]*$/,
  execTimeout: 10000,
  sendTimeout: 5000,
  debug: true,  // Enable debug mode
};

async function diagnoseConnection() {
  try {
    console.log(`\n========================================`);
    console.log(`ZTE C320 OLT Connection Diagnostic`);
    console.log(`Host: 103.151.33.158:2323`);
    console.log(`========================================\n`);
    
    console.log(`Step 1: Connecting...`);
    await connection.connect(params);
    console.log(`✅ TCP connection established\n`);
    
    console.log(`Step 2: Sending username 'kitanet'...`);
    await connection.send('kitanet', { waitFor: /[Pp]assword/ });
    console.log(`✅ Username sent, password prompt received\n`);
    
    console.log(`Step 3: Sending password...`);
    await connection.send('tehpoci@2022!', { waitFor: /[#>$%]/ });
    console.log(`✅ Password sent, logged in!\n`);
    
    console.log(`Step 4: Checking current prompt...`);
    const promptCheck = await connection.exec('');
    console.log(`Current prompt response: "${promptCheck}"`);
    console.log(`Length: ${promptCheck.length} chars\n`);
    
    console.log(`Step 5: Trying 'enable' command...`);
    try {
      const enableResp = await connection.exec('enable');
      console.log(`Enable response: "${enableResp}"`);
      console.log(`Length: ${enableResp.length} chars\n`);
    } catch (err: any) {
      console.log(`Enable failed: ${err.message}\n`);
    }
    
    console.log(`Step 6: Trying 'show version' command...`);
    try {
      const versionResp = await connection.exec('show version');
      console.log(`Version response: "${versionResp.substring(0, 500)}"`);
      console.log(`Length: ${versionResp.length} chars\n`);
    } catch (err: any) {
      console.log(`Show version failed: ${err.message}\n`);
    }
    
    console.log(`Step 7: Trying simple 'show' command...`);
    try {
      const showResp = await connection.exec('show');
      console.log(`Show response: "${showResp.substring(0, 500)}"`);
      console.log(`Length: ${showResp.length} chars\n`);
    } catch (err: any) {
      console.log(`Show failed: ${err.message}\n`);
    }
    
    console.log(`Step 8: Trying '?' help command...`);
    try {
      const helpResp = await connection.exec('?');
      console.log(`Help response: "${helpResp.substring(0, 500)}"`);
      console.log(`Length: ${helpResp.length} chars\n`);
    } catch (err: any) {
      console.log(`Help failed: ${err.message}\n`);
    }
    
    console.log(`Step 9: Trying specific ONU query on port 1/1/1...`);
    try {
      const onuResp = await connection.exec('show gpon onu state gpon-olt_1/1/1');
      console.log(`ONU query response: "${onuResp}"`);
      console.log(`Length: ${onuResp.length} chars\n`);
    } catch (err: any) {
      console.log(`ONU query failed: ${err.message}\n`);
    }
    
    console.log(`========================================`);
    console.log(`Diagnostic Complete!`);
    console.log(`========================================\n`);
    
    connection.end();
    process.exit(0);
    
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(`Stack:`, error.stack);
    connection.end();
    process.exit(1);
  }
}

diagnoseConnection();
