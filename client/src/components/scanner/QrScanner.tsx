import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
import { Camera, AlertCircle, RefreshCw, CameraOff, SwitchCamera } from 'lucide-react';

interface QrScannerProps {
  onScanSuccess: (scannedText: string) => void;
  isVerifying?: boolean;
}

export const QrScanner: React.FC<QrScannerProps> = ({ onScanSuccess, isVerifying = false }) => {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isTransitioningRef = useRef(false);
  const isMountedRef = useRef(true);
  const containerId = useRef('qr-viewport-feed').current;

  // In-flight verification request lock and token suppression cache
  const isVerifyingRef = useRef(isVerifying);
  const lastScannedTokenRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);

  // Sync isVerifying prop with internal ref
  useEffect(() => {
    isVerifyingRef.current = isVerifying;
  }, [isVerifying]);

  const onScanSuccessRef = useRef(onScanSuccess);
  onScanSuccessRef.current = onScanSuccess;

  /**
   * Synchronously stops all MediaStreamTracks on the video element.
   * Guarantees immediate hardware camera release upon unmount or camera switch.
   */
  const stopTracksSynchronously = useCallback(() => {
    try {
      const containerEl = document.getElementById(containerId);
      const videoEl = containerEl?.querySelector('video') as HTMLVideoElement | null;
      if (videoEl && videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (_e) {}
        });
        videoEl.srcObject = null;
      }
    } catch (_err) {
      // Non-blocking track release
    }
  }, [containerId]);

  const stopScanner = useCallback(async () => {
    // Release hardware camera tracks synchronously first
    stopTracksSynchronously();

    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    try {
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        if (scanner.isScanning) {
          try {
            await scanner.stop();
          } catch (_sErr) {}
        }
        try {
          scanner.clear();
        } catch (_cErr) {}
      }
    } catch (err) {
      console.warn('[QrScanner] Error stopping scanner:', err);
    } finally {
      if (isMountedRef.current) {
        setIsScanning(false);
      }
      isTransitioningRef.current = false;
    }
  }, [stopTracksSynchronously]);

  const startCamera = useCallback(
    async (targetCameraId?: string, targetFacingMode: 'environment' | 'user' = facingMode) => {
      if (!isMountedRef.current) return;
      if (isTransitioningRef.current) {
        return;
      }

      setIsInitializing(true);
      setScannerError(null);

      // Clean up previous scanner safely
      await stopScanner();

      if (!isMountedRef.current) return;
      isTransitioningRef.current = true;

      try {
        const containerEl = document.getElementById(containerId);
        if (!containerEl) {
          isTransitioningRef.current = false;
          setIsInitializing(false);
          return;
        }

        // Avoid destructive innerHTML = '' which breaks active listeners;
        // Html5Qrcode manages DOM creation inside containerId cleanly.
        const html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        const scanConfig = {
          fps: 15,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        };

        /**
         * Frame decode handler:
         * 1. Drops frame if verification is in flight (isVerifyingRef.current).
         * 2. Suppresses duplicate scans of the SAME token within 4,000ms.
         * 3. Scans a DIFFERENT token immediately (0ms delay).
         */
        const handleDecoded = (decodedText: string) => {
          const cleanToken = decodedText.trim();
          if (!cleanToken) return;

          // In-flight verification request lock: drop frame while server request is pending
          if (isVerifyingRef.current) {
            return;
          }

          const now = Date.now();
          // Suppress duplicate frames of the same token for 4,000ms
          if (
            lastScannedTokenRef.current === cleanToken &&
            now - lastScannedTimeRef.current < 4000
          ) {
            return;
          }

          // New or expired token: update cache and invoke callback immediately
          lastScannedTokenRef.current = cleanToken;
          lastScannedTimeRef.current = now;
          isVerifyingRef.current = true;

          try {
            const result = onScanSuccessRef.current(cleanToken) as unknown;
            if (result && typeof (result as Promise<unknown>).then === 'function') {
              (result as Promise<unknown>)
                .catch(() => {})
                .finally(() => {
                  if (!isVerifying) {
                    isVerifyingRef.current = false;
                  }
                });
            }
          } catch (_e) {
            isVerifyingRef.current = false;
          }
        };

        if (targetCameraId) {
          await html5QrCode.start(targetCameraId, scanConfig, handleDecoded, () => {});
          if (isMountedRef.current) {
            setSelectedCameraId(targetCameraId);
          }
        } else {
          await html5QrCode.start(
            { facingMode: targetFacingMode },
            scanConfig,
            handleDecoded,
            () => {}
          );
        }

        if (isMountedRef.current) {
          setIsScanning(true);
          try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              const unique = devices.filter(
                (d, idx, self) => idx === self.findIndex((t) => t.id === d.id)
              );
              setCameras(unique);
            }
          } catch (_camErr) {}
        }
      } catch (err: any) {
        console.warn('[QrScanner] Camera start error:', err);
        if (isMountedRef.current) {
          const errMsg =
            err?.name === 'NotAllowedError' || err?.message?.includes('Permission')
              ? 'Camera permission denied. Please allow camera access in browser permissions.'
              : err?.name === 'NotReadableError' || err?.message?.includes('busy')
              ? 'Camera is in use by another tab or app. Please close other camera tabs and tap Retry.'
              : err?.message || 'Unable to start camera.';
          setScannerError(errMsg);
          setIsScanning(false);
        }
      } finally {
        isTransitioningRef.current = false;
        if (isMountedRef.current) {
          setIsInitializing(false);
        }
      }
    },
    [containerId, facingMode, stopScanner]
  );

  useEffect(() => {
    isMountedRef.current = true;
    let timer: NodeJS.Timeout;

    timer = setTimeout(() => {
      if (isMountedRef.current) {
        startCamera();
      }
    }, 250);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      // Synchronously release camera hardware tracks on unmount
      stopTracksSynchronously();
      // Asynchronously clean up Html5Qrcode instance
      stopScanner().catch(() => {});
    };
  }, [startCamera, stopScanner, stopTracksSynchronously]);

  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    setSelectedCameraId('');
    startCamera(undefined, nextMode);
  };

  const handleSwitchCamera = (newId: string) => {
    setSelectedCameraId(newId);
    startCamera(newId);
  };

  return (
    <div className="w-full space-y-3">
      {/* Scanner Header & Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-stone-900" />
          <span className="text-xs font-bold text-zinc-900">Live Camera Feed</span>
          {isScanning && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {cameras.length > 1 && (
            <select
              value={selectedCameraId}
              onChange={(e) => handleSwitchCamera(e.target.value)}
              className="text-[11px] font-semibold bg-stone-100 border border-stone-200/90 rounded-xl px-2 py-1 text-zinc-800 focus:outline-none focus:border-stone-900 max-w-[130px] truncate shadow-2xs"
            >
              <option value="">Default ({facingMode === 'environment' ? 'Back' : 'Front'})</option>
              {cameras.map((c, idx) => (
                <option key={c.id} value={c.id}>
                  {c.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleToggleFacingMode}
            title="Flip Camera (Front / Back)"
            aria-label="Flip Camera"
            className="p-1.5 bg-stone-100 hover:bg-stone-200 text-zinc-700 rounded-xl border border-stone-200/90 transition-colors shadow-2xs"
          >
            <SwitchCamera className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => (isScanning ? stopScanner() : startCamera(selectedCameraId))}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-xl border transition-colors shadow-2xs ${
              isScanning
                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                : 'bg-stone-900 text-white border-stone-800 hover:bg-black'
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
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{scannerError}</span>
          </div>
          <button
            onClick={() => startCamera(selectedCameraId)}
            className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-[11px] shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Camera Viewport with Framing Brackets */}
      <div className="relative rounded-2xl overflow-hidden border border-stone-300 bg-stone-950 min-h-[280px] sm:min-h-[320px] flex items-center justify-center shadow-inner">
        {isInitializing && (
          <div className="absolute inset-0 z-10 bg-stone-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-stone-300 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-white" />
            <span>Connecting to camera stream...</span>
          </div>
        )}

        {/* Viewfinder Target Frame (Visual Aid) */}
        {isScanning && !isInitializing && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="w-[200px] h-[200px] sm:w-[230px] sm:h-[230px] relative border-2 border-emerald-500/40 rounded-2xl overflow-hidden">
              {/* Corner Accent Brackets */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />

              {/* Scanning Laser Guide */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scanline" />
            </div>
          </div>
        )}

        <div id={containerId} className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />
      </div>
    </div>
  );
};
