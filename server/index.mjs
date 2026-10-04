import {startNotificationWorker} from './notifications.mjs';
import { app } from './app.mjs';
const port=Number(process.env.API_PORT||process.env.PORT||4000);app.listen(port,'0.0.0.0',()=>console.log(`Powerplanet API running on port ${port}`));

startNotificationWorker();
