import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Load user + token on app start
  useEffect(() => {
    const storedUser = localStorage.getItem("palm_user");
    const token = localStorage.getItem("palm_token");

    if (storedUser && token) {
      setUser(JSON.parse(storedUser));

      // ✅ Set token globally for all API calls
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }

    setLoading(false);
  }, []);

  // ✅ LOGIN
  const login = async (email, password) => {
    const { data } = await api.post("/login", { email, password });

    // Save token + user
    localStorage.setItem("palm_token", data.token);
    localStorage.setItem("palm_user", JSON.stringify(data.user));

    // Set token globally
    api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;

    setUser(data.user);
    return data.user;
  };

  // ✅ REGISTER
  const register = async (payload) => {
    const { data } = await api.post("/register", payload);

    localStorage.setItem("palm_token", data.token);
    localStorage.setItem("palm_user", JSON.stringify(data.user));

    // Set token globally
    api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;

    setUser(data.user);
    return data.user;
  };

  // ✅ LOGOUT
  const logout = () => {
    localStorage.removeItem("palm_token");
    localStorage.removeItem("palm_user");

    // Remove token from axios
    delete api.defaults.headers.common["Authorization"];

    setUser(null);
  };

  // ✅ REFRESH USER
  const refreshUser = async () => {
    try {
      const { data } = await api.get("/me");

      localStorage.setItem("palm_user", JSON.stringify(data.user));
      setUser(data.user);

      return data.user;
    } catch (err) {
      console.log("User refresh failed");
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);