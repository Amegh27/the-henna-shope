import React, { useState } from "react";
import { adminLogin } from "../services/authService";
import { X, LogIn, ShieldCheck } from "lucide-react";

export default function AdminLogin({ onLogin, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const data = await adminLogin(email, password);
      onLogin(data.admin);
    } catch (err) {
      setError(err.message || "Unable to login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-screen">
      <style>{`
        .admin-login-screen {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          box-sizing: border-box;
          overflow-y: auto;
          background:
            radial-gradient(circle at 15% 15%, rgba(178,138,80,0.14), transparent 35%),
            radial-gradient(circle at 85% 85%, rgba(41,75,56,0.13), transparent 35%),
            #f8f5eb;
          z-index: 99999;
        }

        .admin-login-screen *,
        .admin-login-screen *::before,
        .admin-login-screen *::after {
          box-sizing: border-box;
        }

        .admin-login-card {
          width: 100%;
          max-width: 460px;
          background: #fffdf7;
          padding: 42px;
          border-radius: 20px;
          border: 1px solid #e8e2d5;
          box-shadow: 0 25px 70px rgba(31,57,43,0.12);
        }

        .admin-login-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 34px;
        }

        .admin-login-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 22px;
          color: #294b38;
        }

        .admin-login-brand-icon {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #e8eee4;
        }

        .admin-login-eyebrow {
          color: #a17c48;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
          margin-bottom: 8px;
        }

        .admin-login-title {
          color: #294b38;
          font-size: 30px;
          line-height: 1.2;
          margin: 0;
        }

        .admin-login-subtitle {
          color: #77796e;
          font-size: 14px;
          margin-top: 10px;
          line-height: 1.6;
        }

        .admin-login-close {
          border: 1px solid #e8e2d5;
          background: transparent;
          color: #294b38;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .admin-login-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .admin-login-form label {
          color: #294b38;
          font-size: 13px;
          font-weight: 600;
          margin-top: 8px;
        }

        .admin-login-form input {
          width: 100%;
          min-height: 50px;
          padding: 0 15px;
          border: 1px solid #dedfd5;
          border-radius: 9px;
          background: #fff;
          color: #292b24;
          font-size: 14px;
          outline: none;
        }

        .admin-login-form input:focus {
          border-color: #294b38;
          box-shadow: 0 0 0 3px rgba(41,75,56,0.08);
        }

        .admin-login-submit {
          width: 100%;
          min-height: 52px;
          margin-top: 18px;
          border: none;
          border-radius: 9px;
          background: #294b38;
          color: white;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
        }

        .admin-login-submit:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .admin-login-error {
          color: #b42318;
          font-size: 13px;
          margin: 5px 0 0;
        }

        .admin-login-footer {
          text-align: center;
          margin-top: 28px;
          color: #88897e;
          font-size: 11px;
          letter-spacing: 1px;
        }

        @media (max-width: 520px) {
          .admin-login-screen {
            padding: 16px;
          }

          .admin-login-card {
            padding: 28px 22px;
          }

          .admin-login-title {
            font-size: 26px;
          }
        }
      `}</style>

      <section className="admin-login-card">
        <div className="admin-login-header">
          <div>
            <div className="admin-login-brand">
              <div className="admin-login-brand-icon">
                <ShieldCheck size={23} />
              </div>
              <span style={{ fontWeight: 700, letterSpacing: "1px" }}>
                THE HENNA SHOPE
              </span>
            </div>

            <div className="admin-login-eyebrow">
              STORE MANAGEMENT
            </div>

            <h2 className="admin-login-title">Welcome Back</h2>

            <p className="admin-login-subtitle">
              Sign in to access your store dashboard.
            </p>
          </div>

          <button
            className="admin-login-close"
            onClick={onClose}
            type="button"
            aria-label="Close admin login"
          >
            <X size={19} />
          </button>
        </div>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label>Email Address</label>

          <input
            type="email"
            placeholder="Enter admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="admin-login-error">{error}</p>
          )}

          <button
            className="admin-login-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login to Dashboard"}
            <LogIn size={17} />
          </button>
        </form>

        <div className="admin-login-footer">
          SECURE ADMIN ACCESS
        </div>
      </section>
    </div>
  );
}