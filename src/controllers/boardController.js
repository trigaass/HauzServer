// ✅ Apenas as funções que precisam ser corrigidas:

export const addUserToBoard = (req, res) => {
  const { id } = req.params; // board_id vem da URL
  const { user_id, admin_id } = req.body;

  if (!id || !user_id || !admin_id) {
    return res.status(400).json({ error: "board_id, user_id e admin_id são obrigatórios" });
  }

  const board_id = parseInt(id);

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
  const { id, userId } = req.params; // board_id e user_id vêm da URL
  const { admin_id } = req.body;

  if (!id || !userId || !admin_id) {
    return res.status(400).json({ error: "board_id, user_id e admin_id são obrigatórios" });
  }

  const board_id = parseInt(id);
  const user_id = parseInt(userId);

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