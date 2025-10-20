import express from "express";
import { 
  createBoard, 
  getBoards, 
  getBoardUsers,
  deleteBoard,
  addUserToBoard, 
  removeUserFromBoard 
} from "../controllers/boardController.js";

const router = express.Router();

router.post("/boards", createBoard);
router.get("/boards", getBoards);
router.get("/boards/:id/users", getBoardUsers);
router.delete("/boards/:id", deleteBoard);
router.post("/boards/users", addUserToBoard);
router.delete("/boards/users", removeUserFromBoard);

export default router;