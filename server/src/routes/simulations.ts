import { Router, Request, Response } from "express";
import { SIMULATION_SCENARIOS, runSimulation, getSimulationRecord } from "../services/simulation";
import { getSimulationAnalytics } from "../services/simulationAnalytics";

const router = Router();

// GET /api/simulations/scenarios — list available simulation scenarios
router.get("/scenarios", (_req: Request, res: Response) => {
  res.json({ scenarios: SIMULATION_SCENARIOS });
});

// GET /api/simulations/analytics — simulation intelligence & scenario analytics
router.get("/analytics", async (_req: Request, res: Response) => {
  try {
    const analytics = await getSimulationAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error("Failed to fetch simulation analytics:", error);
    res.status(500).json({ error: "Failed to fetch simulation analytics" });
  }
});

// GET /api/simulations/:id/report — get reliability report for a simulation run
router.get("/:id/report", (req: Request, res: Response) => {
  const simulationId = req.params.id as string;
  const record = getSimulationRecord(simulationId);

  if (!record) {
    res.status(404).json({ error: `Simulation '${simulationId}' report not found` });
    return;
  }

  res.json({ report: record.report, result: record.result });
});

// POST /api/simulations/run — execute a concurrent simulation scenario
router.post("/run", async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.body;

    if (!scenarioId || typeof scenarioId !== "string") {
      res.status(400).json({ error: "scenarioId is required" });
      return;
    }

    const scenario = SIMULATION_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) {
      res.status(404).json({ error: `Scenario '${scenarioId}' not found` });
      return;
    }

    const result = await runSimulation(scenarioId);
    res.json({ result, report: result.report });
  } catch (error) {
    console.error("Simulation route error:", error);
    res.status(500).json({ error: "Failed to execute simulation" });
  }
});

export default router;
