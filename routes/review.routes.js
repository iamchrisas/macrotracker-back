const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/jwt.middleware");
const Review = require("../models/Review.model");

// Create a review
router.post("/add", isAuthenticated, async (req, res) => {
  const { food, taste, digestion, rate } = req.body;
  const author = req.user.id;

  // Example validation for 'rate'
  if (rate < 1 || rate > 5) {
    return res.status(400).json({ message: "Rate must be between 1 and 5" });
  }

  try {
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
    const reviews = await Review.find({ author: req.user.id }).populate("food");
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
  const { taste, digestion, rate } = req.body;

  // Example validation for 'rate'
  if (rate < 1 || rate > 5) {
    return res.status(400).json({ message: "Rate must be between 1 and 5" });
  }

  try {
    const review = await Review.findOne({ _id: id, author: req.user.id });
    if (!review) {
      return res
        .status(404)
        .json({ message: "Review not found or unauthorized" });
    }

    review.taste = taste;
    review.digestion = digestion;
    review.rate = rate;
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
    const deletedReview = await Review.findOneAndDelete({
      _id: id,
      author: req.user.id,
    });
    if (!deletedReview) {
      return res
        .status(404)
        .json({ message: "Review not found or unauthorized" });
    }

    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting review", error: error.toString() });
  }
});
module.exports = router;
