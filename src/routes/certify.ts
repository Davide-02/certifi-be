import { Router } from "express";
import { CertificationController } from "../controllers/CertificationController";
import { tenantMiddleware } from "../middleware/tenant";

const router = Router();

// POST /certify - Certify an already-analyzed document on blockchain
router.post("/", tenantMiddleware, CertificationController.certify);

export default router;
