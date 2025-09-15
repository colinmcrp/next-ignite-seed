import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';

describe('Health Check Endpoints', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      environment: 'test'
    });
    expect(response.body.timestamp).toBeDefined();
  });

  it('should return API information', async () => {
    const response = await request(app)
      .get('/api')
      .expect(200);

    expect(response.body).toMatchObject({
      message: 'FamSpace API',
      version: '1.0.0'
    });
    expect(response.body.endpoints).toBeDefined();
  });

  it('should return 404 for unknown routes', async () => {
    const response = await request(app)
      .get('/unknown-route')
      .expect(404);

    expect(response.body).toMatchObject({
      error: 'Not Found'
    });
  });
});