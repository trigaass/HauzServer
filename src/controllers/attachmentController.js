import db from "../configs/db.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Criar pasta uploads se não existir
const uploadsDir = path.join(__dirname, '../../uploads/attachments');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/');

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Apenas arquivos PDF, JPEG e PNG são permitidos'));
  }
};

export const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter
});

// ✅ CRIAR ANEXO (apenas admins)
export const createAttachment = (req, res) => {
  const { company_id, uploaded_by, title, description } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "Arquivo é obrigatório" });
  }

  if (!company_id || !uploaded_by || !title) {
    // Se deu erro, deletar o arquivo que foi enviado
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "company_id, uploaded_by e title são obrigatórios" });
  }

  // Verificar se o usuário é admin
  db.query(
    "SELECT role, company_id FROM users WHERE id = ?",
    [uploaded_by],
    (err, results) => {
      if (err) {
        console.error("Erro ao verificar usuário:", err);
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: "Erro ao criar anexo" });
      }

      if (results.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const user = results[0];

      if (user.role !== 'admin') {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: "Apenas administradores podem enviar anexos" });
      }

      if (user.company_id !== parseInt(company_id)) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: "Você só pode enviar anexos para sua empresa" });
      }

      const file_url = `/uploads/attachments/${req.file.filename}`;
      const file_type = req.file.mimetype;
      const file_size = req.file.size;

      db.query(
        `INSERT INTO attachments 
         (company_id, uploaded_by, title, description, file_url, file_type, file_size) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [company_id, uploaded_by, title, description || null, file_url, file_type, file_size],
        (err, result) => {
          if (err) {
            console.error("Erro ao criar anexo:", err);
            fs.unlinkSync(req.file.path);
            return res.status(500).json({ error: "Erro ao criar anexo" });
          }

          res.status(201).json({
            message: "Anexo criado com sucesso",
            attachmentId: result.insertId,
            file_url: file_url,
            file_type: file_type,
            file_size: file_size
          });
        }
      );
    }
  );
};

// ✅ BUSCAR ANEXOS DA EMPRESA (com status de visualização)
export const getAttachments = (req, res) => {
  const { company_id, user_id } = req.query;

  if (!company_id || !user_id) {
    return res.status(400).json({ error: "company_id e user_id são obrigatórios" });
  }

  const query = `
    SELECT 
      a.id,
      a.title,
      a.description,
      a.file_url,
      a.file_type,
      a.file_size,
      a.created_at,
      a.updated_at,
      u.email as uploaded_by_email,
      u.role as uploaded_by_role,
      CASE WHEN av.id IS NOT NULL THEN true ELSE false END as is_viewed,
      av.viewed_at
    FROM attachments a
    INNER JOIN users u ON a.uploaded_by = u.id
    LEFT JOIN attachment_views av ON a.id = av.attachment_id AND av.user_id = ?
    WHERE a.company_id = ?
    ORDER BY a.created_at DESC
  `;

  db.query(query, [user_id, company_id], (err, results) => {
    if (err) {
      console.error("Erro ao buscar anexos:", err);
      return res.status(500).json({ error: "Erro ao buscar anexos" });
    }

    res.json(results);
  });
};

// ✅ BUSCAR UM ANEXO ESPECÍFICO
export const getAttachmentById = (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;

  if (!id || !user_id) {
    return res.status(400).json({ error: "id e user_id são obrigatórios" });
  }

  const query = `
    SELECT 
      a.id,
      a.company_id,
      a.title,
      a.description,
      a.file_url,
      a.file_type,
      a.file_size,
      a.created_at,
      a.updated_at,
      u.email as uploaded_by_email,
      u.role as uploaded_by_role,
      CASE WHEN av.id IS NOT NULL THEN true ELSE false END as is_viewed,
      av.viewed_at
    FROM attachments a
    INNER JOIN users u ON a.uploaded_by = u.id
    LEFT JOIN attachment_views av ON a.id = av.attachment_id AND av.user_id = ?
    WHERE a.id = ?
  `;

  db.query(query, [user_id, id], (err, results) => {
    if (err) {
      console.error("Erro ao buscar anexo:", err);
      return res.status(500).json({ error: "Erro ao buscar anexo" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Anexo não encontrado" });
    }

    // Verificar se o usuário pertence à mesma empresa
    db.query(
      "SELECT company_id FROM users WHERE id = ?",
      [user_id],
      (err, userResults) => {
        if (err || userResults.length === 0) {
          return res.status(403).json({ error: "Acesso negado" });
        }

        if (userResults[0].company_id !== results[0].company_id) {
          return res.status(403).json({ error: "Você não tem acesso a este anexo" });
        }

        res.json(results[0]);
      }
    );
  });
};

// ✅ MARCAR ANEXO COMO VISTO
export const markAsViewed = (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  if (!id || !user_id) {
    return res.status(400).json({ error: "id e user_id são obrigatórios" });
  }

  // Verificar se o anexo existe e se o usuário pertence à mesma empresa
  db.query(
    `SELECT a.company_id 
     FROM attachments a 
     WHERE a.id = ?`,
    [id],
    (err, attachmentResults) => {
      if (err) {
        console.error("Erro ao verificar anexo:", err);
        return res.status(500).json({ error: "Erro ao marcar como visto" });
      }

      if (attachmentResults.length === 0) {
        return res.status(404).json({ error: "Anexo não encontrado" });
      }

      db.query(
        "SELECT company_id FROM users WHERE id = ?",
        [user_id],
        (err, userResults) => {
          if (err || userResults.length === 0) {
            return res.status(403).json({ error: "Usuário não encontrado" });
          }

          if (userResults[0].company_id !== attachmentResults[0].company_id) {
            return res.status(403).json({ error: "Você não tem acesso a este anexo" });
          }

          // Inserir visualização (se já existir, o UNIQUE vai ignorar)
          db.query(
            "INSERT INTO attachment_views (attachment_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
            [id, user_id],
            (err) => {
              if (err) {
                console.error("Erro ao marcar como visto:", err);
                return res.status(500).json({ error: "Erro ao marcar como visto" });
              }

              res.json({ message: "Anexo marcado como visto" });
            }
          );
        }
      );
    }
  );
};

// ✅ BUSCAR ESTATÍSTICAS DE VISUALIZAÇÕES (para admins)
export const getAttachmentStats = (req, res) => {
  const { id } = req.params;
  const { admin_id } = req.query;

  if (!id || !admin_id) {
    return res.status(400).json({ error: "id e admin_id são obrigatórios" });
  }

  // Verificar se é admin
  db.query(
    "SELECT role, company_id FROM users WHERE id = ?",
    [admin_id],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      if (results[0].role !== 'admin') {
        return res.status(403).json({ error: "Apenas administradores podem ver estatísticas" });
      }

      const adminCompanyId = results[0].company_id;

      // Buscar estatísticas
      const query = `
        SELECT 
          a.id,
          a.title,
          a.created_at,
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT av.user_id) as viewed_by_count,
          ARRAY_AGG(
            DISTINCT jsonb_build_object(
              'user_id', viewed_user.id,
              'email', viewed_user.email,
              'viewed_at', av.viewed_at
            )
          ) FILTER (WHERE av.user_id IS NOT NULL) as viewed_by
        FROM attachments a
        CROSS JOIN users u
        LEFT JOIN attachment_views av ON a.id = av.attachment_id AND av.user_id = u.id
        LEFT JOIN users viewed_user ON av.user_id = viewed_user.id
        WHERE a.id = ? 
          AND a.company_id = ?
          AND u.company_id = ?
        GROUP BY a.id, a.title, a.created_at
      `;

      db.query(query, [id, adminCompanyId, adminCompanyId], (err, stats) => {
        if (err) {
          console.error("Erro ao buscar estatísticas:", err);
          return res.status(500).json({ error: "Erro ao buscar estatísticas" });
        }

        if (stats.length === 0) {
          return res.status(404).json({ error: "Anexo não encontrado" });
        }

        res.json(stats[0]);
      });
    }
  );
};

// ✅ DELETAR ANEXO (apenas admin que enviou ou admin da empresa)
export const deleteAttachment = (req, res) => {
  const { id } = req.params;
  const { admin_id } = req.body;

  if (!id || !admin_id) {
    return res.status(400).json({ error: "id e admin_id são obrigatórios" });
  }

  // Verificar se é admin
  db.query(
    "SELECT role, company_id FROM users WHERE id = ?",
    [admin_id],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(403).json({ error: "Usuário não encontrado" });
      }

      if (results[0].role !== 'admin') {
        return res.status(403).json({ error: "Apenas administradores podem deletar anexos" });
      }

      const adminCompanyId = results[0].company_id;

      // Buscar o anexo
      db.query(
        "SELECT file_url, company_id FROM attachments WHERE id = ?",
        [id],
        (err, attachmentResults) => {
          if (err) {
            console.error("Erro ao buscar anexo:", err);
            return res.status(500).json({ error: "Erro ao deletar anexo" });
          }

          if (attachmentResults.length === 0) {
            return res.status(404).json({ error: "Anexo não encontrado" });
          }

          const attachment = attachmentResults[0];

          if (attachment.company_id !== adminCompanyId) {
            return res.status(403).json({ error: "Você não pode deletar anexos de outra empresa" });
          }

          // Deletar do banco
          db.query("DELETE FROM attachments WHERE id = ?", [id], (err) => {
            if (err) {
              console.error("Erro ao deletar anexo:", err);
              return res.status(500).json({ error: "Erro ao deletar anexo" });
            }

            // Deletar o arquivo físico
            const filePath = path.join(__dirname, '../../', attachment.file_url);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`Arquivo deletado: ${filePath}`);
            }

            res.json({ message: "Anexo deletado com sucesso" });
          });
        }
      );
    }
  );
};

// ✅ BUSCAR USUÁRIOS QUE NÃO VISUALIZARAM (para admins)
export const getNotViewedUsers = (req, res) => {
  const { id } = req.params;
  const { admin_id } = req.query;

  if (!id || !admin_id) {
    return res.status(400).json({ error: "id e admin_id são obrigatórios" });
  }

  // Verificar se é admin
  db.query(
    "SELECT role, company_id FROM users WHERE id = ?",
    [admin_id],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      if (results[0].role !== 'admin') {
        return res.status(403).json({ error: "Apenas administradores podem ver esta informação" });
      }

      const adminCompanyId = results[0].company_id;

      const query = `
        SELECT 
          u.id,
          u.email,
          u.role
        FROM users u
        WHERE u.company_id = ?
          AND u.id NOT IN (
            SELECT av.user_id 
            FROM attachment_views av 
            WHERE av.attachment_id = ?
          )
        ORDER BY u.role DESC, u.email ASC
      `;

      db.query(query, [adminCompanyId, id], (err, users) => {
        if (err) {
          console.error("Erro ao buscar usuários:", err);
          return res.status(500).json({ error: "Erro ao buscar usuários" });
        }

        res.json(users);
      });
    }
  );
};