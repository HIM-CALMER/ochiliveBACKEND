const PAYSTACK_URL = 'https://api.paystack.co';

const getSecretKey = () => process.env.PAYSTACK_SECRET_KEY;

const paystackRequest = async (path, options = {}) => {
  const secretKey = getSecretKey();
  if (!secretKey) throw new Error('PAYSTACK_SECRET_KEY is not configured.');

  const response = await fetch(`${PAYSTACK_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok || !data.status) throw new Error(data.message || 'Paystack request failed.');
  return data.data;
};

const initializeTransaction = (payload) => paystackRequest('/transaction/initialize', { method: 'POST', body: JSON.stringify(payload) });
const verifyTransaction = (reference) => paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);

module.exports = { initializeTransaction, verifyTransaction };