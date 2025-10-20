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

// Configuração de CORS baseada no ambiente
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requisições sem origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  Origem bloqueada pelo CORS: ${origin}`);
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// IMPORTANTE: Middleware CORS deve vir ANTES de qualquer rota
app.use(cors(corsOptions));

// Middleware para parsear JSON
app.use(express.json());

// 🖼️ SERVIR ARQUIVOS ESTÁTICOS (IMAGENS)
// Isso permite acessar as imagens via http://localhost:3000/uploads/tasks/nome-do-arquivo.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Log de todas as requisições (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

app.get("/", (req, res) => {
  res.json({ 
    message: "API HauzFlow rodando com sucesso 🚀",
    version: "1.0.0",
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rotas da API
app.use("/api/auth", authRoutes);
app.use("/api", boardRoutes);
app.use("/api", companyRoutes);
app.use("/api", userRoutes);
app.use("/api", cardRoutes);
app.use("/api", taskRoutes);

// Rota 404
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error("❌ Erro:", err.message);
  
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  
  res.status(err.status || 500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : err.message 
  });
});

const PORT = process.env.API_PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Servidor HauzFlow rodando`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🖼️  Uploads: http://localhost:${PORT}/uploads/tasks/`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📋 CORS: ${allowedOrigins.join(', ')}`);
  console.log(`⏰ Iniciado em: ${new Date().toLocaleString('pt-BR')}`);
  console.log(`${"=".repeat(60)}\n`);
});