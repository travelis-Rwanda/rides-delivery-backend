// Shared HTTP helpers — no framework, pure Node http.

function send(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res, statusCode, code, message) {
  send(res, statusCode, {
    error: { code, message, timestamp: new Date().toISOString() },
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Extract a named segment from a URL pattern match.
// e.g. matchPath('/sync/restaurant/:orderId', '/sync/restaurant/ORD-001')
// returns { orderId: 'ORD-001' } or null if no match.
function matchPath(pattern, url) {
  const patternParts = pattern.split('/');
  const urlParts = url.split('?')[0].split('/');
  if (patternParts.length !== urlParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(urlParts[i]);
    } else if (patternParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
}

module.exports = { send, sendError, parseBody, matchPath };
