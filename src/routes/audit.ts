import { Router } from "express";
import { AuditController } from "../controllers/AuditController";
import { tenantMiddleware } from "../middleware/tenant";

const router = Router();

// GET /audit-logs - Get all audit logs (admin only)
router.get("/", tenantMiddleware, AuditController.getAll);

export default router;
