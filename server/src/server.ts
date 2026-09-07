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
