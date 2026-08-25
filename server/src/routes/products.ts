import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/products — list all products
router.get("/", async (_req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: { merchant: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ products, count: products.length });
  } catch (error) {
    console.error("Failed to fetch products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET /api/products/:id — get single product
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // Basic ID validation — cuid is alphanumeric, typically 25 chars
    if (!id || typeof id !== "string" || id.length < 10 || id.length > 40) {
      res.status(400).json({ error: "Invalid product ID format" });
      return;
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: { merchant: { select: { id: true, name: true } } },
    });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json({ product });
  } catch (error) {
    console.error("Failed to fetch product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

export default router;
