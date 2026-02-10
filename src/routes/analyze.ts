import { Router } from "express";
import multer from "multer";
import { AnalysisController } from "../controllers/AnalysisController";
import { tenantMiddleware } from "../middleware/tenant";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// POST /analyze - Analyze document with AI (NO blockchain certification)
router.post(
  "/",
  tenantMiddleware,
  upload.single("file"),
  AnalysisController.analyze
);

export default router;
