import express from "express";
import cors from "cors";
import healthRouter from "./routes/health";
import productsRouter from "./routes/products";
import ordersRouter from "./routes/orders";
import paymentsRouter from "./routes/payments";
import eventsRouter from "./routes/events";
import buyersRouter from "./routes/buyers";
import simulationsRouter from "./routes/simulations";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/health", healthRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/events", eventsRouter);
app.use("/api/buyers", buyersRouter);
app.use("/api/simulations", simulationsRouter);

// Start server
app.listen(PORT, () => {
  console.log(`⚡ AgentStorm server running on http://localhost:${PORT}`);
});
