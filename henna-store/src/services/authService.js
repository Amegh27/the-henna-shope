import API from "../api";

async function parseResponse(response) {
  const text = await response.text();

  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Server returned an invalid response. Status: ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data;
}

export const adminLogin = async (email, password) => {
  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await parseResponse(response);

  if (!data.token || !data.admin) {
    throw new Error("Invalid login response from server.");
  }

  localStorage.setItem("adminToken", data.token);
  localStorage.setItem("adminData", JSON.stringify(data.admin));

  return data;
};

export const getAdminProfile = async () => {
  const token = localStorage.getItem("adminToken");

  if (!token) {
    throw new Error("No admin session found.");
  }

  const response = await fetch(`${API}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseResponse(response);

  return data.admin;
};

export const adminLogout = () => {
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminData");
};
