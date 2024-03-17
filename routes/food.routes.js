const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/jwt.middleware");
const fileUploader = require("../config/cloudinary.config");
const Food = require("../models/Food.model");
const cloudinary = require("cloudinary").v2;

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

// View a single food item
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const foodItem = await Food.findById(req.params.id);
    if (!foodItem || foodItem.user.toString() !== req.payload.id) {
      return res
        .status(404)
        .json({ message: "Food item not found or unauthorized" });
    }
    res.status(200).json(foodItem);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching food item", error: err.toString() });
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
      try {
        await cloudinary.uploader.destroy(publicId);
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
