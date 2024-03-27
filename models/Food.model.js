const { Schema, model } = require("mongoose");

const foodSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: {
    type: Date,
    required: true,
  },
  name: { type: String, required: true },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 },
  image: { type: String },
  calories: { type: Number, default: 0 },
});

module.exports = model("Food", foodSchema);
