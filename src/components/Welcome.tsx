import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { useAuthStore } from "../stores/authStore";
import { apiFetchAuthMe } from "../lib/ariy-api";
import { DASHBOARD_URL } from "../lib/constants";

/**
 * Welcome — стартовый экран по дизайну ariyvpn.com.
 *
 * Layout (сверху вниз):
 *   1. Hero — логотип Ariy + name + subtitle
 *   2. Primary CTA — большая голубая «Войти через Telegram»
 *   3. «или» — разделитель
 *   4. Stack ссылок: «Войти по email», «Использовать ссылку подписки», «Зарегистрироваться»
 *
 * При клике на email/sub-url ссылку — раскрывается inline-форма соответствующего типа.
 * Telegram-flow ведёт через polling backend'а: видим UI «открыли бота, ждём…»,
 * polling каждые 3с, при `status:linked` → setSubUrl + fetchSubscription.
 */
type ExpandMode = null | "email" | "sub-url";

export function Welcome() {
  const { t } = useTranslation();

  const subUrl = useSubscriptionStore((s) => s.url);
  const subLoading = useSubscriptionStore((s) => s.loading);
  const subError = useSubscriptionStore((s) => s.error);
  const setSubUrl = useSubscriptionStore((s) => s.setUrl);
  const fetchSubscription = useSubscriptionStore((s) => s.fetchSubscription);

  const authBusy = useAuthStore((s) => s.busy);
  const tg = useAuthStore((s) => s.tg);
  const startTg = useAuthStore((s) => s.startTelegramLogin);
  const cancelTg = useAuthStore((s) => s.cancelTelegramLogin);
  const loginEmail = useAuthStore((s) => s.loginEmail);
  const sessionToken = useAuthStore((s) => s.sessionToken);

  const [expand, setExpand] = useState<ExpandMode>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const lastSessionToken = useRef<string | null>(null);

  // Login успешен — автоматом получаем sub_url через backend и
  // подставляем в subscriptionStore. Юзер сразу видит свою подписку,
  // ничего вручную копировать не надо.
  //
  // Если backend endpoint /v1/auth/sub_url ещё не задеплоен или вернул
  // null — фоллбэк на ручной ввод через "sub-url" expand.
  useEffect(() => {
    if (sessionToken && sessionToken !== lastSessionToken.current) {
      lastSessionToken.current = sessionToken;
      console.log("[Welcome] login OK, fetching /v1/auth/me...");
      void (async () => {
        // Один вызов /v1/auth/me — берём sub_url для подписки + plan/
        // email/telegram_id для authStore (для compact-sub-info).
        const me = await apiFetchAuthMe(sessionToken);
        if (me) {
          useAuthStore.setState({
            plan: me.plan,
            email: me.email,
            telegramId: me.telegram_id,
          });
        }
        const sub = me?.sub_url ?? null;
        if (sub) {
          console.log("[Welcome] got sub_url, auto-filling");
          setSubUrl(sub);
          void fetchSubscription();
        } else {
          console.warn("[Welcome] /v1/auth/me вернул sub_url=null — fallback на ручной ввод");
          setEmailError(
            "Вы вошли. Не удалось автоматически получить ссылку подписки. Скопируйте её из кабинета вручную."
          );
          setExpand("sub-url");
        }
      })();
    }
  }, [sessionToken]);

  // auth-api возвращает loginUrl как `https://t.me/AriyVPN_Bot?start=webauth_xxx`.
  // Для юзеров в сетях где t.me заблокирован (а это весь смысл VPN) browser
  // не загружает страницу даже через system-proxy — Firefox его игнорирует,
  // trial-нода может лежать. Поэтому преобразуем в `tg://resolve?domain=...`
  // — это IPC к установленному Telegram-приложению (использует MTProto со
  // встроенными обходами цензуры). Browser вообще не задействуется.
  //
  // Fallback на оригинальный t.me URL — кнопка «Открыть в браузере» в
  // pending-блоке ниже (для редкого случая когда TG-приложение не установлено).
  const toTgDeepLink = (httpsUrl: string): string => {
    const m = httpsUrl.match(/^https?:\/\/t\.me\/([^/?]+)\?start=(.+)$/i);
    if (!m) return httpsUrl;
    const [, bot, startParam] = m;
    return `tg://resolve?domain=${bot}&start=${startParam}`;
  };

  const onClickTelegram = async () => {
    if (tg) {
      void openUrl(toTgDeepLink(tg.loginUrl)).catch(() => {});
      return;
    }
    const res = await startTg();
    if (res.ok) {
      const fresh = useAuthStore.getState().tg;
      if (fresh) void openUrl(toTgDeepLink(fresh.loginUrl)).catch(() => {});
    } else {
      setEmailError(res.message);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };
  const onDragLeave = () => setDragActive(false);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (expand !== "sub-url") return;
    const dt = e.dataTransfer;
    if (!dt) return;
    let raw = dt.getData("text/uri-list");
    if (raw) raw = raw.split(/\r?\n/).find((l) => l && !l.startsWith("#")) ?? "";
    if (!raw) raw = dt.getData("text/plain");
    raw = raw.trim();
    if (!raw || !/^https?:\/\//i.test(raw)) return;
    setSubUrl(raw);
    void fetchSubscription();
  };

  const onSubmitEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmailError(null);
    if (!email.trim() || !password) return;
    const res = await loginEmail(email, password);
    if (!res.ok) {
      const i18nKey =
        res.code === "invalid_credentials" ? "welcome.login.err.invalidCredentials"
          : res.code === "rate_limited" ? "welcome.login.err.rateLimited"
            : res.code === "bad_input" ? "welcome.login.err.badInput"
              : null;
      setEmailError(i18nKey ? t(i18nKey) : res.message);
    }
  };

  return (
    <div
      className={`welcome ariy-welcome${dragActive ? " is-drag-over" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="ariy-hero">
        <div className="ariy-hero-logo">
          <img src="/logo.png" alt="Ariy VPN" />
        </div>
        <h1 className="ariy-hero-title">Ariy VPN</h1>
        <p className="ariy-hero-subtitle">{t("welcome.heroSubtitle")}</p>
      </div>

      {tg ? (
        <div className="ariy-tg-pending">
          <p className="ariy-tg-pending-title">{t("welcome.login.tgPending")}</p>
          <p className="ariy-tg-pending-hint">{t("welcome.login.tgPendingHint")}</p>
          <button type="button" className="ariy-cta ariy-cta-secondary" onClick={() => openUrl(toTgDeepLink(tg.loginUrl)).catch(() => {})}>
            {t("welcome.login.tgReopen")}
          </button>
          {/* Fallback для редкого случая когда TG-приложение не установлено
              на устройстве — открываем https://t.me/... через дефолтный
              браузер. Если у юзера в сети заблокирован t.me — это не
              сработает, но альтернативы нет, юзер должен поставить TG. */}
          <button type="button" className="ariy-link-btn" onClick={() => openUrl(tg.loginUrl).catch(() => {})}>
            {t("welcome.login.tgOpenInBrowser")}
          </button>
          <button type="button" className="ariy-link-btn" onClick={cancelTg}>
            {t("welcome.login.tgCancel")}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="ariy-cta ariy-cta-tg"
            disabled={authBusy}
            onClick={onClickTelegram}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M9.78 15.7l-.36 4.06c.51 0 .74-.22 1-.48l2.4-2.3 4.99 3.65c.91.5 1.56.24 1.81-.84l3.27-15.31h.01c.29-1.34-.49-1.88-1.39-1.55L1.46 9.97c-1.32.5-1.3 1.23-.23 1.55l4.97 1.55 11.55-7.27c.54-.36 1.04-.16.63.2L9.78 15.7z"
              />
            </svg>
            <span>{t("welcome.login.tg")}</span>
          </button>

          <div className="ariy-divider">
            <span>{t("welcome.login.or")}</span>
          </div>

          <div className="ariy-link-stack">
            <button type="button" className="ariy-link" onClick={() => setExpand(expand === "email" ? null : "email")}>
              {t("welcome.login.email")}
            </button>
            <button type="button" className="ariy-link" onClick={() => setExpand(expand === "sub-url" ? null : "sub-url")}>
              {t("welcome.login.subUrl")}
            </button>
            <button type="button" className="ariy-link ariy-link-dim" onClick={() => openUrl(DASHBOARD_URL).catch(() => {})}>
              {t("welcome.login.register")}
            </button>
          </div>

          {expand === "email" && (
            <form onSubmit={onSubmitEmail} className="ariy-expand-form">
              <input
                type="email"
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("welcome.login.emailPlaceholder")}
                className="input ariy-input"
              />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("welcome.login.passwordPlaceholder")}
                className="input ariy-input"
              />
              <button
                type="submit"
                disabled={authBusy || subLoading || !email.trim() || !password}
                className="ariy-cta ariy-cta-secondary"
              >
                {authBusy || subLoading ? "…" : t("welcome.login.submit")}
              </button>
              {emailError && <pre className="hero-error">{emailError}</pre>}
            </form>
          )}

          {expand === "sub-url" && (
            <div className="ariy-expand-form">
              <input
                type="url"
                autoFocus
                value={subUrl}
                onChange={(e) => setSubUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchSubscription()}
                placeholder="https://sub.example.com/..."
                className="input ariy-input"
              />
              <button
                type="button"
                disabled={subLoading || !subUrl.trim()}
                onClick={() => fetchSubscription()}
                className="ariy-cta ariy-cta-secondary"
              >
                {subLoading ? "…" : t("welcome.load")}
              </button>
              {subError && <pre className="hero-error">{subError}</pre>}
              <p className="welcome-desc welcome-desc-hint">{t("welcome.dropHint")}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
