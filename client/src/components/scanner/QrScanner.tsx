import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, KeyRound, AlertCircle, RefreshCw } from 'lucide-react';

interface QrScannerProps {
  onScanSuccess: (scannedText: string) => void;
}

export const QrScanner: React.FC<QrScannerProps> = ({ onScanSuccess }) => {
  const [manualToken, setManualToken] = useState('');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isCooldownRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const elementId = 'qr-reader-viewport';

    const initScanner = async () => {
      setIsInitializing(true);
      setScannerError(null);

      try {
        // Ensure DOM element is present
        const viewportEl = document.getElementById(elementId);
        if (!viewportEl) return;

        const scannerInstance = new Html5Qrcode(elementId);
        html5QrCodeRef.current = scannerInstance;

        const scanConfig = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        const onScan = (decodedText: string) => {
          if (isCooldownRef.current) return;
          isCooldownRef.current = true;
          onScanSuccess(decodedText);
          setTimeout(() => {
            isCooldownRef.current = false;
          }, 1800);
        };

        // Multi-level robust camera startup with rear/environment priority
        let started = false;

        // Attempt 1: Standard environment facingMode constraint (works on iOS & Android Chrome)
        try {
          await scannerInstance.start({ facingMode: 'environment' }, scanConfig, onScan, () => {});
          started = true;
        } catch (attempt1Err) {
          console.warn('Attempt 1 (facingMode: environment) failed:', attempt1Err);
        }

        // Attempt 2: Query camera devices and select back camera ID
        if (!started && isMounted) {
          try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              const backCamera = devices.find((d) =>
                /back|rear|environment|wide|triple|dual|0, facing back/i.test(d.label)
              ) || devices[devices.length - 1];

              await scannerInstance.start(backCamera.id, scanConfig, onScan, () => {});
              started = true;
            }
          } catch (attempt2Err) {
            console.warn('Attempt 2 (Device ID) failed:', attempt2Err);
          }
        }

        // Attempt 3: Fallback to any available camera
        if (!started && isMounted) {
          await scannerInstance.start({ facingMode: 'user' }, scanConfig, onScan, () => {});
          started = true;
        }
      } catch (err: any) {
        console.error('Camera initialization error:', err);
        if (isMounted) {
          const errMsg =
            err?.name === 'NotAllowedError' || err?.message?.includes('Permission')
              ? 'Camera access permission was denied. Please allow camera permissions in your browser settings.'
              : err?.name === 'NotReadableError' || err?.message?.includes('busy')
              ? 'Camera is in use by another app or tab. Please tap Retry.'
              : err?.message || 'Unable to start camera scanner. Please tap Retry or use manual entry below.';
          setScannerError(errMsg);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    initScanner();

    // Clean up camera stream completely when scanner unmounts
    return () => {
      isMounted = false;
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current
            .stop()
            .then(() => {
              try {
                html5QrCodeRef.current?.clear();
              } catch {}
            })
            .catch(() => {});
        } else {
          try {
            html5QrCodeRef.current.clear();
          } catch {}
        }
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

  const handleRetryCamera = () => {
    setScannerError(null);
    setIsInitializing(true);
    if (html5QrCodeRef.current) {
      if (html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {}).finally(() => {
          try { html5QrCodeRef.current?.clear(); } catch {}
          window.location.reload();
        });
        return;
      }
    }
    window.location.reload();
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-2xl border border-surface-border p-6 shadow-md">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 text-surface-charcoal">
        <Camera className="w-5 h-5 text-brand-600" />
        <h3 className="font-extrabold text-lg">Event Camera Scanner</h3>
      </div>

      {scannerError && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{scannerError}</span>
          </div>
          <button
            onClick={handleRetryCamera}
            className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded text-[11px] shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Camera Viewport Container */}
      <div className="relative rounded-xl overflow-hidden border-2 border-zinc-900 bg-zinc-950 min-h-[300px] flex items-center justify-center">
        {isInitializing && (
          <div className="absolute inset-0 z-10 bg-zinc-950 flex flex-col items-center justify-center gap-2 text-zinc-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
            <span>Connecting to rear device camera...</span>
          </div>
        )}
        <div id="qr-reader-viewport" className="w-full h-full" />
      </div>

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

