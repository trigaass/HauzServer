import express from "express";
import {
  registerLogin,
  registerLogout,
  getDailyTime,
  getWeeklyTime,
  getTimeHistory,
  getActiveSession,
  getAllUsersTime
} from "../controllers/sessionController.js";

const router = express.Router();

// Registrar login/logout
router.post("/sessions/login", registerLogin);
router.post("/sessions/logout", registerLogout);

// Buscar tempos
router.get("/sessions/daily", getDailyTime);
router.get("/sessions/weekly", getWeeklyTime);
router.get("/sessions/history", getTimeHistory);
router.get("/sessions/active/:user_id", getActiveSession);
router.get("/sessions/users/all", getAllUsersTime);

export default router;