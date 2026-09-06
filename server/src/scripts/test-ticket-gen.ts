import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';

async function testGeneration() {
  const templatePath = path.resolve(__dirname, '../../assets/ticket_template.png');
  const templateBuffer = fs.readFileSync(templatePath);
  const templateBase64 = `data:image/png;base64,${templateBuffer.toString('base64')}`;

  const qrDataUrl = await QRCode.toDataURL('https://ticketification.com/verify/sample-token-12345', {
    width: 400,
    margin: 1,
    color: {
      dark: '#111827',
      light: '#FFFFFF',
    },
  });

  const guestName = 'श्री राजेश कुमार शर्मा';

  const html = `
  <!DOCTYPE html>
  <html lang="hi">
  <head>
    <meta charset="UTF-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Rozha+One&family=Yatra+One&family=Tiro+Devanagari+Hindi:wght@400;700&family=Mukta:wght@600;700;800&family=Gotu&display=swap');
      
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        width: 1620px;
        height: 2025px;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: #000;
        -webkit-print-color-adjust: exact;
      }
      .invitation-container {
        width: 1620px;
        height: 2025px;
        position: relative;
        background-image: url('${templateBase64}');
        background-size: 1620px 2025px;
        background-position: center;
        background-repeat: no-repeat;
      }
      .content-wrapper {
        position: absolute;
        top: 950px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 1100px;
      }
      .qr-card {
        background: #FFFFFF;
        padding: 16px;
        border-radius: 24px;
        border: 4px solid #FCD34D;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
        display: inline-block;
      }
      .qr-img {
        width: 370px;
        height: 370px;
        display: block;
        border-radius: 12px;
      }
      .guest-name-box {
        margin-top: 36px;
        text-align: center;
        width: 100%;
        max-width: 1000px;
      }
      .guest-name {
        font-family: 'Rozha One', 'Yatra One', 'Tiro Devanagari Hindi', 'Gotu', serif;
        font-size: 64px;
        font-weight: 300;
        color: #FFE680;
        letter-spacing: 1.5px;
        line-height: 1.3;
        text-shadow: 0 4px 14px rgba(0, 0, 0, 0.75), 0 0 25px rgba(252, 211, 77, 0.45);
      }
      .ticket-id {
        margin-top: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 20px;
        font-weight: 600;
        color: #FCD34D;
        letter-spacing: 2px;
        opacity: 0.9;
        text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
      }
    </style>
  </head>
  <body>
    <div class="invitation-container">
      <div class="content-wrapper">
        <div class="qr-card">
          <img src="${qrDataUrl}" class="qr-img" alt="QR Code" />
        </div>
        <div class="guest-name-box">
          <div class="guest-name">${guestName}</div>
          <div class="ticket-id">PASS ID: TIK-892401</div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  const browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1620, height: 2025 });
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const outDir = path.resolve(__dirname, '../../uploads/tickets');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'test-sample-ticket.png');
  await page.screenshot({ path: outPath, type: 'png', fullPage: true });
  await browser.close();

  console.log('Saved test ticket to:', outPath);
}

testGeneration();
