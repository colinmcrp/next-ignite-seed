import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { app } from './app';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

// Only start server if this file is run directly (not imported)
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`FamSpace server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
  });
}

export default app;