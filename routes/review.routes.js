const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/jwt.middleware");
const Review = require("../models/Review.model");
const Food = require("../models/Food.model");

// Create a review
router.post("/add-review", isAuthenticated, async (req, res) => {
  const { food, taste, digestion, rate } = req.body;
  const author = req.payload.id;

  // Example validation for 'rate'
  if (rate < 1 || rate > 5) {
    return res.status(400).json({ message: "Rate must be between 1 and 5" });
  }

  try {
    // Verify the existence of the food item
    const foodItem = await Food.findById(food);
    if (!foodItem) {
      return res.status(404).json({ message: "Food item not found" });
    }

    // Proceed to create the review since the food item exists
    const newReview = await Review.create({
      food,
      author,
      taste,
      digestion,
      rate,
    });
    res.status(201).json(newReview);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating review", error: error.toString() });
  }
});

// Get reviews by the logged-in user
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const reviews = await Review.find({ author: req.payload.id }).populate(
      "food"
    );
    res.status(200).json(reviews);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching reviews", error: error.toString() });
  }
});

// Get a single review by ID
router.get("/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;

  try {
    const review = await Review.findById(id).populate("food");
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }
    if (review.author.toString() !== req.payload.id) {
      return res
        .status(403)
        .json({ message: "Unauthorized access to this review" });
    }
    res.status(200).json(review);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching review", error: error.toString() });
  }
});

// Update a review
router.put("/edit-review/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { food, taste, digestion, rate } = req.body; // Include 'food' if updating it

  // Example validation for 'rate'
  if (rate < 1 || rate > 5) {
    return res.status(400).json({ message: "Rate must be between 1 and 5" });
  }

  try {
    // Verify the existence of the food item if 'food' is being updated
    if (food) {
      const foodItem = await Food.findById(food);
      if (!foodItem) {
        return res.status(404).json({ message: "Food item not found" });
      }
    }

    const review = await Review.findOne({ _id: id, author: req.payload.id });
    if (!review) {
      return res
        .status(404)
        .json({ message: "Review not found or unauthorized" });
    }

    // Update fields if provided
    if (taste !== undefined) review.taste = taste;
    if (digestion !== undefined) review.digestion = digestion;
    if (rate !== undefined) review.rate = rate;
    if (food !== undefined) review.food = food; // Update the 'food' field if provided

    await review.save();

    res.status(200).json({ message: "Review updated successfully", review });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating review", error: error.toString() });
  }
});

// Delete a review
router.delete("/delete-review/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: "Review ID is required" });
  }
  try {
    const reviewToDelete = await Review.findById(id);

    if (!reviewToDelete) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (reviewToDelete.author.toString() !== req.payload.id) {
      return res.status(403).json({ message: "Unauthorized to delete this review" });
    }

    await reviewToDelete.remove();
    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error); // Server-side logging
    res.status(500).json({ message: "Error deleting review", error: "An error occurred" });
  }
});

module.exports = router;
