/* Usage: node convert_puppeteer.js input.html output.pdf */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const inFile = process.argv[2] || '../SAFE_Comprehensive.html';
  const outFile = process.argv[3] || '../SAFE_Comprehensive_puppeteer.pdf';
  const url = 'file://' + path.resolve(inFile);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: outFile,
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
  });

  await browser.close();
  console.log(`Created ${outFile}`);
})();