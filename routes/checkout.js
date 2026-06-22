import express from "express";
import Stripe from "stripe";
import { authenticate } from "../middleware/auth.js";
import Recipe from "../models/Recipe.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

let stripe = null;
if (STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.startsWith("your_")) {
  stripe = new Stripe(STRIPE_SECRET_KEY);
}

// POST /api/checkout - Create checkout session
router.post("/", authenticate, async (req, res) => {
  try {
    const { type, recipeId } = req.body;
    if (!type || !["premium", "recipe"].includes(type)) {
      return res.status(400).json({ error: "Invalid payment type" });
    }

    let amount = 0;
    let title = "";

    if (type === "premium") {
      amount = 19.99;
      title = "RecipeHub Premium Membership";
    } else {
      if (!recipeId) {
        return res.status(400).json({ error: "Recipe ID is required" });
      }
      const recipe = await Recipe.findById(recipeId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      if (recipe.price <= 0) {
        return res.status(400).json({ error: "Recipe is free" });
      }
      amount = recipe.price;
      title = `Purchase Recipe: ${recipe.recipeName}`;
    }

    const origin = req.headers.origin || process.env.CLIENT_URL || "http://localhost:3000";

    // MOCK CHECKOUT MODE (Fallback if Stripe Secret Key missing)
    if (!stripe) {
      console.warn("Stripe Secret Key missing/placeholder. Falling back to Mock checkout mode.");
      const mockSessionId = `mock_session_${Math.random().toString(36).substring(2, 15)}`;
      const successUrl = `${origin}/payment/success?session_id=${mockSessionId}&type=${type}&recipeId=${recipeId || ""}&amount=${amount}`;
      return res.json({ url: successUrl });
    }

    // Real Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: title,
              description: type === "premium" ? "Unlocks unlimited uploads and Premium Profile badge" : "Instant access to ingredient list and guidelines",
            },
            unit_amount: Math.round(amount * 100), // in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        type,
        userId: req.user._id.toString(),
        userEmail: req.user.email,
        recipeId: recipeId || "",
        amount: amount.toString(),
      },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: type === "premium" ? `${origin}/dashboard` : `${origin}/recipes/${recipeId}`,
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error("Checkout Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/checkout/success - Verify checkout success
router.post("/success", authenticate, async (req, res) => {
  try {
    const { sessionId, type, recipeId, amount } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    // Check duplicate
    const existingPayment = await Payment.findOne({ transactionId: sessionId });
    if (existingPayment) {
      return res.json({
        message: "Payment already processed",
        payment: existingPayment,
      });
    }

    let processedType = type;
    let processedRecipeId = recipeId || null;
    let processedAmount = amount ? Number(amount) : 0;

    // Handle Mock checkout verification
    if (sessionId.startsWith("mock_session_")) {
      const payment = await Payment.create({
        userEmail: req.user.email,
        userId: req.user._id,
        amount: processedAmount,
        recipeId: processedRecipeId ? processedRecipeId : null,
        transactionId: sessionId,
        paymentStatus: "paid",
        paidAt: new Date(),
      });

      if (processedType === "premium") {
        await User.findByIdAndUpdate(req.user._id, { isPremium: true });
      }

      return res.json({
        message: "Payment successfully verified (Mock mode)",
        payment,
      });
    }

    // Real Stripe Session Verification
    if (!stripe) {
      return res.status(500).json({ error: "Stripe configuration error" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    processedType = session.metadata.type;
    processedRecipeId = session.metadata.recipeId || null;
    processedAmount = Number(session.metadata.amount || 0);

    const payment = await Payment.create({
      userEmail: session.metadata.userEmail,
      userId: session.metadata.userId,
      amount: processedAmount,
      recipeId: processedRecipeId ? processedRecipeId : null,
      transactionId: session.id,
      paymentStatus: "paid",
      paidAt: new Date(),
    });

    if (processedType === "premium") {
      await User.findByIdAndUpdate(session.metadata.userId, { isPremium: true });
    }

    return res.json({
      message: "Payment successfully verified",
      payment,
    });
  } catch (error) {
    console.error("Verify Payment Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/checkout/webhook - Stripe Webhook
router.post("/webhook", async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe not configured" });
  }

  try {
    const sig = req.headers["stripe-signature"];
    let event;

    if (STRIPE_WEBHOOK_SECRET && sig) {
      try {
        event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }
    } else {
      event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const transactionId = session.id;

      const alreadyPaid = await Payment.findOne({ transactionId });
      if (!alreadyPaid) {
        const metadata = session.metadata;
        const type = metadata.type;
        const userId = metadata.userId;
        const userEmail = metadata.userEmail;
        const recipeId = metadata.recipeId || null;
        const amount = Number(metadata.amount || 0);

        await Payment.create({
          userEmail,
          userId,
          amount,
          recipeId: recipeId ? recipeId : null,
          transactionId,
          paymentStatus: "paid",
          paidAt: new Date(),
        });

        if (type === "premium") {
          await User.findByIdAndUpdate(userId, { isPremium: true });
        }
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Stripe Webhook Route Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
