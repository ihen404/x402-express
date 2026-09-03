require('dotenv').config();
const express = require('express');
const x402 = require('@ihentrel/x402-express');
const puppeteer = require('puppeteer-core');
const TurndownService = require('turndown');

const app = express();
app.use(express.json());

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// Configure x402 Middleware: Protect the /api/scrape endpoint
// Charges 0.02 USDC on Base per scraping request
app.use('/api/scrape', x402({
  payTo: process.env.PAYMENT_WALLET_ADDRESS ||'0x391e20e3f938d9aa3b39c7f4aa1cb6cbd6a9df28',
  price: '0.005', // $0.005 USDC per request
  asset: 'USDC',
  network: 'base'
}));

// Main Scraper Endpoint
app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body.' });
  }

  let browser;
  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

    // Extract body HTML and convert to clean Markdown
    const bodyHtml = await page.evaluate(() => document.body.innerHTML);
    const markdown = turndownService.turndown(bodyHtml);

    await browser.close();

    return res.json({
      success: true,
      url,
      markdown,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    if (browser) await browser.close();
    return res.status(500).json({ error: 'Failed to scrape target URL', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`x402 Paid Scraper API running on port ${PORT}`);
});
