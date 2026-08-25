import express from "express";
import cors from "cors";
import healthRouter from "./routes/health";
import productsRouter from "./routes/products";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/health", healthRouter);
app.use("/api/products", productsRouter);

// Start server
app.listen(PORT, () => {
  console.log(`⚡ AgentStorm server running on http://localhost:${PORT}`);
});
