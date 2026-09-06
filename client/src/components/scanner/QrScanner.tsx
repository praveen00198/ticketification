import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
import { Camera, KeyRound, AlertCircle, RefreshCw, SwitchCamera } from 'lucide-react';

interface QrScannerProps {
  onScanSuccess: (scannedText: string) => void;
}

export const QrScanner: React.FC<QrScannerProps> = ({ onScanSuccess }) => {
  const [manualToken, setManualToken] = useState('');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
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
        const scannerInstance = new Html5Qrcode(elementId);
        html5QrCodeRef.current = scannerInstance;

        // 1. Query available video input devices
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (!devices || devices.length === 0) {
          throw new Error('No camera devices detected on this system.');
        }

        setCameras(devices);

        // 2. Select back/rear/environment camera by default on mobile devices
        const backCamera = devices.find((d) =>
          /back|rear|environment|wide|triple|dual|0, facing back/i.test(d.label)
        ) || devices[devices.length - 1] || devices[0];

        const targetCameraId = backCamera ? backCamera.id : devices[0].id;
        setSelectedCameraId(targetCameraId);

        // 3. Start scanning with high frame rate and back camera preference
        await scannerInstance.start(
          targetCameraId || { facingMode: { ideal: 'environment' } },
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isCooldownRef.current) return;
            isCooldownRef.current = true;
            onScanSuccess(decodedText);
            setTimeout(() => {
              isCooldownRef.current = false;
            }, 1800);
          },
          () => {
            // Ignore frame scan errors
          }
        );
      } catch (err: any) {
        console.error('Camera initialization error:', err);
        if (isMounted) {
          const errMsg =
            err?.name === 'NotAllowedError' || err?.message?.includes('Permission')
              ? 'Camera access permission was denied. Please allow camera permissions in your browser address bar to scan tickets.'
              : err?.message || 'Unable to start camera scanner. Please use manual token or Ticket ID entry below.';
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
              html5QrCodeRef.current?.clear();
            })
            .catch((err) => console.warn('Error stopping scanner stream:', err));
        } else {
          html5QrCodeRef.current.clear();
        }
      }
    };
  }, [onScanSuccess]);

  // Handle camera switching
  const handleCameraChange = async (newCameraId: string) => {
    setSelectedCameraId(newCameraId);
    if (!html5QrCodeRef.current) return;

    try {
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      await html5QrCodeRef.current.start(
        newCameraId,
        {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (isCooldownRef.current) return;
          isCooldownRef.current = true;
          onScanSuccess(decodedText);
          setTimeout(() => {
            isCooldownRef.current = false;
          }, 1800);
        },
        () => {}
      );
    } catch (err: any) {
      console.error('Failed to switch camera:', err);
      setScannerError('Could not switch to selected camera. Ensure camera is not in use.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      onScanSuccess(manualToken.trim());
      setManualToken('');
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-2xl border border-surface-border p-6 shadow-md">
      {/* Header & Camera Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-surface-charcoal">
          <Camera className="w-5 h-5 text-brand-600" />
          <h3 className="font-extrabold text-lg">Event Camera Scanner</h3>
        </div>

        {cameras.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs bg-surface-bg px-2.5 py-1.5 rounded-lg border border-surface-border">
            <SwitchCamera className="w-3.5 h-3.5 text-surface-muted" />
            <select
              value={selectedCameraId}
              onChange={(e) => handleCameraChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-surface-charcoal focus:outline-none cursor-pointer"
            >
              {cameras.map((c, idx) => (
                <option key={c.id} value={c.id}>
                  {c.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {scannerError && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{scannerError}</span>
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
