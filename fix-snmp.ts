import { TelnetSession } from './server/telnet-session';

async function fixSnmpConfig() {
  const session = new TelnetSession();
  
  try {
    console.log('🔌 Connecting to ZTE OLT Pajang...');
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
    
    console.log('✅ Connected! Disabling pagination...');
    await session.execute('terminal length 0', 3000);
    
    console.log('\n📋 === Current SNMP Configuration ===');
    const currentConfig = await session.execute('show snmp config', 5000);
    console.log(currentConfig);
    
    console.log('\n⚙️  === Entering Configuration Mode ===');
    await session.execute('configure terminal', 3000);
    
    console.log('🔧 === Configuring SNMP Community ===');
    const setCommunity = await session.execute('snmp-server community public view allview ro', 5000);
    console.log(setCommunity);
    
    console.log('🔧 === Enabling SNMP Traps ===');
    const enableTrap = await session.execute('snmp-server enable trap', 5000);
    console.log(enableTrap);
    
    console.log('💾 === Saving Configuration ===');
    await session.execute('exit', 3000);
    const saveConfig = await session.execute('write', 5000);
    console.log(saveConfig);
    
    console.log('\n✅ === Verifying New Configuration ===');
    const newConfig = await session.execute('show snmp config', 5000);
    console.log(newConfig);
    
    await session.close();
    console.log('\n✅ Disconnected - SNMP configuration complete!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await session.close();
  }
}

fixSnmpConfig();
