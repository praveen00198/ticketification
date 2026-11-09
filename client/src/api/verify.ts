import { apiClient } from './client';
import { enqueueOfflineScan, isOfflineOrServerError } from '../services/offlineScanQueue';

export type VerificationState =
  | 'VALID'
  | 'ALREADY_USED'
  | 'INVALID'
  | 'CANCELLED'
  | 'WRONG_EVENT'
  | 'VALID_WORKER'
  | 'UNASSIGNED_WORKER'
  | 'PENDING_SYNC';

export interface VerifiedTicketData {
  id?: string;
  sequenceNumber?: number;
  name: string;
  category: string;
  usagePolicy: string;
  organization?: string | null;
  designation?: string | null;
  eventName?: string;
  eventDate?: string;
  assetUrl?: string | null;
  lastCheckinTime?: string | null;
}

export interface VerificationResponse {
  status: VerificationState;
  message: string;
  ticket?: VerifiedTicketData;
  offlineScanId?: string;
  queuedAt?: string;
  isReplay?: boolean;
  acknowledged?: boolean;
}

export interface CheckinResponse {
  success: boolean;
  status: string;
  message: string;
  checkinId?: string;
  checkedInAt?: string;
  guestName?: string;
  workerName?: string;
  category?: string;
}

export interface BatchSyncScanItem {
  scanEventId: string;
  idempotencyKey: string;
  token: string;
  scannedAt: string;
  gate?: string;
  workerName?: string;
}

export interface BatchSyncResultItem {
  scanEventId: string;
  idempotencyKey: string;
  status: VerificationState;
  code: string;
  message: string;
  acknowledged: boolean;
  checkedInAt?: string;
}

export interface BatchSyncResponse {
  success: boolean;
  processedCount: number;
  results: BatchSyncResultItem[];
}

export const verifyApi = {
  async lookupToken(token: string, eventId?: string): Promise<VerificationResponse> {
    const res: any = await apiClient.post('/verify/lookup', { token, eventId });
    return res.data;
  },

  async publicVerify(token: string): Promise<VerificationResponse> {
    const res: any = await apiClient.get(`/verify/${token}`);
    return res.data;
  },

  async checkIn(
    token: string,
    eventId?: string,
    workerName?: string
  ): Promise<CheckinResponse> {
    const res: any = await apiClient.post('/verify/checkin', {
      token,
      eventId,
      workerName,
    });
    return res.data;
  },

  async getRecentCheckins(eventId: string) {
    const res: any = await apiClient.get(`/verify/recent/${eventId}`);
    return res.data || [];
  },

  async scanTicket(
    token: string,
    eventId?: string,
    workerName?: string,
    gate?: string,
    idempotencyKey?: string
  ): Promise<VerificationResponse & { checkinId?: string; checkedInAt?: string; workerName?: string; guestName?: string }> {
    const res: any = await apiClient.post('/verify/scan', {
      token,
      eventId,
      workerName,
      gate,
      idempotencyKey,
    });
    return res.data;
  },

  async syncOfflineScans(
    eventId: string,
    deviceScannerId: string,
    scans: BatchSyncScanItem[]
  ): Promise<BatchSyncResponse> {
    const res: any = await apiClient.post('/verify/sync', {
      eventId,
      deviceScannerId,
      scans,
    });
    return res.data;
  },
};

/**
 * Scan ticket with conditional client-side offline queuing (Requirement R4).
 * If the backend verification service is unreachable due to network failure,
 * timeout, or 5xx server error, the scan is safely enqueued into native IndexedDB
 * and returns a PENDING_SYNC status (never a false VALID).
 * Standard 4xx errors (INVALID, ALREADY_USED, WRONG_EVENT) are rejected immediately.
 */
export async function scanTicketWithOfflineQueue(
  token: string,
  eventId?: string,
  workerName?: string,
  gate?: string
): Promise<VerificationResponse & { checkinId?: string; checkedInAt?: string; workerName?: string; guestName?: string }> {
  try {
    return await verifyApi.scanTicket(token, eventId, workerName, gate);
  } catch (err: any) {
    if (isOfflineOrServerError(err) && eventId) {
      const record = await enqueueOfflineScan({
        token,
        eventId,
        workerName,
        gate,
      });

      return {
        status: 'PENDING_SYNC',
        message: `Offline mode active: Scan recorded locally in device queue (#${record.id.slice(0, 8)}). Will synchronize automatically when connection is restored.`,
        offlineScanId: record.id,
        queuedAt: record.clientTimestamp,
        ticket: {
          name: workerName || 'Offline Attendee Pass',
          category: 'Queued (Pending Sync)',
          usagePolicy: 'SINGLE_USE',
        },
      };
    }

    // Re-throw 4xx validation rejections or unrecoverable client errors
    throw err;
  }
}
