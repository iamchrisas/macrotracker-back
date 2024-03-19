const { Schema, model } = require("mongoose");

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required."],
    },
    name: {
      type: String,
      required: [true, "Name is required."],
    },
    dailyProteinGoal: {
      type: Number,
      default: 0,
    },
    dailyCarbGoal: {
      type: Number,
      default: 0,
    },
    dailyFatGoal: {
      type: Number,
      default: 0,
    },
    dailyCalorieGoal: {
      type: Number,
      default: 0,
    },
    weightGoal: {
      type: Number,
      default: 0,
    },
    currentWeight: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const User = model("User", userSchema);

module.exports = User;
