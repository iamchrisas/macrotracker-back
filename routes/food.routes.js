const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/jwt.middleware");
const fileUploader = require("../config/cloudinary.config");
const Food = require("../models/Food.model");
const User = require("../models/User.model");
const Review = require("../models/Review.model");
const cloudinary = require("cloudinary").v2;
const { zonedTimeToUtc, utcToZonedTime, format } = require("date-fns-tz");

// Add food item with image upload
router.post(
  "/add-food",
  isAuthenticated,
  fileUploader.single("image"),
  async (req, res) => {
    const { name, protein, carbs, fat, calories } = req.body; // Include calories in the destructuring
    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }
    let imageUrl =
      "https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fda435093-5e78-410d-b72b-ba3500a18130"; // Default value if no image is uploaded

    if (req.file) {
      imageUrl = req.file.path; // Cloudinary URL of the uploaded image
    }

    try {
      const newFood = new Food({
        user: req.payload.id,
        name,
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
        calories: calories || 0, // Ensure calories are included and have a default value
        image: imageUrl,
      });

      const food = await newFood.save();
      res.status(201).json({ message: "Food item added successfully", food });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error adding food item", error: err.toString() });
    }
  }
);

// Route to view food stats of the day
router.get("/daily-stats", isAuthenticated, async (req, res) => {
  const userId = req.payload.id;
  let queryDate = new Date();
  if (req.query.date) {
    if (isNaN(Date.parse(req.query.date))) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    queryDate = new Date(req.query.date);
  }

  // Fallback to UTC+1 if no time zone is provided
  const timeZone = req.query.tz || "Etc/GMT-1"; // Adjusted fallback

  // Convert the queryDate to the start of the day in the client's time zone
  const startOfDay = utcToZonedTime(queryDate, timeZone);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfQueryDayUtc = zonedTimeToUtc(startOfDay, timeZone);

  // Convert the queryDate to the end of the day in the client's time zone
  const endOfDay = utcToZonedTime(queryDate, timeZone);
  endOfDay.setHours(23, 59, 59, 999);
  const endOfQueryDayUtc = zonedTimeToUtc(endOfDay, timeZone);

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const foodItemsToday = await Food.find({
      user: userId,
      date: { $gte: startOfQueryDayUtc, $lte: endOfQueryDayUtc },
    });

    // Calculate total intake
    const totals = foodItemsToday.reduce(
      (acc, item) => {
        acc.protein += item.protein;
        acc.carbs += item.carbs;
        acc.fat += item.fat;
        acc.calories += item.calories;
        return acc;
      },
      { protein: 0, carbs: 0, fat: 0, calories: 0 }
    );

    // Goals directly from the user model
    const goals = {
      protein: user.dailyProteinGoal,
      carbs: user.dailyCarbGoal,
      fat: user.dailyFatGoal,
      calories: user.dailyCalorieGoal,
    };

    // Calculate remaining goals
    const remaining = {
      protein: Math.round(goals.protein - totals.protein),
      carbs: Math.round(goals.carbs - totals.carbs),
      fat: Math.round(goals.fat - totals.fat),
      calories: Math.round(goals.calories - totals.calories),
    };

    res.status(200).json({ totals, goals, remaining });
  } catch (error) {
    console.error("Error fetching daily nutrition status:", error);
    res.status(500).json({
      message: "Error fetching daily nutrition status",
      error: error.toString(),
    });
  }
});

// View food items
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const foodItems = await Food.find({ user: req.payload.id });
    res.status(200).json(foodItems);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching food items", error: err.toString() });
  }
});

// View a single food item along with its reviews
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const foodId = req.params.id;
    const foodItem = await Food.findById(foodId);

    // Check if the food item exists and belongs to the authenticated user
    if (!foodItem || foodItem.user.toString() !== req.payload.id) {
      return res
        .status(404)
        .json({ message: "Food item not found or unauthorized" });
    }

    // Fetch reviews associated with the food item
    const reviews = await Review.find({ food: foodId }).populate("author");

    // Combine the food item details with its reviews in the response
    const response = {
      foodItem,
      reviews,
    };

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({
      message: "Error fetching food item and reviews",
      error: err.toString(),
    });
  }
});

// Edit food item with image upload
router.put(
  "/edit-food/:id",
  isAuthenticated,
  fileUploader.single("image"),
  async (req, res) => {
    const { id } = req.params;
    const { name, protein, carbs, fat, calories } = req.body; // Include calories in the destructuring
    let imageUrl = req.body.image; // Use existing image URL by default

    if (req.file) {
      imageUrl = req.file.path; // New Cloudinary URL if a new image is uploaded
    }

    try {
      const foodItem = await Food.findById(id);
      if (!foodItem || foodItem.user.toString() !== req.payload.id) {
        return res
          .status(403)
          .json({ message: "Unauthorized or food item not found" });
      }

      // Update only provided fields
      if (name) foodItem.name = name;
      if (protein) foodItem.protein = protein;
      if (carbs) foodItem.carbs = carbs;
      if (fat) foodItem.fat = fat;
      if (calories) foodItem.calories = calories; // Accept calories from the client
      if (imageUrl) foodItem.image = imageUrl;

      const updatedFood = await foodItem.save();
      res
        .status(200)
        .json({ message: "Food item updated successfully", updatedFood });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error updating food item", error: err.toString() });
    }
  }
);

// Function to extract Public ID from Cloudinary URL
const extractPublicIdFromUrl = (url) => {
  const urlParts = url.split("/");
  const publicIdWithExtension = urlParts[urlParts.length - 1];
  const [publicId] = publicIdWithExtension.split(".");
  return publicId;
};

// Delete food item
router.delete("/delete-food/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;

  try {
    const foodItem = await Food.findById(id);
    if (!foodItem) {
      return res.status(404).json({ message: "Food item not found" });
    }

    // Check if the food item belongs to the authenticated user
    if (foodItem.user.toString() !== req.payload.id) {
      return res
        .status(403)
        .json({ message: "Unauthorized to delete this food item" });
    }

    // Delete the image from Cloudinary if it exists
    if (foodItem.image) {
      const publicId = extractPublicIdFromUrl(foodItem.image);
      const folderPath = "ih-macrotracker/"; // Specify the folder path where your images are stored
      try {
        await cloudinary.uploader.destroy(folderPath + publicId);
      } catch (cloudinaryErr) {
        console.error("Error deleting image from Cloudinary:", cloudinaryErr);
        return res.status(500).json({
          message: "Error deleting associated image",
          error: cloudinaryErr.toString(),
        });
      }
    }

    // Then delete the food item from the database
    await Food.findByIdAndDelete(id);
    res.status(200).json({ message: "Food item deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error deleting food item", error: err.toString() });
  }
});

module.exports = router;
