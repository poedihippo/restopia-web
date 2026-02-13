import { IRole } from "@/@types/role";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PermissionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: IRole | null;
}

const PermissionDetailModal = ({
  isOpen,
  onClose,
  role,
}: PermissionDetailModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Permissions - {role?.name}</DialogTitle>
        </DialogHeader>

        <div className="max-h-100 overflow-y-auto">
          {role?.permissions && role.permissions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {role.permissions.map((permission) => (
                <span
                  key={permission.id}
                  className="inline-flex items-center rounded-md bg-secondary px-2.5 py-0.5 text-sm font-medium text-secondary-foreground"
                >
                  {permission.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No permissions assigned to this role.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PermissionDetailModal;
