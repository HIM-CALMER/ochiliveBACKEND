const COMEDIAN_LEVELS = {
  1: {
    name: 'Rookie',
    maxStreamMinutes: 5,
    monthlyStreamLimit: 4,
    ticketPublishingEnabled: false,
    pricingMode: 'free',
    minimumRating: null,
  },
};

const getComedianLevel = (level = 1) => COMEDIAN_LEVELS[level] || COMEDIAN_LEVELS[1];

const getComedianAccess = (comedianProfile = {}) => {
  const level = Number(comedianProfile.level) || 1;
  return { level, ...getComedianLevel(level) };
};

module.exports = { COMEDIAN_LEVELS, getComedianLevel, getComedianAccess };
