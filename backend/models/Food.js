
const mongoose = require("mongoose");

const foodSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    category: {
      type: String,
      enum: [
        "Pizza",
        "Burger",
        "Sandwich",
        "Pasta",
        "Beverages",
        "Snacks",
        "Other",
      ],
      default: "Other",
    },

    description: {
      type: String,
      default: "Freshly prepared food",
      trim: true,
      maxlength: 500,
    },

    price: {
      type: Number,
      required: true,
      min: 1,
    },

    emoji: {
      type: String,
      default: "🍽️",
    },

    image: {
      type: String,
      default: "",
      trim: true,
    },

    available: {
      type: Boolean,
      default: true,
    },

    stockQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Stock quantity must be a whole number.",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Food", foodSchema);
