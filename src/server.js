const http = require('http');
const router = require('./router');

// Boot notification listeners (RID-19)
require('./events/notificationService');

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  try {
    await router(req, res);
  } catch (err) {
    console.error('[ERROR]', err);
    const body = JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', timestamp: new Date().toISOString() } });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(body);
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
