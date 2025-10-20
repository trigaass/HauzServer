import express from "express";
import { createCompany, getCompanies } from "../controllers/companyController.js";

const router = express.Router();

router.post("/companies", createCompany);
router.get("/companies", getCompanies);

export default router;
