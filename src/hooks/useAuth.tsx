import { IUserMe } from "@/@types/user";
import { cookies } from "@/lib/cookies";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { queryClient } from "./query";
import { useAxios } from "./useApi";

type AuthContextType = {
  user: IUserMe | null;
  login: (token: string, redirectUrl?: string) => Promise<void>;
  logout: () => void;
  isLoggedIn: boolean;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => {},
  logout: () => {},
  isLoggedIn: false,
  isLoading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<IUserMe | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const api = useAxios();

  const logout = useCallback(() => {
    cookies.remove("token", { path: "/" });

    setUser(null);
    setIsLoggedIn(false);

    queryClient.clear();
    queryClient.removeQueries();

    toast.success("Logout Berhasil", {
      description: "Anda akan diarahkan ke halaman login.",
    });

    window.location.href = "/";
  }, []);

  useEffect(() => {
    let ignore = false;

    async function checkUserAuth() {
      const token = cookies.get("token");
      if (token) {
        setIsLoggedIn(true);
        try {
          const response = await api.get(
            "auth/me?include=created_by,updated_by,branch,branch.company,roles,permissions,branches",
          );
          if (ignore) return;
          if (response.data && response.data.data) {
            setUser(response.data.data);
          } else {
            logout();
          }
        } catch (error) {
          if (ignore) return;
          console.error("Failed to fetch user:", error);
          logout();
        }
      }
      if (!ignore) setIsLoading(false);
    }

    checkUserAuth();

    return () => {
      ignore = true;
    };
  }, [api, logout]);

  useEffect(() => {
    const interval = setInterval(() => {
      const token = cookies.get("token");
      if (!token && user) {
        logout();
      }
      if (!token && (isLoggedIn || user)) {
        logout();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, logout, isLoggedIn]);

  const login = async (token: string) => {
    cookies.remove("token", { path: "/" });

    cookies.set("token", token, {
      expires: 1,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    setIsLoggedIn(true);

    try {
      const response = await api.get("auth/me?include=client");
      if (response.data && response.data.data) {
        setUser(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch user after login:", error);
    }

    window.location.href = "/dashboard";
  };

  const value = {
    user,
    login,
    logout,
    isLoggedIn,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
