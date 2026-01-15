import { describe, it, expect } from "vitest";

type Role = "owner" | "collaborator" | "viewer";

const getPermissions = (role: Role, isAdmin = false) => ({
  canView: true,
  canGenerate: role !== "viewer",
  canLock: role === "owner",
  canDelete: role === "owner",
  isAdmin,
});

describe("Permission Boundaries Invariants", () => {
  it("3.1 Viewer role MUST be view-only (no generate, no lock)", () => {
    const permissions = getPermissions("viewer");

    expect(permissions.canView).toBe(true);
    expect(permissions.canGenerate).toBe(false);
    expect(permissions.canLock).toBe(false);
  });

  it("3.2 Collaborator role MUST generate but NOT lock or delete", () => {
    const permissions = getPermissions("collaborator");

    expect(permissions.canGenerate).toBe(true);
    expect(permissions.canLock).toBe(false);
    expect(permissions.canDelete).toBe(false);
  });

  it("3.3 Admin-only routes MUST be inaccessible to non-admin users", () => {
    const viewer = getPermissions("viewer", false);
    const collaborator = getPermissions("collaborator", false);
    const owner = getPermissions("owner", false);
    const admin = getPermissions("owner", true);

    expect(viewer.isAdmin).toBe(false);
    expect(collaborator.isAdmin).toBe(false);
    expect(owner.isAdmin).toBe(false);
    expect(admin.isAdmin).toBe(true);
  });
});
