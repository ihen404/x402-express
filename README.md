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
