import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
import { Camera, AlertCircle, RefreshCw, CameraOff } from 'lucide-react';

interface QrScannerProps {
  onScanSuccess: (scannedText: string) => void;
}

export const QrScanner: React.FC<QrScannerProps> = ({ onScanSuccess }) => {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isCooldownRef = useRef(false);
  const containerId = useRef(`qr-viewport-${Math.random().toString(36).substring(2, 9)}`).current;

  const onScanSuccessRef = useRef(onScanSuccess);
  onScanSuccessRef.current = onScanSuccess;

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (_e) {}
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startCamera = useCallback(async (cameraId?: string) => {
    setIsInitializing(true);
    setScannerError(null);

    // Clean up any existing scanner instance first
    await stopScanner();

    try {
      const containerEl = document.getElementById(containerId);
      if (!containerEl) return;

      const html5QrCode = new Html5Qrcode(containerId);
      scannerRef.current = html5QrCode;

      // Query available cameras
      let devices: CameraDevice[] = [];
      try {
        devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
        }
      } catch (_e) {}

      const scanConfig = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      const handleDecoded = (decodedText: string) => {
        if (isCooldownRef.current) return;
        isCooldownRef.current = true;
        onScanSuccessRef.current(decodedText);
        setTimeout(() => {
          isCooldownRef.current = false;
        }, 1800);
      };

      if (cameraId) {
        await html5QrCode.start(cameraId, scanConfig, handleDecoded, () => {});
        setSelectedCameraId(cameraId);
      } else if (devices && devices.length > 0) {
        const backCamera = devices.find((d) =>
          /back|rear|environment|wide|0, facing back/i.test(d.label)
        ) || devices[0];

        setSelectedCameraId(backCamera.id);
        await html5QrCode.start(backCamera.id, scanConfig, handleDecoded, () => {});
      } else {
        await html5QrCode.start({ facingMode: 'environment' }, scanConfig, handleDecoded, () => {});
      }

      setIsScanning(true);
    } catch (err: any) {
      console.warn('[QrScanner] Camera start error:', err);
      const errMsg =
        err?.name === 'NotAllowedError' || err?.message?.includes('Permission')
          ? 'Camera access permission denied. Please allow camera permissions in your browser.'
          : err?.name === 'NotReadableError' || err?.message?.includes('busy')
          ? 'Camera is in use by another tab or app. Please close other camera tabs and tap Retry.'
          : err?.message || 'Unable to access camera.';
      setScannerError(errMsg);
      setIsScanning(false);
    } finally {
      setIsInitializing(false);
    }
  }, [containerId, stopScanner]);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      if (mounted) {
        startCamera();
      }
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, []);

  const handleSwitchCamera = (newId: string) => {
    startCamera(newId);
  };

  return (
    <div className="w-full space-y-3">
      {/* Scanner Header & Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-brand-600" />
          <span className="text-xs font-bold text-zinc-900">Live Camera Feed</span>
        </div>

        <div className="flex items-center gap-2">
          {cameras.length > 1 && (
            <select
              value={selectedCameraId}
              onChange={(e) => handleSwitchCamera(e.target.value)}
              className="text-[11px] font-semibold bg-zinc-100 border border-zinc-200 rounded-lg px-2 py-1 text-zinc-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {cameras.map((c, idx) => (
                <option key={c.id} value={c.id}>
                  {c.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => (isScanning ? stopScanner() : startCamera(selectedCameraId))}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors ${
              isScanning
                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {isScanning ? (
              <>
                <CameraOff className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                <span>Start</span>
              </>
            )}
          </button>
        </div>
      </div>

      {scannerError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{scannerError}</span>
          </div>
          <button
            onClick={() => startCamera(selectedCameraId)}
            className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded text-[11px] shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Camera Viewport */}
      <div className="relative rounded-2xl overflow-hidden border border-zinc-300 bg-black min-h-[300px] flex items-center justify-center shadow-inner">
        {isInitializing && (
          <div className="absolute inset-0 z-10 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-zinc-300 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
            <span>Connecting to camera stream...</span>
          </div>
        )}
        <div id={containerId} className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />
      </div>
    </div>
  );
};

