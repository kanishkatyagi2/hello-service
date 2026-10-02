const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({
    service: 'hello-service',
    message: 'Hello from the golden path',
    version: process.env.npm_package_version || '0.1.0'
  });
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = app;