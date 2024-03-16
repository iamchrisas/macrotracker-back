const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/jwt.middleware");
const Review = require("../models/Review.model");
const Food = require("../models/Food.model");

// Create a review
router.post("/add", isAuthenticated, async (req, res) => {
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

// Update a review
router.put("/edit/:id", isAuthenticated, async (req, res) => {
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
router.delete("/delete/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;

  try {
    // Attempt to find and delete the review, ensuring the current user is the author
    const deletedReview = await Review.findOneAndDelete({
      _id: id,
      author: req.payload.id,
    });

    // If no review was found to delete, either it doesn't exist or the current user isn't the author
    if (!deletedReview) {
      return res
        .status(404)
        .json({ message: "Review not found or unauthorized" });
    }

    // Successfully deleted the review
    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    // Handle any errors that occur during the deletion process
    res
      .status(500)
      .json({ message: "Error deleting review", error: error.toString() });
  }
});

module.exports = router;
