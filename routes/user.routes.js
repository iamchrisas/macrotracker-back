const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/jwt.middleware"); // Adjust the path as necessary
const User = require("../models/User.model");

// Route to get user profile
router.get("/profile", isAuthenticated, async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId).select("-password"); // Exclude the password from the result

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error); // More detailed logging
    res.status(500).json({
      message: "Error fetching user profile",
      error: error.toString(),
    });
  }
});

// Route to update user data
router.put("/edit-profile", isAuthenticated, async (req, res) => {
  const { dailyCalorieGoal, weightGoal, currentWeight } = req.body;
  const userId = req.user.id;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { dailyCalorieGoal, weightGoal, currentWeight } },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    updatedUser.password = undefined; // Remove sensitive information

    res
      .status(200)
      .json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating profile", error: error.toString() });
  }
});

module.exports = router;
