import express from "express";
import { 
  getOrCreateConversation,
  getUserConversations,
  sendMessage,
  getMessages,
  markAsRead,
  getAvailableUsers
} from "../controllers/chatController.js";

const router = express.Router();

// Criar ou buscar conversa direta
router.post("/conversations", getOrCreateConversation);

// Buscar conversas do usuário
router.get("/conversations/user/:user_id", getUserConversations);

// Buscar mensagens de uma conversa
router.get("/conversations/:conversation_id/messages", getMessages);

// Enviar mensagem
router.post("/messages", sendMessage);

// Marcar mensagens como lidas
router.put("/conversations/:conversation_id/read", markAsRead);

// Buscar usuários disponíveis para chat
router.get("/users/available", getAvailableUsers);

export default router;