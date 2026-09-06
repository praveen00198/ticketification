import mongoose from 'mongoose';
import config from './env';

export async function connectDB(): Promise<typeof mongoose | null> {
  try {
    const conn = await mongoose.connect(config.env.mongoUri);
    console.log(`[DB] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[DB Error] Failed to connect to MongoDB (${config.env.mongoUri}):`, error);
    if (config.env.isProduction) {
      process.exit(1);
    }
    console.warn('[DB Warning] Running in dev mode with mock/degraded database capability.');
    return null;
  }
}
