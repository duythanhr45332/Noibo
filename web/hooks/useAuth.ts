"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

interface AuthUser {
  user_id: string;
  role_id: number;
  username: string;
  role: string;
  [key: string]: any;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const token = Cookies.get("token");
    if (token) {
      try {
        const decoded = jwtDecode<AuthUser>(token);
        setUser(decoded);
        setIsAuthenticated(true);
      } catch (e) {
        console.error("Invalid token", e);
        setIsAuthenticated(false);
      }
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  return { user, isAuthenticated };
}
