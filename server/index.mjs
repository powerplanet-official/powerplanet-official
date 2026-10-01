import {startNotificationWorker} from './notifications.mjs';
import { app } from './app.mjs';
const port=Number(process.env.API_PORT||4000);app.listen(port,'127.0.0.1',()=>console.log(`Powerplanet API running at http://127.0.0.1:${port}`));

startNotificationWorker();
