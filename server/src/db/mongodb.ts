import mongoose from 'mongoose';
import config from '../config/env';

/**
 * MongoDB Connection Manager for Ticketification.
 * Manages connection pooling, lifecycle events, and graceful shutdowns.
 */

let isConnected = false;

export interface MongoConnectionOptions {
  uri?: string;
  maxPoolSize?: number;
  minPoolSize?: number;
  serverSelectionTimeoutMS?: number;
}

export async function connectMongoDB(options: MongoConnectionOptions = {}): Promise<typeof mongoose | null> {
  const uri = options.uri !== undefined ? options.uri : config.env.mongoUri;

  if (!uri) {
    console.warn('⚠️ [MongoDB] MONGODB_URI not set. MongoDB application features will run in standby mode.');
    return null;
  }

  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    mongoose.connection.on('connected', () => {
      isConnected = true;
      console.log('✅ [MongoDB] Connected to database instance successfully.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ [MongoDB] Connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('⚠️ [MongoDB] Disconnected from database instance.');
    });

    await mongoose.connect(uri, {
      maxPoolSize: options.maxPoolSize || 50,
      minPoolSize: options.minPoolSize || 10,
      serverSelectionTimeoutMS: options.serverSelectionTimeoutMS || 5000,
      autoIndex: process.env.NODE_ENV !== 'production', // Build indexes in dev/test, manage explicitly in prod
    });

    isConnected = true;
    return mongoose;
  } catch (error: any) {
    console.error('❌ [MongoDB] Failed to connect:', error.message);
    isConnected = false;
    return null;
  }
}

export async function disconnectMongoDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('🔌 [MongoDB] Connection closed cleanly.');
  }
}

export function setMongoConnectedForTesting(status: boolean): void {
  isConnected = status;
}

export function isMongoConnected(): boolean {
  if (process.env.NODE_ENV === 'test' && isConnected) {
    return true;
  }
  return isConnected && mongoose.connection.readyState === 1;
}

export default {
  connect: connectMongoDB,
  disconnect: disconnectMongoDB,
  isConnected: isMongoConnected,
};
