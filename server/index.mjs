import {startNotificationWorker} from './notifications.mjs';
import { app } from './app.mjs';
const port=Number(process.env.API_PORT||process.env.PORT||4000);
const server=app.listen(port,'0.0.0.0',()=>console.log(`Powerplanet API running on port ${port}`));
server.on('error',error=>{console.error(`Powerplanet API failed to listen on port ${port}: ${error.code||error.message}`);process.exit(1);});
process.on('unhandledRejection',reason=>console.error('Powerplanet API unhandled rejection:',reason));

startNotificationWorker();
