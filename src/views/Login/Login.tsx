'use client'

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Controller } from "react-hook-form";
import useLogin from "./useLogin";

const css = `
  .login-root {
    display: grid; min-height: 100svh; grid-template-columns: 1fr;
    font-family: var(--font-sans);
    background:
      radial-gradient(600px 400px at 0% 0%, var(--accent-light-bg), transparent 70%),
      var(--surface-raised);
  }
  @media (min-width: 1024px) {
    .login-root { grid-template-columns: 1fr 1fr; }
  }
  .login-input {
    width: 100%; height: 42px; padding: 0 14px;
    border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
    border-radius: var(--radius-md);
    background: var(--surface-raised); color: var(--foreground);
    font-size: 14px; font-family: inherit; outline: none;
    transition: border-color .15s, box-shadow .15s;
  }
  .login-input::placeholder { color: var(--foreground-subtle); }
  .login-input:focus { border-color: var(--caramel); box-shadow: 0 0 0 3px var(--accent-light-bg); }
  .login-input[aria-invalid="true"] { border-color: var(--destructive); }
  .login-input[aria-invalid="true"]:focus { box-shadow: 0 0 0 3px var(--destructive-bg); }
  .login-submit { transition: background .15s, transform .15s; }
  .login-submit:hover:not(:disabled) { background: var(--cocoa-700) !important; }
  .login-submit:active:not(:disabled) { transform: translateY(1px); }
  .login-eye:hover { color: var(--foreground) !important; }

  @keyframes login-spin { to { transform: rotate(360deg); } }
  @keyframes login-drift { 0%, 100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-10px) rotate(-5deg); } }
  .login-bigcake {
    position: absolute; left: -90px; bottom: -60px; width: 560px; height: auto;
    pointer-events: none; z-index: 0; transform: rotate(-6deg); transform-origin: 30% 100%;
    filter: drop-shadow(0 30px 40px rgba(42, 26, 19, 0.12));
  }
  @media (max-width: 640px) { .login-bigcake { width: 380px; left: -80px; bottom: -40px; } }
  .login-grain {
    position: absolute; inset: -50%; pointer-events: none; opacity: 0.08; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  }
  @keyframes login-kenburns { from { transform: scale(1.04) translate(0, 0); } to { transform: scale(1.14) translate(-2%, -1.5%); } }
  @keyframes login-grain { 0%, 100% { transform: translate(0, 0); } 25% { transform: translate(-3%, 2%); } 50% { transform: translate(2%, -3%); } 75% { transform: translate(-2%, -1%); } }
  @keyframes login-rec { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
  @keyframes login-title-in { from { opacity: 0; transform: translateY(18px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
  @keyframes login-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: no-preference) {
    .login-kenburns { animation: login-kenburns 24s ease-in-out infinite alternate; }
    .login-grain { animation: login-grain 0.8s steps(4) infinite; }
    .login-rec { animation: login-rec 1.6s ease-in-out infinite; }
    .login-title { animation: login-title-in 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both; }
    .login-bigcake { animation: login-drift 9s ease-in-out infinite; }
    .login-form { animation: login-in 500ms cubic-bezier(0.16, 1, 0.3, 1); }
  }
`;

// Oversized, faded cake silhouette that sits behind the form in the bottom-left corner.
function BigCakeShadow() {
  return (
    <svg viewBox="0 0 220 150" aria-hidden="true" className="login-bigcake">
      <defs>
        <linearGradient id="login-bigcake-fade" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--cocoa-700)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--cocoa-700)" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="login-bigcake-cream" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--caramel)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--caramel)" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <rect x="40" y="128" width="140" height="8" rx="4" fill="url(#login-bigcake-cream)" />
      <path d="M52 92h116v36H52z" fill="url(#login-bigcake-fade)" />
      <path d="M52 92h116v8c-8 0-8 10-16 10s-8-10-16-10-8 14-16 14-8-14-16-14-8 10-16 10-8-10-16-10-8 12-16 12-4-8-4-8z" fill="url(#login-bigcake-cream)" />
      <path d="M64 58h92v34H64z" fill="url(#login-bigcake-fade)" />
      <path d="M64 58h92v6c-6 0-6 9-12 9s-6-9-12-9-6 13-12 13-6-13-12-13-6 9-12 9-6-9-12-9-6 11-12 11-4-6-4-6z" fill="url(#login-bigcake-cream)" />
      <circle cx="110" cy="50" r="8" fill="url(#login-bigcake-fade)" />
      <rect x="84" y="36" width="4" height="22" rx="2" fill="url(#login-bigcake-fade)" />
      <rect x="132" y="36" width="4" height="22" rx="2" fill="url(#login-bigcake-fade)" />
    </svg>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--foreground)",
};

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--destructive)",
  margin: 0,
};

const Login = () => {
  const { form, isLoading, isRedirecting, onSubmit, showPassword, setShowPassword } =
    useLogin();

  return (
    <div className="login-root">
      <style>{css}</style>

      {/* Form side */}
      <div style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", padding: "28px 32px" }}>
        <BigCakeShadow />
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.webp" alt="" width={32} height={32} style={{ borderRadius: "var(--radius-md)" }} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em", color: "var(--cocoa-900)" }}>
              DAPUR COKELAT
            </span>
            <span style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--caramel)", marginTop: 2 }}>
              EST. 2001
            </span>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="login-form"
            style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 20 }}
          >
            <div style={{ marginBottom: 8 }}>
              <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 26, fontWeight: 700, color: "var(--foreground)", margin: 0, letterSpacing: "-0.03em" }}>
                Welcome back
              </h1>
              <p style={{ fontSize: 14, color: "var(--foreground-muted)", margin: "6px 0 0" }}>
                Sign in to continue to your workspace.
              </p>
            </div>

            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="email" style={labelStyle}>Email</label>
                  <input
                    {...field}
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@company.com"
                    className="login-input"
                    aria-invalid={!!fieldState.error}
                  />
                  {fieldState.error && <p style={errorStyle}>{fieldState.error.message}</p>}
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="password"
              render={({ field, fieldState }) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="password" style={labelStyle}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      {...field}
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="login-input"
                      style={{ paddingRight: 42 }}
                      aria-invalid={!!fieldState.error}
                    />
                    <button
                      type="button"
                      className="login-eye"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      data-fast-click
                      style={{
                        position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                        width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                        background: "transparent", border: "none", cursor: "pointer",
                        color: "var(--foreground-subtle)", borderRadius: "var(--radius-sm)",
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldState.error && <p style={errorStyle}>{fieldState.error.message}</p>}
                </div>
              )}
            />

            <button
              type="submit"
              disabled={isLoading}
              className="login-submit"
              style={{
                marginTop: 4, height: 42, width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: "var(--cocoa-900)", color: "#fff", border: "none",
                borderRadius: "var(--radius-md)", fontSize: 14, fontWeight: 600,
                fontFamily: "inherit", cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.75 : 1,
                boxShadow: "0 6px 16px rgba(42, 26, 19, 0.18)",
              }}
            >
              {isLoading && <Loader2 size={16} style={{ animation: "login-spin 1s linear infinite" }} />}
              {isRedirecting ? "Opening dashboard…" : isLoading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p style={{ position: "relative", zIndex: 1, fontSize: 12, color: "var(--foreground-subtle)", margin: 0 }}>
          © {new Date().getFullYear()} Dapur Cokelat
        </p>
      </div>

      <div className="bg-muted relative hidden lg:block" style={{ overflow: "hidden" }}>
        <img
          src="/dapur.webp"
          alt="Image"
          className="login-kenburns absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />

        {/* Cinematic treatment: vignette, bottom fade, film grain, letterbox bars, title card */}
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background:
              "linear-gradient(to bottom, rgba(20, 12, 8, 0.7) 0%, transparent 22%)," +
              "radial-gradient(ellipse at 50% 40%, transparent 45%, rgba(10, 6, 4, 0.55) 100%)," +
              "linear-gradient(to top, rgba(20, 12, 8, 0.92) 0%, rgba(20, 12, 8, 0.45) 35%, transparent 60%)",
          }}
        />
        <div aria-hidden className="login-grain" />
        <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 28, background: "#0b0705" }} />
        <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 28, background: "#0b0705" }} />

        <div style={{ position: "absolute", top: 48, left: 48, right: 48, display: "flex", alignItems: "center", justifyContent: "space-between", color: "rgba(255, 255, 255, 0.85)", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="login-rec" style={{ width: 7, height: 7, borderRadius: 999, background: "#E5484D" }} />
            Since 2001
          </span>
          <span>Bakery Management Platform</span>
        </div>

        <div className="login-title" style={{ position: "absolute", left: 48, right: 48, bottom: 64, color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{ width: 32, height: 1, background: "var(--caramel)" }} />
            <span style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--caramel)", fontWeight: 600 }}>
              Dapur Cokelat
            </span>
          </div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 40, lineHeight: 1.1, fontWeight: 700, letterSpacing: "-0.035em", margin: 0, maxWidth: 480 }}>
            Crafted with chocolate.
            <br />
            <span style={{ color: "rgba(255, 255, 255, 0.55)" }}>Run with precision.</span>
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: "16px 0 0", maxWidth: 420, color: "rgba(255, 255, 255, 0.7)" }}>
            Sales, production, stock and transfers for every outlet — one workspace.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
