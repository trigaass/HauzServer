import db from "../configs/db.js";
import bcrypt from "bcrypt";

export const createUser = async (req, res) => {
  const { email, password, role, company_id } = req.body;

  if (!email || !password || !role || !company_id) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Email inválido" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
  }

  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: "Role deve ser 'admin' ou 'user'" });
  }

  try {
    db.query("SELECT id FROM users WHERE email = ?", [email], async (err, results) => {
      if (err) {
        console.error("Erro ao verificar email:", err);
        return res.status(500).json({ error: "Erro ao criar usuário" });
      }

      if (results.length > 0) {
        return res.status(400).json({ error: "Email já cadastrado" });
      }

      db.query("SELECT id FROM companies WHERE id = ?", [company_id], async (err, companyResults) => {
        if (err) {
          console.error("Erro ao verificar empresa:", err);
          return res.status(500).json({ error: "Erro ao criar usuário" });
        }

        if (companyResults.length === 0) {
          return res.status(404).json({ error: "Empresa não encontrada" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
          "INSERT INTO users (email, password, role, company_id) VALUES (?, ?, ?, ?)",
          [email, hashedPassword, role, company_id],
          (err, result) => {
            if (err) {
              console.error("Erro ao criar usuário:", err);
              return res.status(500).json({ error: "Erro ao criar usuário" });
            }

            res.status(201).json({ 
              message: "Usuário criado com sucesso", 
              userId: result.insertId 
            });
          }
        );
      });
    });
  } catch (error) {
    console.error("Erro ao processar criação de usuário:", error);
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
};

export const getUsers = (req, res) => {
  const { company_id } = req.query;

  let query = `
    SELECT u.id, u.email, u.role, u.company_id, u.created_at, c.name as company_name
    FROM users u
    JOIN companies c ON u.company_id = c.id
  `;
  const params = [];

  if (company_id) {
    query += " WHERE u.company_id = ?";
    params.push(company_id);
  }

  query += " ORDER BY u.created_at DESC";

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Erro ao buscar usuários:", err);
      return res.status(500).json({ error: "Erro ao buscar usuários" });
    }

    res.json(results);
  });
};