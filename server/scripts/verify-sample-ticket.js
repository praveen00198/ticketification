const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const jsQR = require('jsqr');

async function verifySampleTicket() {
  const filePath = path.resolve(__dirname, '../sample_default_ticket.png');
  console.log(`[CHALLENGER] Loading sample ticket from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  console.log(`[CHALLENGER] File size: ${fileBuffer.length} bytes (${(fileBuffer.length / 1024).toFixed(2)} KB)`);

  // 1. Verify PNG Magic Bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  const expectedMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const actualMagic = Array.from(fileBuffer.subarray(0, 8));
  console.log(`[CHALLENGER] Expected magic: ${expectedMagic.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
  console.log(`[CHALLENGER] Actual magic:   ${actualMagic.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

  const magicMatch = expectedMagic.every((val, idx) => actualMagic[idx] === val);
  if (!magicMatch) {
    throw new Error(`Magic bytes mismatch! File is not a genuine PNG image.`);
  }
  console.log('✅ Magic bytes 0x89504E470D0A1A0A verified successfully.');

  // 2. Verify Dimensions & Color Channels via Sharp
  const metadata = await sharp(fileBuffer).metadata();
  console.log(`[CHALLENGER] Format: ${metadata.format}, Dimensions: ${metadata.width} x ${metadata.height}, Channels: ${metadata.channels}, ColorSpace: ${metadata.space}`);

  if (metadata.width !== 1620 || metadata.height !== 2025) {
    throw new Error(`Dimensions mismatch! Expected 1620x2025, got ${metadata.width}x${metadata.height}`);
  }
  if (metadata.format !== 'png') {
    throw new Error(`Format mismatch! Expected png, got ${metadata.format}`);
  }
  console.log('✅ Dimensions 1620 x 2025 verified successfully.');

  // 3. Extract Raw RGBA Pixel Buffer and Optical Decode via jsQR (Full Image)
  console.log('[CHALLENGER] Extracting uncompressed raw RGBA pixel buffer...');
  const rawFull = await sharp(fileBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log(`[CHALLENGER] Raw pixel buffer length: ${rawFull.data.length} bytes (${rawFull.info.width}x${rawFull.info.height}x${rawFull.info.channels})`);

  const clampedFull = new Uint8ClampedArray(rawFull.data);
  const decodedFull = jsQR(clampedFull, rawFull.info.width, rawFull.info.height);

  if (!decodedFull) {
    throw new Error('FAILED to optically decode QR code from full 1620x2025 PNG image!');
  }
  console.log(`✅ jsQR full-frame decode successful!`);
  console.log(`[CHALLENGER] Decoded URL: "${decodedFull.data}"`);

  // 4. Assert Expected Verification URL
  const expectedUrl = 'https://ticketification.app/verify/4f8b2a1c9e3d7a5b6f0e2d4c8a1b3e5f7a9c2d4e6f8a0b1c3d5e7f9a1b3c5d7e';
  if (decodedFull.data !== expectedUrl) {
    throw new Error(`Decoded URL mismatch! Expected: ${expectedUrl}, Got: ${decodedFull.data}`);
  }
  console.log('✅ Verification URL matches target exactly.');

  // 5. Crop Viewport Scan (Adversarial Region Check: translate(530, 840), width=560, height=560)
  console.log('[CHALLENGER] Testing cropped QR bounding box viewport extraction (530, 840, 560x560)...');
  const rawCrop = await sharp(fileBuffer)
    .extract({ left: 530, top: 840, width: 560, height: 560 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const clampedCrop = new Uint8ClampedArray(rawCrop.data);
  const decodedCrop = jsQR(clampedCrop, rawCrop.info.width, rawCrop.info.height);
  if (!decodedCrop) {
    throw new Error('FAILED to decode QR from cropped viewport!');
  }
  if (decodedCrop.data !== expectedUrl) {
    throw new Error(`Cropped QR decode mismatch! Got: ${decodedCrop.data}`);
  }
  console.log('✅ Viewport cropped QR decode matches target exactly.');

  // 6. Confirm ZERO Attendee PII in QR Payload
  const forbiddenPii = [
    'Aman',
    'Gupta',
    'राहुल',
    'शर्मा',
    'SMP-SAMPLE-2026',
    'Grand Convention Centre',
    'VIP Delegate',
    'Lead Systems Architect',
    'Tech Corp',
    '@',
    'phone',
    'name',
    'email'
  ];

  const payload = decodedFull.data;
  const piiViolations = [];
  for (const item of forbiddenPii) {
    if (payload.toLowerCase().includes(item.toLowerCase())) {
      piiViolations.push(item);
    }
  }

  if (piiViolations.length > 0) {
    throw new Error(`PII LEAK DETECTED in QR code payload: ${piiViolations.join(', ')}`);
  }
  console.log('✅ ZERO attendee PII confirmed in QR payload.');

  // 7. QR Payload Structure Invariant
  const urlPattern = /^https:\/\/ticketification\.app\/verify\/[a-f0-9]{64}$/;
  if (!urlPattern.test(payload)) {
    throw new Error(`QR payload does not match strict verification URL regex: ${payload}`);
  }
  console.log('✅ Strict URL regex /^https:\\/\\/ticketification\\.app\\/verify\\/[a-f0-9]{64}$/ confirmed.');

  console.log('\n========================================');
  console.log('🎉 ALL EMPIRICAL VERIFICATION GATES PASSED');
  console.log('========================================\n');
}

verifySampleTicket().catch((err) => {
  console.error('❌ EMPIRICAL VERIFICATION FAILED:', err);
  process.exit(1);
});
