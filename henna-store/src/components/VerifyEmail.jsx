import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, ShieldCheck } from "lucide-react";
import {
  verifyEmail,
  resendOTP,
} from "../services/userAuthService";

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!/^\d{6}$/.test(otp)) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);

      await verifyEmail(email, otp);

      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setMessage("");

    try {
      setResending(true);

      const data = await resendOTP(email);

      setMessage(data.message);
      setOtp("");
    } catch (err) {
      setError(err.message || "Unable to resend OTP.");
    } finally {
      setResending(false);
    }
  }

  if (!email) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2>Email address missing</h2>
          <p>Please register again to receive your verification OTP.</p>
          <Link to="/signup" className="auth-back">
            Go to signup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-heading">
          <ShieldCheck size={35} />

          <h1>Verify Your <em>Email</em></h1>

          <p>
            We've sent a 6-digit verification code to:
          </p>

          <p style={{ color: "#294b38", fontWeight: 600 }}>
            <Mail
              size={15}
              style={{ verticalAlign: "middle", marginRight: 6 }}
            />
            {email}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleVerify}>

          <div className="auth-field">
            <label>Enter verification code</label>

            <div className="auth-input">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter 6-digit OTP"
                value={otp}
                maxLength={6}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, ""))
                }
                required
              />
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}

          {message && (
            <p style={{ color: "#294b38", fontSize: 12 }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            className="button dark auth-submit"
            disabled={loading}
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>

        </form>

        <div className="auth-switch">
          Didn't receive the code?
          <button
            type="button"
            className="auth-resend"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? "Sending..." : " Resend OTP"}
          </button>
        </div>

        <Link to="/signup" className="auth-back">
          ← Back to Signup
        </Link>

      </div>
    </div>
  );
}