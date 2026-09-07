import dns from 'dns';

// Force Node.js to prioritize IPv4 addresses over IPv6.
// Fixes ENETUNREACH socket errors on cloud container hosts (e.g. Render) lacking IPv6 routes.
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import app from './app';
import config from './config/env';

async function startServer() {
  const PORT = config.env.port;
  app.listen(PORT, () => {
    console.log(`[Server] Operational console API listening on http://localhost:${PORT}`);
    console.log(`[Environment] Node ENV: ${config.env.nodeEnv}`);
  });
}

startServer();

