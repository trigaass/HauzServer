import db from "../configs/db.js";

export const createBoard = (req, res) => {
  const { name, description, company_id, created_by } = req.body;

  if (!name || !company_id || !created_by) {
    return res.status(400).json({ error: "Campos obrigatórios: name, company_id, created_by" });
  }

  db.query(
    "SELECT id, role, company_id FROM users WHERE id = ?",
    [created_by],
    (err, userResults) => {
      if (err) {
        console.error("❌ Erro ao verificar usuário:", err.message);
        return res.status(500).json({ error: "Erro ao criar board" });
      }

      if (userResults.length === 0) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const user = userResults[0];

      if (user.role !== 'admin') {
        return res.status(403).json({ error: "Apenas administradores podem criar boards" });
      }

      if (user.company_id !== company_id) {
        return res.status(403).json({ error: "Sem permissão para criar board nesta empresa" });
      }

      db.query(
        "INSERT INTO boards (name, description, company_id, created_by) VALUES (?, ?, ?, ?)",
        [name, description || null, company_id, created_by],
        (err, result) => {
          if (err) {
            console.error("❌ Erro ao criar board:", err.message);
            return res.status(500).json({ error: "Erro ao criar board" });
          }

          const boardId = result.insertId;

          db.query(
            "INSERT INTO board_users (board_id, user_id) VALUES (?, ?)",
            [boardId, created_by],
            (err) => {
              if (err) {
                console.error("❌ Erro ao adicionar criador ao board:", err.message);
              }
              
              res.status(201).json({ 
                message: "Board criado com sucesso", 
                boardId: boardId 
              });
            }
          );
        }
      );
    }
  );
};

export const getBoards = (req, res) => {
  const { userId, role } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId é obrigatório" });
  }

  if (role === "admin") {
    db.query(
      `SELECT b.*, u.email as creator_email, c.name as company_name
       FROM boards b
       JOIN users u ON b.created_by = u.id
       JOIN companies c ON b.company_id = c.id
       WHERE b.company_id = (SELECT company_id FROM users WHERE id = ?)
       ORDER BY b.created_at DESC`,
      [userId],
      (err, results) => {
        if (err) {
          console.error("❌ Erro ao buscar boards:", err.message);
          return res.status(500).json({ error: "Erro ao buscar boards" });
        }
        res.json(results);
      }
    );
  } else {
    db.query(
      `SELECT b.*, u.email as creator_email, c.name as company_name
       FROM boards b
       JOIN board_users bu ON b.id = bu.board_id
       JOIN users u ON b.created_by = u.id
       JOIN companies c ON b.company_id = c.id
       WHERE bu.user_id = ?
       ORDER BY b.created_at DESC`,
      [userId],
      (err, results) => {
        if (err) {
          console.error("❌ Erro ao buscar boards:", err.message);
          return res.status(500).json({ error: "Erro ao buscar boards" });
        }
        res.json(results);
      }
    );
  }
};

export const getBoardUsers = (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "ID do board é obrigatório" });
  }

  db.query(
    `SELECT u.id, u.email, u.role
     FROM users u
     JOIN board_users bu ON u.id = bu.user_id
     WHERE bu.board_id = ?
     ORDER BY u.email ASC`,
    [id],
    (err, results) => {
      if (err) {
        console.error("❌ Erro ao buscar usuários do board:", err.message);
        return res.status(500).json({ error: "Erro ao buscar usuários" });
      }
      res.json(results);
    }
  );
};

export const deleteBoard = (req, res) => {
  const { id } = req.params;
  const { userId, role } = req.query;

  if (!id) {
    return res.status(400).json({ error: "ID do board é obrigatório" });
  }

  if (!userId) {
    return res.status(400).json({ error: "userId é obrigatório" });
  }

  db.query(
    "SELECT created_by, company_id FROM boards WHERE id = ?",
    [id],
    (err, results) => {
      if (err) {
        console.error("❌ Erro ao verificar board:", err.message);
        return res.status(500).json({ error: "Erro ao excluir board" });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: "Board não encontrado" });
      }

      const board = results[0];

      if (role === 'admin') {
        db.query(
          "SELECT company_id FROM users WHERE id = ?",
          [userId],
          (err, userResults) => {
            if (err || userResults.length === 0) {
              return res.status(403).json({ error: "Usuário não encontrado" });
            }

            const userCompanyId = userResults[0].company_id;

            if (userCompanyId !== board.company_id) {
              return res.status(403).json({ error: "Sem permissão para deletar este board" });
            }

            deleteBoardAndRelations(id, res);
          }
        );
      } else {
        return res.status(403).json({ error: "Apenas administradores podem deletar boards" });
      }
    }
  );
};

function deleteBoardAndRelations(boardId, res) {
  db.query(
    "DELETE FROM board_users WHERE board_id = ?",
    [boardId],
    (err) => {
      if (err) {
        console.error("❌ Erro ao deletar associações do board:", err.message);
        return res.status(500).json({ error: "Erro ao excluir board" });
      }

      db.query(
        "DELETE FROM boards WHERE id = ?",
        [boardId],
        (err, result) => {
          if (err) {
            console.error("❌ Erro ao deletar board:", err.message);
            return res.status(500).json({ error: "Erro ao excluir board" });
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Board não encontrado" });
          }

          res.json({ message: "Board excluído com sucesso" });
        }
      );
    }
  );
}

export const addUserToBoard = (req, res) => {
  const { board_id, user_id, admin_id } = req.body;

  if (!board_id || !user_id || !admin_id) {
    return res.status(400).json({ error: "board_id, user_id e admin_id são obrigatórios" });
  }

  db.query(
    "SELECT role, company_id FROM users WHERE id = ?",
    [admin_id],
    (err, adminResults) => {
      if (err || adminResults.length === 0) {
        return res.status(403).json({ error: "Usuário não encontrado" });
      }

      const admin = adminResults[0];

      if (admin.role !== 'admin') {
        return res.status(403).json({ error: "Apenas administradores podem adicionar usuários aos boards" });
      }

      db.query(
        "SELECT company_id FROM boards WHERE id = ?",
        [board_id],
        (err, boardResults) => {
          if (err || boardResults.length === 0) {
            return res.status(404).json({ error: "Board não encontrado" });
          }

          const board = boardResults[0];

          if (board.company_id !== admin.company_id) {
            return res.status(403).json({ error: "Board não pertence à sua empresa" });
          }

          db.query(
            "SELECT company_id FROM users WHERE id = ?",
            [user_id],
            (err, userResults) => {
              if (err || userResults.length === 0) {
                return res.status(404).json({ error: "Usuário não encontrado" });
              }

              const user = userResults[0];

              if (user.company_id !== admin.company_id) {
                return res.status(403).json({ error: "Usuário não pertence à sua empresa" });
              }

              db.query(
                "INSERT INTO board_users (board_id, user_id) VALUES (?, ?)",
                [board_id, user_id],
                (err, result) => {
                  if (err) {
                    if (err.code === '23505') {
                      return res.status(400).json({ error: "Usuário já está neste board" });
                    }
                    console.error("❌ Erro ao adicionar usuário ao board:", err.message);
                    return res.status(500).json({ error: "Erro ao adicionar usuário" });
                  }

                  res.status(201).json({ message: "Usuário adicionado ao board com sucesso" });
                }
              );
            }
          );
        }
      );
    }
  );
};

export const removeUserFromBoard = (req, res) => {
  const { board_id, user_id, admin_id } = req.body;

  if (!board_id || !user_id || !admin_id) {
    return res.status(400).json({ error: "board_id, user_id e admin_id são obrigatórios" });
  }

  db.query(
    "SELECT role, company_id FROM users WHERE id = ?",
    [admin_id],
    (err, adminResults) => {
      if (err || adminResults.length === 0) {
        return res.status(403).json({ error: "Usuário não encontrado" });
      }

      const admin = adminResults[0];

      if (admin.role !== 'admin') {
        return res.status(403).json({ error: "Apenas administradores podem remover usuários dos boards" });
      }

      db.query(
        "SELECT company_id FROM boards WHERE id = ?",
        [board_id],
        (err, boardResults) => {
          if (err || boardResults.length === 0) {
            return res.status(404).json({ error: "Board não encontrado" });
          }

          const board = boardResults[0];

          if (board.company_id !== admin.company_id) {
            return res.status(403).json({ error: "Board não pertence à sua empresa" });
          }

          db.query(
            "DELETE FROM board_users WHERE board_id = ? AND user_id = ?",
            [board_id, user_id],
            (err, result) => {
              if (err) {
                console.error("❌ Erro ao remover usuário do board:", err.message);
                return res.status(500).json({ error: "Erro ao remover usuário" });
              }

              if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Relacionamento não encontrado" });
              }

              res.json({ message: "Usuário removido do board com sucesso" });
            }
          );
        }
      );
    }
  );
};