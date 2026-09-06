import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Camera, KeyRound, AlertCircle } from 'lucide-react';

interface QrScannerProps {
  onScanSuccess: (scannedText: string) => void;
}

export const QrScanner: React.FC<QrScannerProps> = ({ onScanSuccess }) => {
  const [manualToken, setManualToken] = useState('');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Instantiate camera scanner
    try {
      const scanner = new Html5QrcodeScanner(
        'qr-reader-container',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          rememberLastUsedCamera: true,
        },
        /* verbose= */ false
      );

      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          onScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignore transient frame scan errors
          if (!errorMessage.includes('No QR code found')) {
            console.debug('Scan frame warning:', errorMessage);
          }
        }
      );
    } catch (err: any) {
      setScannerError('Could not initialize camera scanner. Ensure camera permissions are granted or use manual ticket verification fallback.');
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((err) => console.error('Failed to clear scanner:', err));
      }
    };
  }, [onScanSuccess]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      onScanSuccess(manualToken.trim());
      setManualToken('');
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-2xl border border-surface-border p-6 shadow-md">
      <div className="flex items-center gap-2 mb-4 text-surface-charcoal">
        <Camera className="w-5 h-5 text-brand-600" />
        <h3 className="font-extrabold text-lg">Event Camera Scanner</h3>
      </div>

      {scannerError && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{scannerError}</span>
        </div>
      )}

      {/* Camera Viewport Container */}
      <div
        id="qr-reader-container"
        className="w-full rounded-xl overflow-hidden border-2 border-zinc-900 bg-zinc-950 min-h-[300px]"
      />

      {/* Manual Entry Fallback */}
      <div className="mt-6 pt-6 border-t border-surface-border">
        <div className="text-xs font-semibold text-surface-muted uppercase mb-3 flex items-center gap-1.5">
          <KeyRound className="w-4 h-4 text-zinc-400" /> Manual Token or Ticket ID Entry
        </div>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Paste Token or Enter Ticket ID (e.g. EVT26-000001)"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            className="flex-1 px-3.5 py-2.5 bg-surface-bg border border-surface-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={!manualToken.trim()}
            className="bg-surface-charcoal hover:bg-black text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            Verify
          </button>
        </form>
      </div>
    </div>
  );
};
