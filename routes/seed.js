import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Recipe from "../models/Recipe.js";
import Payment from "../models/Payment.js";
import Favorite from "../models/Favorite.js";
import Report from "../models/Report.js";

const router = express.Router();

// GET /api/seed - Seed database
router.get("/", async (req, res) => {
  try {
    const clean = req.query.clean === "true";

    if (clean) {
      await User.deleteMany({});
      await Recipe.deleteMany({});
      await Payment.deleteMany({});
      await Favorite.deleteMany({});
      await Report.deleteMany({});
      console.log("Database cleared successfully.");
    }

    const userCount = await User.countDocuments();
    if (userCount > 0 && !clean) {
      return res.json({ message: "Database already seeded. Access with ?clean=true to clean & reseed." });
    }

    const hashedAdminPassword = await bcrypt.hash("Admin123", 10);
    const hashedUserPassword = await bcrypt.hash("User1234", 10);

    // 1. Create Users
    const admin = await User.create({
      name: "Admin Raymond",
      email: "admin_chef@recipehub.com",
      password: hashedAdminPassword,
      image: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=100",
      role: "admin",
      isBlocked: false,
      isPremium: true,
    });

    const chef = await User.create({
      name: "Chef Elena Rostova",
      email: "chef_test@recipehub.com",
      password: hashedUserPassword,
      image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=100",
      role: "user",
      isBlocked: false,
      isPremium: true,
    });

    const foodie = await User.create({
      name: "John Foodie",
      email: "foodie_test@recipehub.com",
      password: hashedUserPassword,
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
      role: "user",
      isBlocked: false,
      isPremium: false,
    });

    // 2. Create Recipes
    const recipesData = [
      {
        recipeName: "Classic Margherita Pizza",
        recipeImage: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800",
        category: "Lunch",
        cuisineType: "Italian",
        difficultyLevel: "Easy",
        preparationTime: 30,
        ingredients: [
          "1 pre-made pizza dough",
          "1/2 cup canned crushed tomatoes",
          "1 cup fresh mozzarella slices",
          "Fresh basil leaves",
          "1 tbsp olive oil",
          "Salt and black pepper to taste"
        ],
        instructions: "1. Preheat oven to 450°F (230°C).\n2. Roll out pizza dough onto a baking sheet.\n3. Spread crushed tomatoes evenly over dough.\n4. Arrange mozzarella slices on top.\n5. Drizzle with olive oil, sprinkle with salt.\n6. Bake for 12-15 minutes until crust is golden.\n7. Top with fresh basil before serving.",
        authorId: chef._id,
        authorName: chef.name,
        authorEmail: chef.email,
        likesCount: 15,
        price: 0,
        isFeatured: true,
        status: "published",
      },
      {
        recipeName: "Gourmet Chocolate Soufflé",
        recipeImage: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800",
        category: "Dessert",
        cuisineType: "French",
        difficultyLevel: "Hard",
        preparationTime: 45,
        ingredients: [
          "100g high-quality dark chocolate (70%)",
          "3 tbsp unsalted butter",
          "3 large egg yolks",
          "4 large egg whites",
          "1/4 cup granulated sugar",
          "1/2 tsp vanilla extract",
          "Powdered sugar for dusting"
        ],
        instructions: "1. Heat oven to 375°F (190°C). Butter four 6-ounce ramekins and coat with sugar.\n2. Melt chocolate and butter together in a heatproof bowl set over simmering water.\n3. Remove from heat, let cool slightly, then whisk in egg yolks and vanilla.\n4. Beat egg whites until soft peaks form, add sugar gradually, beating until stiff but not dry.\n5. Gently fold 1/3 of the whites into the chocolate mixture, then fold in the rest.\n6. Divide among ramekins. Bake for 12-15 minutes until puffed. Dust with powdered sugar.",
        authorId: chef._id,
        authorName: chef.name,
        authorEmail: chef.email,
        likesCount: 42,
        price: 2.99, // Paid recipe!
        isFeatured: true,
        status: "published",
      },
      {
        recipeName: "Spicy Birria Beef Tacos",
        recipeImage: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800",
        category: "Dinner",
        cuisineType: "Mexican",
        difficultyLevel: "Medium",
        preparationTime: 120,
        ingredients: [
          "1 kg beef chuck roast",
          "3 dried ancho chilies",
          "3 dried guajillo chilies",
          "1 onion, chopped",
          "4 garlic cloves",
          "Corn tortillas",
          "1 cup shredded Oaxaca cheese",
          "Cilantro and chopped onion for garnish"
        ],
        instructions: "1. Boil dried chilies, onion, garlic, and spices in water for 15 minutes. Blend into a smooth paste.\n2. Sear beef chuck roast in a large pot, pour chili paste over, and simmer with water for 3 hours until tender.\n3. Shred the beef, retaining the rich broth (consome).\n4. Dip tortillas in consome fat, fry on a flat grill, add cheese and beef, and fold.\n5. Serve hot with a cup of consome for dipping.",
        authorId: chef._id,
        authorName: chef.name,
        authorEmail: chef.email,
        likesCount: 28,
        price: 0,
        isFeatured: false,
        status: "published",
      },
      {
        recipeName: "Authentic Salmon Sushi Rolls",
        recipeImage: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800",
        category: "Dinner",
        cuisineType: "Japanese",
        difficultyLevel: "Hard",
        preparationTime: 60,
        ingredients: [
          "2 cups sushi rice, cooked and seasoned",
          "4 sheets nori (seaweed)",
          "150g sushi-grade raw salmon, sliced",
          "1 cucumber, cut into thin strips",
          "1 avocado, sliced",
          "Soy sauce and wasabi for serving"
        ],
        instructions: "1. Place nori sheet on a bamboo rolling mat.\n2. Spread 1/2 cup of sushi rice evenly over nori, leaving a 1-inch border.\n3. Arrange salmon strips, cucumber, and avocado in a line across the center of the rice.\n4. Roll tightly using the mat, sealing the border with a drop of water.\n5. Slice roll into 6-8 pieces with a wet, sharp knife. Serve with soy sauce.",
        authorId: admin._id,
        authorName: admin.name,
        authorEmail: admin.email,
        likesCount: 19,
        price: 4.99, // Paid recipe!
        isFeatured: false,
        status: "published",
      },
      {
        recipeName: "Buttermilk Fluffy Pancakes",
        recipeImage: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800",
        category: "Breakfast",
        cuisineType: "American",
        difficultyLevel: "Easy",
        preparationTime: 20,
        ingredients: [
          "2 cups all-purpose flour",
          "2 tsp baking powder",
          "1/2 tsp baking soda",
          "2 tbsp sugar",
          "2 cups buttermilk",
          "2 eggs",
          "3 tbsp melted butter"
        ],
        instructions: "1. Whisk flour, baking powder, baking soda, and sugar in a large bowl.\n2. Whisk buttermilk, eggs, and melted butter in another bowl.\n3. Fold wet ingredients into dry until just combined.\n4. Heat a greased griddle over medium heat.\n5. Pour batter onto griddle, cook until bubbles form, flip, and cook until golden brown.",
        authorId: chef._id,
        authorName: chef.name,
        authorEmail: chef.email,
        likesCount: 35,
        price: 0,
        isFeatured: false,
        status: "published",
      },
      {
        recipeName: "Triple Berry Green Smoothie",
        recipeImage: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800",
        category: "Beverages",
        cuisineType: "American",
        difficultyLevel: "Easy",
        preparationTime: 10,
        ingredients: [
          "1/2 cup frozen strawberries",
          "1/2 cup frozen blueberries",
          "1/2 cup frozen raspberries",
          "1 cup baby spinach leaves",
          "1 cup almond milk",
          "1 tbsp honey or maple syrup"
        ],
        instructions: "1. Combine all ingredients in a high-speed blender.\n2. Blend until smooth and creamy, adjusting milk if too thick.\n3. Pour into glasses and serve chilled.",
        authorId: foodie._id,
        authorName: foodie.name,
        authorEmail: foodie.email,
        likesCount: 9,
        price: 0,
        isFeatured: false,
        status: "published",
      }
    ];

    await Recipe.create(recipesData);

    return res.json({
      message: "Database seeded successfully",
      users: {
        admin: "admin_chef@recipehub.com (Password: Admin123)",
        chef: "chef_test@recipehub.com (Password: User1234)",
        foodie: "foodie_test@recipehub.com (Password: User1234)",
      },
      recipesCount: recipesData.length,
    });
  } catch (error) {
    console.error("Seeding Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
