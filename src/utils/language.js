"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "scanner_ui_language";
const SUPPORTED_LANGUAGES = ["ru", "uz", "en"];

export const LANGUAGE_OPTIONS = [
  { value: "ru", label: "RU" },
  { value: "uz", label: "UZ" },
  { value: "en", label: "EN" },
];

export const TRANSLATIONS = {
  ru: {
    language: "Язык",
    selectLanguage: "Выберите язык",
    ticketScanner: "Ticket Scanner",
    online: "Online",
    offline: "Offline",
    logout: "Выйти",
    staff: "Сотрудник",
    email: "Email",
    camera: "Камера",
    cameraAndManual: "Камера и ручной ввод",
    scannerQr: "Сканер QR",
    openCamera: "Открыть камеру",
    hideCamera: "Скрыть камеру",
    cameraAuto: "Автовыбор (основная камера)",
    start: "Запустить",
    stop: "Остановить",
    manualPlaceholder: "Введите UUID/ID билета",
    check: "Проверить",
    lastResult: "Последний результат",
    success: "Успешно",
    waitOrError: "Ожидание / ошибка",
    ticketType: "Тип билета",
    scanTime: "Время скана",
    lastScan: "Последний скан",
    searchResults: "Результаты поиска",
    scanHistory: "История сканирований",
    successfulScans: "Успешные",
    failedScans: "Ошибочные",
    loading: "Загрузка...",
    records: "записей",
    from: "из",
    searchPlaceholder: "Поиск по UUID/ID билета",
    search: "Найти",
    searching: "Поиск...",
    reset: "Сброс",
    back: "Назад",
    forward: "Вперёд",
    page: "Страница",
    noScansYet: "Сканов пока нет",
    ticketId: "ID билета",
    user: "Пользователь",
    status: "Статус",
    type: "Тип",
    date: "Дата",
    partnerTicket: "Партнерский",
    enterTicketOrScan: "Введите ID билета или отсканируйте QR-код",
    enterTicketId: "Введите ID билета",
    scanProcessed: "Билет успешно обработан",
    scanError: "Ошибка сканирования",
    ocrSearching: "Ищу QR-код или UUID в кадре...",
    qrChecking: "QR распознан, проверяю...",
    uuidDetected: "UUID распознан. Нажмите «Проверить».",
    switchingCamera: "Переключаю камеру...",
    searchError: "Ошибка поиска",
    justNow: "назад",
    hourShort: "ч",
    minuteShort: "м",
    secondShort: "с",
    loginTitle: "Вход в систему сканирования",
    loginSubtitle: "Авторизуйтесь для работы со сканером билетов",
    password: "Пароль",
    passwordPlaceholder: "Введите пароль",
    hidePassword: "Скрыть пароль",
    showPassword: "Показать пароль",
    signIn: "Войти",
    signingIn: "Входим...",
    invalidTokens: "Сервер не вернул корректные токены",
    loginError: "Не удалось выполнить вход",
    cameraNotFound:
      "Камера не найдена или временно недоступна. Проверьте разрешения и выберите другую камеру.",
    cameraDenied: "Доступ к камере запрещен. Разрешите камеру в настройках браузера.",
    cameraNotOnDevice: "Камера не найдена на устройстве.",
    cameraBusy: "Камера занята другим приложением. Закройте его и попробуйте снова.",
    cameraConstraint: "Не удалось выбрать камеру. Попробуйте другой режим камеры.",
    cameraUnavailable: "Не удалось получить доступ к камере.",
    secureContextRequired:
      "Камера работает только через HTTPS или localhost. Откройте сайт по https/localhost.",
    browserNoCameraSupport: "Ваш браузер не поддерживает доступ к камере.",
    camerasNotFoundRetry: "Камеры не найдены. Нажмите «Запустить» для повторной попытки.",
    camerasNotFoundDevice: "Камеры не найдены на устройстве.",
  },
  uz: {
    language: "Til",
    selectLanguage: "Tilni tanlang",
    ticketScanner: "Ticket Scanner",
    online: "Online",
    offline: "Offline",
    logout: "Chiqish",
    staff: "Xodim",
    email: "Email",
    camera: "Kamera",
    cameraAndManual: "Kamera va qo‘lda kiritish",
    scannerQr: "QR skaner",
    openCamera: "Kamerani ochish",
    hideCamera: "Kamerani yashirish",
    cameraAuto: "Avto tanlash (asosiy kamera)",
    start: "Boshlash",
    stop: "To‘xtatish",
    manualPlaceholder: "UUID/ID kiriting",
    check: "Tekshirish",
    lastResult: "So‘nggi natija",
    success: "Muvaffaqiyatli",
    waitOrError: "Kutilmoqda / xato",
    ticketType: "Bilet turi",
    scanTime: "Skan vaqti",
    lastScan: "So‘nggi skan",
    searchResults: "Qidiruv natijalari",
    scanHistory: "Skan tarixi",
    successfulScans: "Muvaffaqiyatli",
    failedScans: "Xatolik",
    loading: "Yuklanmoqda...",
    records: "yozuv",
    from: "dan",
    searchPlaceholder: "UUID/ID bo‘yicha qidirish",
    search: "Qidirish",
    searching: "Qidirilmoqda...",
    reset: "Tozalash",
    back: "Orqaga",
    forward: "Oldinga",
    page: "Sahifa",
    noScansYet: "Hali skanlar yo‘q",
    ticketId: "Bilet ID",
    user: "Foydalanuvchi",
    status: "Holat",
    type: "Turi",
    date: "Sana",
    partnerTicket: "Hamkor",
    enterTicketOrScan: "Bilet ID kiriting yoki QR skanerlang",
    enterTicketId: "Bilet ID kiriting",
    scanProcessed: "Bilet muvaffaqiyatli qayta ishlandi",
    scanError: "Skan xatosi",
    ocrSearching: "Kadrda QR yoki UUID qidirilmoqda...",
    qrChecking: "QR topildi, tekshirilmoqda...",
    uuidDetected: "UUID topildi. «Tekshirish»ni bosing.",
    switchingCamera: "Kamera almashtirilmoqda...",
    searchError: "Qidiruv xatosi",
    justNow: "oldin",
    hourShort: "soat",
    minuteShort: "daq",
    secondShort: "son",
    loginTitle: "Skan tizimiga kirish",
    loginSubtitle: "Bilet skaneri bilan ishlash uchun tizimga kiring",
    password: "Parol",
    passwordPlaceholder: "Parolni kiriting",
    hidePassword: "Parolni yashirish",
    showPassword: "Parolni ko‘rsatish",
    signIn: "Kirish",
    signingIn: "Kirilmoqda...",
    invalidTokens: "Server to‘g‘ri tokenlarni qaytarmadi",
    loginError: "Kirish amalga oshmadi",
    cameraNotFound:
      "Kamera topilmadi yoki vaqtincha mavjud emas. Ruxsatlarni tekshiring va boshqa kamerani tanlang.",
    cameraDenied: "Kameraga ruxsat berilmagan. Brauzer sozlamalarida ruxsat bering.",
    cameraNotOnDevice: "Qurilmada kamera topilmadi.",
    cameraBusy: "Kamera boshqa ilova tomonidan band. Uni yoping va qayta urinib ko‘ring.",
    cameraConstraint: "Kamerani tanlab bo‘lmadi. Boshqa rejimni sinab ko‘ring.",
    cameraUnavailable: "Kameraga kirib bo‘lmadi.",
    secureContextRequired:
      "Kamera faqat HTTPS yoki localhost da ishlaydi. Saytni https/localhost orqali oching.",
    browserNoCameraSupport: "Brauzeringiz kamera ishlashini qo‘llab-quvvatlamaydi.",
    camerasNotFoundRetry: "Kameralar topilmadi. Qayta urinish uchun «Boshlash»ni bosing.",
    camerasNotFoundDevice: "Qurilmada kameralar topilmadi.",
  },
  en: {
    language: "Language",
    selectLanguage: "Select language",
    ticketScanner: "Ticket Scanner",
    online: "Online",
    offline: "Offline",
    logout: "Logout",
    staff: "Staff",
    email: "Email",
    camera: "Camera",
    cameraAndManual: "Camera and manual input",
    scannerQr: "QR Scanner",
    openCamera: "Open camera",
    hideCamera: "Hide camera",
    cameraAuto: "Auto-select (main camera)",
    start: "Start",
    stop: "Stop",
    manualPlaceholder: "Enter UUID/ticket ID",
    check: "Check",
    lastResult: "Last result",
    success: "Success",
    waitOrError: "Waiting / error",
    ticketType: "Ticket type",
    scanTime: "Scan time",
    lastScan: "Last scan",
    searchResults: "Search results",
    scanHistory: "Scan history",
    successfulScans: "Successful",
    failedScans: "Failed",
    loading: "Loading...",
    records: "records",
    from: "of",
    searchPlaceholder: "Search by UUID/ticket ID",
    search: "Search",
    searching: "Searching...",
    reset: "Reset",
    back: "Back",
    forward: "Next",
    page: "Page",
    noScansYet: "No scans yet",
    ticketId: "Ticket ID",
    user: "User",
    status: "Status",
    type: "Type",
    date: "Date",
    partnerTicket: "Partner",
    enterTicketOrScan: "Enter ticket ID or scan QR code",
    enterTicketId: "Enter ticket ID",
    scanProcessed: "Ticket processed successfully",
    scanError: "Scan error",
    ocrSearching: "Looking for QR or UUID in frame...",
    qrChecking: "QR detected, checking...",
    uuidDetected: "UUID detected. Press “Check”.",
    switchingCamera: "Switching camera...",
    searchError: "Search error",
    justNow: "ago",
    hourShort: "h",
    minuteShort: "m",
    secondShort: "s",
    loginTitle: "Scanner system login",
    loginSubtitle: "Sign in to work with the ticket scanner",
    password: "Password",
    passwordPlaceholder: "Enter password",
    hidePassword: "Hide password",
    showPassword: "Show password",
    signIn: "Sign in",
    signingIn: "Signing in...",
    invalidTokens: "Server did not return valid tokens",
    loginError: "Failed to sign in",
    cameraNotFound:
      "Camera not found or temporarily unavailable. Check permissions and try another camera.",
    cameraDenied: "Camera access denied. Allow camera permissions in browser settings.",
    cameraNotOnDevice: "No camera found on this device.",
    cameraBusy: "Camera is busy in another app. Close it and try again.",
    cameraConstraint: "Unable to select camera. Try another camera mode.",
    cameraUnavailable: "Unable to access camera.",
    secureContextRequired:
      "Camera works only on HTTPS or localhost. Open the site via https/localhost.",
    browserNoCameraSupport: "Your browser does not support camera access.",
    camerasNotFoundRetry: "No cameras found. Press “Start” to retry.",
    camerasNotFoundDevice: "No cameras found on this device.",
  },
};

function resolveInitialLanguage() {
  if (typeof window === "undefined") return "ru";

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (storedValue && SUPPORTED_LANGUAGES.includes(storedValue)) {
    return storedValue;
  }

  const browserLanguage = window.navigator.language?.slice(0, 2).toLowerCase();
  if (browserLanguage && SUPPORTED_LANGUAGES.includes(browserLanguage)) {
    return browserLanguage;
  }

  return "ru";
}

export function useLanguage() {
  const [language, setLanguageState] = useState("ru");

  useEffect(() => {
    const resolvedLanguage = resolveInitialLanguage();
    if (resolvedLanguage === "ru") return;

    const timeoutId = window.setTimeout(() => {
      setLanguageState(resolvedLanguage);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const setLanguage = useCallback((nextLanguage) => {
    const normalizedLanguage = String(nextLanguage || "").toLowerCase();
    if (!SUPPORTED_LANGUAGES.includes(normalizedLanguage)) return;

    setLanguageState(normalizedLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, normalizedLanguage);
    }
  }, []);

  const t = useMemo(
    () => TRANSLATIONS[language] || TRANSLATIONS.ru,
    [language]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
  }, [language]);

  return { language, setLanguage, t };
}
