import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './modules/auth/routes/auth.routes';
import guestRoutes from './modules/guests/routes/guest.routes';
import ticketRoutes from './modules/tickets/routes/ticket.routes';
import verificationRoutes from './modules/verification/routes/verification.routes';
import dashboardRoutes from './modules/dashboard/routes/dashboard.routes';
import webhookRoutes from './modules/delivery/routes/webhook.routes';
import { errorHandler } from './middlewares/error.middleware';
import config from './config/env';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve generated ticket images statically
const uploadsPath = path.resolve(process.cwd(), config.env.uploadDir);
app.use('/uploads', express.static(uploadsPath));

// REST API Base Router
app.use('/api/auth', authRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/tickets', verificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
// WhatsApp Webhook (no auth — Meta sends verification & status callbacks here)
app.use('/api/webhook', webhookRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', system: 'QR Ticket Generation System', timestamp: new Date().toISOString() });
});

// Centralized Error Handler Middleware
app.use(errorHandler);

export default app;
