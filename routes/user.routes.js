const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/jwt.middleware"); // Adjust the path as necessary
const User = require("../models/User.model");

// Route to get user profile
router.get("/user-profile", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload.id;

    if (!userId) {
      return res
        .status(400)
        .json({ message: "User ID not found in token payload" });
    }

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
  const {
    currentWeight,
    weightGoal,
    dailyCalorieGoal,
    dailyProteinGoal,
    dailyCarbGoal,
    dailyFatGoal,
  } = req.body;
  const userId = req.payload.id;

  try {
    // Find the user
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (currentWeight !== undefined) user.currentWeight = currentWeight;
    if (weightGoal !== undefined) user.weightGoal = weightGoal;
    if (dailyCalorieGoal !== undefined)
      user.dailyCalorieGoal = dailyCalorieGoal;
    if (dailyProteinGoal !== undefined)
      user.dailyProteinGoal = dailyProteinGoal;
    if (dailyCarbGoal !== undefined) user.dailyCarbGoal = dailyCarbGoal;
    if (dailyFatGoal !== undefined) user.dailyFatGoal = dailyFatGoal;

    // Save the updated user
    const updatedUser = await user.save();

    // Remove sensitive information before sending the response
    updatedUser.password = undefined;

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser.toObject({ getters: true, virtuals: false }),
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating profile", error: error.toString() });
  }
});


module.exports = router;
