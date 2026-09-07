import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import authRoutes from './modules/auth/routes/auth.routes';
import guestRoutes from './modules/guests/routes/guest.routes';
import ticketRoutes from './modules/tickets/routes/ticket.routes';
import verificationRoutes from './modules/verification/routes/verification.routes';
import dashboardRoutes from './modules/dashboard/routes/dashboard.routes';
import eventRoutes from './modules/events/routes/event.routes';
import { ticketService } from './modules/tickets/services/ticket.service';
import { ticketRepository } from './modules/tickets/repositories/ticket.repository';
import { qrService } from './modules/tickets/services/qr.service';
import { ticketImageService } from './modules/tickets/services/ticket-image.service';
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

// Serve generated ticket images statically with on-demand fallback regeneration
const uploadsPath = path.resolve(process.cwd(), config.env.uploadDir);

app.get('/uploads/tickets/:filename', async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsPath, 'tickets', filename);
  
  if (fs.existsSync(filePath)) {
    if (filename.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (filename.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }
    return res.sendFile(filePath);
  }

  // On-demand dynamic generation fallback
  try {
    const cleanToken = filename.replace(/\.(svg|png)$/, '').replace(/^ticket-/, '');
    const ticketRecord =
      (await ticketService.getTicketById(cleanToken)) ||
      (await ticketRepository.findByVerificationToken(cleanToken));

    if (ticketRecord) {
      const qrDataUrl = await qrService.generateQrDataUrl(ticketRecord.ticket.verificationToken);
      const ticketSeqStr = ticketRecord.ticket.sequenceNumber.toString().padStart(5, '0');
      const displayId = `${ticketRecord.event.name.substring(0, 3).toUpperCase()}-${ticketSeqStr}`;

      const { filePath: newPath } = await ticketImageService.generateTicketImage({
        ticketId: displayId,
        guestName: ticketRecord.guest?.name || 'Valued Guest',
        eventName: ticketRecord.event.name,
        eventDate: ticketRecord.event.date,
        ticketType: ticketRecord.ticketType.label || ticketRecord.ticketType.name,
        qrCodeDataUrl: qrDataUrl,
        organization: ticketRecord.guest?.organization || undefined,
        phone: ticketRecord.guest?.phone || undefined,
      });

      if (fs.existsSync(newPath)) {
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.sendFile(newPath);
      }
    }
  } catch (genErr) {
    console.warn('[Uploads] Error during on-demand ticket regeneration:', genErr);
  }

  return res.status(404).send('Ticket image not found');
});

app.use('/uploads', express.static(uploadsPath));

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
