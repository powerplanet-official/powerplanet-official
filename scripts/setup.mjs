import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
if(!existsSync('.env')){
 const password=randomBytes(24).toString('base64url');
 writeFileSync('.env',`API_PORT=4000\nPORT=3000\nADMIN_EMAIL=admin@powerplanet.local\nADMIN_PASSWORD=${password}\nSECURE_COOKIES=false\n`,{mode:0o600});
 console.log('Created private .env with a random administrator password. Read .env for your local login.');
}
const result=spawnSync(process.execPath,['scripts/create-admin.mjs'],{stdio:'inherit',env:process.env});
process.exitCode=result.status??1;
