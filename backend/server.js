
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config();

const Food = require("./models/Food");
const Order = require("./models/Order");
const User = require("./models/User");
const { authenticate, authorize } = require("./middleware/auth");

const app = express();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

// ================= SECURITY CONFIGURATION =================

if (!JWT_SECRET) {
  console.error("Missing JWT_SECRET in backend/.env");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error("Missing MONGO_URI in backend/.env");
  process.exit(1);
}

app.use(helmet());

const allowedOrigins = (
  process.env.CLIENT_URL || "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
  })
);

app.use(express.json({ limit: "10kb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many attempts. Please try again after 15 minutes.",
  },
});

// ================= HELPER FUNCTIONS =================

function createToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    Buffer.byteLength(password, "utf8") <= 72
  );
}

function validNameAndEmail(name, email) {
  return (
    typeof name === "string" &&
    typeof email === "string" &&
    name.trim().length > 0 &&
    name.trim().length <= 100 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    email.trim().length <= 254
  );
}

const allowedCategories = [
  "Pizza",
  "Burger",
  "Sandwich",
  "Pasta",
  "Beverages",
  "Snacks",
  "Other",
];

const allowedStatuses = [
  "Placed",
  "Accepted",
  "Preparing",
  "Ready for Pickup",
  "Completed",
];

const allowedPaymentMethods = [
  "Cash on Pickup",
  "Online Payment (Demo)",
];

// Restore deducted stock if an order fails.
// Do not change availability automatically because an admin
// may have manually marked the food unavailable.
async function restoreDeductedStock(deductedFoods) {
  const foodsToRestore = [...deductedFoods];

  deductedFoods.length = 0;

  for (const item of foodsToRestore) {
    try {
      await Food.updateOne(
        { id: item.foodId },
        {
          $inc: { stockQuantity: item.quantity },
        }
      );
    } catch (error) {
      console.error(
        `Stock restoration failed for food ${item.foodId}:`,
        error.message
      );
    }
  }
}

// ================= PUBLIC ROUTES =================

app.get("/", (_req, res) => {
  res.send("CampusBite Backend is Running!");
});

app.get("/api/test", (_req, res) => {
  res.json({
    message: "Welcome to CampusBite API!",
    status: "Success",
  });
});

// ================= AUTHENTICATION =================

// Customer Registration
app.post(
  "/api/auth/register",
  authLimiter,
  async (req, res) => {
    try {
      const { name, email, password } = req.body || {};

      if (
        !validNameAndEmail(name, email) ||
        !validPassword(password)
      ) {
        return res.status(400).json({
          message:
            "Enter a valid name, email and password (8-72 bytes).",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const existingUser = await User.findOne({
        email: normalizedEmail,
      });

      if (existingUser) {
        return res.status(409).json({
          message: "An account with this email already exists.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: "customer",
      });

      res.status(201).json({
        message: "Customer account created successfully. Please log in.",
        user: publicUser(user),
      });
    } catch (error) {
      console.error("Registration error:", error);

      if (error.code === 11000) {
        return res.status(409).json({
          message: "An account with this email already exists.",
        });
      }

      res.status(500).json({
        message: "Unable to create account.",
      });
    }
  }
);

// Login
app.post(
  "/api/auth/login",
  authLimiter,
  async (req, res) => {
    try {
      const { password } = req.body || {};

      const email =
        typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";

      if (!email || typeof password !== "string" || !password) {
        return res.status(400).json({
          message: "Email and password are required.",
        });
      }

      const user = await User.findOne({
        email,
      }).select("+password");

      if (
        !user ||
        !(await bcrypt.compare(password, user.password))
      ) {
        return res.status(401).json({
          message: "Invalid email or password.",
        });
      }

      res.json({
        message: "Login successful.",
        token: createToken(user),
        user: publicUser(user),
      });
    } catch (error) {
      console.error("Login error:", error);

      res.status(500).json({
        message: "Unable to log in.",
      });
    }
  }
);

// Get Logged-in User
app.get(
  "/api/auth/me",
  authenticate,
  async (req, res) => {
    res.json({
      user: publicUser(req.user),
    });
  }
);

// First Admin Setup
app.post(
  "/api/auth/setup-admin",
  authLimiter,
  async (req, res) => {
    try {
      const { name, email, password, setupKey } = req.body || {};

      if (
        !process.env.ADMIN_SETUP_KEY ||
        typeof setupKey !== "string" ||
        setupKey !== process.env.ADMIN_SETUP_KEY
      ) {
        return res.status(403).json({
          message: "Invalid admin setup key.",
        });
      }

      if (await User.exists({ role: "admin" })) {
        return res.status(403).json({
          message:
            "An Admin account has already been created. Ask the existing Admin to create staff accounts.",
        });
      }

      if (
        !validNameAndEmail(name, email) ||
        !validPassword(password)
      ) {
        return res.status(400).json({
          message:
            "Enter a valid name, email and password (8-72 bytes).",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (await User.exists({ email: normalizedEmail })) {
        return res.status(409).json({
          message: "This email is already registered.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const admin = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: "admin",
      });

      res.status(201).json({
        message: "First Admin created. Please log in.",
        user: publicUser(admin),
      });
    } catch (error) {
      console.error("Admin setup error:", error);

      if (error.code === 11000) {
        return res.status(409).json({
          message: "This account already exists.",
        });
      }

      res.status(500).json({
        message: "Unable to set up Admin account.",
      });
    }
  }
);

// Admin Creates Staff Accounts
app.post(
  "/api/auth/users",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body || {};

      if (role !== "staff") {
        return res.status(400).json({
          message: "Admin can create Staff accounts only.",
        });
      }

      if (
        !validNameAndEmail(name, email) ||
        !validPassword(password)
      ) {
        return res.status(400).json({
          message:
            "Enter a valid name, email and password (8-72 bytes).",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (await User.exists({ email: normalizedEmail })) {
        return res.status(409).json({
          message: "This email is already registered.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const staff = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: "staff",
      });

      res.status(201).json({
        message: "Staff account created.",
        user: publicUser(staff),
      });
    } catch (error) {
      console.error("Staff creation error:", error);

      if (error.code === 11000) {
        return res.status(409).json({
          message: "This email is already registered.",
        });
      }

      res.status(500).json({
        message: "Unable to create Staff account.",
      });
    }
  }
);

// ================= FOOD ROUTES =================

// Get All Foods (Public)
app.get("/api/foods", async (_req, res) => {
  try {
    const foods = await Food.find().sort({ id: 1 });

    res.json(foods);
  } catch (error) {
    console.error("Fetch foods error:", error);

    res.status(500).json({
      message: "Unable to fetch foods.",
    });
  }
});

// Add Food (Admin Only)
app.post(
  "/api/foods",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const {
        name,
        category,
        description,
        price,
        emoji,
        image,
        stockQuantity,
      } = req.body || {};

      const stock = Number(stockQuantity ?? 0);
      const foodPrice = Number(price);
      const foodCategory = category || "Other";

      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100 ||
        !Number.isFinite(foodPrice) ||
        foodPrice <= 0 ||
        !Number.isInteger(stock) ||
        stock < 0 ||
        !allowedCategories.includes(foodCategory)
      ) {
        return res.status(400).json({
          message: "Enter valid food details, category and stock quantity.",
        });
      }

      if (
        description !== undefined &&
        typeof description !== "string"
      ) {
        return res.status(400).json({
          message: "Invalid food description.",
        });
      }

      if (image !== undefined && typeof image !== "string") {
        return res.status(400).json({
          message: "Invalid food image.",
        });
      }

      if (emoji !== undefined && typeof emoji !== "string") {
        return res.status(400).json({
          message: "Invalid food emoji.",
        });
      }

      const lastFood = await Food.findOne().sort({ id: -1 });

      const food = await Food.create({
        id: lastFood ? lastFood.id + 1 : 1,
        name: name.trim(),
        category: foodCategory,
        description: description || "Freshly prepared food",
        price: foodPrice,
        emoji: emoji || "🍽️",
        image: image || "",
        stockQuantity: stock,
        available: true,
      });

      res.status(201).json({
        message: "Food added successfully.",
        food,
      });
    } catch (error) {
      console.error("Add food error:", error);

      if (error.code === 11000) {
        return res.status(409).json({
          message: "Food ID already exists. Please try again.",
        });
      }

      res.status(500).json({
        message: "Unable to add food.",
      });
    }
  }
);

// Update Food (Admin Only)
app.put(
  "/api/foods/:id",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const { name, category, price, image, stockQuantity } =
        req.body || {};

      const foodId = Number(req.params.id);
      const stock = Number(stockQuantity ?? 0);
      const foodPrice = Number(price);
      const foodCategory = category || "Other";

      if (
        !Number.isInteger(foodId) ||
        foodId < 1 ||
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100 ||
        !Number.isFinite(foodPrice) ||
        foodPrice <= 0 ||
        !Number.isInteger(stock) ||
        stock < 0 ||
        !allowedCategories.includes(foodCategory)
      ) {
        return res.status(400).json({
          message: "Enter valid food details, category and stock quantity.",
        });
      }

      if (image !== undefined && typeof image !== "string") {
        return res.status(400).json({
          message: "Invalid food image.",
        });
      }

      const food = await Food.findOneAndUpdate(
        { id: foodId },
        {
          name: name.trim(),
          category: foodCategory,
          price: foodPrice,
          image: image || "",
          stockQuantity: stock,
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!food) {
        return res.status(404).json({
          message: "Food item not found.",
        });
      }

      res.json({
        message: "Food updated successfully.",
        food,
      });
    } catch (error) {
      console.error("Update food error:", error);

      res.status(500).json({
        message: "Unable to update food.",
      });
    }
  }
);

// Update Food Availability (Admin Only)
app.patch(
  "/api/foods/:id/availability",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const foodId = Number(req.params.id);

      if (!Number.isInteger(foodId) || foodId < 1) {
        return res.status(400).json({
          message: "Invalid food ID.",
        });
      }

      if (typeof req.body?.available !== "boolean") {
        return res.status(400).json({
          message: "Availability must be true or false.",
        });
      }

      const food = await Food.findOneAndUpdate(
        { id: foodId },
        { available: req.body.available },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!food) {
        return res.status(404).json({
          message: "Food item not found.",
        });
      }

      res.json({
        message: "Food availability updated.",
        food,
      });
    } catch (error) {
      console.error("Availability update error:", error);

      res.status(500).json({
        message: "Unable to update food availability.",
      });
    }
  }
);

// Delete Food (Admin Only)
app.delete(
  "/api/foods/:id",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const foodId = Number(req.params.id);

      if (!Number.isInteger(foodId) || foodId < 1) {
        return res.status(400).json({
          message: "Invalid food ID.",
        });
      }

      const food = await Food.findOneAndDelete({
        id: foodId,
      });

      if (!food) {
        return res.status(404).json({
          message: "Food item not found.",
        });
      }

      res.json({
        message: "Food deleted successfully.",
        food,
      });
    } catch (error) {
      console.error("Delete food error:", error);

      res.status(500).json({
        message: "Unable to delete food.",
      });
    }
  }
);

// ================= ORDER ROUTES =================

// Place Order (Customer Only)
app.post(
  "/api/orders",
  authenticate,
  authorize("customer"),
  async (req, res) => {
    const deductedFoods = [];

    try {
      const { items, paymentMethod } = req.body || {};

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          message: "Your order must contain at least one food item.",
        });
      }

      if (!allowedPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({
          message: "Invalid payment method.",
        });
      }

      // Validate and combine duplicate food items
      const combinedItems = new Map();

      for (const item of items) {
        if (
          !item ||
          typeof item !== "object" ||
          Array.isArray(item)
        ) {
          return res.status(400).json({
            message: "Invalid order item.",
          });
        }

        const foodId = Number(item.foodId ?? item.id);
        const quantity = Number(item.quantity);

        if (
          !Number.isInteger(foodId) ||
          foodId < 1 ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 50
        ) {
          return res.status(400).json({
            message: "Invalid food item or quantity.",
          });
        }

        const currentQuantity = combinedItems.get(foodId) || 0;
        const newQuantity = currentQuantity + quantity;

        if (newQuantity > 50) {
          return res.status(400).json({
            message: "Maximum quantity per food item is 50.",
          });
        }

        combinedItems.set(foodId, newQuantity);
      }

      const orderItems = [];

      // Deduct stock for every ordered food item
      for (const [foodId, quantity] of combinedItems) {
        const food = await Food.findOneAndUpdate(
          {
            id: foodId,
            available: true,
            stockQuantity: { $gte: quantity },
          },
          {
            $inc: { stockQuantity: -quantity },
          },
          {
            new: true,
          }
        );

        if (!food) {
          await restoreDeductedStock(deductedFoods);

          return res.status(400).json({
            message:
              "Insufficient stock or food unavailable. Please refresh the menu and try again.",
          });
        }

        deductedFoods.push({
          foodId,
          quantity,
        });

        // Mark food unavailable when stock reaches zero
        if (food.stockQuantity === 0) {
          await Food.updateOne(
            {
              id: foodId,
              stockQuantity: 0,
            },
            {
              $set: { available: false },
            }
          );
        }

        // Use database food information, not frontend prices
        orderItems.push({
          foodId: food.id,
          name: food.name,
          price: food.price,
          quantity,
          emoji: food.emoji || "🍽️",
        });
      }

      const total = orderItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      const order = await Order.create({
        orderId: `CB${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
        customerId: req.user._id,
        customerName: req.user.name,
        items: orderItems,
        total,
        paymentMethod,
        status: "Placed",
      });

      res.status(201).json({
        message: "Order placed successfully.",
        order,
      });
    } catch (error) {
      console.error("Place order error:", error);

      await restoreDeductedStock(deductedFoods);

      res.status(500).json({
        message: "Unable to place order.",
      });
    }
  }
);

// Get Orders
// Customers see only their own orders.
// Staff/Admin can see all orders.
app.get(
  "/api/orders",
  authenticate,
  async (req, res) => {
    try {
      const filter =
        req.user.role === "customer"
          ? { customerId: req.user._id }
          : {};

      const orders = await Order.find(filter).sort({
        createdAt: -1,
      });

      res.json(orders);
    } catch (error) {
      console.error("Fetch orders error:", error);

      res.status(500).json({
        message: "Unable to fetch orders.",
      });
    }
  }
);

// Update Order Status (Staff/Admin Only)
app.patch(
  "/api/orders/:id/status",
  authenticate,
  authorize("staff", "admin"),
  async (req, res) => {
    try {
      const { status } = req.body || {};

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          message: "Invalid order status.",
        });
      }

      const order = await Order.findOneAndUpdate(
        { orderId: req.params.id },
        { status },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!order) {
        return res.status(404).json({
          message: "Order not found.",
        });
      }

      res.json({
        message: "Order status updated.",
        order,
      });
    } catch (error) {
      console.error("Order status update error:", error);

      res.status(500).json({
        message: "Unable to update order status.",
      });
    }
  }
);

// ================= DATABASE CONNECTION =================

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected successfully!");

    // Add starter foods only if the collection is empty
    if ((await Food.countDocuments()) === 0) {
      await Food.insertMany([
        {
          id: 1,
          name: "Pizza",
          description: "Delicious cheesy pizza",
          price: 99,
          emoji: "🍕",
          available: true,
          stockQuantity: 10,
        },
        {
          id: 2,
          name: "Burger",
          description: "Fresh and tasty burger",
          price: 69,
          emoji: "🍔",
          available: true,
          stockQuantity: 10,
        },
        {
          id: 3,
          name: "Sandwich",
          description: "Healthy grilled sandwich",
          price: 49,
          emoji: "🥪",
          available: true,
          stockQuantity: 10,
        },
      ]);

      console.log("Starter food items added!");
    }

    app.listen(PORT, () => {
      console.log(`CampusBite backend running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
