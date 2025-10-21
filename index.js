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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Removido o console.warn - só retorna erro se necessário
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Removido o middleware de log de requisições

app.get("/", (req, res) => {
  res.json({ 
    message: "API HauzFlow rodando com sucesso 🚀",
    version: "1.0.0",
    environment: process.env.NODE_ENV || 'development'
  });
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

// Error handler global - mantém logs de erro
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

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  // Mensagem simplificada de inicialização
  console.log(`\n🚀 HauzFlow API rodando em http://localhost:${PORT}`);
  console.log(`📁 Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
});