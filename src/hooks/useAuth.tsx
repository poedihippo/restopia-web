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
import api from "./useApi";
import { authService } from "@/services/auth.service";
import { setPricePermission } from "@/utils/price";
import { matchesAnyPermission } from "@/lib/permissions";
import { sortBranches } from "@/utils/branchOrder";

// Branch pickers fed from auth/me (top-bar switcher, report filters) use the business order.
const withSortedBranches = (u: any) =>
  Array.isArray(u?.branches) ? { ...u, branches: sortBranches(u.branches) } : u;

type AuthContextType = {
  user: IUserMe | null;
  login: (token: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => void;
  isLoggedIn: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  isSuperadmin: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => { },
  logout: () => { },
  refreshUser: () => { },
  isLoggedIn: false,
  isLoading: true,
  hasPermission: () => false,
  isSuperadmin: false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<IUserMe | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const logout = useCallback(async (reason?: "expired" | "manual") => {
    try {
      const token = cookies.get("token");
      if (token) {
        await authService.revoke();
      }
    } catch (e) {
      console.error("Failed to revoke token:", e);
    }

    const cookieOpts = {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    };

    cookies.remove("token", cookieOpts);
    cookies.remove("refresh_token", cookieOpts);
    cookies.remove("session_start", cookieOpts);

    setUser(null);
    setIsLoggedIn(false);
    setPricePermission(false);

    queryClient.clear();
    queryClient.removeQueries();

    if (reason === "expired") {
      toast.error("Sesi Berakhir", {
        description:
          "Sesi Anda telah berakhir setelah 12 jam. Silakan login kembali.",
      });
    } else {
      toast.success("Logout Berhasil", {
        description: "Anda akan diarahkan ke halaman login.",
      });
    }

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
            const userData = withSortedBranches(response.data.data);
            setUser(userData);
            setPricePermission(
              userData.type === "superadmin" || 
              matchesAnyPermission((userData.permissions ?? []).map((p: any) => p.name), "common.price.read")
            );
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
    const SESSION_MAX_MS = 12 * 60 * 60 * 1000;

    const interval = setInterval(() => {
      const token = cookies.get("token");
      if (!token && (isLoggedIn || user)) {
        logout();
        return;
      }

      const sessionStart = cookies.get("session_start");
      if (sessionStart && Date.now() - Number(sessionStart) >= SESSION_MAX_MS) {
        logout("expired");
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, logout, isLoggedIn]);

  const login = async (token: string, refreshToken: string) => {
    const cookieOpts = {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    };

    cookies.remove("token", cookieOpts);
    cookies.remove("refresh_token", cookieOpts);
    cookies.remove("session_start", cookieOpts);

    cookies.set("token", token, {
      expires: 1,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    cookies.set("refresh_token", refreshToken, {
      expires: 7,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    cookies.set("session_start", String(Date.now()), {
      expires: 1,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    setIsLoggedIn(true);

    try {
      const response = await api.get(
        "auth/me?include=created_by,updated_by,branch,branch.company,roles,permissions,branches",
      );
      if (response.data && response.data.data) {
        const userData = withSortedBranches(response.data.data);
        setUser(userData);
        setPricePermission(
          userData.type === "superadmin" || 
          matchesAnyPermission((userData.permissions ?? []).map((p: any) => p.name), "common.price.read")
        );
      }
    } catch (error) {
      console.error("Failed to fetch user after login:", error);
    }

    window.location.href = "/dashboard";
  };

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get(
        "auth/me?include=created_by,updated_by,branch,branch.company,roles,permissions,branches"
      );
      if (response.data && response.data.data) {
        const userData = withSortedBranches(response.data.data);
        setUser(userData);
        setPricePermission(
          userData.type === "superadmin" || 
          matchesAnyPermission((userData.permissions ?? []).map((p: any) => p.name), "common.price.read")
        );
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }, [api]);


  const isSuperadmin = user?.type === "superadmin";

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      if (user.type === "superadmin") return true;

      const granted = (user.permissions ?? []).map((p: any) => p.name).filter(Boolean);
      return matchesAnyPermission(granted, permission);
    },
    [user],
  );

  const value = {
    user,
    login,
    logout,
    refreshUser,
    isLoggedIn,
    isLoading,
    hasPermission,
    isSuperadmin,
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
