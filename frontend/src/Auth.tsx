
import { useState } from "react";
import { apiFetch, saveToken } from "./api";
import { Zap, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

interface AuthProps {
  onLogin: (user: {
    name: string;
    email: string;
    role: string;
  }) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isSignup
        ? "/api/auth/signup"
        : "/api/auth/login";

      const body = isSignup
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };

      const response = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed.");
      }

      if (!data.token) {
        throw new Error("Authentication token was not received.");
      }

      saveToken(data.token);

      onLogin({
        name: data.user?.name || data.admin?.name || name,
        email: data.user?.email || data.admin?.email || email,
        role: data.user?.role || data.admin?.role || "User",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span><Zap size={25} /></span>
          <div>
            <strong>NexaFlow<span>.</span></strong>
            <small>BUSINESS MANAGEMENT STUDIO</small>
          </div>
        </div>

        <div className="auth-heading">
          <p className="auth-eyebrow">WELCOME TO NEXAFLOW</p>
          <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p>
            {isSignup
              ? "Start managing your business in one place."
              : "Sign in to access your business workspace."}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={!isSignup ? "active" : ""}
            onClick={() => {
              setIsSignup(false);
              setError("");
            }}
          >
            Login
          </button>

          <button
            type="button"
            className={isSignup ? "active" : ""}
            onClick={() => {
              setIsSignup(true);
              setError("");
            }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <label className="auth-field">
              Full Name
              <input
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </label>
          )}

          <label className="auth-field">
            Email Address
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="auth-field">
            Password
            <div className="auth-password">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {isSignup && (
              <small>Use at least 8 characters.</small>
            )}
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="auth-spinner" size={19} />
            ) : (
              <>
                {isSignup ? "Create Account" : "Sign In"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="auth-footer">
          Secure business workspace · Powered by NexaFlow
        </p>
      </div>
    </div>
  );
}
