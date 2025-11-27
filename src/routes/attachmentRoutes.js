import express from "express";
import {
  createAttachment,
  getAttachments,
  getAttachmentById,
  markAsViewed,
  getAttachmentStats,
  deleteAttachment,
  getNotViewedUsers,
  upload
} from "../controllers/attachmentController.js";

const router = express.Router();

// ✅ Criar anexo (apenas admins, com upload de arquivo)
router.post("/attachments", upload.single('file'), createAttachment);

// ✅ Buscar todos os anexos da empresa (com status de visualização)
router.get("/attachments", getAttachments);

// ✅ Buscar anexo específico
router.get("/attachments/:id", getAttachmentById);

// ✅ Marcar anexo como visto
router.post("/attachments/:id/view", markAsViewed);

// ✅ Buscar estatísticas de visualizações de um anexo (admin)
router.get("/attachments/:id/stats", getAttachmentStats);

// ✅ Buscar usuários que NÃO visualizaram (admin)
router.get("/attachments/:id/not-viewed", getNotViewedUsers);

// ✅ Deletar anexo (apenas admin)
router.delete("/attachments/:id", deleteAttachment);

export default router;