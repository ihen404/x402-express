const { createPublicClient, http, formatUnits, parseUnits } = require('viem');
const { base } = require('viem/chains');

// Base USDC Contract Address
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Standard ERC-20 Transfer Event Signature (Transfer(address,address,uint256))
const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/**
* In-memory Replay Protection Store
* Maps txHash -> timestamp when verified
*/
class ReplayStore {
constructor(ttlMs = 24 * 60 * 60 * 1000) { // Default 24 hour TTL
this.processed = new Map();
this.ttlMs = ttlMs;

// Periodic cleanup of expired hashes every hour
setInterval(() => this.cleanup(), 60 * 60 * 1000).unref();
}

has(hash) {
const timestamp = this.processed.get(hash.toLowerCase());
if (!timestamp) return false;
if (Date.now() - timestamp > this.ttlMs) {
  this.processed.delete(hash.toLowerCase());
  return false;
}
return true;
}

add(hash) {
this.processed.set(hash.toLowerCase(), Date.now());
}

cleanup() {
const now = Date.now();
for (const [hash, timestamp] of this.processed.entries()) {
  if (now - timestamp > this.ttlMs) {
    this.processed.delete(hash);
  }
}
}
}

// Global replay store instance
const globalReplayStore = new ReplayStore();

/**
* x402 Express Middleware Factory
*
* @param {Object} options Configuration options
* @param {string} options.payTo - Target wallet address to receive funds (0x...)
* @param {string} options.price - Minimum price required (e.g., '0.01')
* @param {string} [options.asset='USDC'] - Asset type: 'USDC' or 'ETH'
* @param {string} [options.rpcUrl] - Optional custom Base RPC endpoint URL
* @param {number} [options.ttlMs] - Replay cache TTL in milliseconds
*/
function x402(options = {}) {
const {
payTo,
price = '0.01',
asset = 'USDC',
rpcUrl,
ttlMs
} = options;

if (!payTo) {
throw new Error('[x402-express] Configuration error: "payTo" wallet address is required.');
}

const replayStore = ttlMs ? new ReplayStore(ttlMs) : globalReplayStore;

// Initialize Viem Client for Base Network
const publicClient = createPublicClient({
chain: base,
transport: http(rpcUrl || 'https://mainnet.base.org')
});

return async function x402Middleware(req, res, next) {
const txHash = req.headers['x-payment'] || req.headers['x-payment-hash'];

// 1. Check for Missing Payment Header -> Issue HTTP 402 Challenge
if (!txHash) {
  const challengePayload = {
    scheme: 'exact',
    payTo,
    price,
    asset,
    network: 'base',
    chainId: 8453,
    tokenAddress: asset === 'USDC' ? BASE_USDC_ADDRESS : null
  };

  const encodedChallenge = Buffer.from(JSON.stringify(challengePayload)).toString('base64');

  res.setHeader('X-Payment-Required', encodedChallenge);
  return res.status(402).json({
    error: 'Payment Required',
    message: `This endpoint requires an on-chain payment of ${price} ${asset} on Base.`,
    accepts: challengePayload
  });
}

// 2. Replay Protection Check
if (replayStore.has(txHash)) {
  return res.status(402).json({
    error: 'Payment Required',
    message: 'This transaction hash has already been used (Replay Protection).'
  });
}

// 3. On-Chain Verification via Viem
try {
  // Retrieve transaction receipt from Base RPC
  const receipt = await publicClient.getTransactionReceipt({
    hash: txHash
  });

  if (receipt.status !== 'success') {
    return res.status(402).json({
      error: 'Payment Required',
      message: 'Provided transaction failed or reverted on-chain.'
    });
  }

  // Verify Payment Details based on Asset Type
  let isVerified = false;

  if (asset.toUpperCase() === 'USDC') {
    // Inspect ERC-20 Logs for USDC Transfer to recipient
    const targetRecipient = payTo.toLowerCase();
    const minAmountUnits = parseUnits(price, 6); // USDC uses 6 decimals

    for (const log of receipt.logs) {
      if (
        log.address.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase() &&
        log.topics[0] === TRANSFER_EVENT_TOPIC &&
        log.topics[2] // Topic 2 is 'to' address (indexed)
      ) {
        const recipientHex = '0x' + log.topics[2].slice(26).toLowerCase();
        const value = BigInt(log.data);

        if (recipientHex === targetRecipient && value >= minAmountUnits) {
          isVerified = true;
          break;
        }
      }
    }
  } else if (asset.toUpperCase() === 'ETH') {
    // Inspect Native ETH Transaction
    const tx = await publicClient.getTransaction({ hash: txHash });
    const minAmountWei = parseUnits(price, 18);

    if (
      tx.to &&
      tx.to.toLowerCase() === payTo.toLowerCase() &&
      tx.value >= minAmountWei
    ) {
      isVerified = true;
    }
  }

  if (!isVerified) {
    return res.status(402).json({
      error: 'Payment Required',
      message: `Transaction does not fulfill payment criteria of ${price} ${asset} to ${payTo}.`
    });
  }

  // 4. Mark Transaction Hash as Spent & Proceed
  replayStore.add(txHash);
  req.x402Payment = {
    txHash,
    payTo,
    price,
    asset,
    verified: true
  };

  next();
} catch (err) {
  console.error('[x402-express] Verification error:', err.message);
  return res.status(402).json({
    error: 'Payment Required',
    message: 'Unable to verify transaction hash on Base network. Ensure transaction is confirmed.'
  });
}
};
}

module.exports = x402;
