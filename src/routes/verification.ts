import { Router } from "express";
import multer from "multer";
import { VerificationController } from "../controllers/VerificationController";
import { optionalTenantMiddleware } from "../middleware/tenant";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// GET /verify?hash=... - Verify by hash (requires authentication)
router.get("/", VerificationController.verifyByHash);

// POST /verify - Verify by file or hash (requires authentication)
router.post(
  "/",
  optionalTenantMiddleware,
  upload.single("file"),
  VerificationController.verify
);

export default router;
