import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import authRoutes from './modules/auth/routes/auth.routes';
import guestRoutes from './modules/guests/routes/guest.routes';
import ticketRoutes from './modules/tickets/routes/ticket.routes';
import verificationRoutes from './modules/verification/routes/verification.routes';
import dashboardRoutes from './modules/dashboard/routes/dashboard.routes';
import webhookRoutes from './modules/delivery/routes/webhook.routes';
import { ticketService } from './modules/tickets/services/ticket.service';
import { errorHandler } from './middlewares/error.middleware';
import config from './config/env';

const app = express();

const allowedOrigins = [
  config.env.appUrl,
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CORS_ORIGIN,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Allow if explicit match, vercel preview/prod domain, or wildcard
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        process.env.CORS_ORIGIN === '*' ||
        !config.env.isProduction
      ) {
        return callback(null, true);
      }

      // Default fallback in case user hasn't set custom domain yet
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve generated ticket images statically with on-demand fallback regeneration
const uploadsPath = path.resolve(process.cwd(), config.env.uploadDir);

app.get('/uploads/tickets/:filename', async (req, res, next) => {
  const filePath = path.join(uploadsPath, 'tickets', req.params.filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // If missing on disk (e.g. after Render cold start / restart), regenerate on the fly
  const match = req.params.filename.match(/^ticket-(.+)\.png$/i);
  if (match && match[1]) {
    try {
      const ticketId = match[1];
      const result = await ticketService.getTicketImageFilePath(ticketId);
      if (fs.existsSync(result.filePath)) {
        return res.sendFile(result.filePath);
      }
    } catch (err) {
      console.warn(`[OnDemandImageGen] Could not generate on-demand image for ${req.params.filename}:`, err);
    }
  }
  return next();
});

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
