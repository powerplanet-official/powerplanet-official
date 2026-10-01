import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
const api=spawn(process.execPath,['server/index.mjs'],{stdio:'inherit',env:process.env});
const web=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0'],{stdio:'inherit',env:process.env});
function stop(){api.kill();web.kill();}process.on('SIGINT',stop);process.on('SIGTERM',stop);api.on('exit',code=>{if(code)process.exitCode=code;web.kill();});web.on('exit',code=>{if(code)process.exitCode=code;api.kill();});
