import db from "../configs/db.js";

export const createCompany = (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Nome da empresa é obrigatório" });
  }

  db.query("SELECT id FROM companies WHERE name = ?", [name], (err, results) => {
    if (err) {
      console.error("Erro ao verificar empresa:", err);
      return res.status(500).json({ error: "Erro ao criar empresa" });
    }

    if (results.length > 0) {
      return res.status(400).json({ error: "Empresa já cadastrada" });
    }

    db.query(
      "INSERT INTO companies (name) VALUES (?)",
      [name],
      (err, result) => {
        if (err) {
          console.error("Erro ao criar empresa:", err);
          return res.status(500).json({ error: "Erro ao criar empresa" });
        }

        res.status(201).json({
          message: "Empresa criada com sucesso",
          companyId: result.insertId
        });
      }
    );
  });
};

export const getCompanies = (req, res) => {
  db.query(
    "SELECT id, name, created_at FROM companies ORDER BY name ASC",
    [],
    (err, results) => {
      if (err) {
        console.error("Erro ao buscar empresas:", err);
        return res.status(500).json({ error: "Erro ao buscar empresas" });
      }

      res.json(results);
    }
  );
};