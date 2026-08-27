process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const { registerUser, checkUsernameAvailability } = require('../src/controllers/authController');
const { createUser } = require('../src/services/userStore');
const { searchProfiles } = require('../src/controllers/profileController');

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

test('username availability rejects reserved names', async () => {
  const req = { query: { username: 'support' } };
  const res = createRes();

  await checkUsernameAvailability(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.available, false);
  assert.equal(res.body.reason, 'reserved');
});

test('username availability returns suggestions for a taken name', async () => {
  await createUser({
    id: 'availability-user-1',
    name: 'Taken User',
    email: 'taken.availability@example.com',
    username: 'taken_name',
    password: 'hashed-password',
    profilePictureUrl: '',
    bio: '',
    accountType: 'creator',
    followerIds: [],
    followingIds: [],
  });
  const req = { query: { username: 'taken_name' } };
  const res = createRes();

  await checkUsernameAvailability(req, res);

  assert.equal(res.body.available, false);
  assert.equal(res.body.reason, 'taken');
  assert.ok(res.body.suggestions.length > 0);
  assert.ok(!res.body.suggestions.includes('taken_name'));
});

test('searchProfiles returns users matching the query', async () => {
  await createUser({
    id: 'search-user-1',
    name: 'Alex Parker',
    email: 'alex.search@example.com',
    username: 'alex_parker',
    password: 'hashed-password',
    profilePictureUrl: '',
    bio: 'Standup comic and storyteller.',
    accountType: 'comedian',
    followerIds: ['viewer-1'],
    followingIds: [],
  });

  const req = { user: { id: 'viewer-1' }, query: { q: 'alex' } };
  const res = createRes();

  await searchProfiles(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.results));
  assert.ok(res.body.results.some((user) => user.username === 'alex_parker'));
});

test('searchProfiles matches by username and name from the backend user store', async () => {
  await createUser({
    id: 'search-user-2',
    name: 'Ayomide Adeyemi',
    email: 'ayomide@example.com',
    username: 'ayo_mide',
    password: 'hashed-password',
    profilePictureUrl: '',
    bio: 'Comedy performer.',
    accountType: 'creator',
    followerIds: ['viewer-2'],
    followingIds: [],
  });

  const nameSearchReq = { user: { id: 'viewer-2' }, query: { q: 'ayomide' } };
  const nameSearchRes = createRes();
  await searchProfiles(nameSearchReq, nameSearchRes);

  assert.equal(nameSearchRes.statusCode, 200);
  assert.ok(nameSearchRes.body.results.some((user) => user.name === 'Ayomide Adeyemi'));

  const usernameSearchReq = { user: { id: 'viewer-2' }, query: { q: 'ayo' } };
  const usernameSearchRes = createRes();
  await searchProfiles(usernameSearchReq, usernameSearchRes);

  assert.equal(usernameSearchRes.statusCode, 200);
  assert.ok(usernameSearchRes.body.results.some((user) => user.username === 'ayo_mide'));
});

test('profile posts stay available in the in-memory fallback without MongoDB', async () => {
  const { uploadVideoPost } = require('../src/controllers/videoController');
  const { clearVideoStore } = require('../src/services/videoStore');
  const { getPosts } = require('../src/controllers/profileController');
  const { createUser } = require('../src/services/userStore');

  clearVideoStore();
  await createUser({
    id: 'u_mem_1',
    name: 'Memory User',
    email: 'memory.user@example.com',
    username: 'memory_user',
    password: 'hashed-password',
    profilePictureUrl: '',
    bio: 'Memory user',
    accountType: 'creator',
    followerIds: [],
    followingIds: [],
  });

  const uploadReq = {
    user: { id: 'u_mem_1', name: 'Memory User', username: 'memory_user' },
    headers: { authorization: 'Bearer demo-token' },
    body: {
      title: 'Memory post',
      description: 'Stored without MongoDB',
      mediaUrl: '/uploads/memory-video.mp4',
      thumbnailUrl: '/uploads/memory-video.mp4',
      type: 'video',
      category: 'Comedy',
    },
  };
  const uploadRes = createRes();

  await uploadVideoPost(uploadReq, uploadRes);

  assert.equal(uploadRes.statusCode, 201);

  const req = { params: { username: 'memory_user' } };
  const res = createRes();
  await getPosts(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.body), true);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].title, 'Memory post');

  clearVideoStore();
});

test('likes and comments work in the in-memory fallback without MongoDB', async () => {
  const { clearVideoStore, createVideo } = require('../src/services/videoStore');
  const { likeVideo, commentOnVideo } = require('../src/controllers/videoActionsController');

  clearVideoStore();
  const created = await createVideo({
    id: 'video_memory_1',
    creatorId: 'u_mem_2',
    creatorName: 'Tester',
    title: 'Memory social post',
    description: 'A social test',
    mediaUrl: '/uploads/test.mp4',
    thumbnailUrl: '/uploads/test.mp4',
    category: 'Comedy',
    type: 'video',
    likes: 0,
    likedBy: [],
    comments: 0,
    commentThread: [],
    status: 'published',
    createdAt: new Date(),
  });

  const likeReq = { params: { id: created.id }, user: { id: 'viewer_1' } };
  const likeRes = createRes();
  await likeVideo(likeReq, likeRes);

  assert.equal(likeRes.statusCode, 200);
  assert.equal(likeRes.body.liked, true);
  assert.equal(likeRes.body.likes, 1);

  const commentReq = {
    params: { id: created.id },
    user: { id: 'viewer_2', name: 'Jane', username: 'jane' },
    body: { comment: 'This is funny' },
  };
  const commentRes = createRes();
  await commentOnVideo(commentReq, commentRes);

  assert.equal(commentRes.statusCode, 201);
  assert.equal(commentRes.body.video.comments, 1);
  assert.equal(commentRes.body.comment.text, 'This is funny');

  clearVideoStore();
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
