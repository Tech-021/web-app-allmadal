"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center size-9 rounded-xl bg-emerald-500/10 text-emerald-400 text-lg border border-emerald-500/20">
              📷
            </span>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                {title || (language === "ur" ? "Camera Barcode Scanner" : "Camera Barcode & QR Scanner")}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {subtitle ||
                  (language === "ur"
                    ? "Camera ko barcode ke samnay rakhein"
                    : "Point camera at any standard retail barcode or QR code")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Video Viewport Area */}
        <div className="relative bg-black flex items-center justify-center min-h-[320px] overflow-hidden select-none">
          <div
            id={containerIdRef.current}
            className="w-full h-full flex items-center justify-center [&_video]:max-h-[380px] [&_video]:w-full [&_video]:object-contain"
          />

          {/* Loading Indicator */}
          {isStarting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20 space-y-3">
              <div className="size-10 rounded-full border-3 border-emerald-500/20 border-t-emerald-500 animate-spin" />
              <p className="text-xs font-bold text-slate-300">
                {language === "ur" ? "Camera shuru ho raha hai..." : "Accessing camera..."}
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 z-20 space-y-3">
              <span className="text-3xl">⚠️</span>
              <p className="text-xs font-bold text-red-400 max-w-xs">{errorMsg}</p>
              <button
                type="button"
                onClick={() => onClose()}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-slate-800 text-white hover:bg-slate-700 transition"
              >
                {t("form.close", "Close")}
              </button>
            </div>
          )}

          {/* Target Reticle / Laser Overlay */}
          {!isStarting && !errorMsg && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Corner reticle frame */}
              <div className="relative w-[300px] h-[190px] border border-white/20 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                {/* Top-Left Corner */}
                <div className="absolute -top-1 -left-1 size-5 border-t-3 border-l-3 border-emerald-400 rounded-tl-lg" />
                {/* Top-Right Corner */}
                <div className="absolute -top-1 -right-1 size-5 border-t-3 border-r-3 border-emerald-400 rounded-tr-lg" />
                {/* Bottom-Left Corner */}
                <div className="absolute -bottom-1 -left-1 size-5 border-b-3 border-l-3 border-emerald-400 rounded-bl-lg" />
                {/* Bottom-Right Corner */}
                <div className="absolute -bottom-1 -right-1 size-5 border-b-3 border-r-3 border-emerald-400 rounded-br-lg" />

                {/* Animated Pulsing Laser Line */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-bounce duration-1000 top-1/2 -translate-y-1/2" />
              </div>

              {/* Scanning status hint badge */}
              <div className="absolute bottom-4 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 text-[11px] font-extrabold text-emerald-400 flex items-center gap-1.5 shadow-md">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                <span>
                  {language === "ur" ? "Barcode samnay rakhein" : "Align barcode within frame"}
                </span>
              </div>
            </div>
          )}

          {/* Scan Success Confirmation Banner */}
          {recentScanFlash && (
            <div className="absolute top-4 inset-x-4 z-30 flex items-center justify-center pointer-events-none animate-in zoom-in-95 duration-150">
              <div className="px-4 py-2.5 rounded-2xl bg-emerald-600 text-white font-black text-xs shadow-xl flex items-center gap-2 border border-emerald-400/40">
                <span className="text-base">✓</span>
                <span>
                  {language === "ur" ? "Scan Mukammal:" : "Barcode Scanned:"}{" "}
                  <code className="font-mono bg-emerald-700/80 px-1.5 py-0.5 rounded text-[11px]">
                    {recentScanFlash}
                  </code>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Last Scanned Feedback Card (When Product is found in POS) */}
        {lastScannedInfo && (
          <div className="px-5 py-2.5 bg-slate-800/80 border-t border-slate-700/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`text-base ${lastScannedInfo.found ? "text-emerald-400" : "text-amber-400"}`}>
                {lastScannedInfo.found ? "✅" : "⚠️"}
              </span>
              <div>
                <p className="font-extrabold text-white">
                  {lastScannedInfo.productName || (language === "ur" ? "Samaan nahi mila" : "Unknown Item")}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {lastScannedInfo.code}
                </p>
              </div>
            </div>
            {lastScannedInfo.price !== undefined && (
              <span className="font-black text-emerald-400 text-sm">
                ₨ {lastScannedInfo.price.toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* Guidance Tip Banner */}
        <div className="px-5 py-2 bg-slate-950/90 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400">
          <span className="text-emerald-400 text-xs">💡</span>
          <span>
            {language === "ur"
              ? "Naseehat: Barcode ko camera se 15–20cm door rakhein taake focus saaf ho."
              : "Tip: Hold barcode 15–20cm away from camera, flat and well-lit. Move back slightly if blurry."}
          </span>
        </div>

        {/* Controls Toolbar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {/* Camera Switcher (if > 1 camera) */}
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={() => void handleSwitchCamera()}
                title="Switch front/rear camera"
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>🔄</span>
                <span>{language === "ur" ? "Camera Badlein" : "Flip"}</span>
              </button>
            )}

            {/* Flashlight/Torch toggle if supported */}
            {hasTorch && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                title="Toggle camera flashlight"
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isTorchOn
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                }`}
              >
                <span>{isTorchOn ? "🔦 On" : "🔦 Off"}</span>
              </button>
            )}

            {/* Snap / Upload Image file */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload photo or take picture if webcam is blurry"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>📁</span>
              <span>{language === "ur" ? "Tasveer Upload" : "Upload Photo"}</span>
            </button>

            {/* Sound Mute/Unmute */}
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
              className="size-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center text-xs transition cursor-pointer"
            >
              {soundEnabled ? "🔔" : "🔕"}
            </button>
          </div>

          {/* Continuous Scanning Mode Toggle */}
          <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isContinuous}
              onChange={(e) => {
                const val = e.target.checked;
                setIsContinuous(val);
                if (onContinuousToggle) onContinuousToggle(val);
              }}
              className="size-4 accent-[#00875a] rounded cursor-pointer"
            />
            <span>
              {language === "ur" ? "Musalsal Scan (Continuous)" : "Continuous POS Scan"}
            </span>
          </label>
        </div>

        {/* Manual Barcode Digits Fallback Entry */}
        <form onSubmit={handleManualSubmit} className="p-3 bg-slate-950/70 border-t border-slate-800/80 flex items-center gap-2">
          <input
            type="text"
            placeholder={language === "ur" ? "Ya barcode number likhein..." : "Or type barcode number manually..."}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-mono font-bold text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition cursor-pointer"
          >
            {t("action.submit", "Enter")}
          </button>
        </form>
      </div>
    </div>
  );
}
