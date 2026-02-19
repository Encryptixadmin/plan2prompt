import { Request, Response, NextFunction } from "express";
import { adminService } from "../services/admin.service";

declare global {
  namespace Express {
    interface Request {
      adminUserId?: string;
      isAdmin?: boolean;
    }
  }
}

function getUserId(req: Request): string | undefined {
  if ((req.session as any)?.localUserId) {
    return (req.session as any).localUserId;
  }
  return (req.user as any)?.claims?.sub;
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = getUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  const isAdmin = await adminService.isUserAdmin(userId);

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: {
        code: "ADMIN_ACCESS_DENIED",
        message: "Admin access required. This action is restricted to administrators.",
      },
    });
  }

  req.adminUserId = userId;
  req.isAdmin = true;

  next();
}
