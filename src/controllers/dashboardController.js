const { findByEmail } = require('../services/userStore');
const { listNotifications, markNotificationRead, markAllNotificationsRead } = require('../services/notificationStore');
const { initializeTransaction, verifyTransaction } = require('../services/paystackService');
const { getWallet, creditWallet } = require('../services/walletStore');
const { getComedianAccess } = require('../config/comedianLevels');

const getDashboardSummary = async (req, res) => {
  return res.json({
    totals: {
      liveRooms: 18,
      viewers: 12400,
      walletBalance: 12480,
    },
    highlights: [
      { label: 'Top room', value: 'The Late Show' },
      { label: 'Fastest growing', value: 'Studio Sessions' },
      { label: 'New followers', value: '246' },
    ],
    activeRooms: [
      { title: 'Creator Lounge', host: 'Nia Rivers', viewers: '8.4k' },
      { title: 'Night Shift', host: 'Mika Sol', viewers: '4.9k' },
      { title: 'Open Mic Nights', host: 'Ayo & crew', viewers: '12.8k' },
    ],
  });
};

const getDiscoverItems = async (req, res) => {
  return res.json([
    { title: 'Open Mic Nights', category: 'Comedy', tag: 'Tonight', description: 'Fresh voices, tight sets, and quick laughs.' },
    { title: 'Studio Sessions', category: 'Music', tag: 'Popular', description: 'Intimate creator rooms with real-time reactions.' },
    { title: 'Night Shift', category: 'Late night', tag: 'Recommended', description: 'Late-night energy for premium audiences.' },
    { title: 'Creator Spotlight', category: 'Interview', tag: 'Featured', description: 'Deep dives with headline creators and live Q&A.' },
  ]);
};

const getWalletSummary = async (req, res) => {
  return res.json(await getWallet(req.user.id));
};

const initializeWalletFunding = async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount < 100) return res.status(400).json({ message: 'Enter an amount of at least 100.' });
  if (!req.user.email) return res.status(400).json({ message: 'A verified email is required to add funds.' });
  try {
    const frontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const backendUrl = String(process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const callbackUrl = `${backendUrl}/api/dashboard/wallet/fund/callback`;
    const transaction = await initializeTransaction({ amount: Math.round(amount * 100), email: req.user.email, currency: req.body?.currency || 'NGN', callback_url: callbackUrl, metadata: { userId: req.user.id, purpose: 'wallet_funding' } });
    return res.json({ authorizationUrl: transaction.authorization_url, reference: transaction.reference });
  } catch (error) {
    return res.status(503).json({ message: error.message || 'Unable to start payment.' });
  }
};

const verifyWalletFunding = async (req, res) => {
  const reference = String(req.query?.reference || '').trim();
  if (!reference) return res.status(400).json({ message: 'Payment reference is required.' });
  try {
    const transaction = await verifyTransaction(reference);
    const metadataUserId = transaction.metadata?.userId || transaction.metadata?.user_id;
    if (transaction.status !== 'success' || String(metadataUserId || '') !== String(req.user.id)) return res.status(400).json({ message: 'Payment could not be verified.' });
    const wallet = await creditWallet(req.user.id, Number(transaction.amount) / 100, reference, transaction.currency || 'NGN', { paystackId: transaction.id, channel: transaction.channel });
    return res.json({ message: 'Funds added successfully.', wallet });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Payment could not be verified.' });
  }
};

const walletFundingCallback = (req, res) => {
  const frontendUrl = String(process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (!frontendUrl) return res.status(500).send('FRONTEND_URL is not configured.');

  const redirectUrl = new URL(`${frontendUrl}/wallet`);
  const reference = String(req.query?.reference || req.query?.trxref || '').trim();
  const status = String(req.query?.status || '').trim();
  if (reference) redirectUrl.searchParams.set('reference', reference);
  if (status) redirectUrl.searchParams.set('status', status);
  return res.redirect(302, redirectUrl.toString());
};

const getProfileSummary = async (req, res) => {
  const user = req.user || {};
  const storedUser = user.email ? await findByEmail(user.email) : null;
  const profileUser = storedUser || user;
  const name = profileUser.name || 'Ochi Creator';
  const email = profileUser.email || 'creator@ochi.live';
  const followerIds = Array.isArray(profileUser.followerIds) ? profileUser.followerIds : [];
  const followingIds = Array.isArray(profileUser.followingIds) ? profileUser.followingIds : [];

  return res.json({
    user: {
      id: profileUser.id || 'user_demo',
      name,
      username: email.split('@')[0] || 'creator',
      bio: 'Live creator focused on premium events, audience engagement, and insightful broadcasts.',
      location: 'Remote',
      tier: 'Creator Pro',
      accountType: profileUser.accountType || 'creator',
      comedyProfile: profileUser.accountType === 'comedian' ? {
        ...(profileUser.comedyProfile || {}),
        ...getComedianAccess(profileUser.comedyProfile),
      } : null,
    },
    stats: {
      followers: followerIds.length,
      following: followingIds.length,
      streams: 84,
      engagement: '92%',
    },
  });
};

const getNotifications = async (req, res) => {
  const type = ['like', 'comment', 'save', 'follow', 'follow-back', 'reshare', 'mention'].includes(req.query?.type) ? req.query.type : null;
  const records = await listNotifications(req.user.id, type);
  const notifications = records.map((item) => ({
    ...item,
    id: item.id || item._id?.toString(),
    title: { like: 'Video liked', comment: 'New comment', save: 'Video saved', follow: 'New follower', 'follow-back': 'Followed back', reshare: 'Post reshared', mention: 'Mentioned in a post' }[item.type] || 'New activity',
    description: item.type === 'comment' ? `${item.actorName || item.actorUsername} said: “${item.comment}”` : `${item.actorName || item.actorUsername} ${item.type === 'follow' ? 'started following you.' : item.type === 'save' ? 'saved your video.' : item.type === 'like' ? 'liked your video.' : item.type === 'reshare' ? 'reshared your post.' : 'interacted with your content.'}`,
    actor: item.actorName || item.actorUsername,
    username: item.actorUsername ? `@${item.actorUsername.replace(/^@/, '')}` : '',
    time: new Date(item.createdAt).toLocaleString(),
    unread: !item.readAt,
  }));
  return res.json({ notifications, unreadCount: notifications.filter((item) => item.unread).length });
};

const readNotification = async (req, res) => {
  const updated = await markNotificationRead(req.params.id, req.user.id);
  if (!updated) return res.status(404).json({ message: 'Notification not found.' });
  return res.json({ ok: true });
};

const readAllNotifications = async (req, res) => {
  await markAllNotificationsRead(req.user.id);
  return res.json({ ok: true });
};

const getActivityFeed = async (req, res) => {
  const wallet = await getWallet(req.user.id);
  const notifications = await listNotifications(req.user.id);
  const notificationTitles = {
    like: 'Video liked',
    comment: 'New comment',
    save: 'Video saved',
    follow: 'New follower',
    'follow-back': 'Followed back',
    reshare: 'Post reshared',
    mention: 'Mentioned in a post',
  };
  const notificationActivity = notifications.map((notification) => ({
    id: notification.id || notification._id?.toString(),
    title: notificationTitles[notification.type] || 'Social activity',
    category: 'Social',
    time: new Date(notification.createdAt).toLocaleString(),
    occurredAt: notification.createdAt,
    detail: notification.type === 'comment'
      ? `${notification.actorName || notification.actorUsername} said: “${notification.comment}”`
      : `${notification.actorName || notification.actorUsername} ${notification.type === 'follow' ? 'started following you.' : notification.type === 'like' ? 'liked your video.' : notification.type === 'save' ? 'saved your video.' : notification.type === 'reshare' ? 'reshared your post.' : 'interacted with your content.'}`,
    notification: {
      type: notification.type,
      unread: !notification.readAt,
      actorUsername: notification.actorUsername || '',
    },
  }));
  const walletActivity = (wallet.recentTransactions || []).map((transaction) => {
    const type = transaction.type || (transaction.event === 'Funds added' ? 'funding' : 'wallet');
    const amount = Number(transaction.amount ?? transaction.net ?? transaction.gross ?? 0);
    const currency = transaction.currency || wallet.currency || 'NGN';
    const status = transaction.status || 'settled';
    const labels = {
      funding: 'Wallet funded',
      withdrawal: 'Withdrawal update',
      earning: 'Creator earnings received',
      refund: 'Wallet refund issued',
      'gift-purchase': 'Gift purchase',
      'gift-tip': 'Gift tip sent',
    };

    return {
      id: transaction.id || transaction._id?.toString() || transaction.reference,
      title: labels[type] || 'Wallet transaction',
      category: 'Wallet',
      time: new Date(transaction.createdAt || transaction.date || Date.now()).toLocaleString(),
      occurredAt: transaction.createdAt || transaction.date,
      detail: `${currency} ${amount.toLocaleString()} ${status}. ${transaction.source || 'Wallet ledger'}.`,
      wallet: {
        reference: transaction.reference,
        type,
        amount,
        currency,
        status,
        source: transaction.source || '',
      },
    };
  });

  return res.json([...notificationActivity, ...walletActivity].sort((first, second) => (
    new Date(second.occurredAt || 0).getTime() - new Date(first.occurredAt || 0).getTime()
  )));
};

const uploadAsset = async (req, res) => {
  const { title, category, description } = req.body || {};

  if (!title?.trim()) {
    return res.status(400).json({ message: 'Please include a title for the upload.' });
  }

  return res.status(201).json({
    message: 'Upload request received. Your asset is queued for processing.',
    upload: {
      id: `upload_${Date.now()}`,
      title: title.trim(),
      category: category?.trim() || 'General',
      description: description?.trim() || '',
      status: 'queued',
    },
  });
};

module.exports = {
  getDashboardSummary,
  getDiscoverItems,
  getWalletSummary,
  initializeWalletFunding,
  verifyWalletFunding,
  walletFundingCallback,
  getProfileSummary,
  getNotifications,
  readNotification,
  readAllNotifications,
  getActivityFeed,
  uploadAsset,
};
