"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IconAlertCircle, IconLoader2, IconPhoto, IconCamera } from "@tabler/icons-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface QRScannerProps {
  onScanSuccess?: (decodedText: string) => void;
  onSuccess?: (decodedText: string) => void;
  onScanFailure?: (error: any) => void;
  onFailure?: (error: any) => void;
}

// ============================================================
// IMAGE PREPROCESSING UTILITIES
// Thuật toán xử lý ảnh chuyên biệt cho mã QR trên CCCD Việt Nam
// ============================================================

/**
 * Load file ảnh thành HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không thể đọc file ảnh"));
    };
    img.src = url;
  });
}

/**
 * Chuyển ảnh gốc sang canvas với kích thước hợp lý.
 * Giữ nguyên ảnh nếu đủ nhỏ, scale down nếu quá to.
 */
function imageToCanvas(img: HTMLImageElement, maxDim = 2000): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  let w = img.width;
  let h = img.height;
  if (w > maxDim || h > maxDim) {
    const ratio = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/**
 * Tạo grayscale array từ ImageData
 */
function toGrayscale(imageData: ImageData): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(imageData.width * imageData.height);
  const d = imageData.data;
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = Math.round(0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2]);
  }
  return gray;
}

/**
 * Adaptive thresholding (kiểu mean) - hiệu quả hơn global threshold 
 * cho ảnh có nền không đều (như hoa văn trên CCCD).
 * blockSize: kích thước vùng lân cận (pixel)
 * C: hằng số trừ đi khỏi mean (điều chỉnh độ nhạy)
 */
function adaptiveThreshold(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  blockSize: number,
  C: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(gray.length);

  // Tính integral image để tính mean nhanh
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] =
        integral[y * (width + 1) + (x + 1)] + rowSum;
    }
  }

  const half = Math.floor(blockSize / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(width - 1, x + half);
      const y2 = Math.min(height - 1, y + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * (width + 1) + (x2 + 1)] -
        integral[y1 * (width + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (width + 1) + x1] +
        integral[y1 * (width + 1) + x1];
      const mean = sum / count;
      result[y * width + x] = gray[y * width + x] > mean - C ? 255 : 0;
    }
  }
  return result;
}

/**
 * Global thresholding đơn giản
 */
function globalThreshold(gray: Uint8ClampedArray, t: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    result[i] = gray[i] > t ? 255 : 0;
  }
  return result;
}

/**
 * Tăng contrast bằng histogram stretching
 */
function enhanceContrast(gray: Uint8ClampedArray): Uint8ClampedArray {
  let min = 255, max = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < min) min = gray[i];
    if (gray[i] > max) max = gray[i];
  }
  const range = max - min || 1;
  const result = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    result[i] = Math.round(((gray[i] - min) / range) * 255);
  }
  return result;
}

/**
 * Tạo ImageData từ mảng grayscale (trắng đen)
 */
function grayToImageData(gray: Uint8ClampedArray, w: number, h: number): ImageData {
  const imageData = new ImageData(w, h);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    imageData.data[idx] = gray[i];
    imageData.data[idx + 1] = gray[i];
    imageData.data[idx + 2] = gray[i];
    imageData.data[idx + 3] = 255;
  }
  return imageData;
}

/**
 * Làm sắc nét ảnh bằng convolution kernel (khắc phục webcam bị mờ)
 */
function sharpenCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const ctx = source.getContext("2d")!;
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);

  // Unsharp mask kernel: [0,-1,0 / -1,5,-1 / 0,-1,0]
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const idx = (y * w + x) * 4 + c;
        const val =
          5 * src.data[idx] -
          src.data[((y - 1) * w + x) * 4 + c] -
          src.data[((y + 1) * w + x) * 4 + c] -
          src.data[(y * w + (x - 1)) * 4 + c] -
          src.data[(y * w + (x + 1)) * 4 + c];
        dst.data[idx] = Math.min(255, Math.max(0, val));
      }
      dst.data[(y * w + x) * 4 + 3] = 255;
    }
  }

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.putImageData(dst, 0, 0);
  return out;
}

/**
 * Phóng to canvas nhỏ lên kích thước tối thiểu để jsQR có đủ pixel
 */
function upscaleCanvas(source: HTMLCanvasElement, minDim = 800): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const shortest = Math.min(w, h);
  if (shortest >= minDim) return source;

  const scale = minDim / shortest;
  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);
  const out = document.createElement("canvas");
  out.width = newW;
  out.height = newH;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, newW, newH);
  return out;
}

/**
 * Hàm quét QR core: thử nhiều phương pháp tiền xử lý khác nhau trên canvas
 * @param isLiveStream Nếu là true, sẽ bỏ qua các vòng lặp filter nặng nề trên CPU để chống đơ máy.
 */
async function scanQRFromCanvas(canvas: HTMLCanvasElement, isLiveStream: boolean = false): Promise<string> {
  const jsQR = (await import("jsqr")).default;

  const ctx = canvas.getContext("2d")!;
  const origImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const w = canvas.width;
  const h = canvas.height;

  // Bước 1: Thử quét ảnh gốc bằng jsQR (nhanh nhất ~20ms)
  const origResult = jsQR(origImageData.data, w, h);
  if (origResult && origResult.data.trim().length > 0) {
    return origResult.data;
  }

  // Bước 2: Dùng siêu engine ZXing (qr-scanner) để quét chuyên sâu
  try {
    const QrScanner = (await import("qr-scanner")).default;
    const safeCanvas = (w > 1900 || h > 1900) ? upscaleCanvas(canvas, 1900) : canvas;
    const zxingResult = await QrScanner.scanImage(safeCanvas, {
      returnDetailedScanResult: true,
      disallowCanvasResizing: true
    });
    if (zxingResult && zxingResult.data && zxingResult.data.trim().length > 0) {
      return zxingResult.data;
    }
  } catch (err) {
    // Thử làm sắc nét ảnh (Sharpen Filter) rồi ném lại vào ZXing lần nữa
    try {
      const QrScanner = (await import("qr-scanner")).default;
      const sharpenedCanvas = sharpenCanvas(canvas);
      const safeSharpened = (w > 1900 || h > 1900) ? upscaleCanvas(sharpenedCanvas, 1900) : sharpenedCanvas;
      const zxingResult2 = await QrScanner.scanImage(safeSharpened, {
        returnDetailedScanResult: true,
        disallowCanvasResizing: true
      });
      if (zxingResult2 && zxingResult2.data && zxingResult2.data.trim().length > 0) {
        return zxingResult2.data;
      }
    } catch (err2) {
      // Bỏ qua
    }
  }

  if (isLiveStream) {
    throw new Error("Live stream: Không tìm thấy QR");
  }

  // Bước 2: Chuyển sang grayscale + tăng contrast cho xử lý ảnh tĩnh
  const gray = toGrayscale(origImageData);
  const enhanced = enhanceContrast(gray);

  // Bước 3: Thử adaptive thresholding với nhiều tham số
  const adaptiveConfigs = [
    { blockSize: 15, C: 8 },
    { blockSize: 25, C: 10 },
    { blockSize: 35, C: 12 },
    { blockSize: 11, C: 5 },
    { blockSize: 51, C: 15 },
    { blockSize: 21, C: 6 },
  ];

  for (const config of adaptiveConfigs) {
    // Thử trên ảnh enhanced contrast
    const binarized = adaptiveThreshold(enhanced, w, h, config.blockSize, config.C);
    const imgData = grayToImageData(binarized, w, h);
    const result = jsQR(imgData.data, w, h);
    if (result && result.data.trim().length > 0) return result.data;

    // Thử trên ảnh grayscale gốc (không enhance)
    const binarized2 = adaptiveThreshold(gray, w, h, config.blockSize, config.C);
    const imgData2 = grayToImageData(binarized2, w, h);
    const result2 = jsQR(imgData2.data, w, h);
    if (result2 && result2.data.trim().length > 0) return result2.data;
  }

  // Bước 4: Fallback sang global thresholding
  const globalThresholds = [128, 100, 110, 120, 140, 150, 160, 80, 90, 170, 180, 200];
  for (const t of globalThresholds) {
    const binarized = globalThreshold(enhanced, t);
    const imgData = grayToImageData(binarized, w, h);
    const result = jsQR(imgData.data, w, h);
    if (result && result.data.trim().length > 0) return result.data;
  }

  // Bước 5: Thử inverted (đảo trắng đen)
  const invertedGray = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    invertedGray[i] = 255 - gray[i];
  }
  const invertedEnhanced = enhanceContrast(invertedGray);
  for (const config of adaptiveConfigs.slice(0, 3)) {
    const binarized = adaptiveThreshold(invertedEnhanced, w, h, config.blockSize, config.C);
    const imgData = grayToImageData(binarized, w, h);
    const result = jsQR(imgData.data, w, h);
    if (result && result.data.trim().length > 0) return result.data;
  }

  throw new Error("Không thể nhận diện mã QR trong ảnh");
}

/**
 * Quét QR từ file ảnh (wrapper quanh scanQRFromCanvas)
 */
async function scanQRFromFile(file: File): Promise<string> {
  const img = await loadImage(file);
  const canvas = imageToCanvas(img);
  return scanQRFromCanvas(canvas);
}

// ============================================================
// COMPONENT
// ============================================================

export function QRScanner({ onScanSuccess, onSuccess, onScanFailure, onFailure }: QRScannerProps) {
  const handleSuccess = onScanSuccess || onSuccess || (() => {});
  const handleFailure = onScanFailure || onFailure || (() => {});
  const [error, setError] = useState<string | null>(null);
  const [resolutionWarning, setResolutionWarning] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLiveScanningRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Detect mobile device to hide webcam UI
    const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : "";
    setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent));

    if (!isCameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      return;
    }

    const initCamera = async () => {
      if (!isMounted) return;
      setIsStarting(true);
      setError(null);
      setResolutionWarning(null);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Trình duyệt không hỗ trợ WebRTC getUserMedia. Đảm bảo bạn đang dùng HTTPS.");
        }

        const constraints1080 = {
          width: { min: 1920, ideal: 1920 },
          height: { min: 1080, ideal: 1080 }
        };

        const constraints720 = {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };

        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { ...constraints1080, facingMode: "environment" }
          });
        } catch (e1: any) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { ...constraints1080, facingMode: "user" }
            });
          } catch (e2: any) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: { ...constraints720, facingMode: "environment" }
              });
            } catch (e3: any) {
              try {
                stream = await navigator.mediaDevices.getUserMedia({
                  video: { ...constraints720, facingMode: "user" }
                });
              } catch (e4: any) {
                // Ignore, will throw below
              }
            }
          }
        }

        if (!stream) {
          throw new Error("Tất cả các thử nghiệm khởi tạo Camera đều thất bại. Vui lòng kiểm tra quyền truy cập Camera trong cài đặt trình duyệt.");
        }

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings ? videoTrack.getSettings() : null;

        if (settings && settings.height && settings.height < 1080) {
          setResolutionWarning(`Camera của bạn đang ở chuẩn thấp (${settings.height}p). Sẽ rất khó để lấy nét mã QR siêu nhỏ. Nếu không quét được, hãy tải ảnh chụp từ điện thoại lên.`);
        } else {
          setResolutionWarning(null);
        }

        try {
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities ? track.getCapabilities() : null;

          const advancedConstraints: any[] = [];

          // Thử bật focus liên tục nếu phần cứng hỗ trợ
          if (capabilities && (capabilities as MediaTrackCapabilities & { focusMode?: string[] }).focusMode?.includes("continuous")) {
            advancedConstraints.push({ focusMode: "continuous" });
          }

          // Thử bật zoom quang học nhẹ (1.5x) nếu hỗ trợ
          if (capabilities && (capabilities as MediaTrackCapabilities & { zoom?: { max?: number } }).zoom) {
            const zoomMax = (capabilities as MediaTrackCapabilities & { zoom?: { max?: number } }).zoom?.max || 1;
            const targetZoom = Math.min(1.5, zoomMax);
            if (targetZoom > 1) {
              advancedConstraints.push({ zoom: targetZoom });
            }
          }

          if (advancedConstraints.length > 0) {
            await track.applyConstraints({
              advanced: advancedConstraints
            });
          }
        } catch (err: any) {
          // Ignore capabilities errors
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise((resolve) => {
            if (!videoRef.current) return resolve(null);
            videoRef.current.onloadedmetadata = () => resolve(null);
          });
          await videoRef.current.play().catch(e => {
            // Ignore play errors or handle silently
          });

          // Tự code luồng quét liên tục 2 hình/giây để giữ nguyên được chất lượng 4K của luồng WebRTC
          scanIntervalRef.current = setInterval(async () => {
            // KHÓA LUỒNG: Nếu khung hình trước đó đang quét chưa xong, tuyệt đối không quét khung hình mới để chống đơ máy (Freeze)
            if (isLiveScanningRef.current) return;
            if (!isMounted || !videoRef.current || videoRef.current.readyState < 2) return;

            const w = videoRef.current.videoWidth;
            const h = videoRef.current.videoHeight;
            if (w === 0 || h === 0) return;

            isLiveScanningRef.current = true;

            try {
              // CHIẾN THUẬT MULTI-CROP: Cắt nhiều lớp từ ngoài vào trong để ZXing không bị nhiễu nền
              const cropRatios = w >= 1920 ? [0.6, 0.4] : [0.9, 0.5, 0.3];

              for (const ratio of cropRatios) {
                if (!isLiveScanningRef.current) break; // Thoát nếu đã có kết quả

                const cropW = Math.floor(w * ratio);
                const cropH = Math.floor(h * ratio);
                const startX = Math.floor((w - cropW) / 2);
                const startY = Math.floor((h - cropH) / 2);

                const canvas = document.createElement("canvas");
                canvas.width = cropW;
                canvas.height = cropH;
                const ctx = canvas.getContext("2d");
                if (!ctx) continue;
                ctx.drawImage(videoRef.current, startX, startY, cropW, cropH, 0, 0, cropW, cropH);

                try {
                  const decodedText = await scanQRFromCanvas(canvas, true);
                  if (decodedText && decodedText.trim().length > 0) {
                    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
                    if (isMounted) {
                      setIsCameraActive(false);
                      handleSuccess(decodedText);
                    }
                    isLiveScanningRef.current = false;
                    return;
                  }
                } catch (err) {
                  // Thất bại ở lớp cắt này, sẽ tự vòng lên lớp cắt sâu hơn
                }
              }
            } catch (err) {
              // Ignore lỗi quét để tiếp tục khung hình sau
            } finally {
              isLiveScanningRef.current = false;
            }
          }, 500);
        }
        setIsStarting(false);
      } catch (err: any) {
        if (isMounted) {
          setError("Không thể khởi tạo camera độ nét cao. Vui lòng cấp quyền hoặc kiểm tra thiết bị.");
          setIsStarting(false);
          setIsCameraActive(false);
        }
      }
    };

    initCamera();

    return () => {
      isMounted = false;
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isCameraActive, onScanSuccess]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);

    try {
      if (isCameraActive) {
        setIsCameraActive(false);
      }

      const decodedText = await scanQRFromFile(file);
      handleSuccess(decodedText);
    } catch (err) {
      toast.error("Không tìm thấy mã QR. Vui lòng đảm bảo ảnh rõ nét và mã QR không bị che khuất.");
      if (handleFailure) handleFailure(err);
    } finally {
      setIsProcessingFile(false);
      event.target.value = "";
    }
  }, [handleSuccess, handleFailure, isCameraActive]);

  const handleCaptureFrame = useCallback(async () => {
    const videoEl = videoRef.current;
    if (!videoEl || videoEl.readyState < 2) {
      toast.error("Camera chưa sẵn sàng. Vui lòng đợi camera khởi động xong.");
      return;
    }

    setIsProcessingFile(true);

    try {
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;

      // Tạo nhiều vùng crop: toàn bộ, 70%, 50%, 35%
      const cropRatios = [1.0, 0.7, 0.5, 0.35];

      for (const ratio of cropRatios) {
        const cropW = Math.round(vw * ratio);
        const cropH = Math.round(vh * ratio);
        const sx = Math.round((vw - cropW) / 2);
        const sy = Math.round((vh - cropH) / 2);

        const rawCanvas = document.createElement("canvas");
        rawCanvas.width = cropW;
        rawCanvas.height = cropH;
        const ctx = rawCanvas.getContext("2d")!;
        ctx.drawImage(videoEl, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

        // Thử 3 phiên bản: gốc, sharpened, upscaled+sharpened
        const variants: HTMLCanvasElement[] = [
          rawCanvas,
          sharpenCanvas(rawCanvas),
          upscaleCanvas(sharpenCanvas(rawCanvas)),
        ];
        // Thêm phiên bản upscale không sharpen
        if (Math.min(cropW, cropH) < 800) {
          variants.push(upscaleCanvas(rawCanvas));
        }

        for (const variant of variants) {
          try {
            const decodedText = await scanQRFromCanvas(variant);
            handleSuccess(decodedText);
            return;
          } catch {
            // Thử phiên bản tiếp theo
          }
        }
      }

      toast.error("Không tìm thấy mã QR. Hãy đưa CCCD gần camera hơn, giữ yên vài giây để lấy nét rồi bấm lại. Nếu webcam quá mờ, hãy dùng cách 'Tải ảnh CCCD lên' bên dưới.");
    } catch (err) {
      toast.error("Có lỗi khi chụp frame camera.");
      if (handleFailure) handleFailure(err);
    } finally {
      setIsProcessingFile(false);
    }
  }, [onScanSuccess, onScanFailure]);

  return (
    <div className="w-full flex flex-col items-center justify-center py-4 relative">
      {error ? (
        <Alert variant="destructive" className="mb-4 w-full max-w-sm">
          <IconAlertCircle className="h-4 w-4" />
          <AlertTitle>Không truy cập được Camera</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Hiển thị khu vực Webcam trên mọi thiết bị */}
      <div className="w-full max-w-sm mx-auto overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-card-foreground shadow-sm relative">
        {(isStarting || isProcessingFile) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/90 z-20">
            <IconLoader2 className="h-8 w-8 animate-spin text-[#1A56F0] mb-2" />
            <p className="text-sm font-medium text-slate-600">
              {isProcessingFile ? "Đang phân tích ảnh..." : "Đang khởi động camera..."}
            </p>
          </div>
        )}

        {/* Khu vực Scanner hoặc Placeholder */}
        {!isCameraActive ? (
          <div className="w-full h-[300px] flex flex-col items-center justify-center bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg">
            <IconCamera className="h-10 w-10 text-slate-400 mb-3" />
            <p className="text-sm font-medium text-slate-600 mb-4 px-6 text-center">
              Bạn có thể sử dụng webcam để chụp mã QR trên CCCD
            </p>
            <button
              type="button"
              onClick={() => setIsCameraActive(true)}
              className="px-5 py-2.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-sm font-semibold text-[#1A56F0] transition-colors"
            >
              Mở Camera quét CCCD
            </button>
          </div>
        ) : (
          <>
            <div className="w-full relative bg-black flex items-center justify-center overflow-hidden" style={{ minHeight: "300px", height: "300px" }}>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
            </div>

            {/* Khung viền ngắm QR ảo */}
            {!error && !isProcessingFile && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                <div className="w-[250px] h-[250px] border-2 border-[#1A56F0]/50 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#1A56F0] rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#1A56F0] rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#1A56F0] rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#1A56F0] rounded-br-lg" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="w-full max-w-sm mt-5 flex flex-col items-center gap-3 px-2">
        {isCameraActive && !error && (
          <p className="text-xs text-slate-500 text-center">
            Đưa mã QR trên CCCD vào khung hình, hệ thống sẽ <strong>tự động quét liên tục</strong>.
          </p>
        )}

        {isCameraActive && resolutionWarning && (
          <div className="w-full bg-orange-50 border border-orange-200 text-orange-700 p-3 rounded-lg text-xs leading-relaxed text-center shadow-sm">
            <p className="font-semibold mb-1">Cảnh báo độ nét phần cứng</p>
            {resolutionWarning}
          </div>
        )}

        {/* Nút Đóng Camera - Chế độ Auto Scan không cần nút Chụp thủ công */}
        {isCameraActive && !error && !isStarting && (
          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={() => setIsCameraActive(false)}
              className="w-full flex items-center justify-center px-4 py-3 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg shadow-sm hover:bg-slate-200 transition-all text-sm font-semibold"
            >
              Đóng Camera
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 w-full my-1">
          <div className="h-[1px] flex-1 bg-slate-200"></div>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Hoặc tải ảnh</span>
          <div className="h-[1px] flex-1 bg-slate-200"></div>
        </div>

        <Label
          htmlFor="qr-upload"
          className="flex w-full items-center justify-center gap-2 cursor-pointer px-4 py-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 hover:text-[#1A56F0] hover:border-[#1A56F0]/30 transition-all text-sm font-medium text-slate-700"
        >
          <IconPhoto className="h-5 w-5" />
          Tải ảnh lên
          <Input
            id="qr-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isProcessingFile}
          />
        </Label>
      </div>
    </div>
  );
}
