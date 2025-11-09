import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
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
import chatRoutes from "./src/routes/chatRoutes.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ CORS - Ler do .env e limpar espaços
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

console.log('🌐 Origins permitidas:', allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
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

// 🆕 SOCKET.IO - Configuração
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// 🆕 SOCKET.IO - Gerenciamento de conexões
const onlineUsers = new Map(); // userId -> socketId

io.on("connection", (socket) => {
  console.log("🔌 Usuário conectado:", socket.id);

  // Usuário entra online
  socket.on("user:online", (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`👤 Usuário ${userId} online`);
    
    // Notificar outros usuários
    socket.broadcast.emit("user:status", { userId, status: "online" });
  });

  // Enviar mensagem em tempo real
  socket.on("message:send", (data) => {
    const { conversationId, receiverId, message } = data;
    
    // Enviar para o destinatário específico
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("message:received", {
        conversationId,
        message
      });
    }
  });

  // Notificar que está digitando
  socket.on("typing:start", (data) => {
    const { conversationId, receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing:indicator", {
        conversationId,
        isTyping: true
      });
    }
  });

  socket.on("typing:stop", (data) => {
    const { conversationId, receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing:indicator", {
        conversationId,
        isTyping: false
      });
    }
  });

  // Usuário desconecta
  socket.on("disconnect", () => {
    console.log("❌ Usuário desconectado:", socket.id);
    
    // Remover usuário da lista de online
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        socket.broadcast.emit("user:status", { userId, status: "offline" });
        break;
      }
    }
  });
});

// Tornar io acessível nas rotas
app.set('io', io);
app.set('onlineUsers', onlineUsers);

// Middleware para logar requisições (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`🔥 ${req.method} ${req.path} - Origin: ${req.get('origin') || 'sem origin'}`);
    next();
  });
}

app.get("/", (req, res) => {
  res.json({ 
    message: "API HauzFlow rodando com sucesso 🚀",
    version: "1.0.0",
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    features: {
      chat: "enabled",
      realtime: "enabled",
      onlineUsers: onlineUsers.size
    }
  });
});

// Health check para Render
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    uptime: process.uptime(),
    onlineUsers: onlineUsers.size
  });
});

// Rotas
app.use("/api/auth", authRoutes);
app.use("/api", boardRoutes);
app.use("/api", companyRoutes);
app.use("/api", userRoutes);
app.use("/api", cardRoutes);
app.use("/api", taskRoutes);
app.use("/api", chatRoutes);

// 404 handler
app.use((req, res) => {
  console.log('❌ Rota não encontrada:', req.method, req.path);
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

// CRÍTICO: Porta do Render
const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log(`\n🚀 HauzFlow API rodando`);
  console.log(`📡 Porta: ${PORT}`);
  console.log(`🌐 Host: ${HOST}`);
  console.log(`📅 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Conectado' : 'NÃO CONFIGURADO'}`);
  console.log(`💬 WebSocket: Ativo`);
  console.log(`\n✅ Pronto para receber requisições\n`);
});