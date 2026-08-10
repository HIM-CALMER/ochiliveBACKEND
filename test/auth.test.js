process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
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
  const req = { body: { name: 'OTP User', email: 'otp@example.com', username: 'otp_user', password: 'StrongPass123!' } };
  const res = createRes();

  await registerUser(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.pending, true);
  assert.equal(res.body.email, 'otp@example.com');
  assert.match(res.body.message, /verification/i);
});

test('sendOtpEmail uses SMTP when configured', async () => {
  const originalLoad = Module._load;
  const originalHost = process.env.SMTP_HOST;
  const originalPort = process.env.SMTP_PORT;
  const originalSecure = process.env.SMTP_SECURE;
  const originalUser = process.env.SMTP_USER;
  const originalPass = process.env.SMTP_PASS;
  const originalFrom = process.env.SMTP_FROM;

  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '465';
  process.env.SMTP_SECURE = 'true';
  process.env.SMTP_USER = 'test@example.com';
  process.env.SMTP_PASS = 'test-password';
  process.env.SMTP_FROM = 'from@example.com';

  let sendWasCalled = false;

  Module._load = function (request, parent, isMain) {
    if (request === 'nodemailer') {
      return {
        createTransport(config) {
          assert.equal(config.host, 'smtp.example.com');
          return {
            sendMail: async (msg) => {
              sendWasCalled = true;
              assert.equal(msg.from, 'from@example.com');
              assert.match(msg.text, /123456/);
              return { messageId: '1' };
            },
          };
        },
      };
    }

    return originalLoad.apply(this, arguments);
  };

  delete require.cache[require.resolve('../src/services/emailService')];
  const { sendOtpEmail } = require('../src/services/emailService');

  try {
    const result = await sendOtpEmail('test@example.com', '123456');
    assert.equal(result.mode, 'smtp');
    assert.equal(sendWasCalled, true);
  } finally {
    Module._load = originalLoad;
    if (originalHost === undefined) {
      delete process.env.SMTP_HOST;
    } else {
      process.env.SMTP_HOST = originalHost;
    }
    if (originalPort === undefined) {
      delete process.env.SMTP_PORT;
    } else {
      process.env.SMTP_PORT = originalPort;
    }
    if (originalSecure === undefined) {
      delete process.env.SMTP_SECURE;
    } else {
      process.env.SMTP_SECURE = originalSecure;
    }
    if (originalUser === undefined) {
      delete process.env.SMTP_USER;
    } else {
      process.env.SMTP_USER = originalUser;
    }
    if (originalPass === undefined) {
      delete process.env.SMTP_PASS;
    } else {
      process.env.SMTP_PASS = originalPass;
    }
    if (originalFrom === undefined) {
      delete process.env.SMTP_FROM;
    } else {
      process.env.SMTP_FROM = originalFrom;
    }
    delete require.cache[require.resolve('../src/services/emailService')];
  }
});
