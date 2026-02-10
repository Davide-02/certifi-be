import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

export interface TenantRequest extends AuthRequest {
  companyId?: number;
}

export async function tenantMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const companyId = req.headers["x-company-id"]
    ? parseInt(req.headers["x-company-id"] as string, 10)
    : 1;
  req.companyId = companyId;
  next();
}

export async function optionalTenantMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const companyId = req.headers["x-company-id"]
    ? parseInt(req.headers["x-company-id"] as string, 10)
    : undefined;
  if (companyId) req.companyId = companyId;
  next();
}
