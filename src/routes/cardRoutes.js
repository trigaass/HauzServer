import express from "express";
import { 
  createCard, 
  getCards, 
  updateCard, 
  deleteCard 
} from "../controllers/cardController.js";

const router = express.Router();

router.post("/cards", createCard);
router.get("/cards", getCards);
router.put("/cards/:id", updateCard);
router.delete("/cards/:id", deleteCard);

export default router;