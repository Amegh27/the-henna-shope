import React, { useState } from "react";
import { adminLogin } from "../services/authService";
import { X, LogIn } from "lucide-react";

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
    <div className="overlay">
      <section className="admin-panel">
        <div className="drawer-head">
          <div>
            <div className="eyebrow">STORE MANAGEMENT</div>
            <h2>Admin Login</h2>
          </div>

          <button className="icon-btn" onClick={onClose}>
            <X />
          </button>
        </div>

        <form className="product-form" onSubmit={handleSubmit}>
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

          {error && <p style={{ color: "red" }}>{error}</p>}

          <button className="button dark" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
            <LogIn size={17} />
          </button>
        </form>
      </section>
    </div>
  );
}
