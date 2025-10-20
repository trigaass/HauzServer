import express from "express";
import { 
  createTask, 
  getTasks, 
  updateTask, 
  deleteTask,
  deleteTaskImage,
  upload
} from "../controllers/taskController.js";

const router = express.Router();

// Criar task com imagem opcional
router.post("/tasks", upload.single('image'), createTask);

// Buscar tasks (sem mudança)
router.get("/tasks", getTasks);

// Atualizar task com imagem opcional
router.put("/tasks/:id", upload.single('image'), updateTask);

// Deletar task (deleta a imagem também)
router.delete("/tasks/:id", deleteTask);

// Nova rota: deletar apenas a imagem de uma task
router.delete("/tasks/:id/image", deleteTaskImage);

export default router;