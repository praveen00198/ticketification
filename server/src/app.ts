import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/routes/auth.routes';
import guestRoutes from './modules/guests/routes/guest.routes';
import ticketRoutes from './modules/tickets/routes/ticket.routes';
import verificationRoutes from './modules/verification/routes/verification.routes';
import dashboardRoutes from './modules/dashboard/routes/dashboard.routes';
import eventRoutes from './modules/events/routes/event.routes';
import { ticketService } from './modules/tickets/services/ticket.service';
import { ticketRepository } from './modules/tickets/repositories/ticket.repository';
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
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        process.env.CORS_ORIGIN === '*' ||
        !config.env.isProduction
      ) {
        return callback(null, true);
      }
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

// Top-level QR verification URL redirect handler for mobile phone camera scans
app.get('/verify/:token', (req, res) => {
  const token = req.params.token;
  const frontendUrl =
    process.env.FRONTEND_URL ||
    config.env.appUrl ||
    'https://ticketification.vercel.app';
  return res.redirect(302, `${frontendUrl.replace(/\/+$/, '')}/verify/${token}`);
});

// Legacy backward-compatible redirect: if any legacy URL is accessed, redirect to canonical Supabase Storage URL
app.get('/uploads/tickets/:filename', async (req, res) => {
  const filename = req.params.filename;
  try {
    const cleanToken = filename.replace(/\.(svg|png)$/, '').replace(/^ticket-/, '');
    const ticketRecord =
      (await ticketService.getTicketById(cleanToken)) ||
      (await ticketRepository.findByVerificationToken(cleanToken));

    if (ticketRecord?.ticket?.assetUrl && ticketRecord.ticket.assetUrl.includes('supabase.co')) {
      return res.redirect(301, ticketRecord.ticket.assetUrl);
    }
  } catch (_e) {}
  return res.status(404).send('Ticket asset not found. Please access ticket via the dashboard console.');
});

// REST API Base Router
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/verify', verificationRoutes);
app.use('/api/tickets', verificationRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', system: 'QR Ticket Generation System', timestamp: new Date().toISOString() });
});

// Centralized Error Handler Middleware
app.use(errorHandler);

export default app;
