import axios from 'axios';
import fs from 'fs';
import path from 'path';

async function verify() {
  try {
    const testEmail = `ganesh-admin-${Date.now()}@ticketification.com`;
    const testPassword = 'Password123!';
    
    // 1. Register test admin with eventName: "Ganesh Chaturthi"
    const reg = await axios.post('http://localhost:3000/api/auth/register', {
      name: 'Event Organizer',
      email: testEmail,
      password: testPassword,
      eventName: 'Ganesh Chaturthi',
    });
    const token = reg.data.data.token;
    console.log('1. Registered admin with event "Ganesh Chaturthi". Token:', token.substring(0, 15) + '...');

    // 2. Generate tickets
    const genRes = await axios.post(
      'http://localhost:3000/api/tickets/generate',
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
    console.log('2. Generated tickets:');
    genRes.data.data.tickets.forEach((t: any) => {
      console.log(`   - Ticket ID: ${t.ticketId} | Name: ${t.name} | Event: ${t.event}`);
    });

    const firstTicket = genRes.data.data.tickets[0];
    console.log('3. Testing single download for:', firstTicket.ticketId);

    const singleDl = await axios.get(`http://localhost:3000/api/tickets/${firstTicket.ticketId}/download?token=${token}`, {
      responseType: 'arraybuffer',
    });
    console.log('   Single download Content-Disposition:', singleDl.headers['content-disposition']);
    console.log('   Single download size:', singleDl.data.length, 'bytes');

    const testPngPath = path.resolve(process.cwd(), 'uploads/tickets', 'verified-ganesh-ticket.png');
    fs.writeFileSync(testPngPath, singleDl.data);
    console.log('   Saved verified-ganesh-ticket.png');

    console.log('4. Testing ZIP download...');
    const zipDl = await axios.get(`http://localhost:3000/api/tickets/download-zip?token=${token}`, {
      responseType: 'arraybuffer',
    });
    console.log('   ZIP download Content-Disposition:', zipDl.headers['content-disposition']);
    console.log('   ZIP download size:', zipDl.data.length, 'bytes');

    console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  } catch (err: any) {
    console.error('Download verification error:', err.response?.data || err.message);
  }
}

verify();

