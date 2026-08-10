const requireComedian = (req, res, next) => {
  if (req.user?.accountType !== 'comedian' || !req.user?.comedyProfile?.completedAt) {
    return res.status(403).json({ message: 'Complete Try Comedy onboarding before going live.', code: 'COMEDIAN_ONBOARDING_REQUIRED' });
  }
  return next();
};

module.exports = requireComedian;