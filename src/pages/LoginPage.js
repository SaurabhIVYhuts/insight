import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./LoginPage.css";

// Standalone sign-in for the Market Insight dashboard. Posts to the same
// /api/auth/* endpoints the main app uses (api/_lib/routes/auth/*), against
// the same Redis session store — so an existing internal-team account works
// here unchanged. The dashboard itself (src/pages/insight/InsightPage.js)
// still enforces the internal-role requirement server-side on every data
// call; this form only obtains the session cookie.
const PHONE_RE = /^(?:\+91)?[6-9]\d{9}$/;

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/insight";
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // login | signup
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    let normalizedPhone;
    if (mode === "signup") {
      normalizedPhone = form.phone.replace(/[\s-]/g, "").trim();
      if (!normalizedPhone || !PHONE_RE.test(normalizedPhone)) {
        setError("Enter a valid 10-digit mobile number, e.g. 9876543210 or +919876543210.");
        return;
      }
    }

    setStatus("sending");
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "login"
          ? { email: form.email.trim(), password: form.password }
          : { name: form.name.trim(), email: form.email.trim(), phone: normalizedPhone, password: form.password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  return (
    <div className="mi-login-page">
      <div className="mi-login-card">
        <div className="mi-login-brand">
          <span className="mi-login-dot" />
          IVYHUTS <strong>Market Insight</strong>
        </div>

        <div className="mi-login-tabs">
          <button
            type="button"
            className={`mi-login-tab${mode === "login" ? " active" : ""}`}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Log In
          </button>
          <button
            type="button"
            className={`mi-login-tab${mode === "signup" ? " active" : ""}`}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Sign Up
          </button>
        </div>

        <p className="mi-login-sub">
          {mode === "login"
            ? "Sign in with an internal team account to open the dashboard."
            : "Create an account. An admin still has to grant it an internal role before the dashboard will load."}
        </p>

        <form className="mi-login-form" onSubmit={handleSubmit} noValidate>
          {mode === "signup" && (
            <label className="mi-login-field">
              <span>Full name</span>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required />
            </label>
          )}
          {mode === "signup" && (
            <label className="mi-login-field">
              <span>Mobile number</span>
              <input
                type="tel"
                inputMode="tel"
                placeholder="9876543210 or +919876543210"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                maxLength={15}
                required
              />
            </label>
          )}
          <label className="mi-login-field">
            <span>Email address</span>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={100} required />
          </label>
          <label className="mi-login-field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              minLength={mode === "signup" ? 8 : undefined}
              required
            />
          </label>

          {error && <div className="mi-login-error">{error}</div>}

          <button type="submit" className="mi-login-submit" disabled={status === "sending"}>
            {status === "sending" ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
