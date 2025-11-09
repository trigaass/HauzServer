import db from "../configs/db.js";

// ✅ CRIAR OU BUSCAR CONVERSA DIRETA
export const getOrCreateConversation = (req, res) => {
  const { user_id_1, user_id_2 } = req.body;

  if (!user_id_1 || !user_id_2) {
    return res.status(400).json({ error: "user_id_1 e user_id_2 são obrigatórios" });
  }

  // Verificar se já existe conversa entre esses usuários
  const query = `
    SELECT c.id, c.type, c.created_at
    FROM conversations c
    INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
    INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.type = 'direct'
      AND ((cp1.user_id = ? AND cp2.user_id = ?) OR (cp1.user_id = ? AND cp2.user_id = ?))
      AND cp1.user_id != cp2.user_id
    LIMIT 1
  `;

  db.query(query, [user_id_1, user_id_2, user_id_2, user_id_1], (err, results) => {
    if (err) {
      console.error("Erro ao buscar conversa:", err);
      return res.status(500).json({ error: "Erro ao buscar conversa" });
    }

    if (results.length > 0) {
      return res.json(results[0]);
    }

    // Se não existe, criar nova conversa
    db.query(
      "INSERT INTO conversations (type) VALUES (?)",
      ['direct'],
      (err, result) => {
        if (err) {
          console.error("Erro ao criar conversa:", err);
          return res.status(500).json({ error: "Erro ao criar conversa" });
        }

        const conversationId = result.insertId;

        // Adicionar os dois participantes
        const insertParticipants = `
          INSERT INTO conversation_participants (conversation_id, user_id) 
          VALUES (?, ?), (?, ?)
        `;

        db.query(
          insertParticipants,
          [conversationId, user_id_1, conversationId, user_id_2],
          (err) => {
            if (err) {
              console.error("Erro ao adicionar participantes:", err);
              return res.status(500).json({ error: "Erro ao criar conversa" });
            }

            res.status(201).json({
              id: conversationId,
              type: 'direct',
              created_at: new Date()
            });
          }
        );
      }
    );
  });
};

// ✅ BUSCAR CONVERSAS DO USUÁRIO (SIMPLIFICADO)
export const getUserConversations = (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ error: "user_id é obrigatório" });
  }

  const query = `
    SELECT 
      c.id,
      c.type,
      c.created_at,
      c.updated_at
    FROM conversations c
    INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
    WHERE cp.user_id = ?
    ORDER BY c.updated_at DESC
  `;

  db.query(query, [user_id], async (err, conversations) => {
    if (err) {
      console.error("Erro ao buscar conversas:", err);
      return res.status(500).json({ error: "Erro ao buscar conversas" });
    }

    // Para cada conversa, buscar os participantes e última mensagem
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        return new Promise((resolve) => {
          // Buscar participantes
          db.query(
            `SELECT u.id, u.email, u.role
             FROM users u
             INNER JOIN conversation_participants cp ON u.id = cp.user_id
             WHERE cp.conversation_id = ? AND u.id != ?`,
            [conv.id, user_id],
            (err, participants) => {
              if (err) {
                resolve({ ...conv, participants: [], last_message: null, unread_count: 0 });
                return;
              }

              // Buscar última mensagem
              db.query(
                `SELECT content, created_at 
                 FROM messages 
                 WHERE conversation_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [conv.id],
                (err, messages) => {
                  const lastMessage = messages && messages.length > 0 ? messages[0] : null;

                  // Buscar mensagens não lidas
                  db.query(
                    `SELECT COUNT(*) as count 
                     FROM messages 
                     WHERE conversation_id = ? 
                       AND sender_id != ? 
                       AND read = false`,
                    [conv.id, user_id],
                    (err, unreadResult) => {
                      resolve({
                        ...conv,
                        participants: participants || [],
                        last_message: lastMessage?.content || null,
                        last_message_at: lastMessage?.created_at || null,
                        unread_count: unreadResult?.[0]?.count || 0
                      });
                    }
                  );
                }
              );
            }
          );
        });
      })
    );

    res.json(conversationsWithDetails);
  });
};

// ✅ ENVIAR MENSAGEM
export const sendMessage = (req, res) => {
  const { conversation_id, sender_id, content } = req.body;

  if (!conversation_id || !sender_id || !content) {
    return res.status(400).json({ 
      error: "conversation_id, sender_id e content são obrigatórios" 
    });
  }

  // Verificar se o usuário faz parte da conversa
  db.query(
    "SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
    [conversation_id, sender_id],
    (err, results) => {
      if (err) {
        console.error("Erro ao verificar participante:", err);
        return res.status(500).json({ error: "Erro ao enviar mensagem" });
      }

      if (results.length === 0) {
        return res.status(403).json({ error: "Usuário não faz parte desta conversa" });
      }

      db.query(
        "INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)",
        [conversation_id, sender_id, content],
        (err, result) => {
          if (err) {
            console.error("Erro ao enviar mensagem:", err);
            return res.status(500).json({ error: "Erro ao enviar mensagem" });
          }

          // Atualizar updated_at da conversa
          db.query(
            "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [conversation_id],
            () => {}
          );

          res.status(201).json({
            message: "Mensagem enviada com sucesso",
            messageId: result.insertId
          });
        }
      );
    }
  );
};

// ✅ BUSCAR MENSAGENS DE UMA CONVERSA
export const getMessages = (req, res) => {
  const { conversation_id } = req.params;
  const { user_id, limit = 50, offset = 0 } = req.query;

  if (!conversation_id) {
    return res.status(400).json({ error: "conversation_id é obrigatório" });
  }

  // Verificar se o usuário faz parte da conversa
  db.query(
    "SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
    [conversation_id, user_id],
    (err, results) => {
      if (err) {
        console.error("Erro ao verificar participante:", err);
        return res.status(500).json({ error: "Erro ao buscar mensagens" });
      }

      if (results.length === 0) {
        return res.status(403).json({ error: "Usuário não faz parte desta conversa" });
      }

      const query = `
        SELECT 
          m.id,
          m.content,
          m.sender_id,
          m.read,
          m.created_at,
          u.email as sender_email,
          u.role as sender_role
        FROM messages m
        INNER JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      `;

      db.query(query, [conversation_id, parseInt(limit), parseInt(offset)], (err, messages) => {
        if (err) {
          console.error("Erro ao buscar mensagens:", err);
          return res.status(500).json({ error: "Erro ao buscar mensagens" });
        }

        res.json(messages.reverse());
      });
    }
  );
};

// ✅ MARCAR MENSAGENS COMO LIDAS
export const markAsRead = (req, res) => {
  const { conversation_id } = req.params;
  const { user_id } = req.body;

  if (!conversation_id || !user_id) {
    return res.status(400).json({ error: "conversation_id e user_id são obrigatórios" });
  }

  db.query(
    "UPDATE messages SET read = true WHERE conversation_id = ? AND sender_id != ? AND read = false",
    [conversation_id, user_id],
    (err, result) => {
      if (err) {
        console.error("Erro ao marcar como lido:", err);
        return res.status(500).json({ error: "Erro ao marcar mensagens como lidas" });
      }

      res.json({ 
        message: "Mensagens marcadas como lidas",
        updatedCount: result.affectedRows
      });
    }
  );
};

// ✅ BUSCAR USUÁRIOS DISPONÍVEIS PARA CHAT (SIMPLIFICADO)
export const getAvailableUsers = (req, res) => {
  const { user_id, company_id } = req.query;

  if (!user_id || !company_id) {
    return res.status(400).json({ error: "user_id e company_id são obrigatórios" });
  }

  // Buscar todos os usuários da mesma empresa, exceto o usuário atual
  const query = `
    SELECT 
      u.id,
      u.email,
      u.role,
      u.company_id
    FROM users u
    WHERE u.company_id = ?
      AND u.id != ?
    ORDER BY u.role DESC, u.email ASC
  `;

  db.query(query, [company_id, user_id], (err, users) => {
    if (err) {
      console.error("Erro ao buscar usuários:", err);
      return res.status(500).json({ error: "Erro ao buscar usuários" });
    }

    // Para cada usuário, verificar se já existe conversa
    const usersWithConversationStatus = users.map(user => ({
      ...user,
      has_conversation: false // Por enquanto, sempre false (pode implementar depois se necessário)
    }));

    res.json(usersWithConversationStatus);
  });
};