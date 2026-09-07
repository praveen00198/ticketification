import {
  isPngBuffer,
  ticketImageService,
  TicketImageData,
} from '../src/modules/tickets/services/ticket-image.service';
import { initFonts } from '../src/utils/font-initializer';

describe('Phase 4.5: Devanagari / Hindi Complex Script Rendering & OpenType Shaping', () => {
  beforeAll(() => {
    initFonts();
  });

  const dummyQr =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const devanagariTestCases = [
    { id: 'HIN-01', text: 'प्रवीन', desc: 'Ra-kar conjunct (pra) + ee-matra' },
    { id: 'HIN-02', text: 'प्रवीण पटेल', desc: 'Conjunct + Retroflex nasal + Name' },
    { id: 'HIN-03', text: 'अतिथि', desc: 'Short i-matras before consonants' },
    { id: 'HIN-04', text: 'स्वागत है', desc: 'Half-letter sa conjunct (swa) + ai-matra' },
    { id: 'HIN-05', text: 'कार्यक्रम', desc: 'Reph (karya) + Conjunct (kram)' },
    { id: 'HIN-06', text: 'प्रमाण पत्र', desc: 'Conjuncts pra + tra' },
    { id: 'HIN-07', text: 'टेक्नोलॉजी', desc: 'Half-ka conjunct (k-na) + Candra aa-matra' },
    { id: 'HIN-08', text: 'शुभकामनाएँ', desc: 'Bha-ka conjunct + candrabindu on independent vowel' },
    { id: 'HIN-09', text: 'कृपया अपना टिकट दिखाएँ', desc: 'Vocalic r (kri) + pre-base i-matras + candrabindu' },
    { id: 'HIN-10', text: 'हिन्दी', desc: 'Anusvara nasalization + ee-matra' },
    { id: 'HIN-11', text: 'क्ष', desc: 'Ksha ligature (ka + virama + ssa)' },
    { id: 'HIN-12', text: 'त्र', desc: 'Tra ligature (ta + virama + ra)' },
    { id: 'HIN-13', text: 'ज्ञ', desc: 'Gya ligature (ja + virama + nya)' },
    { id: 'HIN-14', text: 'श्र', desc: 'Shra ligature (sha + virama + ra)' },
    { id: 'HIN-15', text: 'प्र', desc: 'Pra conjunct (pa + virama + ra)' },
    { id: 'HIN-16', text: 'क्र', desc: 'Kra conjunct (ka + virama + ra)' },
    { id: 'HIN-17', text: 'स्व', desc: 'Swa half-letter conjunct (sa + virama + va)' },
    { id: 'HIN-18', text: 'श्री', desc: 'Shree honorific with ee-matra' },
    { id: 'HIN-19', text: 'स्वागत है, Praveen', desc: 'Mixed Hindi greeting with English name' },
    { id: 'HIN-20', text: 'प्रवीण Patel', desc: 'Mixed Hindi first name with English surname' },
  ];

  test.each(devanagariTestCases)(
    'should correctly render Devanagari phrase [$id]: "$text" ($desc)',
    async ({ id, text }) => {
      const ticketData: TicketImageData = {
        ticketId: id,
        guestName: text,
        eventName: 'Devanagari Shaping Verification Gala',
        eventDate: '2026-10-25',
        ticketType: 'VIP Guest',
        qrCodeDataUrl: dummyQr,
      };

      const svg = ticketImageService.buildSvg(ticketData);

      // SVG must contain proper font family definition
      expect(svg).toContain('Noto Sans Devanagari');
      // SVG must safely escape and include the text
      const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      expect(svg).toContain(escapedText);

      // Render to genuine PNG via native sharp pipeline (sharp.composite)
      const pngBuffer = await ticketImageService.svgToPng(svg);

      expect(pngBuffer).toBeDefined();
      expect(isPngBuffer(pngBuffer)).toBe(true);
      // Valid rendered PNG for 1620x2025 ticket must have substantial binary content (> 50KB)
      expect(pngBuffer.length).toBeGreaterThan(50000);
    },
    15000
  );

  it('should maintain strict bounded memory (< 150MB RSS delta) during continuous Devanagari ticket generation', async () => {
    const startRss = process.memoryUsage().rss / 1024 / 1024;
    let peakRss = startRss;

    const timer = setInterval(() => {
      const cur = process.memoryUsage().rss / 1024 / 1024;
      if (cur > peakRss) peakRss = cur;
    }, 10);
    timer.unref();

    const batch = devanagariTestCases.slice(0, 5).map((tc) => ({
      ticketId: tc.id,
      guestName: tc.text,
      eventName: 'Memory Stress Verification',
      eventDate: '2026-10-25',
      ticketType: 'General',
      qrCodeDataUrl: dummyQr,
    }));

    const results = await ticketImageService.renderBatchTickets(batch, 1);
    clearInterval(timer);

    expect(results).toHaveLength(5);
    for (const res of results) {
      expect(isPngBuffer(res.pngBuffer)).toBe(true);
    }

    const deltaRss = peakRss - startRss;
    expect(deltaRss).toBeLessThan(150);
  }, 30000);
});
