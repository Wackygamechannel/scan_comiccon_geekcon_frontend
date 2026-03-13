"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import useApi from "@/utils/api";
import { useGlobal } from "@/utils/global";
import { LANGUAGE_OPTIONS, TRANSLATIONS, useLanguage } from "@/utils/language";
import styles from "./login.module.css";

export default function Login() {
  const api = useApi();
  const { auth } = useGlobal();
  const { language, setLanguage, t } = useLanguage();

  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loginErrorMap = {
      [TRANSLATIONS.ru.invalidTokens]: t.invalidTokens,
      [TRANSLATIONS.uz.invalidTokens]: t.invalidTokens,
      [TRANSLATIONS.en.invalidTokens]: t.invalidTokens,
      [TRANSLATIONS.ru.loginError]: t.loginError,
      [TRANSLATIONS.uz.loginError]: t.loginError,
      [TRANSLATIONS.en.loginError]: t.loginError,
    };

    setErrorMessage((prev) => loginErrorMap[prev] || prev);
  }, [t]);

  const isFormComplete =
    emailInput.trim().length > 0 && passwordInput.trim().length > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isFormComplete || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const response = await api.post("/api/v1/crm/login/", {
        email: emailInput.trim(),
        password: passwordInput,
      });

      const tokenPayload = response.data?.data || response.data || {};
      const accessToken =
        tokenPayload.access_token || tokenPayload.access || tokenPayload.token;
      const refreshToken = tokenPayload.refresh_token || tokenPayload.refresh;

      if (!accessToken || !refreshToken) {
        setErrorMessage(t.invalidTokens);
        return;
      }

      auth({
        accessToken,
        refreshToken,
      });

      window.location.replace("/");
    } catch (error) {
      console.error("Ошибка авторизации:", error);
      setErrorMessage(
        error.response?.data?.detail ||
          error.response?.data?.message ||
          t.loginError
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.page}>
      <main className={styles.card}>
        <div className={styles.languageRow}>
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
        </div>

        <div className={styles.titleWrap}>
          <p className={styles.projectTitle}>ComicCon x GeekCon</p>
          <h1>{t.loginTitle}</h1>
          <p>{t.loginSubtitle}</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>{t.email}</span>
            <div className={styles.inputWrap}>
              <Image src="/Letter.svg" alt="mail" width={20} height={20} />
              <input
                type="email"
                name="email"
                placeholder="example@mail.com"
                autoComplete="email"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
              />
            </div>
          </label>

          <label className={styles.field}>
            <span>{t.password}</span>
            <div className={styles.inputWrap}>
              <Image src="/Password.svg" alt="password" width={20} height={20} />
              <input
                type={isPasswordVisible ? "text" : "password"}
                name="password"
                placeholder={t.passwordPlaceholder}
                autoComplete="current-password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setIsPasswordVisible((prev) => !prev)}
                aria-label={isPasswordVisible ? t.hidePassword : t.showPassword}
              >
                <Image
                  src={isPasswordVisible ? "/OpenEye.svg" : "/ClosedEye.svg"}
                  alt="toggle password"
                  width={20}
                  height={20}
                />
              </button>
            </div>
          </label>

          {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!isFormComplete || isSubmitting}
          >
            {isSubmitting ? t.signingIn : t.signIn}
          </button>
        </form>
      </main>
    </section>
  );
}
