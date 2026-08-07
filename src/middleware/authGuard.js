const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  req.user = { token };
  next();
};

module.exports = authenticate;
