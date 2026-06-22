import mongoose from "mongoose";

const RecipeSchema = new mongoose.Schema(
  {
    recipeName: {
      type: String,
      required: [true, "Please provide a recipe name"],
    },
    recipeImage: {
      type: String,
      required: [true, "Please provide a recipe image"],
    },
    category: {
      type: String,
      required: [true, "Please provide a category"],
    },
    cuisineType: {
      type: String,
      required: [true, "Please provide a cuisine type"],
    },
    difficultyLevel: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      required: [true, "Please provide a difficulty level"],
    },
    preparationTime: {
      type: Number,
      required: [true, "Please provide preparation time in minutes"],
    },
    ingredients: {
      type: [String],
      required: [true, "Please provide ingredients"],
    },
    instructions: {
      type: String,
      required: [true, "Please provide instructions"],
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    authorEmail: {
      type: String,
      required: true,
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      default: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["published", "archived"],
      default: "published",
    },
  },
  { timestamps: true }
);

export default mongoose.models.Recipe || mongoose.model("Recipe", RecipeSchema);
