import db from "../configs/db.js";
import bcrypt from "bcrypt";

export const login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Preencha todos os campos" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Email inválido" });
  }

  // 🔥 MUDANÇA: Usar ? em vez de $1
  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) {
      console.error("Erro no banco de dados:", err);
      return res.status(500).json({ error: "Erro ao processar login" });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "Email ou senha incorretos" });
    }

    const user = results[0];

    try {
      const validPass = await bcrypt.compare(password, user.password);
      if (!validPass) {
        return res.status(401).json({ error: "Email ou senha incorretos" });
      }

      return res.json({
        message: "Login realizado com sucesso",
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isAdmin: user.role === 'admin',
          company_id: user.company_id
        }
      });
    } catch (error) {
      console.error("Erro ao comparar senha:", error);
      return res.status(500).json({ error: "Erro ao processar login" });
    }
  });
};