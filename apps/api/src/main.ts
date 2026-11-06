import { createApp } from './app.js';
import { serverOptions } from './config/server.js';

const { port, host } = serverOptions();
const app = await createApp();
await app.listen(port, host);
