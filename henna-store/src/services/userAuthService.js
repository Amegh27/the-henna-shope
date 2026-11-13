import API from "../api";

// CUSTOMER SIGNUP
export const userSignup = async (name, email, password) => {
  const response = await fetch(`${API}/users/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Signup failed");
  }

  return data;
};

// VERIFY EMAIL
export const verifyEmail = async (email, otp) => {
  const response = await fetch(`${API}/users/auth/verify-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, otp }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Verification failed");
  }

  localStorage.setItem("userToken", data.token);
  localStorage.setItem("userData", JSON.stringify(data.user));

  return data;
};

// RESEND OTP
export const resendOTP = async (email) => {
  const response = await fetch(`${API}/users/auth/resend-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to resend OTP");
  }

  return data;
};

// CUSTOMER LOGIN
export const userLogin = async (email, password) => {
  const response = await fetch(`${API}/users/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }

  localStorage.setItem("userToken", data.token);
  localStorage.setItem("userData", JSON.stringify(data.user));

  return data;
};

// CUSTOMER LOGOUT
export const userLogout = () => {
  localStorage.removeItem("userToken");
  localStorage.removeItem("userData");
};

// GET CURRENT CUSTOMER
export const getCurrentUser = () => {
  const user = localStorage.getItem("userData");
  return user ? JSON.parse(user) : null;
};

// CHECK LOGIN STATUS
export const isUserLoggedIn = () => {
  return Boolean(localStorage.getItem("userToken"));
};