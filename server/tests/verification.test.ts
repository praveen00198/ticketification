import { qrService } from '../src/modules/tickets/services/qr.service';
import { verificationService } from '../src/modules/verification/services/verification.service';

describe('VerificationService & QrService Logic', () => {
  it('should generate cryptographically strong 64-character hex tokens', () => {
    const token1 = qrService.generateVerificationToken();
    const token2 = qrService.generateVerificationToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it('should return INVALID for unrecognized token lookup', async () => {
    const mockRepo: any = {
      findByVerificationToken: jest.fn().mockResolvedValue(null),
      findByTicketId: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
    };

    const service = new (verificationService.constructor as any)(mockRepo);
    const result = await service.verifyToken('non_existent_token_123456');

    expect(result.status).toBe('INVALID');
    expect(result.ticket).toBeUndefined();
  });

  it('should prevent checking in an ALREADY USED ticket', async () => {
    const mockTicket = {
      _id: 'ticket123',
      ticketId: 'EVT26-000001',
      status: 'USED',
      usedAt: new Date(),
    };

    const mockRepo: any = {
      findById: jest.fn().mockResolvedValue(mockTicket),
      findByIdOrTicketId: jest.fn().mockResolvedValue(mockTicket),
    };

    const service = new (verificationService.constructor as any)(mockRepo);

    await expect(service.checkInTicket('ticket123', 'Scanner 1')).rejects.toThrow(
      /has ALREADY been used/
    );
  });
});
