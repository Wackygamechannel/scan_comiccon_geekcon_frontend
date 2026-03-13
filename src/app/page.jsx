"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import ClientWrapper from "@/utils/clientWrapper";
import useApi from "@/utils/api";
import { useGlobal } from "@/utils/global";
import { LANGUAGE_OPTIONS, TRANSLATIONS, useLanguage } from "@/utils/language";
import styles from "./home.module.css";

const HISTORY_LIMIT = 100;
const TRACKING_STALE_MS = 350;
const OCR_INTERVAL_MS = 900;
const OCR_DETECTION_COOLDOWN_MS = 2500;
const UUID_COMPACT_PATTERN = /[0-9a-fA-F]{32}/;
const LOCALE_BY_LANGUAGE = {
  ru: "ru-RU",
  uz: "uz-UZ",
  en: "en-US",
};

function mapCameraError(error, t) {
  const errorName = error?.name || "";
  const errorMessage = String(error?.message || "").toLowerCase();

  if (errorMessage.includes("object can not be found here")) {
    return t.cameraNotFound;
  }

  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return t.cameraDenied;
  }

  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return t.cameraNotOnDevice;
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return t.cameraBusy;
  }

  if (errorName === "OverconstrainedError") {
    return t.cameraConstraint;
  }

  return t.cameraUnavailable;
}

const CAMERA_RECOVERABLE_ERRORS = new Set([
  "NotFoundError",
  "DevicesNotFoundError",
  "OverconstrainedError",
]);

const BACK_CAMERA_PATTERN =
  /(back|rear|environment|traseira|trasera|arrière|зад|орқа|orqa|orqa kamera)/i;
const UUID_PATTERN =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

function normalizeCameraDevices(devices) {
  return devices
    .filter((device) => device.kind === "videoinput")
    .map((device, index) => ({
      id: device.deviceId,
      label: device.label || "",
    }))
    .filter((device) => Boolean(device.id));
}

function pickPreferredCameraId(devices, selectedId) {
  if (!devices.length) return "";

  if (selectedId && devices.some((device) => device.id === selectedId)) {
    return selectedId;
  }

  const backCamera = devices.find((device) => BACK_CAMERA_PATTERN.test(device.label));
  return backCamera?.id || devices[0].id;
}

function buildQrBox(viewfinderWidth, viewfinderHeight) {
  const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
  const qrSize = Math.max(180, Math.floor(minEdge * 0.72));
  return { width: qrSize, height: qrSize };
}

function extractDecodedBounds(decodedResult) {
  const rawBounds = decodedResult?.result?.bounds;
  if (!rawBounds || typeof rawBounds !== "object") return null;

  const x = Number(rawBounds.x);
  const y = Number(rawBounds.y);
  const width = Number(rawBounds.width);
  const height = Number(rawBounds.height);

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return { x, y, width, height };
}

function clampBounds(bounds, maxWidth, maxHeight) {
  const width = Math.min(Math.max(bounds.width, 24), maxWidth);
  const height = Math.min(Math.max(bounds.height, 24), maxHeight);
  const x = Math.min(Math.max(bounds.x, 0), Math.max(0, maxWidth - width));
  const y = Math.min(Math.max(bounds.y, 0), Math.max(0, maxHeight - height));
  return { x, y, width, height };
}

function FrameCorners() {
  return (
    <>
      <span className={`${styles.frameCorner} ${styles.frameCornerTl}`} />
      <span className={`${styles.frameCorner} ${styles.frameCornerTr}`} />
      <span className={`${styles.frameCorner} ${styles.frameCornerBl}`} />
      <span className={`${styles.frameCorner} ${styles.frameCornerBr}`} />
    </>
  );
}

function formatScanDateTime(value, language) {
  if (!value) return "—";
  const locale = LOCALE_BY_LANGUAGE[language] || LOCALE_BY_LANGUAGE.ru;

  const parsedIso = DateTime.fromISO(value, { zone: "Asia/Tashkent" });
  const parsed = parsedIso.isValid
    ? parsedIso
    : DateTime.fromFormat(value, "yyyy-MM-dd HH:mm:ss", {
        zone: "Asia/Tashkent",
      });

  if (parsed.isValid) {
    return parsed
      .setLocale(locale)
      .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
  }

  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toLocaleString(locale);
  }

  return String(value);
}

function getLastScanAgo(timestamp, t) {
  if (!timestamp) return "";

  const parsed = DateTime.fromFormat(timestamp, "yyyy-MM-dd HH:mm:ss", {
    zone: "Asia/Tashkent",
  });

  if (!parsed.isValid) return "";

  const now = DateTime.now().setZone("Asia/Tashkent");
  const diff = now.diff(parsed, ["hours", "minutes", "seconds"]).toObject();

  const hours = Math.max(0, Math.floor(diff.hours || 0));
  const minutes = Math.max(0, Math.floor(diff.minutes || 0));
  const seconds = Math.max(0, Math.floor(diff.seconds || 0));
  const parts = [];

  if (hours) parts.push(`${hours} ${t.hourShort}`);
  if (minutes) parts.push(`${minutes} ${t.minuteShort}`);
  parts.push(`${seconds} ${t.secondShort}`);

  return `${parts.join(" ")} ${t.justNow}`;
}

function extractHistoryItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function extractOffsetFromLink(value) {
  if (!value || typeof value !== "string") return null;

  try {
    const parsedUrl = new URL(value, "https://api.geekcon.uz");
    const offsetValue = Number(parsedUrl.searchParams.get("offset"));
    return Number.isFinite(offsetValue) && offsetValue >= 0 ? offsetValue : null;
  } catch {
    return null;
  }
}

function normalizeTicketId(value) {
  const rawValue = String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();

  if (!rawValue) return "";

  const extractedUuid = extractUuidFromText(rawValue);
  if (extractedUuid) {
    return extractedUuid;
  }

  return rawValue.replace(/\s+/g, "");
}

function extractUuidFromText(value) {
  const rawValue = String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[—–−]/g, "-");

  const directMatch = rawValue.match(UUID_PATTERN);
  if (directMatch?.[0]) {
    return directMatch[0].toLowerCase();
  }

  const collapsed = rawValue.replace(/\s+/g, "");
  const collapsedMatch = collapsed.match(UUID_PATTERN);
  if (collapsedMatch?.[0]) {
    return collapsedMatch[0].toLowerCase();
  }

  const onlyHex = rawValue.replace(/[^0-9a-fA-F]/g, "");
  const compactMatch = onlyHex.match(UUID_COMPACT_PATTERN);
  if (compactMatch?.[0]) {
    const compact = compactMatch[0].toLowerCase();
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
  }

  return "";
}

function drawOcrSnapshot(videoElement, viewportElement, canvasElement) {
  const viewportWidth = viewportElement?.clientWidth || 0;
  const viewportHeight = viewportElement?.clientHeight || 0;
  const sourceWidth = videoElement?.videoWidth || 0;
  const sourceHeight = videoElement?.videoHeight || 0;

  if (!viewportWidth || !viewportHeight || !sourceWidth || !sourceHeight) {
    return null;
  }

  const scanBox = buildQrBox(viewportWidth, viewportHeight);
  const scanOffsetX = Math.max(0, (viewportWidth - scanBox.width) / 2);
  const scanOffsetY = Math.max(0, (viewportHeight - scanBox.height) / 2);

  const regionDisplayX = scanOffsetX;
  const regionDisplayY = scanOffsetY;
  const regionDisplayWidth = Math.min(scanBox.width, viewportWidth - regionDisplayX);
  const regionDisplayHeight = Math.min(
    viewportHeight - regionDisplayY,
    Math.floor(scanBox.height * 1.35)
  );

  if (regionDisplayWidth <= 2 || regionDisplayHeight <= 2) {
    return null;
  }

  const scaleX = sourceWidth / viewportWidth;
  const scaleY = sourceHeight / viewportHeight;
  const srcX = Math.max(0, Math.floor(regionDisplayX * scaleX));
  const srcY = Math.max(0, Math.floor(regionDisplayY * scaleY));
  const srcWidth = Math.max(
    1,
    Math.min(sourceWidth - srcX, Math.floor(regionDisplayWidth * scaleX))
  );
  const srcHeight = Math.max(
    1,
    Math.min(sourceHeight - srcY, Math.floor(regionDisplayHeight * scaleY))
  );

  const outputWidth = Math.min(880, srcWidth);
  const outputHeight = Math.max(1, Math.round((srcHeight / srcWidth) * outputWidth));
  canvasElement.width = outputWidth;
  canvasElement.height = outputHeight;

  const context = canvasElement.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.imageSmoothingEnabled = true;
  context.drawImage(
    videoElement,
    srcX,
    srcY,
    srcWidth,
    srcHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return canvasElement;
}

function HistoryDesktopTable({ items, language, t }) {
  if (!items.length) {
    return <p className={styles.emptyState}>{t.noScansYet}</p>;
  }

  return (
    <div className={styles.historyDesktopTable}>
      <div className={styles.historyHead}>
        <p>{t.ticketId}</p>
        <p>{t.user}</p>
        <p>{t.status}</p>
        <p>{t.ticketType}</p>
        <p>{t.date}</p>
      </div>

      {items.map((entry, index) => {
        const isSuccess = (entry.status || "").toLowerCase() === "success";

        return (
          <div
            className={styles.historyRow}
            key={`${entry.ticket_id || "ticket"}-${index}`}
          >
            <p>{entry.ticket_id || "—"}</p>
            <p>{entry.user_name || "—"}</p>
            <p>
              <span
                className={`${styles.statusPill} ${
                  isSuccess ? styles.statusSuccess : styles.statusError
                }`}
              >
                {entry.status_display || entry.status || "—"}
              </span>
            </p>
            <p>{entry.ticket_type || "—"}</p>
            <p>{formatScanDateTime(entry.scanned_at, language)}</p>
          </div>
        );
      })}
    </div>
  );
}

function HistoryMobileCards({ items, language, t }) {
  if (!items.length) {
    return <p className={styles.emptyState}>{t.noScansYet}</p>;
  }

  return (
    <div className={styles.historyMobileList}>
      {items.map((entry, index) => {
        const isSuccess = (entry.status || "").toLowerCase() === "success";

        return (
          <article
            className={styles.historyMobileCard}
            key={`${entry.ticket_id || "ticket"}-${index}`}
          >
            <div className={styles.historyMobileTop}>
              <strong>#{entry.ticket_id || "—"}</strong>
              <span
                className={`${styles.statusPill} ${
                  isSuccess ? styles.statusSuccess : styles.statusError
                }`}
              >
                {entry.status_display || entry.status || "—"}
              </span>
            </div>
            <p>
              <span>{t.user}:</span> {entry.user_name || "—"}
            </p>
            <p>
              <span>{t.type}:</span> {entry.ticket_type || "—"}
            </p>
            <p>
              <span>{t.date}:</span> {formatScanDateTime(entry.scanned_at, language)}
            </p>
          </article>
        );
      })}
    </div>
  );
}

export default function Home() {
  const api = useApi();
  const { logout } = useGlobal();
  const { language, setLanguage, t } = useLanguage();

  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [staffProfile, setStaffProfile] = useState(null);

  const [historyCache, setHistoryCache] = useState([]);
  const [historyView, setHistoryView] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historyNextOffset, setHistoryNextOffset] = useState(null);
  const [historyPrevOffset, setHistoryPrevOffset] = useState(null);

  const [ticketSearchValue, setTicketSearchValue] = useState("");
  const [ticketSearchError, setTicketSearchError] = useState("");
  const [ticketSearchLoading, setTicketSearchLoading] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const [scanResult, setScanResult] = useState(null);
  const [scanMessage, setScanMessage] = useState(TRANSLATIONS.ru.enterTicketOrScan);
  const [lastScanAgo, setLastScanAgo] = useState("");

  const [scannerPanelOpen, setScannerPanelOpen] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [scannerRunning, setScannerRunning] = useState(false);
  const [scannerError, setScannerError] = useState("");

  const [manualTicketId, setManualTicketId] = useState("");

  const qrScannerRef = useRef(null);
  const scannerRunningRef = useRef(false);
  const scannerViewportRef = useRef(null);
  const ocrWorkerRef = useRef(null);
  const ocrCanvasRef = useRef(null);
  const ocrIntervalRef = useRef(null);
  const ocrInFlightRef = useRef(false);
  const scanInFlightRef = useRef(false);
  const lastAutoDetectedIdRef = useRef("");
  const lastAutoDetectedAtRef = useRef(0);
  const cameraRestartTimeoutRef = useRef(null);

  const [trackedBounds, setTrackedBounds] = useState(null);
  const [lastTrackedAt, setLastTrackedAt] = useState(0);
  const [trackingTick, setTrackingTick] = useState(0);

  useEffect(() => {
    const messageKeyMap = {
      [TRANSLATIONS.ru.enterTicketOrScan]: t.enterTicketOrScan,
      [TRANSLATIONS.uz.enterTicketOrScan]: t.enterTicketOrScan,
      [TRANSLATIONS.en.enterTicketOrScan]: t.enterTicketOrScan,
      [TRANSLATIONS.ru.enterTicketId]: t.enterTicketId,
      [TRANSLATIONS.uz.enterTicketId]: t.enterTicketId,
      [TRANSLATIONS.en.enterTicketId]: t.enterTicketId,
      [TRANSLATIONS.ru.scanProcessed]: t.scanProcessed,
      [TRANSLATIONS.uz.scanProcessed]: t.scanProcessed,
      [TRANSLATIONS.en.scanProcessed]: t.scanProcessed,
      [TRANSLATIONS.ru.scanError]: t.scanError,
      [TRANSLATIONS.uz.scanError]: t.scanError,
      [TRANSLATIONS.en.scanError]: t.scanError,
      [TRANSLATIONS.ru.ocrSearching]: t.ocrSearching,
      [TRANSLATIONS.uz.ocrSearching]: t.ocrSearching,
      [TRANSLATIONS.en.ocrSearching]: t.ocrSearching,
      [TRANSLATIONS.ru.qrChecking]: t.qrChecking,
      [TRANSLATIONS.uz.qrChecking]: t.qrChecking,
      [TRANSLATIONS.en.qrChecking]: t.qrChecking,
      [TRANSLATIONS.ru.uuidDetected]: t.uuidDetected,
      [TRANSLATIONS.uz.uuidDetected]: t.uuidDetected,
      [TRANSLATIONS.en.uuidDetected]: t.uuidDetected,
      [TRANSLATIONS.ru.switchingCamera]: t.switchingCamera,
      [TRANSLATIONS.uz.switchingCamera]: t.switchingCamera,
      [TRANSLATIONS.en.switchingCamera]: t.switchingCamera,
    };

    setScanMessage((prev) => messageKeyMap[prev] || prev);
  }, [t]);

  useEffect(() => {
    const cameraErrorMap = {
      [TRANSLATIONS.ru.cameraNotFound]: t.cameraNotFound,
      [TRANSLATIONS.uz.cameraNotFound]: t.cameraNotFound,
      [TRANSLATIONS.en.cameraNotFound]: t.cameraNotFound,
      [TRANSLATIONS.ru.cameraDenied]: t.cameraDenied,
      [TRANSLATIONS.uz.cameraDenied]: t.cameraDenied,
      [TRANSLATIONS.en.cameraDenied]: t.cameraDenied,
      [TRANSLATIONS.ru.cameraNotOnDevice]: t.cameraNotOnDevice,
      [TRANSLATIONS.uz.cameraNotOnDevice]: t.cameraNotOnDevice,
      [TRANSLATIONS.en.cameraNotOnDevice]: t.cameraNotOnDevice,
      [TRANSLATIONS.ru.cameraBusy]: t.cameraBusy,
      [TRANSLATIONS.uz.cameraBusy]: t.cameraBusy,
      [TRANSLATIONS.en.cameraBusy]: t.cameraBusy,
      [TRANSLATIONS.ru.cameraConstraint]: t.cameraConstraint,
      [TRANSLATIONS.uz.cameraConstraint]: t.cameraConstraint,
      [TRANSLATIONS.en.cameraConstraint]: t.cameraConstraint,
      [TRANSLATIONS.ru.cameraUnavailable]: t.cameraUnavailable,
      [TRANSLATIONS.uz.cameraUnavailable]: t.cameraUnavailable,
      [TRANSLATIONS.en.cameraUnavailable]: t.cameraUnavailable,
      [TRANSLATIONS.ru.secureContextRequired]: t.secureContextRequired,
      [TRANSLATIONS.uz.secureContextRequired]: t.secureContextRequired,
      [TRANSLATIONS.en.secureContextRequired]: t.secureContextRequired,
      [TRANSLATIONS.ru.browserNoCameraSupport]: t.browserNoCameraSupport,
      [TRANSLATIONS.uz.browserNoCameraSupport]: t.browserNoCameraSupport,
      [TRANSLATIONS.en.browserNoCameraSupport]: t.browserNoCameraSupport,
      [TRANSLATIONS.ru.camerasNotFoundRetry]: t.camerasNotFoundRetry,
      [TRANSLATIONS.uz.camerasNotFoundRetry]: t.camerasNotFoundRetry,
      [TRANSLATIONS.en.camerasNotFoundRetry]: t.camerasNotFoundRetry,
      [TRANSLATIONS.ru.camerasNotFoundDevice]: t.camerasNotFoundDevice,
      [TRANSLATIONS.uz.camerasNotFoundDevice]: t.camerasNotFoundDevice,
      [TRANSLATIONS.en.camerasNotFoundDevice]: t.camerasNotFoundDevice,
    };

    setScannerError((prev) => cameraErrorMap[prev] || prev);
  }, [t]);

  useEffect(() => {
    scannerRunningRef.current = scannerRunning;
  }, [scannerRunning]);

  useEffect(() => {
    return () => {
      if (ocrIntervalRef.current) {
        window.clearInterval(ocrIntervalRef.current);
        ocrIntervalRef.current = null;
      }
      ocrInFlightRef.current = false;

      if (ocrWorkerRef.current?.terminate) {
        ocrWorkerRef.current.terminate().catch(() => {});
        ocrWorkerRef.current = null;
      }

      if (cameraRestartTimeoutRef.current) {
        window.clearTimeout(cameraRestartTimeoutRef.current);
        cameraRestartTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!scannerRunning) return;
    const intervalId = window.setInterval(() => {
      setTrackingTick(Date.now());
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [scannerRunning]);

  const isTrackingActive =
    scannerRunning &&
    Boolean(trackedBounds) &&
    trackingTick - lastTrackedAt <= TRACKING_STALE_MS;

  useEffect(() => {
    const locale = LOCALE_BY_LANGUAGE[language] || LOCALE_BY_LANGUAGE.ru;
    const tick = () => {
      const now = DateTime.now().setZone("Asia/Tashkent");
      setTime(now.toLocaleString(DateTime.TIME_24_WITH_SECONDS));
      setDate(now.setLocale(locale).toLocaleString(DateTime.DATE_FULL));
    };

    tick();
    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
  }, [language]);

  useEffect(() => {
    const updateNetwork = () => {
      if (typeof navigator === "undefined") {
        setIsOnline(true);
        return;
      }
      setIsOnline(navigator.onLine);
    };

    updateNetwork();

    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);

    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const fetchStaffProfile = async () => {
      try {
        const response = await api.get("/api/v1/crm/staff-view/");
        const payload = response.data?.data || response.data || null;
        if (!isCancelled) {
          setStaffProfile(payload && typeof payload === "object" ? payload : null);
        }
      } catch (error) {
        console.error("Ошибка загрузки профиля сотрудника:", error);
        if (!isCancelled) {
          setStaffProfile(null);
        }
      }
    };

    fetchStaffProfile();

    return () => {
      isCancelled = true;
    };
  }, [api]);

  const fetchScannerHistory = useCallback(
    async ({ offset = 0, resetOnError = true, applyToView = true } = {}) => {
      try {
        setHistoryLoading(true);
        const response = await api.get("/api/v1/crm/cashier/scanner/history/", {
          params: {
            limit: HISTORY_LIMIT,
            offset,
          },
        });

        const payload = response.data;
        const pageItems = extractHistoryItems(payload);
        const totalCount = Number(payload?.count);

        setHistoryOffset(offset);
        setHistoryTotalCount(Number.isFinite(totalCount) ? totalCount : pageItems.length);
        setHistoryNextOffset(extractOffsetFromLink(payload?.next));
        setHistoryPrevOffset(extractOffsetFromLink(payload?.previous));
        setHistoryCache(pageItems);
        if (applyToView) {
          setHistoryView(pageItems);
        }
      } catch (error) {
        console.error("Ошибка при загрузке истории сканирования:", error);

        if (resetOnError) {
          setHistoryOffset(0);
          setHistoryTotalCount(0);
          setHistoryNextOffset(null);
          setHistoryPrevOffset(null);
          setHistoryCache([]);
          setHistoryView([]);
        }
      } finally {
        setHistoryLoading(false);
      }
    },
    [api]
  );

  useEffect(() => {
    fetchScannerHistory({ offset: 0 });
  }, [fetchScannerHistory]);

  const stopOcrLoop = useCallback(() => {
    if (ocrIntervalRef.current) {
      window.clearInterval(ocrIntervalRef.current);
      ocrIntervalRef.current = null;
    }
    ocrInFlightRef.current = false;
  }, []);

  const getOcrWorker = useCallback(async () => {
    if (ocrWorkerRef.current) {
      return ocrWorkerRef.current;
    }

    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      logger: () => {},
    });
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789abcdefABCDEF-",
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    });

    ocrWorkerRef.current = worker;
    return worker;
  }, []);

  const stopScanner = useCallback(async () => {
    if (!qrScannerRef.current || !scannerRunningRef.current) {
      stopOcrLoop();
      setScannerRunning(false);
      return;
    }

    try {
      await qrScannerRef.current.stop();
      await qrScannerRef.current.clear();
    } catch (error) {
      console.error("Ошибка остановки камеры:", error);
    } finally {
      stopOcrLoop();
      setScannerRunning(false);
      setTrackedBounds(null);
      setLastTrackedAt(0);
    }
  }, [stopOcrLoop]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const submitScan = useCallback(
    async (ticketId) => {
      const cleanedTicketId = normalizeTicketId(ticketId);
      if (!cleanedTicketId) {
        setScanMessage(t.enterTicketOrScan);
        return;
      }

      if (scanInFlightRef.current) return;
      scanInFlightRef.current = true;

      try {
        const response = await api.post("/api/v1/crm/cashier/scanner/", {
          qrcode: cleanedTicketId,
        });

        const scanPayload = response.data?.data || response.data || null;
        setScanResult(
          scanPayload && typeof scanPayload === "object" ? scanPayload : null
        );

        setScanMessage(
          response.data?.status_display ||
            response.data?.message ||
            t.scanProcessed
        );
        setLastScanAgo("");

        await fetchScannerHistory({
          offset: historyOffset,
          resetOnError: false,
          applyToView: !isSearchMode,
        });
      } catch (error) {
        const payload = error.response?.data || null;
        setScanResult(payload && typeof payload === "object" ? payload : null);

        setScanMessage(
          error.response?.data?.status_display ||
            error.response?.data?.detail ||
            error.response?.data?.error ||
            error.response?.data?.message ||
            t.scanError
        );

        setLastScanAgo(getLastScanAgo(error.response?.data?.last_scanned_at, t));

        if (error.response) {
          await fetchScannerHistory({
            offset: historyOffset,
            resetOnError: false,
            applyToView: !isSearchMode,
          });
        }
      } finally {
        scanInFlightRef.current = false;
      }
    },
    [api, fetchScannerHistory, historyOffset, isSearchMode, t]
  );

  const loadCameras = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (!window.isSecureContext) {
      setScannerError(t.secureContextRequired);
      setCameras([]);
      setSelectedCamera("");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
      setScannerError(t.browserNoCameraSupport);
      setCameras([]);
      setSelectedCamera("");
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const normalizedDevices = normalizeCameraDevices(devices);

      if (!normalizedDevices.length) {
        setScannerError(t.camerasNotFoundRetry);
        setCameras([]);
        setSelectedCamera("");
        return;
      }

      setCameras(normalizedDevices);
      setSelectedCamera((prev) => pickPreferredCameraId(normalizedDevices, prev));
      setScannerError("");
    } catch (error) {
      console.warn("Ошибка получения камер:", error);
      setScannerError(mapCameraError(error, t));
    }
  }, [t]);

  useEffect(() => {
    if (!scannerPanelOpen) {
      stopScanner();
      return;
    }

    loadCameras();
  }, [loadCameras, scannerPanelOpen, stopScanner]);

  useEffect(() => {
    if (!scannerPanelOpen) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 820px)").matches) return;

    const scrollTimer = window.setTimeout(() => {
      scannerViewportRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 140);

    return () => window.clearTimeout(scrollTimer);
  }, [scannerPanelOpen]);

  const startScanner = async (forcedCameraId = null) => {
    if (scannerRunningRef.current) return;

    try {
      setScannerError("");

      if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
        setScannerError(t.browserNoCameraSupport);
        return;
      }

      if (document.fullscreenElement && document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch {}
      }

      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      permissionStream.getTracks().forEach((track) => track.stop());

      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const availableCameras = normalizeCameraDevices(deviceList);

      if (!availableCameras.length) {
        setScannerError(t.camerasNotFoundDevice);
        setCameras([]);
        setSelectedCamera("");
        return;
      }

      setCameras(availableCameras);

      const preferredCameraId = pickPreferredCameraId(
        availableCameras,
        forcedCameraId || selectedCamera
      );
      setSelectedCamera(preferredCameraId);
      setTrackedBounds(null);
      setLastTrackedAt(0);
      setScanMessage(t.ocrSearching);

      const cameraIds = Array.from(
        new Set([preferredCameraId, ...availableCameras.map((camera) => camera.id)].filter(Boolean))
      );

      if (!qrScannerRef.current) {
        qrScannerRef.current = new Html5Qrcode("qr-reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });
      }

      const updateTrackedFrame = (decodedResult) => {
        const decodedBounds = extractDecodedBounds(decodedResult);
        if (!decodedBounds) return;

        const viewportEl = scannerViewportRef.current;
        if (!viewportEl) return;

        const viewportWidth = viewportEl.clientWidth;
        const viewportHeight = viewportEl.clientHeight;
        if (!viewportWidth || !viewportHeight) return;

        const scanBox = buildQrBox(viewportWidth, viewportHeight);
        const scanOffsetX = Math.max(0, (viewportWidth - scanBox.width) / 2);
        const scanOffsetY = Math.max(0, (viewportHeight - scanBox.height) / 2);

        const isInsideScanBoxSpace =
          decodedBounds.x >= -4 &&
          decodedBounds.y >= -4 &&
          decodedBounds.x + decodedBounds.width <= scanBox.width + 8 &&
          decodedBounds.y + decodedBounds.height <= scanBox.height + 8;

        const videoEl = viewportEl.querySelector("video");
        const sourceWidth = videoEl?.videoWidth || 0;
        const sourceHeight = videoEl?.videoHeight || 0;
        const isInSourceSpace =
          sourceWidth > 0 &&
          sourceHeight > 0 &&
          decodedBounds.x + decodedBounds.width <= sourceWidth + 8 &&
          decodedBounds.y + decodedBounds.height <= sourceHeight + 8;

        let mappedBounds = decodedBounds;
        if (isInsideScanBoxSpace) {
          mappedBounds = {
            x: scanOffsetX + decodedBounds.x,
            y: scanOffsetY + decodedBounds.y,
            width: decodedBounds.width,
            height: decodedBounds.height,
          };
        } else if (isInSourceSpace) {
          mappedBounds = {
            x: (decodedBounds.x / sourceWidth) * viewportWidth,
            y: (decodedBounds.y / sourceHeight) * viewportHeight,
            width: (decodedBounds.width / sourceWidth) * viewportWidth,
            height: (decodedBounds.height / sourceHeight) * viewportHeight,
          };
        }

        setTrackedBounds(clampBounds(mappedBounds, viewportWidth, viewportHeight));
        const now = Date.now();
        setLastTrackedAt(now);
        setTrackingTick(now);
      };

      let lastError = null;
      for (const cameraId of cameraIds) {
        try {
          await qrScannerRef.current.start(
            { deviceId: { exact: cameraId } },
            {
              fps: 20,
              qrbox: buildQrBox,
              aspectRatio: 1,
              disableFlip: false,
            },
            async (decodedText, decodedResult) => {
              updateTrackedFrame(decodedResult);
              const normalizedDecodedId = normalizeTicketId(decodedText);
              if (normalizedDecodedId) {
                setManualTicketId(normalizedDecodedId);
              }
              setScanResult(null);
              setScanMessage(t.qrChecking);
              await stopScanner();
              await submitScan(normalizedDecodedId || decodedText);
            },
            () => {}
          );
          setScannerRunning(true);
          setScannerError("");
          return;
        } catch (error) {
          lastError = error;
          const errorName = error?.name || "";
          if (!CAMERA_RECOVERABLE_ERRORS.has(errorName)) {
            throw error;
          }
        }
      }

      throw lastError || new Error("Camera start failed");
    } catch (error) {
      console.warn("Ошибка запуска камеры:", error);
      setScannerError(mapCameraError(error, t));
      setScannerRunning(false);
    }
  };

  const handleCameraChange = async (event) => {
    const nextCameraId = event.target.value;
    setSelectedCamera(nextCameraId);

    if (!scannerRunningRef.current) return;

    setScanResult(null);
    setScanMessage(t.switchingCamera);

    await stopScanner();

    if (cameraRestartTimeoutRef.current) {
      window.clearTimeout(cameraRestartTimeoutRef.current);
      cameraRestartTimeoutRef.current = null;
    }

    cameraRestartTimeoutRef.current = window.setTimeout(() => {
      cameraRestartTimeoutRef.current = null;
      void startScanner(nextCameraId);
    }, 180);
  };

  useEffect(() => {
    if (!scannerRunning || !scannerPanelOpen) {
      stopOcrLoop();
      return;
    }

    let isCancelled = false;

    const runOcrPass = async () => {
      if (isCancelled || !scannerRunningRef.current) return;
      if (scanInFlightRef.current || ocrInFlightRef.current) return;

      const viewportElement = scannerViewportRef.current;
      const videoElement = viewportElement?.querySelector("video");
      if (!(videoElement instanceof HTMLVideoElement)) return;
      if (videoElement.readyState < 2 || !videoElement.videoWidth || !videoElement.videoHeight) {
        return;
      }

      if (!ocrCanvasRef.current) {
        ocrCanvasRef.current = document.createElement("canvas");
      }

      const ocrCanvas = drawOcrSnapshot(videoElement, viewportElement, ocrCanvasRef.current);
      if (!ocrCanvas) return;

      ocrInFlightRef.current = true;
      try {
        const worker = await getOcrWorker();
        if (isCancelled || !scannerRunningRef.current) return;

        const result = await worker.recognize(ocrCanvas);
        if (isCancelled || !scannerRunningRef.current) return;

        const detectedUuid = extractUuidFromText(result?.data?.text || "");
        if (!detectedUuid) return;

        const detectedAt = Date.now();
        const isSameUuidInCooldown =
          detectedUuid === lastAutoDetectedIdRef.current &&
          detectedAt - lastAutoDetectedAtRef.current < OCR_DETECTION_COOLDOWN_MS;
        if (isSameUuidInCooldown || scanInFlightRef.current) {
          return;
        }

        lastAutoDetectedIdRef.current = detectedUuid;
        lastAutoDetectedAtRef.current = detectedAt;

        setManualTicketId(detectedUuid);
        setScanResult(null);
        setScanMessage(t.uuidDetected);

        await stopScanner();
      } catch (error) {
        if (!isCancelled) {
          console.warn("Ошибка OCR fallback:", error);
        }
      } finally {
        ocrInFlightRef.current = false;
      }
    };

    const runOcrTick = () => {
      void runOcrPass();
    };

    const intervalId = window.setInterval(runOcrTick, OCR_INTERVAL_MS);
    ocrIntervalRef.current = intervalId;
    runOcrTick();

    return () => {
      isCancelled = true;
      if (ocrIntervalRef.current === intervalId) {
        window.clearInterval(intervalId);
        ocrIntervalRef.current = null;
      }
      ocrInFlightRef.current = false;
    };
  }, [getOcrWorker, scannerPanelOpen, scannerRunning, stopOcrLoop, stopScanner, t]);

  const handleManualScan = async (event) => {
    event.preventDefault();

    const normalizedManualTicketId = normalizeTicketId(manualTicketId);
    if (!normalizedManualTicketId) {
      setScanMessage(t.enterTicketId);
      return;
    }

    await submitScan(normalizedManualTicketId);
    setManualTicketId("");
  };

  const submitTicketSearch = async () => {
    const normalizedSearchValue = normalizeTicketId(ticketSearchValue);

    if (!normalizedSearchValue) {
      setIsSearchMode(false);
      setTicketSearchError("");
      setHistoryView(historyCache);
      return;
    }

    if (normalizedSearchValue !== ticketSearchValue) {
      setTicketSearchValue(normalizedSearchValue);
    }

    try {
      setTicketSearchLoading(true);
      setTicketSearchError("");

      const response = await api.get("/api/v1/crm/cashier/scanner/search/", {
        params: { ticket_id: normalizedSearchValue },
      });

      setIsSearchMode(true);
      setHistoryView(extractHistoryItems(response.data));
    } catch (error) {
      console.error("Ошибка поиска по билету:", error);
      setIsSearchMode(true);
      setHistoryView([]);
      setTicketSearchError(
        error.response?.data?.detail ||
          error.response?.data?.message ||
          t.searchError
      );
    } finally {
      setTicketSearchLoading(false);
    }
  };

  const clearTicketSearch = () => {
    setTicketSearchValue("");
    setTicketSearchError("");
    setIsSearchMode(false);
    setHistoryView(historyCache);
  };

  const successScanCount = useMemo(
    () =>
      historyView.filter((item) => (item.status || "").toLowerCase() === "success")
        .length,
    [historyView]
  );

  const errorScanCount = useMemo(
    () =>
      historyView.filter(
        (item) => item.status && (item.status || "").toLowerCase() !== "success"
      ).length,
    [historyView]
  );

  const currentHistoryPage = Math.floor(historyOffset / HISTORY_LIMIT) + 1;
  const totalHistoryPages = Math.max(
    1,
    Math.ceil((historyTotalCount || historyView.length) / HISTORY_LIMIT)
  );

  const goToHistoryOffset = async (nextOffset) => {
    if (historyLoading) return;
    await fetchScannerHistory({
      offset: nextOffset,
      applyToView: true,
      resetOnError: false,
    });
  };

  const scanResultStatus = (scanResult?.status || "").toLowerCase();
  const isScanSuccess = scanResultStatus === "success";
  const scanMessageValue =
    scanResult?.status_display ||
    scanResult?.message ||
    scanResult?.detail ||
    scanResult?.error ||
    scanMessage;

  const ticketTypeValue =
    scanResult?.ticket_type ||
    (scanResult?.partner_ticket
      ? `${t.partnerTicket} (${scanResult.partner_ticket})`
      : "—");

  const staffDisplayName = useMemo(() => {
    const firstName = String(staffProfile?.first_name || "").trim();
    const lastName = String(staffProfile?.last_name || "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    if (fullName) return fullName;
    if (firstName) return firstName;
    if (lastName) return lastName;

    return String(staffProfile?.email || "").trim();
  }, [staffProfile]);

  const staffEmail = String(staffProfile?.email || "").trim();
  const showSecondaryEmail = Boolean(staffEmail && staffEmail !== staffDisplayName);
  const showStaffProfile = Boolean(staffDisplayName || staffEmail);

  return (
    <ClientWrapper>
      <div className={styles.page}>
        <header className={styles.topbar}>
          <div className={styles.brandBlock}>
            <p className={styles.brandKicker}>{t.ticketScanner}</p>
            <h1>ComicCon x GeekCon</h1>
          </div>

          <div className={styles.topbarRight}>
            <label className={styles.languageBox}>
              <span>{t.language}</span>
              <select
                className={styles.languageSelect}
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                aria-label={t.selectLanguage}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.clockBox}>
              <strong>{time}</strong>
              <span>{date}</span>
            </div>
            {showStaffProfile ? (
              <div className={styles.accountBadge}>
                <strong>{staffDisplayName || t.staff}</strong>
                {showSecondaryEmail ? <span>{staffEmail}</span> : null}
              </div>
            ) : null}
            <div
              className={`${styles.networkBadge} ${
                isOnline ? styles.networkOnline : styles.networkOffline
              }`}
            >
              {isOnline ? t.online : t.offline}
            </div>
            <button type="button" className={styles.logoutBtn} onClick={logout}>
              {t.logout}
            </button>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.contentGrid}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>{t.scannerQr}</h2>
                <p>{t.cameraAndManual}</p>
              </div>

              <div className={styles.cameraControls}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setScannerPanelOpen((prev) => !prev)}
                >
                  {scannerPanelOpen ? t.hideCamera : t.openCamera}
                </button>

                {scannerPanelOpen && (
                  <>
                    <div className={styles.scannerViewport} ref={scannerViewportRef}>
                      <div id="qr-reader" className={styles.qrReader} />
                      <div className={styles.scannerOverlay} aria-hidden="true">
                        {scannerRunning ? (
                          isTrackingActive && trackedBounds ? (
                            <div
                              className={styles.trackingFrame}
                              style={{
                                width: trackedBounds.width,
                                height: trackedBounds.height,
                                transform: `translate(${trackedBounds.x}px, ${trackedBounds.y}px)`,
                              }}
                            >
                              <FrameCorners />
                            </div>
                          ) : (
                            <div className={styles.idleGuide}>
                              <FrameCorners />
                            </div>
                          )
                        ) : null}
                      </div>
                    </div>

                    <select
                      className={styles.cameraSelect}
                      value={selectedCamera}
                      onChange={handleCameraChange}
                    >
                      {!cameras.length && (
                        <option value="">{t.cameraAuto}</option>
                      )}
                      {cameras.length ? (
                        cameras.map((camera, index) => (
                          <option key={camera.id} value={camera.id}>
                            {camera.label || `${t.camera} ${index + 1}`}
                          </option>
                        ))
                      ) : null}
                    </select>

                    <div className={styles.cameraActionRow}>
                      {!scannerRunning ? (
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          onClick={startScanner}
                        >
                          {t.start}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          onClick={stopScanner}
                        >
                          {t.stop}
                        </button>
                      )}
                    </div>

                    {scannerError ? (
                      <p className={styles.errorText}>{scannerError}</p>
                    ) : null}
                  </>
                )}
              </div>

              <form className={styles.manualForm} onSubmit={handleManualScan}>
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={t.manualPlaceholder}
                  className={styles.searchInput}
                  value={manualTicketId}
                  onChange={(event) => setManualTicketId(event.target.value)}
                />
                <button type="submit" className={styles.primaryBtn}>
                  {t.check}
                </button>
              </form>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>{t.lastResult}</h2>
                <p>{isScanSuccess ? t.success : t.waitOrError}</p>
              </div>

              <div
                className={`${styles.scanResultCard} ${
                  isScanSuccess ? styles.scanSuccess : styles.scanError
                }`}
              >
                <p>{scanMessageValue}</p>
                <div className={styles.scanMeta}>
                  <span>{t.ticketType}: {ticketTypeValue}</span>
                  <span>
                    {t.scanTime}:{" "}
                    {formatScanDateTime(
                      scanResult?.scanned_at || scanResult?.last_scanned_at,
                      language
                    )}
                  </span>
                  {lastScanAgo ? (
                    <span>
                      {t.lastScan}: {lastScanAgo}
                    </span>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.historyHeaderRow}>
                <h2>{isSearchMode ? t.searchResults : t.scanHistory}</h2>
                <div className={styles.historyCounters}>
                  <div
                    className={`${styles.historyCounter} ${styles.historyCounterSuccess}`}
                    title={t.successfulScans}
                  >
                    <span>{t.successfulScans}</span>
                    <strong>{successScanCount}</strong>
                  </div>
                  <div
                    className={`${styles.historyCounter} ${styles.historyCounterError}`}
                    title={t.failedScans}
                  >
                    <span>{t.failedScans}</span>
                    <strong>{errorScanCount}</strong>
                  </div>
                </div>
              </div>
              <p className={styles.historyMeta}>
                {historyLoading
                  ? t.loading
                  : isSearchMode
                  ? `${historyView.length} ${t.records}`
                  : `${historyView.length} ${t.from} ${historyTotalCount}`}
              </p>
            </div>

            <div className={styles.searchRow}>
              <input
                type="text"
                inputMode="text"
                autoCapitalize="none"
                spellCheck={false}
                className={styles.searchInput}
                placeholder={t.searchPlaceholder}
                value={ticketSearchValue}
                onChange={(event) => {
                  setTicketSearchValue(event.target.value);
                  if (ticketSearchError) setTicketSearchError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submitTicketSearch();
                  }
                }}
              />

              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={submitTicketSearch}
                disabled={ticketSearchLoading}
              >
                {ticketSearchLoading ? t.searching : t.search}
              </button>

              {(isSearchMode || ticketSearchValue.trim()) && (
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={clearTicketSearch}
                  disabled={ticketSearchLoading}
                >
                  {t.reset}
                </button>
              )}
            </div>

            {!isSearchMode && (
              <div className={styles.paginationRow}>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => goToHistoryOffset(historyPrevOffset ?? 0)}
                  disabled={historyLoading || historyPrevOffset === null}
                >
                  {t.back}
                </button>
                <p className={styles.paginationInfo}>
                  {t.page} {currentHistoryPage} / {totalHistoryPages}
                </p>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() =>
                    goToHistoryOffset(historyNextOffset ?? historyOffset + HISTORY_LIMIT)
                  }
                  disabled={historyLoading || historyNextOffset === null}
                >
                  {t.forward}
                </button>
              </div>
            )}

            {ticketSearchError ? <p className={styles.errorText}>{ticketSearchError}</p> : null}

            <div className={styles.historyDesktop}>
              <HistoryDesktopTable items={historyView} language={language} t={t} />
            </div>
            <div className={styles.historyMobile}>
              <HistoryMobileCards items={historyView} language={language} t={t} />
            </div>
          </section>
        </main>
      </div>
    </ClientWrapper>
  );
}
