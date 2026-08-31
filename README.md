# x402-express

> Express.js HTTP 402 payment middleware for autonomous AI agent micropayments on Base.

---

## Overview

`x402-express` provides lightweight middleware for Node.js Express applications to monetize API endpoints via the HTTP 402 Payment Required specification. It allows autonomous AI agents, script clients, and LLM routers to execute microtransactions natively on Base before accessing paid API endpoints.

## Repository

* **GitHub:** [https://github.com/ihen404/x402-express](https://github.com/ihen404/x402-express)

## Installation
bash npm install x402-express
## Quickstart
javascript const express = require('express'); const x402 = require('x402-express');
const app = express();
// Protect endpoint with a $0.01 price requirement app.get('/api/protected', x402({ price: '0.01' }), (req, res) => { res.json({ success: true, data: "Access granted to premium resource." }); });
app.listen(3000, () => { console.log('Server running on http://localhost:3000'); });
## How It Works for AI Agents

1. **Unauthenticated Request:** The client or AI agent sends a standard GET/POST request to a protected endpoint.
2. **HTTP 402 Interception:** The middleware intercepts the request and responds with status code `402 Payment Required`.
3. **Payload Header:** The response includes an `X-Payment-Required` header containing the Base payment parameters encoded in Base64:
json { "error": "Payment Required", "message": "This API is monetized via x402. Provide an x-payment header to execute." }
4. **Agent Execution:** The agent parses the `X-Payment-Required` header, executes the on-chain microtransaction on Base, and resubmits the request with the `X-Payment` proof header to execute the API call.

## License

MIT

### 🌐 Paid API Specification

**Endpoint:** `POST https://your-deployed-app.up.railway.app/api/scrape`  
**Protocol:** `x402` (HTTP 402 Payment Required)  
**Price:** `$0.02 USDC` per request  
**Network:** `Base` (`chainId: 8453`)  
**Asset Contract:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC)  
**Payout Address:** `YOUR_BASE_WALLET_ADDRESS`  

---

#### 1. Unauthenticated Request (HTTP 402 Challenge)
Send a standard POST request without payment headers:

```bash
curl -i -X POST [https://your-deployed-app.up.railway.app/api/scrape](https://your-deployed-app.up.railway.app/api/scrape) \
  -H "Content-Type: application/json" \
  -d '{"url": "[https://news.ycombinator.com](https://news.ycombinator.com)"}'
Expected Response Header:
HTTP/1.1 402 Payment Required
X-Payment-Required: eyJzY2hlbWUiOiJleGFjdCIsInBheVRvIjoiMHhZT1V...
Paid Request (Machine-to-Machine via x402 Client)
AI agents using @ihentrel/x402-express or x402-fetch automatically parse the challenge header, sign a $0.02 USDC payment payload on Base, and retry:
import { fetchWithX402 } from 'x402-client';

const response = await fetchWithX402('[https://your-deployed-app.up.railway.app/api/scrape](https://your-deployed-app.up.railway.app/api/scrape)', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: '[https://news.ycombinator.com](https://news.ycombinator.com)' })
});

const data = await response.json();
console.log(data.markdown); // Returns clean Markdown ready for LLM context

