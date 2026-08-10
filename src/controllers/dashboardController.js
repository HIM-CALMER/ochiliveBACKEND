const { findByEmail } = require('../services/userStore');

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
  return res.json({
    balance: 12480,
    pendingPayouts: 3860,
    lifetimeEarnings: 49830,
    recentTransactions: [
      { id: 'txn_01', description: 'Ticket sales', amount: 560, date: 'Today' },
      { id: 'txn_02', description: 'Super chat', amount: 230, date: 'Yesterday' },
      { id: 'txn_03', description: 'Revenue share', amount: 170, date: '2 days ago' },
    ],
  });
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
  return res.json([
    { id: 'note_1', title: 'New booking request', description: 'Your upcoming stream was promoted on the homepage.', time: '2m ago' },
    { id: 'note_2', title: 'Wallet payout ready', description: 'A new payout is queued and ready for withdrawal.', time: '14m ago' },
    { id: 'note_3', title: 'Room trending', description: 'Creator Lounge is now trending in the top 5.', time: '36m ago' },
  ]);
};

const getActivityFeed = async (req, res) => {
  return res.json([
    { id: 'act_1', title: 'A new highlight reel published', time: '3m ago', detail: 'Your latest live set just hit 3.2k views.' },
    { id: 'act_2', title: 'New followers acquired', time: '18m ago', detail: '24 new fans joined after last broadcast.' },
    { id: 'act_3', title: 'Trending tag unlocked', time: '45m ago', detail: 'Your show is now trending under #LateNight.' },
    { id: 'act_4', title: 'Wallet update', time: '1h ago', detail: 'Pending payout has been validated and queued.' },
  ]);
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
  getProfileSummary,
  getNotifications,
  getActivityFeed,
  uploadAsset,
};
