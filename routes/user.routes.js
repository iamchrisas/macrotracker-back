const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/jwt.middleware"); // Adjust the path as necessary
const User = require("../models/User.model");
const Food = require("../models/Food.model");

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

// Add a new weight entry for the user
router.post("/add-weight", isAuthenticated, async (req, res) => {
  const { weight } = req.body;
  const userId = req.payload.id;

  try {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add the new weight entry
    user.weightHistory.push({ weight });
    await user.save();

    res.status(200).json({ message: "Weight added successfully", user });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding weight", error: error.toString() });
  }
});

// Route to update user data
router.put("/edit-profile", isAuthenticated, async (req, res) => {
  const {
    dailyCalorieGoal,
    weightGoal,
    dailyProteinGoal,
    dailyCarbGoal,
    dailyFatGoal,
  } = req.body;
  const userId = req.payload.id;

  try {
    // Find the user first to update the weightHistory array and other goals
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (dailyCalorieGoal !== undefined)
      user.dailyCalorieGoal = dailyCalorieGoal;
    if (weightGoal !== undefined) user.weightGoal = weightGoal;
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

// Route to view food stats of the day
router.get("/daily-stats", isAuthenticated, async (req, res) => {
  const userId = req.payload.id;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const foodItemsToday = await Food.find({
      user: userId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    // Calculate total intake using the calories field directly
    const totals = foodItemsToday.reduce(
      (acc, item) => {
        acc.protein += item.protein;
        acc.carbs += item.carbs;
        acc.fat += item.fat;
        acc.calories += item.calories; // Directly add item's calories
        return acc;
      },
      { protein: 0, carbs: 0, fat: 0, calories: 0 } // Initialize calories in the accumulator
    );

    // Calculate remaining goals
    const remaining = {
      protein: Math.round(user.dailyProteinGoal - totals.protein),
      carbs: Math.round(user.dailyCarbGoal - totals.carbs),
      fat: Math.round(user.dailyFatGoal - totals.fat),
      calories: Math.round(user.dailyCalorieGoal - totals.calories),
    };

    res.status(200).json({ totals, remaining });
  } catch (error) {
    console.error("Error fetching daily nutrition status:", error);
    res.status(500).json({
      message: "Error fetching daily nutrition status",
      error: error.toString(),
    });
  }
});

// Route to view food stats for each day, week after week
router.get("/weekly-stats", isAuthenticated, async (req, res) => {
  const userId = req.payload.id;
  const { startDate, endDate } = req.query; // Expecting 'startDate' and 'endDate' in 'YYYY-MM-DD' format

  try {
    const foodItems = await Food.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: new Date(startDate), $lte: new Date(endDate) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          totalProtein: { $sum: "$protein" },
          totalCarbs: { $sum: "$carbs" },
          totalFat: { $sum: "$fat" },
          totalCalories: { $sum: "$calories" }, // Directly sum the calories
        },
      },
      { $sort: { _id: 1 } }, // Sort by date ascending
    ]);

    // Map the results to format the response, now including the summed totalCalories
    const results = foodItems.map((item) => ({
      date: item._id,
      protein: item.totalProtein,
      carbs: item.totalCarbs,
      fat: item.totalFat,
      calories: item.totalCalories, // Use the directly summed calories
    }));

    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching weekly nutrition data:", error);
    res.status(500).json({
      message: "Error fetching weekly nutrition data",
      error: error.toString(),
    });
  }
});

module.exports = router;
