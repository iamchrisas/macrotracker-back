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
    const { name, protein, carbs, fat, calories, date } = req.body; // Include calories in the destructuring
    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }
    let imageUrl =
      "https://img.freepik.com/photos-premium/spaghetti-food-photography-delicieuse-cuisine-italienne-creee-ia-generative_115122-5690.jpg"; // Default value if no image is uploaded

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
        calories: calories || 0,
        image: imageUrl,
        date: date ? new Date(date) : new Date(), // Use provided date or default to current date
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
    // Include 'date' in the destructured fields from req.body
    const { name, protein, carbs, fat, calories, date } = req.body;
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

      // Update only fields that are not undefined
      if (name !== undefined) foodItem.name = name;
      if (protein !== undefined) foodItem.protein = protein;
      if (carbs !== undefined) foodItem.carbs = carbs;
      if (fat !== undefined) foodItem.fat = fat;
      if (calories !== undefined) foodItem.calories = calories;
      if (imageUrl !== undefined) foodItem.image = imageUrl;
      // Update the date if it's provided
      if (date !== undefined) foodItem.date = new Date(date);

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
