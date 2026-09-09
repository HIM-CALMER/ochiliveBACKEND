process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://127.0.0.1:5000/api';

const makeUniqueEmail = () => `product-smoke-${Date.now()}-${Math.round(Math.random() * 999999)}@example.com`;
const makeUniqueUsername = () => `smoke_${Math.round(Math.random() * 99999)}_${String(Date.now()).slice(-6)}`;

async function registerAndVerify(email, username, password = 'StrongPass123!') {
  const registerResponse = await sendRequest('/auth/register', 'POST', {
    name: 'Smoke User',
    email,
    username,
    password,
  });

  assert.equal(registerResponse.statusCode, 200);
  assert.equal(registerResponse.body.pending, true);
  assert.ok(registerResponse.body.otp);

  const verifyResponse = await sendRequest('/auth/verify', 'POST', {
    email,
    otp: String(registerResponse.body.otp),
  });

  assert.equal(verifyResponse.statusCode, 201);
  assert.ok(verifyResponse.body.token);
  assert.equal(verifyResponse.body.user.username, username);

  return verifyResponse.body;
}

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
      response.on('data', (chunk) => {
        data += chunk;
      });
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

async function sendMultipartRequest(pathname, token, formData) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const raw = await response.text();
  try {
    return { statusCode: response.status, body: JSON.parse(raw), raw };
  } catch {
    return { statusCode: response.status, body: raw, raw };
  }
}

test('api root is reachable', async () => {
  const response = await sendRequest('/');
  assert.equal(response.statusCode, 200);
  assert.ok(response.body?.message || response.raw.includes('Backend API root'));
});

test('protected feed route responds with authentication requirement', async () => {
  const response = await sendRequest('/videos/?mode=for_you');
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.message, 'Authentication required.');
});

test('protected discover route responds with authentication requirement', async () => {
  const response = await sendRequest('/dashboard/discover');
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.message, 'Authentication required.');
});

test('protected search route responds with authentication requirement', async () => {
  const response = await sendRequest('/search/profiles?q=creator');
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.message, 'Authentication required.');
});

test('public auth route rejects malformed registration payload', async () => {
  const response = await sendRequest('/auth/register', 'POST', {
    name: 'Smoke User',
    email: 'not-an-email',
    username: 'smoke_user',
    password: 'StrongPass123!',
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /valid email/i);
});

test('authenticated session can reach protected feed and profile routes', async () => {
  const email = makeUniqueEmail();
  const username = makeUniqueUsername();
  const auth = await registerAndVerify(email, username);
  const token = auth.token;

  const loginResponse = await sendRequest('/auth/login', 'POST', {
    email,
    password: 'StrongPass123!',
  });

  assert.equal(loginResponse.statusCode, 200);
  assert.ok(loginResponse.body.token);

  const feedResponse = await sendRequest('/videos/?mode=for_you', 'GET', null, {
    Authorization: `Bearer ${loginResponse.body.token}`,
  });

  assert.equal(feedResponse.statusCode, 200);
  assert.ok(Array.isArray(feedResponse.body));

  const profileResponse = await sendRequest(`/profiles/${encodeURIComponent(username)}`, 'GET', null, {
    Authorization: `Bearer ${loginResponse.body.token}`,
  });

  assert.equal(profileResponse.statusCode, 200);
  assert.equal(profileResponse.body.user.username, username);
});

test('authenticated upload-file route accepts a real image payload and reports Cloudinary media metadata', async () => {
  const email = makeUniqueEmail();
  const username = makeUniqueUsername();
  const auth = await registerAndVerify(email, username);
  const token = auth.token;

  const imagePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'assets', 'animations', 'screen.png');
  const imageBuffer = fs.readFileSync(imagePath);
  const form = new FormData();
  form.append('file', new Blob([imageBuffer], { type: 'image/png' }), 'smoke-sample.png');

  const uploadResponse = await sendMultipartRequest('/videos/upload-file', token, form);

  assert.equal(uploadResponse.statusCode, 201);
  assert.equal(uploadResponse.body.resourceType, 'image');
  assert.ok(uploadResponse.body.mediaUrl);
  assert.ok(uploadResponse.body.publicId);
});

test('authenticated comedian can create and start a live room and receive LiveKit host and viewer tokens', async () => {
  const email = makeUniqueEmail();
  const username = makeUniqueUsername();
  const auth = await registerAndVerify(email, username);
  const token = auth.token;

  const onboardingResponse = await sendRequest('/profile/me/comedy-onboarding', 'POST', {
    comedyStyle: 'standup',
    experience: '1 year performing at small rooms',
    influences: 'Tina Fey',
    motivation: 'Build a community of comedy fans',
    audience: 'Young comedy fans',
  }, {
    Authorization: `Bearer ${token}`,
  });

  assert.equal(onboardingResponse.statusCode, 200);
  assert.equal(onboardingResponse.body.user.accountType, 'comedian');

  const createRoomResponse = await sendRequest('/videos/live/rooms', 'POST', {
    title: 'Smoke Room',
    description: 'Route smoke room',
    format: 'standup',
    visibility: 'public',
  }, {
    Authorization: `Bearer ${token}`,
  });

  assert.equal(createRoomResponse.statusCode, 201);
  assert.ok(createRoomResponse.body.room?.id);

  const roomId = createRoomResponse.body.room.id;

  const startRoomResponse = await sendRequest(`/videos/live/rooms/${encodeURIComponent(roomId)}/start`, 'POST', null, {
    Authorization: `Bearer ${token}`,
  });

  assert.equal(startRoomResponse.statusCode, 200);
  assert.equal(startRoomResponse.body.room?.status, 'live');

  const hostTokenResponse = await sendRequest(`/videos/live/rooms/${encodeURIComponent(roomId)}/host-token`, 'POST', null, {
    Authorization: `Bearer ${token}`,
  });

  assert.equal(hostTokenResponse.statusCode, 200);
  assert.ok(hostTokenResponse.body.token);
  assert.equal(hostTokenResponse.body.roomId, roomId);
  assert.ok(hostTokenResponse.body.livekitUrl);

  const viewerTokenResponse = await sendRequest(`/videos/live/rooms/${encodeURIComponent(roomId)}/viewer-token`, 'POST', null, {
    Authorization: `Bearer ${token}`,
  });

  assert.equal(viewerTokenResponse.statusCode, 200);
  assert.ok(viewerTokenResponse.body.token);
  assert.equal(viewerTokenResponse.body.roomId, roomId);
  assert.ok(viewerTokenResponse.body.livekitUrl);
});

test('authenticated wallet funding initializer rejects low amounts and reaches the Paystack handoff when the amount is valid', async () => {
  const email = makeUniqueEmail();
  const username = makeUniqueUsername();
  const auth = await registerAndVerify(email, username);
  const token = auth.token;

  const lowAmountResponse = await sendRequest('/dashboard/wallet/fund/initialize', 'POST', {
    amount: 50,
    currency: 'NGN',
  }, {
    Authorization: `Bearer ${token}`,
  });

  assert.equal(lowAmountResponse.statusCode, 400);
  assert.match(lowAmountResponse.body.message, /at least 100/i);

  const validAmountResponse = await sendRequest('/dashboard/wallet/fund/initialize', 'POST', {
    amount: 100,
    currency: 'NGN',
  }, {
    Authorization: `Bearer ${token}`,
  });

  if (validAmountResponse.statusCode === 200) {
    assert.ok(validAmountResponse.body.authorizationUrl);
    assert.ok(validAmountResponse.body.reference);
  } else {
    assert.equal(validAmountResponse.statusCode, 503);
    assert.match(validAmountResponse.body.message, /PAYSTACK_SECRET_KEY|configured|Unable to start payment|Paystack/i);
  }
});

test('authenticated messaging routes create and fetch a conversation with a real message payload', async () => {
  const senderAuth = await registerAndVerify(makeUniqueEmail(), makeUniqueUsername());
  const receiverAuth = await registerAndVerify(makeUniqueEmail(), makeUniqueUsername());

  const sendResponse = await sendRequest('/messages/send', 'POST', {
    receiverId: receiverAuth.user.id,
    text: 'Hello from the smoke route.',
    mediaUrl: '',
    mediaType: '',
  }, {
    Authorization: `Bearer ${senderAuth.token}`,
  });

  assert.equal(sendResponse.statusCode, 201);
  assert.equal(sendResponse.body.success, true);
  assert.ok(sendResponse.body.data?.conversationId);

  const conversationId = sendResponse.body.data.conversationId;
  const inboxResponse = await sendRequest(`/messages/conversations?tab=messages`, 'GET', null, {
    Authorization: `Bearer ${senderAuth.token}`,
  });

  assert.equal(inboxResponse.statusCode, 200);
  assert.equal(inboxResponse.body.success, true);
  assert.ok(Array.isArray(inboxResponse.body.data));
  assert.ok(inboxResponse.body.data.some((item) => item.conversationId === conversationId));

  const messagesResponse = await sendRequest(`/messages/conversation/${encodeURIComponent(conversationId)}`, 'GET', null, {
    Authorization: `Bearer ${senderAuth.token}`,
  });

  assert.equal(messagesResponse.statusCode, 200);
  assert.equal(messagesResponse.body.success, true);
  assert.ok(Array.isArray(messagesResponse.body.data));
  assert.ok(messagesResponse.body.data.some((item) => item.text === 'Hello from the smoke route.'));
});
