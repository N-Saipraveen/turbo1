import app from './app.js';
import { logger } from './lib/logger.js';

const PORT = process.env.PORT || 3000;

// Start server (for local development)
app.listen(PORT, () => {
  logger.info(`TurboDbx API server running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});
