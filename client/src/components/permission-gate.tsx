import { useProject } from "@/contexts/project-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Permission = "canView" | "canEdit" | "canGenerate" | "canLock" | "canDelete" | "canInvite" | "canExport";

interface PermissionGateProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  disabledMessage?: string;
}

const defaultMessages: Record<Permission, string> = {
  canView: "You don't have permission to view this",
  canEdit: "Only collaborators and owners can edit",
  canGenerate: "Only collaborators and owners can generate artifacts",
  canLock: "Only the project owner can lock artifacts",
  canDelete: "Only the project owner can delete",
  canInvite: "Only the project owner can invite members",
  canExport: "Export is available for all roles",
};

export function PermissionGate({
  permission,
  children,
  fallback,
  disabledMessage,
}: PermissionGateProps) {
  const { permissions, activeProject } = useProject();

  if (!activeProject || !permissions) {
    return fallback || null;
  }

  const hasPermission = permissions[permission];

  if (hasPermission) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return null;
}

interface PermissionButtonProps {
  permission: Permission;
  children: React.ReactElement<{ disabled?: boolean }>;
  disabledMessage?: string;
}

export function PermissionButton({
  permission,
  children,
  disabledMessage,
}: PermissionButtonProps) {
  const { permissions, activeProject } = useProject();

  if (!activeProject || !permissions) {
    return children;
  }

  const hasPermission = permissions[permission];

  if (hasPermission) {
    return children;
  }

  const message = disabledMessage || defaultMessages[permission];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block">
          <span className="pointer-events-none opacity-50">
            {children}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-sm">{message}</p>
      </TooltipContent>
    </Tooltip>
  );
}
