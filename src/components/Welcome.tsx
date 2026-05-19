import { useState, type DragEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { useAuthStore } from "../stores/authStore";
import { buildSubUrl } from "../lib/ariy-api";
import { DASHBOARD_URL } from "../lib/constants";

/**
 * Карточка первого запуска для Ariy VPN.
 *
 * Поддерживает три способа входа:
 *   1. **Email / password** (default) — POST /v1/auth/email/login через
 *      [[authStore]]. После успеха sub_url = `buildSubUrl(session_token)`
 *      и сразу триггерится existing subscription flow.
 *   2. **Telegram deep-link** — placeholder, готовим в v0.2.0
 *      (нужен polling /v1/auth/telegram/poll).
 *   3. **Прямая ссылка подписки** — legacy fallback для тех у кого
 *      sub-URL без auth. Сохранён старый drag-and-drop.
 */
type Mode = "email" | "sub-url";

export function Welcome() {
  const { t } = useTranslation();

  // Subscription store (legacy sub-URL path)
  const subUrl = useSubscriptionStore((s) => s.url);
  const subLoading = useSubscriptionStore((s) => s.loading);
  const subError = useSubscriptionStore((s) => s.error);
  const setSubUrl = useSubscriptionStore((s) => s.setUrl);
  const fetchSubscription = useSubscriptionStore((s) => s.fetchSubscription);

  // Auth store (email path)
  const authBusy = useAuthStore((s) => s.busy);
  const loginEmail = useAuthStore((s) => s.loginEmail);

  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };
  const onDragLeave = () => setDragActive(false);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (mode !== "sub-url") return; // drag-drop работает только в legacy
    const dt = e.dataTransfer;
    if (!dt) return;
    let raw = dt.getData("text/uri-list");
    if (raw) raw = raw.split(/\r?\n/).find((l) => l && !l.startsWith("#")) ?? "";
    if (!raw) raw = dt.getData("text/plain");
    raw = raw.trim();
    if (!raw) return;
    if (!/^https?:\/\//i.test(raw)) return;
    setSubUrl(raw);
    void fetchSubscription();
  };

  const onSubmitEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmailError(null);
    if (!email.trim() || !password) return;
    const res = await loginEmail(email, password);
    if (!res.ok) {
      // Маппим коды в i18n-ключи где есть, иначе показываем raw сообщение.
      const i18nKey =
        res.code === "invalid_credentials"
          ? "welcome.login.err.invalidCredentials"
          : res.code === "rate_limited"
            ? "welcome.login.err.rateLimited"
            : res.code === "bad_input"
              ? "welcome.login.err.badInput"
              : null;
      setEmailError(i18nKey ? t(i18nKey) : res.message);
      return;
    }
    // Логин успешен — собираем sub_url и кидаем в существующий flow.
    // backend endpoint GET /v1/sub/<token> ещё не задеплоен на auth-api;
    // когда задеплоится — subscription.rs парсер скачает контент по
    // этому URL и всё заработает as-is.
    const sessionToken = useAuthStore.getState().sessionToken;
    if (sessionToken) {
      setSubUrl(buildSubUrl(sessionToken));
      void fetchSubscription();
    }
  };

  return (
    <div
      className={`welcome${dragActive ? " is-drag-over" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="welcome-tag">— {t("welcome.tag")}</div>
      <h2 className="welcome-title">{t("welcome.title")}</h2>

      {mode === "email" ? (
        <form onSubmit={onSubmitEmail} className="welcome-login-form" style={{ marginTop: 12 }}>
          <p className="welcome-desc">{t("welcome.login.intro")}</p>
          <input
            type="email"
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("welcome.login.emailPlaceholder")}
            className="input"
            style={{ marginTop: 8 }}
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("welcome.login.passwordPlaceholder")}
            className="input"
            style={{ marginTop: 8 }}
          />
          <button
            type="submit"
            disabled={authBusy || subLoading || !email.trim() || !password}
            className="btn-ghost"
            style={{ marginTop: 8, width: "100%" }}
          >
            {authBusy || subLoading ? "…" : t("welcome.login.submit")}
          </button>
          {emailError && <pre className="hero-error" style={{ marginTop: 8 }}>{emailError}</pre>}

          <div className="welcome-login-links" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <button type="button" className="link-btn" onClick={() => openUrl(DASHBOARD_URL).catch(() => {})}>
              {t("welcome.login.register")}
            </button>
            <button type="button" className="link-btn" onClick={() => setMode("sub-url")}>
              {t("welcome.login.useSubUrl")}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="welcome-desc">
            {t("welcome.desc.before")}&nbsp;
            <span className="bracket">https://sub.example.com/...</span>
            {t("welcome.desc.after")}
          </p>
          <p className="welcome-desc welcome-desc-hint">{t("welcome.dropHint")}</p>
          <div className="row-input" style={{ marginTop: 8 }}>
            <input
              type="url"
              autoFocus
              value={subUrl}
              onChange={(e) => setSubUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchSubscription()}
              placeholder="https://sub.example.com/..."
              className="input"
            />
            <button
              type="button"
              disabled={subLoading || !subUrl.trim()}
              onClick={() => fetchSubscription()}
              className="btn-ghost"
            >
              {subLoading ? "…" : t("welcome.load")}
            </button>
          </div>
          {subError && <pre className="hero-error">{subError}</pre>}
          <div style={{ marginTop: 12 }}>
            <button type="button" className="link-btn" onClick={() => setMode("email")}>
              {t("welcome.login.backToEmail")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
