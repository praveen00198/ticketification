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

app.get('/uploads/tickets/:filename', async (req, res) => {
  const filePath = path.join(uploadsPath, 'tickets', req.params.filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // Extract ticketId: e.g. "ticket-GACH-00004.png" or "ticket-GACH-00004.svg" -> "GACH-00004"
  const match = req.params.filename.match(/^ticket-(.+)\.(png|svg|html)$/i);
  if (match && match[1]) {
    try {
      const ticketId = match[1];
      const ticket = await ticketService.getTicketById(ticketId);
      if (ticket) {
        // 1. If imageBase64 is in MongoDB, stream it with its MIME type
        if (ticket.imageBase64 && ticket.imageBase64.startsWith('data:image/')) {
          const matchType = ticket.imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (matchType) {
            const mimeType = matchType[1];
            const buffer = Buffer.from(matchType[2], 'base64');
            res.setHeader('Content-Type', mimeType);
            return res.send(buffer);
          }
        }

        // 2. Otherwise generate crisp SVG on the fly from MongoDB ticket record
        const qrDataUrl = await qrService.generateQrDataUrl(ticket.verificationToken);
        const svgContent = ticketImageService.buildSvg({
          ticketId: ticket.ticketId,
          guestName: ticket.name,
          eventName: ticket.event,
          eventDate: '',
          ticketType: ticket.ticketType,
          qrCodeDataUrl: qrDataUrl,
          organization: ticket.organization,
          phone: ticket.phone,
        });
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(svgContent);
      }
    } catch (err) {
      console.warn(`[OnDemandImageGen] Error rendering image for ${req.params.filename}:`, err);
    }
  }
  return res.status(404).send('Ticket image not found');
});

app.use('/uploads', express.static(uploadsPath));

// REST API Base Router
app.use('/api/auth', authRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/tickets', verificationRoutes);
app.use('/api/tickets', ticketRoutes);
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
