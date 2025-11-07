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
    
    // Try to find available show commands
    console.log('\n=== Listing available show commands ===');
    const showHelp = await session.execute('show ?', 5000);
    console.log(showHelp);
    
    await session.close();
    console.log('\n✅ Disconnected');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    await session.close();
  }
}

checkSnmpConfig();
