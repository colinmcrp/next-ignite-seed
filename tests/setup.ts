// Test setup and configuration
import { beforeAll, afterAll } from 'vitest';
import { logger } from '../src/utils/logger';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

beforeAll(async () => {
  logger.info('Setting up test environment');
  // Database setup will be added when models are implemented
});

afterAll(async () => {
  logger.info('Cleaning up test environment');
  // Database cleanup will be added when models are implemented
});