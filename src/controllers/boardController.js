import db from "../configs/db.js";

// ✅ CRIAR BOARD
export const createBoard = (req, res) => {
  const { company_id, name } = req.body;

  if (!company_id || !name) {
    return res.status(400).json({ error: "company_id e name são obrigatórios" });
  }

  db.query(
    "INSERT INTO boards (company_id, name) VALUES (?, ?)",
    [company_id, name],
    (err, result) => {
      if (err) {
        console.error("❌ Erro ao criar board:", err.message);
        return res.status(500).json({ error: "Erro ao criar board" });
      }

      res.status(201).json({
        message: "Board criado com sucesso",
        boardId: result.insertId
      });
    }
  );
};

// ✅ BUSCAR BOARDS
export const getBoards = (req, res) => {
  const { company_id } = req.query;

  if (!company_id) {
    return res.status(400).json({ error: "company_id é obrigatório" });
  }

  db.query(
    "SELECT * FROM boards WHERE company_id = ? ORDER BY created_at DESC",
    [company_id],
    (err, results) => {
      if (err) {
        console.error("❌ Erro ao buscar boards:", err.message);
        return res.status(500).json({ error: "Erro ao buscar boards" });
      }
      res.json(results);
    }
  );
};

// ✅ BUSCAR USUÁRIOS DE UM BOARD
export const getBoardUsers = (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "ID do board é obrigatório" });
  }

  db.query(
    `SELECT u.id, u.email, u.role 
     FROM users u
     INNER JOIN board_users bu ON u.id = bu.user_id
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

// ✅ DELETAR BOARD
export const deleteBoard = (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "ID do board é obrigatório" });
  }

  db.query("DELETE FROM boards WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("❌ Erro ao deletar board:", err.message);
      return res.status(500).json({ error: "Erro ao deletar board" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Board não encontrado" });
    }

    res.json({ message: "Board excluído com sucesso" });
  });
};

// ✅ ADICIONAR USUÁRIO AO BOARD (COM VALIDAÇÕES)
export const addUserToBoard = (req, res) => {
  const { id } = req.params; // board_id vem da URL
  const { user_id, admin_id } = req.body; // dados vêm do body

  if (!id || !user_id || !admin_id) {
    return res.status(400).json({ error: "board_id, user_id e admin_id são obrigatórios" });
  }

  const board_id = parseInt(id);

  // 1. Verificar se admin existe e é realmente admin
  db.query(
    "SELECT role, company_id FROM users WHERE id = ?",
    [admin_id],
    (err, adminResults) => {
      if (err) {
        console.error("❌ Erro ao verificar admin:", err.message);
        return res.status(500).json({ error: "Erro ao verificar admin" });
      }

      if (adminResults.length === 0) {
        return res.status(403).json({ error: "Usuário não encontrado" });
      }

      const admin = adminResults[0];

      if (admin.role !== 'admin') {
        return res.status(403).json({ error: "Apenas administradores podem adicionar usuários aos boards" });
      }

      // 2. Verificar se o board existe e pertence à empresa do admin
      db.query(
        "SELECT company_id FROM boards WHERE id = ?",
        [board_id],
        (err, boardResults) => {
          if (err) {
            console.error("❌ Erro ao verificar board:", err.message);
            return res.status(500).json({ error: "Erro ao verificar board" });
          }

          if (boardResults.length === 0) {
            return res.status(404).json({ error: "Board não encontrado" });
          }

          const board = boardResults[0];

          if (board.company_id !== admin.company_id) {
            return res.status(403).json({ error: "Board não pertence à sua empresa" });
          }

          // 3. Verificar se o usuário existe e pertence à mesma empresa
          db.query(
            "SELECT company_id FROM users WHERE id = ?",
            [user_id],
            (err, userResults) => {
              if (err) {
                console.error("❌ Erro ao verificar usuário:", err.message);
                return res.status(500).json({ error: "Erro ao verificar usuário" });
              }

              if (userResults.length === 0) {
                return res.status(404).json({ error: "Usuário não encontrado" });
              }

              const user = userResults[0];

              if (user.company_id !== admin.company_id) {
                return res.status(403).json({ error: "Usuário não pertence à sua empresa" });
              }

              // 4. Finalmente, adicionar usuário ao board
              db.query(
                "INSERT INTO board_users (board_id, user_id) VALUES (?, ?)",
                [board_id, user_id],
                (err, result) => {
                  if (err) {
                    // Código de erro para chave duplicada no PostgreSQL
                    if (err.code === '23505' || err.code === 'ER_DUP_ENTRY') {
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

// ✅ REMOVER USUÁRIO DO BOARD (COM VALIDAÇÕES)
export const removeUserFromBoard = (req, res) => {
  const { id, userId } = req.params; // board_id e user_id vêm da URL
  const { admin_id } = req.body; // admin_id vem do body

  if (!id || !userId || !admin_id) {
    return res.status(400).json({ error: "board_id, user_id e admin_id são obrigatórios" });
  }

  const board_id = parseInt(id);
  const user_id = parseInt(userId);

  // 1. Verificar se admin existe e é realmente admin
  db.query(
    "SELECT role, company_id FROM users WHERE id = ?",
    [admin_id],
    (err, adminResults) => {
      if (err) {
        console.error("❌ Erro ao verificar admin:", err.message);
        return res.status(500).json({ error: "Erro ao verificar admin" });
      }

      if (adminResults.length === 0) {
        return res.status(403).json({ error: "Usuário não encontrado" });
      }

      const admin = adminResults[0];

      if (admin.role !== 'admin') {
        return res.status(403).json({ error: "Apenas administradores podem remover usuários dos boards" });
      }

      // 2. Verificar se o board existe e pertence à empresa do admin
      db.query(
        "SELECT company_id FROM boards WHERE id = ?",
        [board_id],
        (err, boardResults) => {
          if (err) {
            console.error("❌ Erro ao verificar board:", err.message);
            return res.status(500).json({ error: "Erro ao verificar board" });
          }

          if (boardResults.length === 0) {
            return res.status(404).json({ error: "Board não encontrado" });
          }

          const board = boardResults[0];

          if (board.company_id !== admin.company_id) {
            return res.status(403).json({ error: "Board não pertence à sua empresa" });
          }

          // 3. Remover usuário do board
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