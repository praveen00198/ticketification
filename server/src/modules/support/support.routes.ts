import { Router, Request, Response, NextFunction } from 'express';
import { mongoEventReportRepository } from '../events/repositories/mongo-event-report.repository';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { ValidationError, AuthenticationError } from '../../middlewares/error.middleware';
import { REPORT_CATEGORIES } from '../../db/mongo/models/event-report.model';

const router = Router();

export interface SupportFAQ {
  id: string;
  category: 'ATTENDEE' | 'HOST' | 'SCANNER' | 'ACCOUNT';
  question: string;
  answer: string;
}

export const PLATFORM_FAQS: SupportFAQ[] = [
  {
    id: 'faq-1',
    category: 'ATTENDEE',
    question: 'How do I discover events and register?',
    answer: 'Navigate to "Explore Events" to browse upcoming public events, search by title, or filter by category. Click "Register" on any event page to confirm your ticket pass.',
  },
  {
    id: 'faq-2',
    category: 'ATTENDEE',
    question: 'Where can I find my ticket pass and QR code?',
    answer: 'All issued passes are automatically stored in your "My Passes" wallet. You can view your pass, display the live QR token for venue entry, or download the badge PNG directly to your device.',
  },
  {
    id: 'faq-3',
    category: 'ATTENDEE',
    question: 'Can I cancel my registration if I cannot attend?',
    answer: 'Yes. Go to "My Registrations" and click "Cancel Registration" on the active registration. Your spot will be automatically released to other attendees and your linked pass will be revoked.',
  },
  {
    id: 'faq-4',
    category: 'SCANNER',
    question: 'How does turnstile check-in work on event day?',
    answer: 'Gate staff and volunteers use the camera scanner on the "Scan & Turnstiles" console. Each pass has a dynamic cryptographic token that verifies and checks in attendees in sub-100ms. Replay scans or duplicate passes are automatically flagged.',
  },
  {
    id: 'faq-5',
    category: 'HOST',
    question: 'How do I host an event on Ticketification?',
    answer: 'Click "Create Event" under Event Hosting to launch the event creation wizard. Once created, you will be redirected directly to your Host Dashboard where you can import guest lists, generate passes, and manage check-ins.',
  },
  {
    id: 'faq-6',
    category: 'HOST',
    question: 'How do I import guests from an Excel or CSV file?',
    answer: 'From your Host Dashboard, select "Import Guests". Upload your spreadsheet (.xlsx or .csv), confirm the auto-detected column mappings (Name, Email, Ticket Type), and click "Confirm Import" to ingest your roster.',
  },
  {
    id: 'faq-7',
    category: 'ACCOUNT',
    question: 'How do I update my profile or change my password?',
    answer: 'Go to "Account & Profile" in the sidebar. You can update your display name and organizer details under "My Profile", manage preferences under "Account Settings", and update your password under "Security & Password".',
  },
];

/**
 * @route   GET /api/support/faqs
 * @desc    Retrieve verified platform Help Center FAQs
 */
router.get('/faqs', (_req: Request, res: Response) => {
  res.json({
    success: true,
    count: PLATFORM_FAQS.length,
    data: PLATFORM_FAQS,
  });
});

/**
 * @route   POST /api/support/report
 * @desc    Submit an issue or support ticket
 */
router.post('/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, category, reason, reporterEmail, reporterName } = req.body;
    let user = (req as any).user;
    const authHeader = req.headers.authorization;

    if (!user && authHeader) {
      if (!authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError('Invalid authentication header format.');
      }
      const token = authHeader.split(' ')[1]?.trim();
      if (!token) {
        throw new AuthenticationError('Authentication required. Bearer token is empty.');
      }
      const { verifyJwtToken } = await import('../../utils/local-auth');
      const payload = verifyJwtToken(token);
      if (!payload || !payload.id) {
        throw new AuthenticationError('Invalid or expired authentication token.');
      }
      user = { id: String(payload.id), email: payload.email, name: (payload as any).name };
    }

    const email = (user?.email || reporterEmail || '').trim().toLowerCase();
    const name = (user?.name || reporterName || '').trim() || null;
    const userId = user?.id ? String(user.id) : null;

    if (!email || !email.includes('@')) {
      throw new ValidationError('A valid contact email address is required.');
    }

    if (!reason || reason.trim().length < 10) {
      throw new ValidationError('Please provide a detailed description of the issue (minimum 10 characters).');
    }

    const reportCategory = category && REPORT_CATEGORIES.includes(category) ? category : 'OTHER';

    const report = await mongoEventReportRepository.create({
      eventId: eventId || null,
      reporterEmail: email,
      reporterName: name,
      reporterUserId: userId,
      category: reportCategory,
      reason: reason.trim(),
      status: 'PENDING',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    res.status(201).json({
      success: true,
      message: 'Your report has been submitted. Our support team will review it shortly.',
      data: report,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/support/my-reports
 * @desc    Retrieve issue reports submitted by the authenticated user
 */
router.get('/my-reports', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AuthenticationError('Unauthorized. Please authenticate first.');
    }

    const reports = await mongoEventReportRepository.findByReporterUserId(userId);

    res.json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
