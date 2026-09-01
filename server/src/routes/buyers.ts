import { Router, Request, Response } from "express";
import { BUYER_PERSONAS, runBuyer } from "../services/buyer";
import { getAggregatedBuyerAnalytics, getDecisionHistory } from "../services/buyerAnalytics";

const router = Router();

// GET /api/buyers — list all buyer personas
router.get("/", (_req: Request, res: Response) => {
  const buyers = BUYER_PERSONAS.map((p) => ({
    id: p.id,
    name: p.name,
    budget: p.budget,
    category: p.category,
    goal: p.goal,
    behavior: p.behavior,
  }));

  res.json({ buyers });
});

// GET /api/buyers/analytics — aggregated buyer analytics & decision telemetry
router.get("/analytics", async (_req: Request, res: Response) => {
  try {
    const analytics = await getAggregatedBuyerAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error("Failed to fetch buyer analytics:", error);
    res.status(500).json({ error: "Failed to fetch buyer analytics" });
  }
});

// GET /api/buyers/:id/analytics — specific persona analytics & history
router.get("/:id/analytics", async (req: Request, res: Response) => {
  try {
    const buyerId = req.params.id as string;
    const persona = BUYER_PERSONAS.find((p) => p.id === buyerId);
    if (!persona) {
      res.status(404).json({ error: "Buyer persona not found" });
      return;
    }

    const aggregated = await getAggregatedBuyerAnalytics();
    const personaAnalytics = aggregated.personaBreakdown.find((p) => p.personaId === buyerId);
    const history = getDecisionHistory(buyerId);

    res.json({
      persona,
      analytics: personaAnalytics,
      history,
    });
  } catch (error) {
    console.error("Failed to fetch persona analytics:", error);
    res.status(500).json({ error: "Failed to fetch persona analytics" });
  }
});

// POST /api/buyers/:id/run — execute a buyer's decision loop
router.post("/:id/run", async (req: Request, res: Response) => {
  try {
    const buyerId = req.params.id as string;

    const persona = BUYER_PERSONAS.find((p) => p.id === buyerId);
    if (!persona) {
      res.status(404).json({ error: "Buyer persona not found" });
      return;
    }

    const result = await runBuyer(buyerId);
    res.json({ result });
  } catch (error) {
    console.error("Failed to run buyer:", error);
    res.status(500).json({ error: "Failed to run buyer" });
  }
});

export default router;
