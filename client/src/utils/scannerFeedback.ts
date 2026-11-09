/**
 * Scanner Feedback Utility
 * 
 * Provides centralized, hardware-safe audio chimes (Web Audio API)
 * and haptic vibration patterns (navigator.vibrate).
 * 
 * Invariant: Reuses a shared singleton AudioContext lazily initialized
 * and resumed on user interaction to prevent the Chromium/WebKit
 * 6-32 hardware audio context limit exhaustion.
 */

export type FeedbackType = 'SUCCESS' | 'ERROR' | 'PENDING_SYNC' | 'PROMPT';

let sharedAudioCtx: AudioContext | null = null;

/**
 * Returns or initializes the shared Web Audio AudioContext singleton.
 * Resumes suspended context on user gesture.
 */
export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    if (!sharedAudioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        sharedAudioCtx = new AudioContextClass();
      }
    }

    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {
        // May fail if called before any user gesture; will resume on next gesture
      });
    }

    return sharedAudioCtx;
  } catch (_err) {
    return null;
  }
}

/**
 * Play a synthetic chime for the given feedback type using the shared AudioContext.
 */
export function playScannerChime(type: FeedbackType): void {
  try {
    const audioCtx = getSharedAudioContext();
    if (!audioCtx) return;

    // Ensure running state
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    switch (type) {
      case 'SUCCESS':
        // Ascending major fifth chime (D5 -> A5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.0, now + 0.1); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;

      case 'ERROR':
        // Descending dissonant sawtooth chime (A3 -> E3)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220.0, now); // A3
        osc.frequency.setValueAtTime(164.81, now + 0.1); // E3
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
        break;

      case 'PENDING_SYNC':
        // Distinct amber chime (Triangle wave: A4 -> E4 -> A4)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440.0, now); // A4
        osc.frequency.setValueAtTime(329.63, now + 0.08); // E4
        osc.frequency.setValueAtTime(440.0, now + 0.16); // A4
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
        break;

      case 'PROMPT':
      default:
        // Soft single triangle ping (A4)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440.0, now); // A4
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
    }
  } catch (_err) {
    // Graceful silent fallback if Web Audio is blocked
  }
}

/**
 * Triggers hardware vibration pattern if supported by device/browser.
 */
export function triggerScannerVibrate(type: FeedbackType): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

  try {
    switch (type) {
      case 'SUCCESS':
        navigator.vibrate([80]);
        break;
      case 'ERROR':
        navigator.vibrate([150, 100, 150]);
        break;
      case 'PENDING_SYNC':
        navigator.vibrate([60, 40, 60]);
        break;
      case 'PROMPT':
        navigator.vibrate([50]);
        break;
    }
  } catch (_err) {
    // Non-blocking fallback
  }
}

/**
 * Combined feedback dispatch (audio chime + haptic vibration).
 */
export function triggerScannerFeedback(
  type: FeedbackType,
  options?: { sound?: boolean; haptic?: boolean }
): void {
  const soundEnabled = options?.sound ?? true;
  const hapticEnabled = options?.haptic ?? true;

  if (soundEnabled) {
    playScannerChime(type);
  }
  if (hapticEnabled) {
    triggerScannerVibrate(type);
  }
}
