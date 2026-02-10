import { Router } from "express";
import { VerificationController } from "../controllers/VerificationController";
import { optionalTenantMiddleware } from "../middleware/tenant";

const router = Router();

// GET /verify?hash=... - Verify by hash (public)
router.get("/", VerificationController.verifyByHash);

// POST /verify - Verify by file or hash (public)
router.post("/", optionalTenantMiddleware, VerificationController.verify);

export default router;
