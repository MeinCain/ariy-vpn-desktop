import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { useAuthStore } from "../stores/authStore";
import { apiFetchAuthMe, apiFetchTrialVless } from "../lib/ariy-api";
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
  // Тоггл «Прокси для входа в Telegram». Поднимает sing-box TUN c
  // full-tunnel через trial-ноду на 3 минуты — этого хватает чтобы
  // залогиниться, и не оставляет юзера в проксированном состоянии
  // навсегда. По истечении или при успешном логине — авто-выключение.
  const [tgProxyEnabled, setTgProxyEnabled] = useState(false);
  const [tgProxyBusy, setTgProxyBusy] = useState(false);
  const [tgProxyError, setTgProxyError] = useState<string | null>(null);
  const [tgProxyExpiresAt, setTgProxyExpiresAt] = useState<number | null>(null);
  const [, setTgProxyTick] = useState(0);
  const TG_PROXY_DURATION_MS = 3 * 60 * 1000;

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

  // Auto-disconnect trial-TUN при успешном логине ЛЮБЫМ способом:
  //  - TG deep-link / Email login → `sessionToken` non-null (authStore)
  //  - Sub-URL paste → `subUrl` non-empty (subscriptionStore)
  //
  // beta.56: раньше зависимость была только `[sessionToken, tgProxyEnabled]` —
  // при логине через sub-URL trial-TUN продолжал работать до истечения 3 мин
  // или ручного toggle off. Теперь учитываем оба источника "юзер залогинен".
  useEffect(() => {
    if (!tgProxyEnabled) return;
    const isAuthed = Boolean(sessionToken) || Boolean(subUrl);
    if (!isAuthed) return;
    void (async () => {
      try {
        await invoke("disconnect_trial_tun");
      } catch (e) {
        console.warn("[Welcome] disconnect_trial_tun on login failed:", e);
      }
      setTgProxyEnabled(false);
      setTgProxyExpiresAt(null);
    })();
  }, [sessionToken, subUrl, tgProxyEnabled]);

  // Обратный отсчёт. Тикает раз в секунду пока есть expiresAt; по
  // истечении — авто-disconnect. Хранение абсолютного времени (а не
  // remaining) защищает от drift'а если таб встал на паузу.
  useEffect(() => {
    if (tgProxyExpiresAt === null) return;
    const id = window.setInterval(() => {
      const remaining = tgProxyExpiresAt - Date.now();
      if (remaining <= 0) {
        window.clearInterval(id);
        void (async () => {
          try {
            await invoke("disconnect_trial_tun");
          } catch (e) {
            console.warn("[Welcome] auto-disconnect failed:", e);
          }
          setTgProxyEnabled(false);
          setTgProxyExpiresAt(null);
        })();
      } else {
        setTgProxyTick((n) => n + 1);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [tgProxyExpiresAt]);

  const onToggleTgProxy = async (next: boolean) => {
    if (tgProxyBusy) return;
    setTgProxyBusy(true);
    setTgProxyError(null);
    try {
      if (next) {
        const trial = await apiFetchTrialVless();
        if (!trial) throw new Error("сервер недоступен");
        await invoke("connect_trial_tun", {
          host: trial.host,
          port: trial.port,
          uuid: trial.uuid,
          flow: trial.flow,
          sni: trial.sni,
          pbk: trial.pbk,
          sid: trial.sid,
          fp: trial.fp,
        });
        setTgProxyEnabled(true);
        setTgProxyExpiresAt(Date.now() + TG_PROXY_DURATION_MS);
      } else {
        await invoke("disconnect_trial_tun");
        setTgProxyEnabled(false);
        setTgProxyExpiresAt(null);
      }
    } catch (e) {
      console.error("[Welcome] toggle tg-proxy failed:", e);
      setTgProxyError(String((e as Error).message ?? e));
      if (next) {
        setTgProxyEnabled(false);
        setTgProxyExpiresAt(null);
      }
    } finally {
      setTgProxyBusy(false);
    }
  };

  const tgProxyRemainingLabel = (() => {
    if (tgProxyExpiresAt === null) return null;
    const remaining = Math.max(0, tgProxyExpiresAt - Date.now());
    const total = Math.ceil(remaining / 1000);
    const mm = Math.floor(total / 60);
    const ss = total % 60;
    return `${mm}:${ss.toString().padStart(2, "0")}`;
  })();

  // beta.35: trial-proxy управляется тумблером выше. `onClickTelegram` теперь
  // просто стартует TG-poll и открывает t.me/login через дефолтный browser.
  // Если у юзера тумблер ON → trial-TUN активен → t.me грузится через нашу
  // ноду на network layer (любой browser/приложение). Если OFF → юзер
  // ходит напрямую (если у него Telegram и так работает).
  const onClickTelegram = async () => {
    if (tg) {
      void openUrl(tg.loginUrl).catch(() => {});
      return;
    }
    const res = await startTg();
    if (res.ok) {
      const fresh = useAuthStore.getState().tg;
      if (fresh) void openUrl(fresh.loginUrl).catch(() => {});
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
          <button type="button" className="ariy-cta ariy-cta-secondary" onClick={() => openUrl(tg.loginUrl).catch(() => {})}>
            {t("welcome.login.tgReopen")}
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

          {/* Тоггл «Прокси для входа в Telegram». Поднимает full-tunnel
              через trial-ноду на 3 минуты с обратным отсчётом. По истечении
              или при успешном логине автоматом выключается. */}
          <label className="ariy-tg-proxy-toggle">
            <input
              type="checkbox"
              className="ariy-toggle-input"
              checked={tgProxyEnabled}
              disabled={tgProxyBusy}
              onChange={(e) => void onToggleTgProxy(e.target.checked)}
            />
            <span className="ariy-toggle-slider" aria-hidden="true"></span>
            <span className="ariy-tg-proxy-toggle-label">
              {tgProxyBusy
                ? t("welcome.login.tgProxyConnecting")
                : tgProxyEnabled
                  ? tgProxyRemainingLabel
                    ? `${t("welcome.login.tgProxyOn")} · ${tgProxyRemainingLabel}`
                    : t("welcome.login.tgProxyOn")
                  : t("welcome.login.tgProxyOff")}
            </span>
          </label>
          {tgProxyError && (
            <p className="ariy-tg-proxy-error">
              {t("welcome.login.tgProxyError")}: {tgProxyError}
            </p>
          )}

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
