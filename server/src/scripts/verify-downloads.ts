import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Test verification utility for local development ticket downloads.
 * Explicitly guards against execution in production environments.
 */
async function verify() {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowVerification = process.env.ALLOW_TEST_VERIFICATION === 'true' || process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

  if (isProduction || !allowVerification) {
    console.error('[Security] verify-downloads script aborted: Cannot run against production or unverified environments.');
    console.error('[Security] Set NODE_ENV=development or ALLOW_TEST_VERIFICATION=true to run in local test fixtures.');
    process.exit(1);
  }

  const baseUrl = process.env.TEST_API_URL || 'http://localhost:3000';

  try {
    const testEmail = `test-verify-${Date.now()}-${crypto.randomBytes(4).toString('hex')}@ticketification.example.invalid`;
    // Ephemeral dynamic password for local test execution
    const testPassword = process.env.TEST_ADMIN_PASSWORD || `P@ss-${crypto.randomBytes(8).toString('hex')}`;

    // 1. Register test user
    const reg = await axios.post(`${baseUrl}/api/auth/register`, {
      name: 'Event Organizer Test',
      email: testEmail,
      password: testPassword,
      eventName: 'Verification Test Event',
    });

    const token = reg.data?.data?.token;
    if (!token) {
      throw new Error('Registration succeeded but no authorization token was returned');
    }
    console.log('1. Registered test administrator account successfully. Auth session acquired.');

    // 2. Generate tickets
    const genRes = await axios.post(
      `${baseUrl}/api/tickets/generate`,
      {
        guests: [
          {
            name: 'श्री राजेश कुमार शर्मा',
            phone: '+919876543210',
            ticketType: 'VIP Guest',
          },
          {
            name: 'श्रीमती सुनीता शर्मा',
            phone: '+919876543211',
            ticketType: 'Family Pass',
          },
        ],
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const tickets = genRes.data?.data?.tickets || [];
    console.log(`2. Generated ${tickets.length} test tickets successfully.`);

    if (tickets.length === 0) {
      throw new Error('No tickets generated in response');
    }

    const firstTicket = tickets[0];
    console.log('3. Testing single download for pass sequence identifier.');

    const singleDl = await axios.get(`${baseUrl}/api/tickets/${firstTicket.ticketId}/download?token=${encodeURIComponent(token)}`, {
      responseType: 'arraybuffer',
    });
    console.log('   Single download Content-Disposition:', singleDl.headers['content-disposition']);
    console.log('   Single download size:', singleDl.data.length, 'bytes');

    const outDir = path.resolve(process.cwd(), 'uploads/tickets');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const testPngPath = path.join(outDir, 'verified-ganesh-ticket.png');
    fs.writeFileSync(testPngPath, singleDl.data);
    console.log('   Saved verified-ganesh-ticket.png to local test artifact directory.');

    console.log('4. Testing ZIP download...');
    const zipDl = await axios.get(`${baseUrl}/api/tickets/download-zip?token=${encodeURIComponent(token)}`, {
      responseType: 'arraybuffer',
    });
    console.log('   ZIP download Content-Disposition:', zipDl.headers['content-disposition']);
    console.log('   ZIP download size:', zipDl.data.length, 'bytes');

    console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  } catch (err: any) {
    const errorDetails = err.response?.data?.message || err.message || 'Unknown verification error';
    console.error('Download verification error (sanitized):', errorDetails);
    process.exit(1);
  }
}

if (require.main === module) {
  verify();
}
