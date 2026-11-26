"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, ApiError } from "@/lib/api";

export type OrganizationRole =
  | "OWNER"
  | "ADMIN"
  | "MANAGER"
  | "ANALYST"
  | "MEMBER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
  currencyCode: string;
  timezone: string;
  role: OrganizationRole;
}

interface AuthSession {
  user: AuthUser;
  organizations: AuthOrganization[];
  expiresAt: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  organizationName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  organizations: AuthOrganization[];
  selectedOrganization: AuthOrganization | null;
  status: "loading" | "authenticated" | "unauthenticated" | "error";
  error: string | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  selectOrganization: (organizationId: string) => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organizations, setOrganizations] = useState<AuthOrganization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    string | null
  >(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback((session: AuthSession) => {
    setUser(session.user);
    setOrganizations(session.organizations);

    setSelectedOrganizationId((currentId) => {
      const currentOrganization = session.organizations.find(
        (organization) => organization.id === currentId,
      );

      return currentOrganization?.id ?? session.organizations[0]?.id ?? null;
    });

    setError(null);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setOrganizations([]);
    setSelectedOrganizationId(null);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const session = await apiRequest<AuthSession>("/api/v1/auth/session");

      setError(null);
      applySession(session);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        clearSession();
        setError(null);
        setStatus("unauthenticated");
        return;
      }

      const message =
        cause instanceof Error
          ? cause.message
          : "Unable to restore your session.";

      setError(message);
      setStatus("error");
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    let active = true;

    apiRequest<AuthSession>("/api/v1/auth/session")
      .then((session) => {
        if (!active) return;

        applySession(session);
      })
      .catch((cause: unknown) => {
        if (!active) return;

        if (cause instanceof ApiError && cause.status === 401) {
          clearSession();
          setError(null);
          setStatus("unauthenticated");
          return;
        }

        const message =
          cause instanceof Error
            ? cause.message
            : "Unable to restore your session.";

        setError(message);
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [applySession, clearSession]);

  const login = useCallback(
    async (input: LoginInput) => {
      setError(null);

      try {
        const session = await apiRequest<AuthSession>("/api/v1/auth/login", {
          method: "POST",
          body: input,
        });

        applySession(session);
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Login failed.";

        setError(message);
        throw cause;
      }
    },
    [applySession],
  );

  const register = useCallback(async (input: RegisterInput) => {
    setError(null);

    try {
      await apiRequest<unknown>("/api/v1/auth/register", {
        method: "POST",
        body: input,
      });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Registration failed.";

      setError(message);
      throw cause;
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);

    try {
      await apiRequest<{ loggedOut: boolean }>("/api/v1/auth/logout", {
        method: "POST",
      });
    } finally {
      clearSession();
      setStatus("unauthenticated");
    }
  }, [clearSession]);

  const selectOrganization = useCallback(
    (organizationId: string) => {
      const organizationExists = organizations.some(
        (organization) => organization.id === organizationId,
      );

      if (!organizationExists) {
        throw new Error("You do not have access to this organization.");
      }

      setSelectedOrganizationId(organizationId);
    },
    [organizations],
  );

  const selectedOrganization =
    organizations.find(
      (organization) => organization.id === selectedOrganizationId,
    ) ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        selectedOrganization,
        status,
        error,
        login,
        register,
        logout,
        selectOrganization,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return context;
}
