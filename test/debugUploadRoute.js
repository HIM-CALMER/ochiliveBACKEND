process.env.NODE_ENV = 'test';
const http = require('http');
const { randomUUID } = require('crypto');

const API_BASE = 'http://127.0.0.1:5000/api';

function sendRequest(pathname, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const target = `${API_BASE}${pathname}`;
    const payload = body ? JSON.stringify(body) : null;
    const request = http.request(target, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload ? Buffer.byteLength(payload) : 0,
        ...headers,
      },
    }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ statusCode: response.statusCode, body: parsed, raw: data });
        } catch {
          resolve({ statusCode: response.statusCode, body: data, raw: data });
        }
      });
    });

    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

(async () => {
  const email = `debug-upload-${Date.now()}@example.com`;
  const username = `debug_upload_${Math.round(Math.random()*9999)}`;
  const register = await sendRequest('/auth/register', 'POST', { name: 'Debug User', email, username, password: 'StrongPass123!' });
  console.log('register', register.statusCode, JSON.stringify(register.body));

  if (register.statusCode !== 200) process.exit(0);

  const verify = await sendRequest('/auth/verify', 'POST', { email, otp: String(register.body.otp) });
  console.log('verify', verify.statusCode, JSON.stringify(verify.body));

  if (verify.statusCode !== 201) process.exit(0);

  const token = verify.body.token;
  const form = new FormData();
  const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAFfcafAAAAAXNSR0IArwAABKR5F2gEAAAABJRU5ErkJggg==';
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  form.append('file', new Blob([imageBuffer], { type: 'image/png' }), 'smoke-sample.png');

  const response = await fetch(`${API_BASE}/videos/upload-file`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  console.log('upload status:', response.status);
  console.log('upload text:', await response.text());
})();
