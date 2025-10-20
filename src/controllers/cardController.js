import db from "../configs/db.js";

export const createCard = (req, res) => {
  const { board_id, title, position } = req.body;

  if (!board_id) {
    return res.status(400).json({ error: "board_id é obrigatório" });
  }

  db.query(
    "INSERT INTO cards (board_id, title, position) VALUES (?, ?, ?)",
    [board_id, title || "Novo Card", position || 0],
    (err, result) => {
      if (err) {
        console.error("Erro ao criar card:", err);
        return res.status(500).json({ error: "Erro ao criar card" });
      }

      res.status(201).json({
        message: "Card criado com sucesso",
        cardId: result.insertId
      });
    }
  );
};

export const getCards = (req, res) => {
  const { board_id } = req.query;

  if (!board_id) {
    return res.status(400).json({ error: "board_id é obrigatório" });
  }

  db.query(
    "SELECT * FROM cards WHERE board_id = ? ORDER BY position ASC",
    [board_id],
    (err, results) => {
      if (err) {
        console.error("Erro ao buscar cards:", err);
        return res.status(500).json({ error: "Erro ao buscar cards" });
      }
      res.json(results);
    }
  );
};

export const updateCard = (req, res) => {
  const { id } = req.params;
  const { title, position } = req.body;

  if (!id) {
    return res.status(400).json({ error: "ID do card é obrigatório" });
  }

  const updates = [];
  const params = [];

  if (title !== undefined) {
    updates.push("title = ?");
    params.push(title);
  }

  if (position !== undefined) {
    updates.push("position = ?");
    params.push(position);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "Nenhum campo para atualizar" });
  }

  params.push(id);

  db.query(
    `UPDATE cards SET ${updates.join(", ")} WHERE id = ?`,
    params,
    (err, result) => {
      if (err) {
        console.error("Erro ao atualizar card:", err);
        return res.status(500).json({ error: "Erro ao atualizar card" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Card não encontrado" });
      }

      res.json({ message: "Card atualizado com sucesso" });
    }
  );
};

export const deleteCard = (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "ID do card é obrigatório" });
  }

  db.query("DELETE FROM cards WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("Erro ao deletar card:", err);
      return res.status(500).json({ error: "Erro ao deletar card" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Card não encontrado" });
    }

    res.json({ message: "Card excluído com sucesso" });
  });
};