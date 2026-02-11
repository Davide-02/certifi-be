import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

export interface TenantRequest extends AuthRequest {
  companyId?: number;
}

export async function tenantMiddleware(
  _req: TenantRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  next();
}

export async function optionalTenantMiddleware(
  _req: TenantRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  next();
}
