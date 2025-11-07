import { TelnetSession } from './server/telnet-session';

async function checkSnmpStatus() {
  const session = new TelnetSession();
  
  try {
    console.log('🔌 Connecting to ZTE OLT...');
    await session.connect({
      host: '103.151.33.158',
      port: 2323,
      username: 'kitanet',
      password: 'tehpoci@2022!',
      timeout: 15000,
      shellPrompt: /[#>]/,
      loginPrompt: /Username:/i,
      passwordPrompt: /Password:/i,
      ors: '\r\n'
    });
    
    console.log('✅ Connected! Checking SNMP status...\n');
    await session.execute('terminal length 0', 3000);
    
    console.log('=== SNMP Configuration ===');
    const config = await session.execute('show snmp config', 5000);
    console.log(config);
    
    console.log('\n=== Checking if SNMP is listening ===');
    const netstat = await session.execute('show ip socket', 5000);
    console.log(netstat);
    
    await session.close();
    console.log('\n✅ Done');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await session.close();
  }
}

checkSnmpStatus();
