import db from "../configs/db.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

// Configuração para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Criar pasta uploads se não existir
const uploadsDir = path.join(__dirname, '../../uploads/tasks');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuração do Multer para upload de imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `task-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Apenas imagens são permitidas (jpeg, jpg, png, gif, webp)'));
  }
};

export const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter
});

export const createTask = (req, res) => {
  const { card_id, content, position } = req.body;
  const image_url = req.file ? `/uploads/tasks/${req.file.filename}` : null;

  if (!card_id || !content) {
    return res.status(400).json({ error: "card_id e content são obrigatórios" });
  }

  db.query(
    "INSERT INTO tasks (card_id, content, position, image_url) VALUES (?, ?, ?, ?)",
    [card_id, content, position || 0, image_url],
    (err, result) => {
      if (err) {
        console.error("Erro ao criar task:", err);
        // Se deu erro, deletar a imagem que foi enviada
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({ error: "Erro ao criar task" });
      }

      res.status(201).json({
        message: "Task criada com sucesso",
        taskId: result.insertId,
        image_url: image_url
      });
    }
  );
};

export const getTasks = (req, res) => {
  const { card_id } = req.query;

  if (!card_id) {
    return res.status(400).json({ error: "card_id é obrigatório" });
  }

  db.query(
    "SELECT * FROM tasks WHERE card_id = ? ORDER BY position ASC",
    [card_id],
    (err, results) => {
      if (err) {
        console.error("Erro ao buscar tasks:", err);
        return res.status(500).json({ error: "Erro ao buscar tasks" });
      }
      res.json(results);
    }
  );
};

export const updateTask = (req, res) => {
  const { id } = req.params;
  const { content, position, completed } = req.body;
  const new_image_url = req.file ? `/uploads/tasks/${req.file.filename}` : null;

  if (!id) {
    return res.status(400).json({ error: "ID da task é obrigatório" });
  }

  // Primeiro, buscar a task antiga para deletar a imagem anterior se necessário
  db.query("SELECT image_url FROM tasks WHERE id = ?", [id], (err, results) => {
    if (err) {
      console.error("Erro ao buscar task:", err);
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: "Erro ao atualizar task" });
    }

    if (results.length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Task não encontrada" });
    }

    const oldImageUrl = results[0].image_url;

    const updates = [];
    const params = [];

    if (content !== undefined) {
      updates.push("content = ?");
      params.push(content);
    }

    if (position !== undefined) {
      updates.push("position = ?");
      params.push(position);
    }

    if (completed !== undefined) {
      updates.push("completed = ?");
      params.push(completed);
    }

    if (new_image_url !== null) {
      updates.push("image_url = ?");
      params.push(new_image_url);
    }

    if (updates.length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    params.push(id);

    db.query(
      `UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`,
      params,
      (err, result) => {
        if (err) {
          console.error("Erro ao atualizar task:", err);
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: "Erro ao atualizar task" });
        }

        if (result.affectedRows === 0) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: "Task não encontrada" });
        }

        // Se tinha imagem antiga e uma nova foi enviada, deletar a antiga
        if (oldImageUrl && new_image_url) {
          const oldImagePath = path.join(__dirname, '../../', oldImageUrl);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }

        res.json({ 
          message: "Task atualizada com sucesso",
          image_url: new_image_url || oldImageUrl
        });
      }
    );
  });
};

export const deleteTask = (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "ID da task é obrigatório" });
  }

  // Primeiro buscar a task para pegar o caminho da imagem
  db.query("SELECT image_url FROM tasks WHERE id = ?", [id], (err, results) => {
    if (err) {
      console.error("Erro ao buscar task:", err);
      return res.status(500).json({ error: "Erro ao deletar task" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Task não encontrada" });
    }

    const imageUrl = results[0].image_url;

    // Deletar a task do banco
    db.query("DELETE FROM tasks WHERE id = ?", [id], (err, result) => {
      if (err) {
        console.error("Erro ao deletar task:", err);
        return res.status(500).json({ error: "Erro ao deletar task" });
      }

      // Se tinha imagem, deletar o arquivo
      if (imageUrl) {
        const imagePath = path.join(__dirname, '../../', imageUrl);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log(`Imagem deletada: ${imagePath}`);
        }
      }

      res.json({ message: "Task excluída com sucesso" });
    });
  });
};

// Nova rota para deletar apenas a imagem de uma task
export const deleteTaskImage = (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "ID da task é obrigatório" });
  }

  db.query("SELECT image_url FROM tasks WHERE id = ?", [id], (err, results) => {
    if (err) {
      console.error("Erro ao buscar task:", err);
      return res.status(500).json({ error: "Erro ao deletar imagem" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Task não encontrada" });
    }

    const imageUrl = results[0].image_url;

    if (!imageUrl) {
      return res.status(400).json({ error: "Task não possui imagem" });
    }

    // Atualizar task removendo a URL da imagem
    db.query("UPDATE tasks SET image_url = NULL WHERE id = ?", [id], (err) => {
      if (err) {
        console.error("Erro ao atualizar task:", err);
        return res.status(500).json({ error: "Erro ao deletar imagem" });
      }

      // Deletar o arquivo físico
      const imagePath = path.join(__dirname, '../../', imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`Imagem deletada: ${imagePath}`);
      }

      res.json({ message: "Imagem removida com sucesso" });
    });
  });
};