import { useAuth } from "./useAuth";
import { matchesAnyPermission } from "@/lib/permissions";

const BYPASS_TYPES = ["superadmin"];

/**
 * Legacy CRUD permission helper (used by the MIXED/older views).
 * Delegates to the shared matcher in @/lib/permissions so it can never drift
 * away from useAuth.hasPermission / sidebar / route-guard behaviour.
 */
const usePermission = () => {
  const { user, hasPermission } = useAuth();

  const isSuperAdmin = BYPASS_TYPES.includes(user?.type ?? "");
  const granted = (user?.permissions ?? []).map((p: any) => p.name).filter(Boolean);

  const can = (permission: string) =>
    isSuperAdmin || matchesAnyPermission(granted, permission);
  const canRead = (resource: string) =>
    isSuperAdmin || hasPermission(`${resource}.read`);
  const canCreate = (resource: string) =>
    isSuperAdmin || hasPermission(`${resource}.create`);
  const canUpdate = (resource: string) =>
    isSuperAdmin || hasPermission(`${resource}.update`);
  const canDelete = (resource: string) =>
    isSuperAdmin || hasPermission(`${resource}.delete`);

  return { can, canRead, canCreate, canUpdate, canDelete, isSuperAdmin };
};

export default usePermission;
