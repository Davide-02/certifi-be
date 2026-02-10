import { Router } from "express";
import multer from "multer";
import { DocumentController } from "../controllers/DocumentController";
import { tenantMiddleware } from "../middleware/tenant";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post("/upload", tenantMiddleware, upload.single("file"), DocumentController.upload);

export default router;
