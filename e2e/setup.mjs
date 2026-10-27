import { once } from 'node:events';
import { createPreviewServer } from '../scripts/serve.mjs';

export default async function setup() {
  const server = createPreviewServer();
  server.listen(4173, '127.0.0.1');
  await once(server, 'listening');
  return async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  };
}
