const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
  console.log(`hello-service listening on port ${PORT}`);
});