import { Router } from "express";
import multer from "multer";
import { DocumentController } from "../controllers/DocumentController";
import { tenantMiddleware } from "../middleware/tenant";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Legacy endpoint (deprecated)
router.post("/upload", tenantMiddleware, upload.single("file"), DocumentController.upload);

// Get my certifications (as issuer)
router.get("/my-certifications", tenantMiddleware, DocumentController.getMyCertifications);

// Update certification validity end date
router.patch("/:id/valid-until", tenantMiddleware, DocumentController.updateValidUntil);

// Update document status
router.patch("/:id/status", tenantMiddleware, DocumentController.updateStatus);

// Check and expire documents (for periodic jobs)
router.post("/expire-check", tenantMiddleware, DocumentController.expireDocuments);

export default router;
