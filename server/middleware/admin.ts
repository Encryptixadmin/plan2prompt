import { Request, Response, NextFunction } from "express";
import { adminService } from "../services/admin.service";

const DEFAULT_USER_ID = "default-user";

declare global {
  namespace Express {
    interface Request {
      adminUserId?: string;
      isAdmin?: boolean;
    }
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = (req.query.userId as string) || DEFAULT_USER_ID;

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
