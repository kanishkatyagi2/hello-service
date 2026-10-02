const request = require('supertest');
const app = require('./app');

describe('hello-service', () => {
  test('GET / returns service info', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe('hello-service');
  });

  test('GET /healthz returns ok status', async () => {
    const res = await request(app).get('/healthz');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});