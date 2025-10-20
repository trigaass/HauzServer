import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import authRoutes from "./src/routes/authRoutes.js";
import companyRoutes from "./src/routes/companyRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import boardRoutes from "./src/routes/boardRoutes.js";
import cardRoutes from "./src/routes/cardRoutes.js";
import taskRoutes from "./src/routes/taskRoutes.js";

dotenv.config();

const app = express();

// Configuração para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANTE: Middleware CORS deve vir ANTES de qualquer rota
app.use(cors({
  origin: true, // Aceita qualquer origem (apenas para desenvolvimento!)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware para parsear JSON
app.use(express.json());

// 🖼️ SERVIR ARQUIVOS ESTÁTICOS (IMAGENS)
// Isso permite acessar as imagens via http://localhost:3000/uploads/tasks/nome-do-arquivo.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Log de todas as requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get("/", (req, res) => {
  res.json({ message: "API rodando com sucesso 🚀" });
});

app.use("/api/auth", authRoutes);
app.use("/api", boardRoutes);
app.use("/api", companyRoutes);
app.use("/api", userRoutes);
app.use("/api", cardRoutes);
app.use("/api", taskRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

app.use((err, req, res, next) => {
  console.error("❌ Erro:", err.message);
  console.error(err.stack);
  res.status(500).json({ error: "Erro interno do servidor" });
});

const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`🖼️  Uploads em: http://localhost:${PORT}/uploads/tasks/`);
  console.log(`📋 CORS: TOTALMENTE ABERTO (development mode)`);
  console.log(`⏰ Iniciado em: ${new Date().toLocaleString()}`);
  console.log(`${"=".repeat(50)}\n`);
});