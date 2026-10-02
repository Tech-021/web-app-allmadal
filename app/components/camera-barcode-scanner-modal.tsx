"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Icon } from "@/app/components/icons";
import ui from "@/app/components/workspace-ui.module.css";
import { Html5Qrcode, Html5QrcodeSupportedFormats, CameraDevice } from "html5-qrcode";
import { useLanguage } from "./language-context";

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
  subtitle?: string;
  continuous?: boolean;
  onContinuousToggle?: (continuous: boolean) => void;
  lastScannedInfo?: {
    code: string;
    productName?: string;
    price?: number;
    found?: boolean;
  } | null;
}

// 2.2 kHz classic retail POS scanner laser beep encoded in pure WAV PCM base64
const BEEP_AUDIO_DATA_URI =
  "data:audio/wav;base64,UklGRuQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YcADAACA9loVxtQfSfGSCZLwSiDTxRZb9H8LpOg7Ld61EG30bRG03S0756MNgPFcGcPRI0vskQ2R7Ewj0MIaXO+AEKLkPTDbsxVu8G4VstoxPuOiEoDtXR3AziZN6JESkehOJ83AHl7rfxSh4EAz17EZb+tvGbDWNEHfoBZ/6V8hvsoqUOSQFpDkUCvKvSJf538ZoNxCNtOuHW/nbx6u0zdD258bgORgJbvHLlLgjxuP31IuxromYeKAHZ7YRTnQrCFw4nAirM86RteeH4DgYSm5xDFU248fj9tUMsO4KmLefyKd1Eg9zKomcd5xJqrLPUnTnCR/22MttsE1VteOJI7XVjbAtS5j2YAmm9BKQMioKnHZcSqoyEFLz5sogNdkMbO+OFjTjSiN0lg5vbIyZdWAKprMTUPFpi5y1XIvpsRETsuaLIDSZjWxujxaz4wtjM5aPbqwNmbQfy+ZyFBGwaQzc9BzM6TAR1HHmDF/zmc5rrdAXMqMMYzKXEC3rTpozH8zl8RSSb2iN3TMdDeivUpTw5c1gMloPau0Q17GizaLxl5Es6s+acd/OJbAVUy6oDt0x3Q8oLlNVr+VOoDFakGpsUdgwoo6isFgSLCoQmrDfzyVvFhQtp4/dcN1QJ61UFi7lD5/wWtFpq5LYr2KP4q9YkutpUZsv4BBk7haU7OcRHa+dkScslRbt5NDf7xtSaOrTmS5iUOJuWRPqqNKbbqARZK0XVavmkh2unZImq5XXrORR4C4bk2hp1JmtYhIiLRmU6egTm+2gEqQsGBZq5hMd7V3TZirWmCvkEx/s29RnqRWaLGITIiwaFajnVJwsYBOj6xiXKiWUXixeFGWp11jq45QgK9xVZuhWWqsh1GHrGpaoJtWca1/Uo6oZWCklFV5rHlVlKNgZqeNVICqclmZnl1sqIZVhqhsXp2YWnOogFeMpGhjoJJZeah5WpKgZGijjFl/pnRdlptgbqSFWoWjbmGalV50pH9bi6BqZp2QXXqjel6QnGdrn4pdgKF1YZSXZHCfhV6Fn3Fll5NidZ9/YImcbWmZjmJ7n3tijZhqbpuJYoCddmWRlGhym4RjhJtzaZSQZnebgGSImG9slYxme5p7ZouVbXCXh2aAmXhpjpFrdJeDZ4OWdWyQjWp4l39ph5Ryb5KKanyWfGuJkXBzk4ZrgJR5bYyOb3aTg2yDkndwjYtuepJ/bYWQdXOOiG99kX1vh41zdo+Fb4CQenGJi3N4joJwgo55c4qIc3uOgHKEjHd2ioZzfY19c4WKd3iKg3Q=";

let sharedAudioContext: AudioContext | null = null;
let fallbackAudioEl: HTMLAudioElement | null = null;

// Initialize or resume AudioContext on user interaction
function unlockAudioContext(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new AudioCtx();
    }
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

// Fallback HTML5 audio player
function playFallbackAudio() {
  try {
    if (typeof window === "undefined") return;
    if (!fallbackAudioEl) {
      fallbackAudioEl = new Audio(BEEP_AUDIO_DATA_URI);
      fallbackAudioEl.volume = 0.8;
    }
    fallbackAudioEl.currentTime = 0;
    fallbackAudioEl.play().catch(() => {});
  } catch {
    // ignore
  }
}

// Synthesize scanner laser beep using Web Audio API + HTML5 Audio fallback
function playBeep() {
  let webAudioSucceeded = false;
  try {
    const ctx = unlockAudioContext();
    if (ctx && ctx.state === "running") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const now = ctx.currentTime;
      osc.type = "sine";
      osc.frequency.setValueAtTime(2200, now); // Sharp 2.2 kHz retail scanner beep
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
      webAudioSucceeded = true;
    }
  } catch {
    webAudioSucceeded = false;
  }

  // If Web Audio was suspended or unavailable, play fallback WAV
  if (!webAudioSucceeded) {
    playFallbackAudio();
  }

  // Haptic feedback on mobile devices
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([70]);
    }
  } catch {
    // ignore
  }
}

export function CameraBarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title,
  subtitle,
  continuous = false,
  onContinuousToggle,
  lastScannedInfo,
}: CameraBarcodeScannerModalProps) {
  const { t, language } = useLanguage();
  const [isStarting, setIsStarting] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isContinuous, setIsContinuous] = useState(continuous);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [recentScanFlash, setRecentScanFlash] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerIdRef = useRef(`almadel-scanner-${Math.random().toString(36).substring(2, 9)}`);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedTextRef = useRef<string>("");

  // Sync continuous state if prop changes
  useEffect(() => {
    setIsContinuous(continuous);
  }, [continuous]);

  // Unlock audio when modal opens (triggered by user button click)
  useEffect(() => {
    if (isOpen) {
      unlockAudioContext();
    }
  }, [isOpen]);

  // Handle successful scan with debounce protection
  const handleDecoded = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      const clean = decodedText.trim();
      if (!clean) return;

      // Prevent identical rapid duplicate triggers within 1.4 seconds in continuous mode
      if (clean === lastScannedTextRef.current && now - lastScannedTimeRef.current < 1400) {
        return;
      }

      lastScannedTextRef.current = clean;
      lastScannedTimeRef.current = now;

      if (soundEnabled) {
        playBeep();
      }

      setRecentScanFlash(clean);
      setTimeout(() => setRecentScanFlash(null), 1500);

      onScan(clean);

      if (!isContinuous) {
        // Allow beep and flash to play before unmounting modal
        setTimeout(() => {
          onClose();
        }, 180);
      }
    },
    [soundEnabled, isContinuous, onScan, onClose]
  );

  // Initialize and start camera
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const containerId = containerIdRef.current;

    async function initScanner() {
      setIsStarting(true);
      setErrorMsg(null);

      try {
        // Enumerate video devices
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        setCameras(devices || []);

        if (!devices || devices.length === 0) {
          setErrorMsg(
            language === "ur"
              ? "Koi camera nahi mila. Barah-e-karam camera connect karein."
              : "No camera device detected. Please connect a webcam or enable camera access."
          );
          setIsStarting(false);
          return;
        }

        // Prefer rear camera on mobile
        let chosenCameraId = devices[0].id;
        const backCamera = devices.find((d) =>
          d.label.toLowerCase().includes("back") ||
          d.label.toLowerCase().includes("rear") ||
          d.label.toLowerCase().includes("environment")
        );
        if (backCamera) {
          chosenCameraId = backCamera.id;
        }

        setActiveCameraId(chosenCameraId);

        // Pass all supported 1D and 2D formats & enable hardware-accelerated BarcodeDetector in constructor
        const html5QrCode = new Html5Qrcode(containerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        // Camera scan configuration with wide dynamic qrbox and high-resolution video stream
        const scanConfig = {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.min(viewfinderWidth - 20, Math.max(260, Math.floor(viewfinderWidth * 0.9)));
            const height = Math.min(viewfinderHeight - 20, Math.max(160, Math.floor(viewfinderHeight * 0.65)));
            return { width, height };
          },
          videoConstraints: {
            deviceId: chosenCameraId ? { exact: chosenCameraId } : undefined,
            facingMode: chosenCameraId ? undefined : "environment",
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
          },
        };

        await html5QrCode.start(
          chosenCameraId || { facingMode: "environment" },
          scanConfig,
          (decodedText) => {
            if (isMounted) handleDecoded(decodedText);
          },
          () => {
            // Frame error - benign, ignored
          }
        );

        if (!isMounted) {
          await html5QrCode.stop();
          html5QrCode.clear();
          return;
        }

        // Check if torch/flashlight is supported
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const videoElement = document.querySelector(`#${containerId} video`) as any;
          if (videoElement?.srcObject) {
            const track = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
            const capabilities = track.getCapabilities?.() as { torch?: boolean };
            if (capabilities && capabilities.torch) {
              setHasTorch(true);
            }
          }
        } catch {
          setHasTorch(false);
        }

        setIsStarting(false);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Camera scanner start error:", err);
        setErrorMsg(
          msg.includes("NotAllowedError") || msg.includes("Permission")
            ? language === "ur"
              ? "Camera permission ijazat nahi di gayi. Browser settings mein jaa kar camera allow karein."
              : "Camera access was denied. Please allow camera permissions in your browser address bar."
            : language === "ur"
            ? `Camera shuru karne mein khata: ${msg}`
            : `Failed to initialize camera: ${msg}`
        );
        setIsStarting(false);
      }
    }

    // Delay 100ms for DOM element mounting
    const timer = setTimeout(() => {
      void initScanner();
    }, 120);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        const inst = scannerRef.current;
        scannerRef.current = null;
        if (inst.isScanning) {
          inst.stop().catch(() => {}).finally(() => {
            inst.clear();
          });
        }
      }
    };
  }, [isOpen, language, handleDecoded]);

  // Switch between cameras
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1 || !scannerRef.current) return;
    const currentIndex = cameras.findIndex((c) => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];

    try {
      setIsStarting(true);
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      setActiveCameraId(nextCamera.id);
      setIsTorchOn(false);

      const scanConfig = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const width = Math.min(viewfinderWidth - 20, Math.max(260, Math.floor(viewfinderWidth * 0.9)));
          const height = Math.min(viewfinderHeight - 20, Math.max(160, Math.floor(viewfinderHeight * 0.65)));
          return { width, height };
        },
        videoConstraints: {
          deviceId: { exact: nextCamera.id },
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
        },
      };

      await scannerRef.current.start(
        nextCamera.id,
        scanConfig,
        handleDecoded,
        () => {}
      );
      setIsStarting(false);
    } catch (e) {
      console.error("Switch camera failed:", e);
      setIsStarting(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !scannerRef.current) return;
    try {
      setIsStarting(true);
      const decoded = await scannerRef.current.scanFile(file, false);
      if (decoded) {
        handleDecoded(decoded);
      }
    } catch (err) {
      console.warn("Scan file error:", err);
      setErrorMsg(
        language === "ur"
          ? "Is tasveer se barcode nahi mila. Barah-e-karam saaf tasveer upload karein."
          : "Could not read barcode from image. Please make sure the barcode is clear and in focus."
      );
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setIsStarting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    try {
      const containerId = containerIdRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const videoElement = document.querySelector(`#${containerId} video`) as any;
      if (videoElement?.srcObject) {
        const track = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
        const nextState = !isTorchOn;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await track.applyConstraints({ advanced: [{ torch: nextState } as any] });
        setIsTorchOn(nextState);
      }
    } catch (e) {
      console.warn("Torch not supported on this device track:", e);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDecoded(manualCode.trim());
    setManualCode("");
  };

  if (!isOpen) return null;

  const toolBtn =
    "inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface-2)] px-2.5 text-[12px] font-medium text-[var(--text-2)] transition hover:border-[var(--faint)] hover:text-[var(--text)] cursor-pointer max-sm:h-10";

  return (
    <div
      className="al-overlay fixed inset-0 z-50 flex items-end justify-center bg-[rgba(3,4,5,.82)] backdrop-blur-[4px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-theme="dark"
        role="dialog"
        aria-modal="true"
        aria-label={title || "Barcode scanner"}
        className="relative flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[20px] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-lg)] sm:rounded-[18px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-[9px] border border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand)]">
              <Icon name="scan" size={16} />
            </span>
            <div className="min-w-0">
              <h2 className="m-0 truncate text-[15px] font-semibold tracking-[-0.01em]">
                {title || (language === "ur" ? "Camera Barcode Scanner" : "Barcode & QR scanner")}
              </h2>
              <p className="m-0 truncate text-[12px] text-[var(--muted)]">
                {subtitle || (language === "ur" ? "Camera ko barcode ke samnay rakhein" : "Point the camera at any retail barcode or QR code")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="grid size-8 shrink-0 place-items-center rounded-[8px] text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] max-sm:size-10"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Viewport */}
        <div className="relative flex min-h-[300px] select-none items-center justify-center overflow-hidden bg-black">
          <div id={containerIdRef.current} className="flex size-full items-center justify-center [&_video]:max-h-[380px] [&_video]:w-full [&_video]:object-contain" />

          {isStarting && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[var(--bg)]/90">
              <span className="size-8 rounded-full border-2 border-[var(--brand-line)] border-t-[var(--brand)] [animation:almadelSpin_800ms_linear_infinite]" />
              <p className="m-0 text-[12.5px] text-[var(--muted)]">{language === "ur" ? "Camera shuru ho raha hai..." : "Starting camera…"}</p>
            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[var(--bg)]/95 p-6 text-center">
              <span className="grid size-11 place-items-center rounded-[12px] bg-[var(--neg-soft)] text-[var(--neg)]">
                <Icon name="alert" size={20} />
              </span>
              <p className="m-0 max-w-xs text-[13px] text-[var(--text-2)]">{errorMsg}</p>
              <button type="button" onClick={() => onClose()} className={toolBtn}>
                {t("form.close", "Close")}
              </button>
            </div>
          )}

          {!isStarting && !errorMsg && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[180px] w-[min(300px,80%)] rounded-[16px] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                <span className="absolute -left-px -top-px size-6 rounded-tl-[14px] border-l-2 border-t-2 border-[var(--brand)]" />
                <span className="absolute -right-px -top-px size-6 rounded-tr-[14px] border-r-2 border-t-2 border-[var(--brand)]" />
                <span className="absolute -bottom-px -left-px size-6 rounded-bl-[14px] border-b-2 border-l-2 border-[var(--brand)]" />
                <span className="absolute -bottom-px -right-px size-6 rounded-br-[14px] border-b-2 border-r-2 border-[var(--brand)]" />
                <span className="absolute inset-x-3 h-px bg-[linear-gradient(90deg,transparent,var(--brand),transparent)] shadow-[0_0_10px_var(--brand)] [animation:scanSweep_2.2s_var(--ease)_infinite_alternate]" />
              </div>
              <div className="absolute bottom-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11.5px] font-medium text-white/85 backdrop-blur-md">
                <span className="al-live-dot" />
                {language === "ur" ? "Barcode samnay rakhein" : "Align barcode within the frame"}
              </div>
            </div>
          )}

          {recentScanFlash && (
            <div className="al-pop pointer-events-none absolute inset-x-4 top-4 z-30 flex justify-center">
              <div className="flex items-center gap-2 rounded-[10px] bg-[var(--brand)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--on-brand)] shadow-[var(--shadow-lg)]">
                <Icon name="check" size={14} strokeWidth={2.2} />
                {language === "ur" ? "Scan Mukammal:" : "Scanned"}
                <code className="rounded bg-black/15 px-1.5 py-0.5 font-mono text-[11.5px]">{recentScanFlash}</code>
              </div>
            </div>
          )}
        </div>

        {lastScannedInfo && (
          <div className="al-pop flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-[8px] ${
                  lastScannedInfo.found ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[var(--warn-soft)] text-[var(--warn)]"
                }`}
              >
                <Icon name={lastScannedInfo.found ? "check" : "alert"} size={14} />
              </span>
              <div className="min-w-0">
                <p className="m-0 truncate text-[13px] font-medium">{lastScannedInfo.productName || (language === "ur" ? "Samaan nahi mila" : "Unknown item")}</p>
                <p className="m-0 font-mono text-[11px] text-[var(--muted)]">{lastScannedInfo.code}</p>
              </div>
            </div>
            {lastScannedInfo.price !== undefined && <span className="shrink-0 font-mono text-[13px] font-medium text-[var(--brand)]">Rs {lastScannedInfo.price.toLocaleString()}</span>}
          </div>
        )}

        <div className="flex items-start gap-2 border-t border-[var(--border)] px-4 py-2 text-[11.5px] leading-relaxed text-[var(--muted)] sm:px-5">
          <Icon name="info" size={13} className="mt-0.5 shrink-0" />
          <span>
            {language === "ur"
              ? "Naseehat: Barcode ko camera se 15–20cm door rakhein taake focus saaf ho."
              : "Hold the barcode 15–20cm away, flat and well-lit. Move back slightly if it's blurry."}
          </span>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--border)] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {cameras.length > 1 && (
              <button type="button" onClick={() => void handleSwitchCamera()} title="Switch front/rear camera" className={toolBtn}>
                <Icon name="refresh" size={13} />
                {language === "ur" ? "Camera Badlein" : "Flip"}
              </button>
            )}
            {hasTorch && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                title="Toggle flashlight"
                aria-pressed={isTorchOn}
                className={`${toolBtn} ${isTorchOn ? "!border-[color-mix(in_oklab,var(--warn)_40%,transparent)] !bg-[var(--warn-soft)] !text-[var(--warn)]" : ""}`}
              >
                <Icon name="zap" size={13} />
                {isTorchOn ? "Torch on" : "Torch"}
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <button type="button" onClick={() => fileInputRef.current?.click()} title="Upload a photo if the webcam is blurry" className={toolBtn}>
              <Icon name="image" size={13} />
              {language === "ur" ? "Tasveer Upload" : "Upload photo"}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) {
                  playBeep();
                }
              }}
              title={soundEnabled ? "Mute beep sound" : "Enable beep sound (click to test)"}
              aria-pressed={soundEnabled}
              className={`${toolBtn} w-8 justify-center px-0 max-sm:w-10 ${soundEnabled ? "" : "opacity-60"}`}
            >
              <Icon name="bell" size={13} />
            </button>
          </div>

          <label className="flex cursor-pointer select-none items-center gap-2 text-[12.5px] text-[var(--text-2)]">
            <input
              type="checkbox"
              role="switch"
              checked={isContinuous}
              onChange={(e) => {
                const val = e.target.checked;
                setIsContinuous(val);
                if (onContinuousToggle) onContinuousToggle(val);
              }}
              className={ui.switch}
            />
            {language === "ur" ? "Musalsal Scan (Continuous)" : "Continuous scan"}
          </label>
        </div>

        <form onSubmit={handleManualSubmit} className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--sunken)] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:px-5">
          <input
            type="text"
            placeholder={language === "ur" ? "Ya barcode number likhein..." : "Or type the barcode number…"}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className={`${ui.input} ${ui.inputMono} flex-1`}
            aria-label="Barcode number"
          />
          <button type="submit" disabled={!manualCode.trim()} className={ui.primary}>
            {t("action.submit", "Enter")}
          </button>
        </form>
      </div>
    </div>
  );
}
