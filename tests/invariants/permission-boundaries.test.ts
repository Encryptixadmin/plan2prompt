import { describe, it, expect } from "vitest";
import { getRolePermissions } from "../../shared/types/project";

describe("Permission Boundaries Invariants", () => {
  it("3.1 Viewer role MUST be view-only (no generate, no lock)", () => {
    const permissions = getRolePermissions("viewer");

    expect(permissions.canView).toBe(true);
    expect(permissions.canGenerate).toBe(false);
    expect(permissions.canLock).toBe(false);
    expect(permissions.canEdit).toBe(false);
  });

  it("3.2 Collaborator role MUST generate but NOT lock or delete", () => {
    const permissions = getRolePermissions("collaborator");

    expect(permissions.canGenerate).toBe(true);
    expect(permissions.canLock).toBe(false);
    expect(permissions.canDelete).toBe(false);
    expect(permissions.canInvite).toBe(false);
  });

  it("3.3 Admin-only routes MUST be inaccessible to non-admin users", () => {
    const viewerPerms = getRolePermissions("viewer");
    const collaboratorPerms = getRolePermissions("collaborator");
    const ownerPerms = getRolePermissions("owner");

    const canAccessAdmin = (perms: typeof ownerPerms) => {
      return perms.canLock && perms.canDelete && perms.canInvite;
    };

    expect(canAccessAdmin(viewerPerms)).toBe(false);
    expect(canAccessAdmin(collaboratorPerms)).toBe(false);
    expect(canAccessAdmin(ownerPerms)).toBe(true);
  });
});
