import { useAuth } from "./useAuth";

const BYPASS_TYPES = ["superadmin"];

const usePermission = () => {
  const { user } = useAuth();

  const isSuperAdmin = BYPASS_TYPES.includes(user?.type ?? "");
  const permSet = new Set(user?.permissions?.map((p) => p.name) ?? []);

  const can = (permission: string) => isSuperAdmin || permSet.has(permission);
  const canRead = (resource: string) => isSuperAdmin || permSet.has(`${resource}.read`);
  const canCreate = (resource: string) => isSuperAdmin || permSet.has(`${resource}.create`);
  const canUpdate = (resource: string) => isSuperAdmin || permSet.has(`${resource}.update`);
  const canDelete = (resource: string) => isSuperAdmin || permSet.has(`${resource}.delete`);

  return { can, canRead, canCreate, canUpdate, canDelete, isSuperAdmin };
};

export default usePermission;
