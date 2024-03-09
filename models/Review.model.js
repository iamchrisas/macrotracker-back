const { Schema, model } = require("mongoose");

const reviewSchema = new Schema({
  food: { type: Schema.Types.ObjectId, ref: 'Food', required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  taste: { type: String, enum: ['bad', 'ok', 'great'], required: true },
  digestion: { type: String, enum: ['bad', 'ok', 'great'], required: true },
  rate: { type: Number, min: 1, max: 5, required: true }
});

module.exports = model("Review", reviewSchema);