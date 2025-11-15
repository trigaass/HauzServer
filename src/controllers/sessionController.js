import db from "../configs/db.js";

// 🟢 REGISTRAR LOGIN
export const registerLogin = (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id é obrigatório" });
  }

  db.query(
    "INSERT INTO user_sessions (user_id, login_at, date) VALUES (?, NOW(), CURRENT_DATE)",
    [user_id],
    (err, result) => {
      if (err) {
        console.error("Erro ao registrar login:", err);
        return res.status(500).json({ error: "Erro ao registrar login" });
      }

      res.status(201).json({
        message: "Login registrado com sucesso",
        sessionId: result.insertId
      });
    }
  );
};

// 🔴 REGISTRAR LOGOUT
export const registerLogout = (req, res) => {
  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ error: "session_id é obrigatório" });
  }

  // Buscar a sessão e calcular a duração
  db.query(
    "SELECT login_at FROM user_sessions WHERE id = ? AND logout_at IS NULL",
    [session_id],
    (err, results) => {
      if (err) {
        console.error("Erro ao buscar sessão:", err);
        return res.status(500).json({ error: "Erro ao registrar logout" });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: "Sessão não encontrada ou já finalizada" });
      }

      // Atualizar com logout e duração
      db.query(
        `UPDATE user_sessions 
         SET logout_at = NOW(),
             duration_seconds = EXTRACT(EPOCH FROM (NOW() - login_at))
         WHERE id = ?`,
        [session_id],
        (err) => {
          if (err) {
            console.error("Erro ao registrar logout:", err);
            return res.status(500).json({ error: "Erro ao registrar logout" });
          }

          res.json({ message: "Logout registrado com sucesso" });
        }
      );
    }
  );
};

// 📊 BUSCAR TEMPO DE LOGIN DO DIA
export const getDailyTime = (req, res) => {
  const { user_id, date } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: "user_id é obrigatório" });
  }

  const queryDate = date || 'CURRENT_DATE';
  const query = `
    SELECT 
      date,
      COUNT(*) as session_count,
      SUM(COALESCE(duration_seconds, 0)) as total_seconds,
      FLOOR(SUM(COALESCE(duration_seconds, 0)) / 3600) as hours,
      FLOOR((SUM(COALESCE(duration_seconds, 0)) % 3600) / 60) as minutes,
      SUM(COALESCE(duration_seconds, 0)) % 60 as seconds
    FROM user_sessions
    WHERE user_id = ? 
      AND date = ${date ? '?' : 'CURRENT_DATE'}
    GROUP BY date
  `;

  const params = date ? [user_id, date] : [user_id];

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Erro ao buscar tempo diário:", err);
      return res.status(500).json({ error: "Erro ao buscar tempo diário" });
    }

    if (results.length === 0) {
      return res.json({
        date: date || new Date().toISOString().split('T')[0],
        session_count: 0,
        total_seconds: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
      });
    }

    res.json(results[0]);
  });
};

// 📅 BUSCAR TEMPO DA SEMANA
export const getWeeklyTime = (req, res) => {
  const { user_id, start_date, end_date } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: "user_id é obrigatório" });
  }

  // Se não informar datas, pegar semana atual (domingo a sábado)
  const query = `
    SELECT 
      date,
      COUNT(*) as session_count,
      SUM(COALESCE(duration_seconds, 0)) as total_seconds,
      FLOOR(SUM(COALESCE(duration_seconds, 0)) / 3600) as hours,
      FLOOR((SUM(COALESCE(duration_seconds, 0)) % 3600) / 60) as minutes,
      SUM(COALESCE(duration_seconds, 0)) % 60 as seconds
    FROM user_sessions
    WHERE user_id = ?
      ${start_date ? 'AND date >= ?' : 'AND date >= DATE_TRUNC(\'week\', CURRENT_DATE)'}
      ${end_date ? 'AND date <= ?' : 'AND date <= CURRENT_DATE'}
    GROUP BY date
    ORDER BY date ASC
  `;

  const params = [user_id];
  if (start_date) params.push(start_date);
  if (end_date) params.push(end_date);

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Erro ao buscar tempo semanal:", err);
      return res.status(500).json({ error: "Erro ao buscar tempo semanal" });
    }

    // Calcular total da semana
    const totalSeconds = results.reduce((sum, day) => sum + parseInt(day.total_seconds), 0);
    const totalSessions = results.reduce((sum, day) => sum + parseInt(day.session_count), 0);

    res.json({
      days: results,
      summary: {
        total_sessions: totalSessions,
        total_seconds: totalSeconds,
        total_hours: Math.floor(totalSeconds / 3600),
        total_minutes: Math.floor((totalSeconds % 3600) / 60),
        average_daily_seconds: results.length > 0 ? Math.floor(totalSeconds / results.length) : 0
      }
    });
  });
};

// 📈 BUSCAR HISTÓRICO COMPLETO (últimos 30 dias)
export const getTimeHistory = (req, res) => {
  const { user_id, days = 30 } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: "user_id é obrigatório" });
  }

  const query = `
    SELECT 
      date,
      COUNT(*) as session_count,
      SUM(COALESCE(duration_seconds, 0)) as total_seconds,
      FLOOR(SUM(COALESCE(duration_seconds, 0)) / 3600) as hours,
      FLOOR((SUM(COALESCE(duration_seconds, 0)) % 3600) / 60) as minutes
    FROM user_sessions
    WHERE user_id = ?
      AND date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
    GROUP BY date
    ORDER BY date DESC
  `;

  db.query(query, [user_id], (err, results) => {
    if (err) {
      console.error("Erro ao buscar histórico:", err);
      return res.status(500).json({ error: "Erro ao buscar histórico" });
    }

    res.json(results);
  });
};

// 🔄 BUSCAR SESSÃO ATIVA
export const getActiveSession = (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ error: "user_id é obrigatório" });
  }

  db.query(
    `SELECT id, login_at, 
            EXTRACT(EPOCH FROM (NOW() - login_at)) as elapsed_seconds
     FROM user_sessions
     WHERE user_id = ? 
       AND logout_at IS NULL
       AND date = CURRENT_DATE
     ORDER BY login_at DESC
     LIMIT 1`,
    [user_id],
    (err, results) => {
      if (err) {
        console.error("Erro ao buscar sessão ativa:", err);
        return res.status(500).json({ error: "Erro ao buscar sessão ativa" });
      }

      if (results.length === 0) {
        return res.json({ active: false, session: null });
      }

      res.json({ 
        active: true, 
        session: results[0] 
      });
    }
  );
};

// 📊 BUSCAR RESUMO DE TODOS OS USUÁRIOS (ADMIN)
export const getAllUsersTime = (req, res) => {
  const { company_id } = req.query;

  if (!company_id) {
    return res.status(400).json({ error: "company_id é obrigatório" });
  }

  const query = `
    SELECT 
      u.id,
      u.email,
      u.role,
      -- Tempo de hoje
      COALESCE(SUM(CASE WHEN s.date = CURRENT_DATE THEN s.duration_seconds ELSE 0 END), 0) as today_seconds,
      -- Tempo da semana
      COALESCE(SUM(CASE 
        WHEN s.date >= DATE_TRUNC('week', CURRENT_DATE) 
        AND s.date <= CURRENT_DATE 
        THEN s.duration_seconds 
        ELSE 0 
      END), 0) as week_seconds,
      -- Sessão ativa
      MAX(CASE 
        WHEN s.logout_at IS NULL AND s.date = CURRENT_DATE 
        THEN EXTRACT(EPOCH FROM (NOW() - s.login_at))
        ELSE 0 
      END) as active_seconds
    FROM users u
    LEFT JOIN user_sessions s ON u.id = s.user_id
    WHERE u.company_id = ?
    GROUP BY u.id, u.email, u.role
    ORDER BY u.role DESC, u.email ASC
  `;

  db.query(query, [company_id], (err, results) => {
    if (err) {
      console.error("Erro ao buscar tempo dos usuários:", err);
      return res.status(500).json({ error: "Erro ao buscar dados" });
    }

    const formattedResults = results.map(user => ({
      ...user,
      is_online: user.active_seconds > 0,
      today_seconds: parseInt(user.today_seconds) + parseInt(user.active_seconds),
      week_seconds: parseInt(user.week_seconds) + parseInt(user.active_seconds)
    }));

    res.json(formattedResults);
  });
};