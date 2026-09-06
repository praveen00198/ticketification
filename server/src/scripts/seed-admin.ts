import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import config from '../config/env';
import { User } from '../modules/auth/models/user.model';

async function seedAdmin() {
  const email = process.argv[2] || 'admin@ticketification.com';
  const password = process.argv[3] || 'Admin@123';
  const name = process.argv[4] || 'Administrator';

  console.log(`[Seed Admin] Connecting to MongoDB at ${config.env.mongoUri}...`);

  try {
    await mongoose.connect(config.env.mongoUri);
    console.log('[Seed Admin] Connected to MongoDB.');

    const passwordHash = await bcrypt.hash(password, 10);
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      existingUser.name = name;
      existingUser.passwordHash = passwordHash;
      existingUser.role = 'ADMIN';
      existingUser.eventName = 'Ticketification 2026';
      await existingUser.save();
      console.log(`\n✅ Administrator user UPDATED successfully!`);
    } else {
      await User.create({
        name,
        email: email.toLowerCase(),
        passwordHash,
        eventName: 'Ticketification 2026',
        role: 'ADMIN',
      });
      console.log(`\n✅ Administrator user CREATED successfully!`);
    }

    console.log(`----------------------------------------`);
    console.log(` Email:    ${email}`);
    console.log(` Password: ${password}`);
    console.log(`----------------------------------------\n`);
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedAdmin();
