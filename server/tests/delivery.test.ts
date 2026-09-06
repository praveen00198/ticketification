import { whatsAppProvider } from '../src/modules/delivery/providers/whatsapp.provider';
import { deliveryService } from '../src/modules/delivery/services/delivery.service';
import { ITicketDocument } from '../src/modules/tickets/models/ticket.model';

describe('DeliveryService & WhatsAppProvider (Mock Mode)', () => {
  const mockTicket: Partial<ITicketDocument> = {
    ticketId: 'EVT26-000001',
    verificationToken: 'test_token_12345',
    name: 'Aman Patel',
    phone: '+919876543210',
    email: 'aman@example.com',
    event: 'Eventify 2026',
    eventDate: new Date('2026-08-25'),
    ticketType: 'VIP Pass',
    status: 'ACTIVE',
    deliveryProvider: 'WHATSAPP',
    deliveryStatus: 'PENDING',
  };

  it('should deliver ticket via mock WhatsApp provider successfully', async () => {
    const result = await whatsAppProvider.sendTicket(
      mockTicket as ITicketDocument,
      '/fake/path/ticket-EVT26-000001.png'
    );

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBeDefined();
    expect(result.providerMessageId).toContain('mock-wa-');
  });

  it('should route delivery through DeliveryService batch processing', async () => {
    const items = [
      { ticket: mockTicket as ITicketDocument, imagePath: '/fake/path/1.png' },
      { ticket: { ...mockTicket, ticketId: 'EVT26-000002' } as ITicketDocument, imagePath: '/fake/path/2.png' },
    ];

    const batchResult = await deliveryService.sendBatch(items);

    expect(batchResult.sent).toBe(2);
    expect(batchResult.failed).toBe(0);
    expect(batchResult.results.length).toBe(2);
  });
});
