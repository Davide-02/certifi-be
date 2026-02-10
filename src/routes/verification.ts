import { Router } from "express";
import { VerificationController } from "../controllers/VerificationController";
import { optionalTenantMiddleware } from "../middleware/tenant";

const router = Router();

// GET /verify?hash=... - Verify by hash (requires authentication)
router.get("/", VerificationController.verifyByHash);

// POST /verify - Verify by file or hash (requires authentication)
router.post("/", optionalTenantMiddleware, VerificationController.verify);

export default router;
