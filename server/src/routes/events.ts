import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/events — get recent events
router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50;

    const events = await prisma.event.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    res.json({ events });
  } catch (error) {
    console.error("Failed to fetch events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

export default router;
