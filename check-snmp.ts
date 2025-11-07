import { TelnetSession } from './server/telnet-session';

async function checkSnmpConfig() {
  const session = new TelnetSession();
  
  try {
    console.log('Connecting to ZTE OLT Pajang...');
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
    
    console.log('Connected! Disabling pagination...');
    await session.execute('terminal length 0', 3000);
    
    console.log('\n=== Current SNMP Configuration ===');
    const snmpConfig = await session.execute('show running-config snmp', 5000);
    console.log(snmpConfig);
    
    console.log('\n=== SNMP Community ===');
    const snmpCommunity = await session.execute('show snmp community', 5000);
    console.log(snmpCommunity);
    
    console.log('\n=== SNMP Agent Status ===');
    const snmpAgent = await session.execute('show snmp agent', 5000);
    console.log(snmpAgent);
    
    await session.close();
    console.log('\n✅ Disconnected');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    await session.close();
  }
}

checkSnmpConfig();
