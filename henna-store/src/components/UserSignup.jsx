import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, User, Mail, Lock } from "lucide-react";
import { userSignup } from "../services/userAuthService";

export default function UserSignup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    try {
      setLoading(true);

      await userSignup(
        formData.name,
        formData.email,
        formData.password
      );

      navigate("/verify-email", {
        state: { email: formData.email.trim().toLowerCase() },
      });

    } catch (err) {
      setError(err.message || "Unable to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-heading">
          <span className="eyebrow">JOIN OUR COMMUNITY</span>

          <h1>Create Your <em>Account</em></h1>

          <p>
            Create an account to explore our collection of
            handcrafted henna products.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>

          <div className="auth-field">
            <label>Full Name</label>

            <div className="auth-input">
              <User size={17} />

              <input
                type="text"
                name="name"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label>Email Address</label>

            <div className="auth-input">
              <Mail size={17} />

              <input
                type="email"
                name="email"
                placeholder="Enter your real email address"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label>Password</label>

            <div className="auth-input">
              <Lock size={17} />

              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
                minLength={8}
                required
              />

              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label>Confirm Password</label>

            <div className="auth-input">
              <Lock size={17} />

              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />

              <button
                type="button"
                className="auth-eye"
                onClick={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="button dark auth-submit"
            disabled={loading}
          >
            {loading ? "Sending OTP..." : "Create Account"}
          </button>

        </form>

        <div className="auth-switch">
          Already have an account?
          <Link to="/login"> Sign In</Link>
        </div>

        <Link to="/" className="auth-back">
          ← Back to Store
        </Link>

      </div>
    </div>
  );
}