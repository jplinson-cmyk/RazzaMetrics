import React, { useEffect, useState } from "react";
import { Chrome, FileCheck2, LayoutDashboard, Link2, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { Logo } from "../brand/Logo";
import { ContourField } from "./ContourField";

// What the app does, in the order a consultant uses it. Kept to features that exist.
const TOOLS = [
  { icon: LayoutDashboard, name: "Site Explorer overview", line: "Traffic, keywords, referring domains and site health for each domain." },
  { icon: Search, name: "Organic keywords and top pages", line: "Read straight from your verified Search Console properties." },
  { icon: Link2, name: "Backlink profile", line: "Imported link data, new and lost domains, and a toxicity review." },
  { icon: FileCheck2, name: "Site audit", line: "Crawl findings tracked as issues until they are fixed." },
];

export const LoginModal: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
  const { login, loginManually, loading } = useAuth();
  const [configured, setConfigured] = useState(false);
  const [manualConfigured, setManualConfigured] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ googleConfigured: boolean; manualConfigured: boolean }>("/config")
      .then((c) => {
        setConfigured(c.googleConfigured);
        setManualConfigured(c.manualConfigured);
        if (!c.googleConfigured && !c.manualConfigured)
          setError(
            "Configure Google OAuth and APP_ENCRYPTION_KEY on the server. See docs/setup.md.",
          );
      })
      .catch((e) => setError(e.message));
  }, []);
  if (!isOpen) return null;
  return (
    <div className="login">
      <section className="login-story" aria-labelledby="login-story-title">
        <ContourField />
        <div className="login-wordmark">
          <Logo size={32} />
        </div>
        <div className="login-pitch">
          <h2 id="login-story-title">Every client site, read in one place.</h2>
          <p>Search Console, backlinks and site audits for each domain Razza Consulting manages.</p>
          <ul className="login-tools">
            {TOOLS.map(({ icon: Icon, name, line }) => (
              <li key={name}>
                <Icon className="login-tool-icon" aria-hidden="true" />
                <span>
                  <strong>{name}</strong>
                  <span>{line}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="login-foot">© 2026 Razza Consulting Group Inc.</p>
      </section>

      <main className="login-side">
        <div className="login-card">
          <h1>Razza Metrics</h1>
          <p className="login-lede">Sign in with your Razza Consulting account.</p>

          <button
            type="button"
            onClick={login}
            disabled={loading || submitting || !configured}
            className="login-key login-key--google"
          >
            <Chrome className="w-4 h-4" aria-hidden="true" />
            {loading ? "Checking session…" : "Continue with Google"}
          </button>
          <p className="login-note">Google sign-in is limited to verified @razzaconsulting.com addresses.</p>

          <div className="login-or" aria-hidden="true"><span>or with a username</span></div>

          <form
            className="login-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setSubmitting(true);
              try {
                await loginManually(username, password);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Sign in failed.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <label className="login-field">
              <span>Username</span>
              <input
                name="username"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label className="login-field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="login-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || submitting || !manualConfigured}
              className="login-key login-key--primary"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
