process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerUser } = require('../src/controllers/authController');

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('registerUser rejects weak passwords', async () => {
  const req = { body: { name: 'Test User', email: 'test@example.com', password: '123' } };
  const res = createRes();

  await registerUser(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /password/i);
});

test('registerUser rejects invalid email formats', async () => {
  const req = { body: { name: 'Test User', email: 'not-an-email', password: 'StrongPass123!' } };
  const res = createRes();

  await registerUser(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /email/i);
});

test('registerUser returns a pending verification response for valid signup data', async () => {
  const req = { body: { name: 'OTP User', email: 'otp@example.com', password: 'StrongPass123!' } };
  const res = createRes();

  await registerUser(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.pending, true);
  assert.equal(res.body.email, 'otp@example.com');
  assert.match(res.body.message, /verification/i);
});
