import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dbConnect from "./config/db.js";

// Routes import
import authRoutes from "./routes/auth.js";
import recipeRoutes from "./routes/recipes.js";
import favoriteRoutes from "./routes/favorites.js";
import reportRoutes from "./routes/reports.js";
import checkoutRoutes from "./routes/checkout.js";
import dashboardRoutes from "./routes/dashboard.js";
import adminRoutes from "./routes/admin.js";
import seedRoutes from "./routes/seed.js";

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Connect to MongoDB
dbConnect();

// Express JSON middleware with raw buffer parser for Stripe webhook validation
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith("/api/checkout/webhook")) {
        req.rawBody = buf;
      }
    },
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS configuration to support cross-origin cookie sharing
const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:3000"
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman, etc.)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.includes(origin) || 
                        origin.endsWith(".vercel.app") || 
                        origin === "http://localhost:3000";
      
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "stripe-signature"],
  })
);

// Register API Routes
app.use("/api/auth", authRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/seed", seedRoutes);

// Base route for healthcheck
app.get("/", (req, res) => {
  res.json({ message: "RecipeHub backend API is running smoothly." });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
