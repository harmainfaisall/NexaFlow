require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

// Reuse MongoDB connection across Vercel function invocations.
let dbConnectionPromise = null;
let migrationPromise = null;

async function connectToDatabase() {
  if (
    !process.env.MONGO_URI ||
    !process.env.JWT_SECRET ||
    !process.env.ADMIN_SETUP_KEY
  ) {
    throw new Error("Required environment variables are missing.");
  }

  if (mongoose.connection.readyState !== 1) {
    if (
      mongoose.connection.readyState === 0 ||
      mongoose.connection.readyState === 3
    ) {
      dbConnectionPromise = null;
    }

    if (!dbConnectionPromise) {
      dbConnectionPromise = mongoose
        .connect(process.env.MONGO_URI)
        .catch((error) => {
          dbConnectionPromise = null;
          throw error;
        });
    }

    await dbConnectionPromise;
  }

  if (!migrationPromise) {
    migrationPromise = migrateLegacyData()
      .then((migrated) => {
        if (!migrated) {
          migrationPromise = null;
        }
      })
      .catch((error) => {
        migrationPromise = null;
        throw error;
      });
  }

  await migrationPromise;
}

// Every API request waits for the database to be ready.
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error("Database initialization error:", error.message);

    res.status(503).json({
      message: "Service temporarily unavailable. Please try again."
    });
  }
});

const userIdField = {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Admin",
  required: true,
  index: true
};

// CUSTOMER MODEL
const customerSchema = new mongoose.Schema(
  {
    userId: userIdField,
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active"
    }
  },
  { timestamps: true }
);

const Customer =
  mongoose.models.Customer ||
  mongoose.model("Customer", customerSchema);

// INVENTORY MODEL
const inventorySchema = new mongoose.Schema(
  {
    userId: userIdField,
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    lowStockThreshold: { type: Number, default: 10, min: 0 },
    image: { type: String, default: "" }
  },
  { timestamps: true }
);

const Inventory =
  mongoose.models.Inventory ||
  mongoose.model("Inventory", inventorySchema);

// ORDER ITEM MODEL
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true
    },
    productName: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

// ORDER MODEL
const orderSchema = new mongoose.Schema(
  {
    userId: userIdField,
    orderId: { type: String, required: true, unique: true },
    customer: { type: String, required: true },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null
    },
    items: { type: [orderItemSchema], default: [] },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Completed"],
      default: "Pending"
    }
  },
  { timestamps: true }
);

const Order =
  mongoose.models.Order ||
  mongoose.model("Order", orderSchema);

// NOTIFICATION MODEL
const notificationSchema = new mongoose.Schema(
  {
    userId: userIdField,
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["customer", "order", "inventory", "stock"],
      required: true
    },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

// ADMIN MODEL
const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      default: "User"
    }
  },
  { timestamps: true }
);

const Admin =
  mongoose.models.Admin ||
  mongoose.model("Admin", adminSchema);

// CREATE NOTIFICATION
async function createNotification(userId, title, message, type) {
  try {
    await Notification.create({
      userId,
      title,
      message,
      type
    });
  } catch (error) {
    console.error("Notification error:", error.message);
  }
}

// STOCK CHANGE NOTIFICATIONS
async function notifyStockChanges(userId, changes) {
  for (const change of changes) {
    const {
      name,
      oldQuantity,
      newQuantity,
      oldThreshold,
      newThreshold
    } = change;

    if (newQuantity === 0 && oldQuantity !== 0) {
      await createNotification(
        userId,
        "Out of Stock",
        `${name} is now out of stock.`,
        "stock"
      );
      continue;
    }

    const wasLow =
      oldQuantity !== null &&
      oldQuantity <= oldThreshold;

    const isLow = newQuantity <= newThreshold;

    if (isLow && !wasLow && newQuantity > 0) {
      await createNotification(
        userId,
        "Low Stock Alert",
        `${name} has only ${newQuantity} units left.`,
        "stock"
      );
    }
  }
}

// AUTHENTICATION MIDDLEWARE
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const admin = await Admin.findById(
      decoded.adminId
    ).select("-password");

    if (!admin) {
      return res.status(401).json({
        message: "Account not found"
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token"
    });
  }
}

// HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    application: "NexaFlow"
  });
});

// FIRST-TIME ADMINISTRATOR SETUP
app.post("/api/auth/setup", async (req, res) => {
  try {
    const { name, email, password, setupKey } = req.body;

    if (setupKey !== process.env.ADMIN_SETUP_KEY) {
      return res.status(403).json({
        message: "Invalid setup key"
      });
    }

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Name, email and password are required"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters"
      });
    }

    if (await Admin.countDocuments() > 0) {
      return res.status(403).json({
        message: "Admin account has already been created"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await Admin.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: "Administrator"
    });

    res.status(201).json({
      message: "Admin account created successfully",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error("Admin setup error:", error);

    res.status(500).json({
      message: "Unable to create admin account"
    });
  }
});

// USER SIGNUP
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Name, email and password are required"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters"
      });
    }

    const existingUser = await Admin.findOne({
      email: email.trim().toLowerCase()
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await Admin.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: "User"
    });

    const token = jwt.sign(
      { adminId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Signup error:", error);

    res.status(500).json({
      message: "Unable to create account"
    });
  }
});

// LOGIN

 // LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const admin = await Admin.findOne({
      email: email.trim().toLowerCase()
    });

    if (!admin) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      admin.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      { adminId: admin._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Unable to login"
    });
  }
});

// CURRENT LOGGED-IN USER
app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json(req.admin);
});

// PROTECT ALL REMAINING API ROUTES
app.use("/api", authenticateToken);

// CUSTOMER ROUTES

app.get("/api/customers", async (req, res) => {
  try {
    const customers = await Customer.find({
      userId: req.admin._id
    }).sort({ createdAt: -1 });

    res.json(customers);
  } catch (error) {
    res.status(500).json({
      message: "Unable to load customers"
    });
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    const { name, email, phone, city, status } = req.body;

    if (
      ![name, email, phone, city].every(
        value => typeof value === "string" && value.trim()
      )
    ) {
      return res.status(400).json({
        message: "All customer fields are required"
      });
    }

    const customer = await Customer.create({
      userId: req.admin._id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      city: city.trim(),
      status: status || "Active"
    });

    await createNotification(
      req.admin._id,
      "Customer Added",
      `${customer.name} was added to your customers.`,
      "customer"
    );

    res.status(201).json(customer);
  } catch (error) {
    console.error("Customer create error:", error);

    res.status(400).json({
      message: "Invalid customer information"
    });
  }
});

app.put("/api/customers/:id", async (req, res) => {
  try {
    const allowed = [
      "name",
      "email",
      "phone",
      "city",
      "status"
    ];

    const updates = {};

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid fields provided"
      });
    }

    if (updates.name !== undefined) {
      if (
        typeof updates.name !== "string" ||
        !updates.name.trim()
      ) {
        return res.status(400).json({
          message: "Customer name cannot be empty"
        });
      }

      updates.name = updates.name.trim();
    }

    if (updates.email !== undefined) {
      if (
        typeof updates.email !== "string" ||
        !updates.email.trim()
      ) {
        return res.status(400).json({
          message: "Invalid email"
        });
      }

      updates.email = updates.email.trim().toLowerCase();
    }

    for (const field of ["phone", "city"]) {
      if (updates[field] !== undefined) {
        if (
          typeof updates[field] !== "string" ||
          !updates[field].trim()
        ) {
          return res.status(400).json({
            message: `Invalid ${field}`
          });
        }

        updates[field] = updates[field].trim();
      }
    }

    const customer = await Customer.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.admin._id
      },
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    await createNotification(
      req.admin._id,
      "Customer Updated",
      `${customer.name}'s information was updated.`,
      "customer"
    );

    res.json(customer);
  } catch (error) {
    console.error("Customer update error:", error);

    res.status(400).json({
      message: "Invalid customer update"
    });
  }
});

app.delete("/api/customers/:id", async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      userId: req.admin._id
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    const existingOrders = await Order.exists({
      userId: req.admin._id,
      $or: [
        { customerId: customer._id },
        { customer: customer.name }
      ]
    });

    if (existingOrders) {
      return res.status(400).json({
        message: "This customer cannot be deleted because they have existing orders."
      });
    }

    await Customer.deleteOne({
      _id: customer._id,
      userId: req.admin._id
    });

    await createNotification(
      req.admin._id,
      "Customer Deleted",
      `${customer.name} was removed from your customers.`,
      "customer"
    );

    res.json({
      message: "Customer deleted successfully"
    });
  } catch (error) {
    console.error("Customer delete error:", error);

    res.status(400).json({
      message: "Invalid customer ID"
    });
  }
});

// ORDER ROUTES

app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find({
      userId: req.admin._id
    }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error("Order fetch error:", error);

    res.status(500).json({
      message: "Unable to load orders"
    });
  }
});

// CREATE ORDER
app.post("/api/orders", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      customerId,
      items,
      status = "Pending"
    } = req.body;

    if (
      typeof customerId !== "string" ||
      !mongoose.Types.ObjectId.isValid(customerId)
    ) {
      return res.status(400).json({
        message: "Invalid customer ID"
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Please add at least one product"
      });
    }

    if (!["Pending", "Processing"].includes(status)) {
      return res.status(400).json({
        message: "Invalid order status"
      });
    }

    const quantities = new Map();

    for (const item of items) {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        typeof item.product !== "string" ||
        !mongoose.Types.ObjectId.isValid(item.product) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return res.status(400).json({
          message: "Invalid product or quantity"
        });
      }

      quantities.set(
        item.product,
        (quantities.get(item.product) || 0) + item.quantity
      );
    }

    let createdOrder;
    const stockChanges = [];

    await session.withTransaction(async () => {
      stockChanges.length = 0;

      const customer = await Customer.findOne({
        _id: customerId,
        userId: req.admin._id
      }).session(session);

      if (!customer) {
        throw new Error("Customer not found in your account");
      }

      let totalAmount = 0;
      const orderItems = [];

      for (const [productId, quantity] of quantities) {
        const product = await Inventory.findOne({
          _id: productId,
          userId: req.admin._id
        }).session(session);

        if (!product) {
          throw new Error("Product not found in your inventory");
        }

        if (
          !Number.isFinite(product.price) ||
          product.price <= 0
        ) {
          throw new Error(`Invalid price for ${product.name}`);
        }

        if (product.quantity < quantity) {
          throw new Error(
            `Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${quantity}`
          );
        }

        if (status === "Processing") {
          const updatedProduct = await Inventory.findOneAndUpdate(
            {
              _id: productId,
              userId: req.admin._id,
              quantity: { $gte: quantity }
            },
            {
              $inc: { quantity: -quantity }
            },
            {
              new: true,
              session
            }
          );

          if (!updatedProduct) {
            throw new Error(
              `Insufficient stock for ${product.name}`
            );
          }

          stockChanges.push({
            name: updatedProduct.name,
            oldQuantity: product.quantity,
            newQuantity: updatedProduct.quantity,
            oldThreshold: product.lowStockThreshold ?? 10,
            newThreshold: updatedProduct.lowStockThreshold ?? 10
          });
        }

        totalAmount += product.price * quantity;

        orderItems.push({
          product: product._id,
          productName: product.name,
          quantity,
          price: product.price
        });
      }

      const [order] = await Order.create(
        [
          {
            userId: req.admin._id,
            orderId: `NX-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            customer: customer.name,
            customerId: customer._id,
            items: orderItems,
            amount: totalAmount,
            status
          }
        ],
        { session }
      );

      createdOrder = order;
    });

    await createNotification(
      req.admin._id,
      "Order Added",
      `Order ${createdOrder.orderId} was created for ${createdOrder.customer}.`,
      "order"
    );

    await notifyStockChanges(req.admin._id, stockChanges);

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error("Order creation error:", error);

    res.status(400).json({
      message: error.message || "Unable to create order"
    });
  } finally {
    await session.endSession();
  }
});

// UPDATE ORDER STATUS
app.put("/api/orders/:id", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { status } = req.body;

    if (!["Pending", "Processing", "Completed"].includes(status)) {
      return res.status(400).json({
        message: "Invalid order status"
      });
    }

    let updatedOrder;
    let previousStatus;
    const stockChanges = [];

    await session.withTransaction(async () => {
      stockChanges.length = 0;

      const order = await Order.findOne({
        _id: req.params.id,
        userId: req.admin._id
      }).session(session);

      if (!order) {
        throw new Error("Order not found");
      }

      previousStatus = order.status;

      if (previousStatus === status) {
        updatedOrder = order;
        return;
      }

      if (previousStatus === "Completed") {
        throw new Error("Completed orders cannot be changed");
      }

      if (previousStatus === "Pending" && status === "Completed") {
        throw new Error("Move order to Processing first");
      }

      if (!order.items || order.items.length === 0) {
        throw new Error("This order has no product details");
      }

      if (previousStatus === "Pending" && status === "Processing") {
        for (const item of order.items) {
          const productBefore = await Inventory.findOne({
            _id: item.product,
            userId: req.admin._id
          }).session(session);

          if (!productBefore) {
            throw new Error("Product not found in your inventory");
          }

          const product = await Inventory.findOneAndUpdate(
            {
              _id: item.product,
              userId: req.admin._id,
              quantity: { $gte: item.quantity }
            },
            {
              $inc: { quantity: -item.quantity }
            },
            {
              new: true,
              session
            }
          );

          if (!product) {
            throw new Error(
              `Insufficient stock for ${productBefore.name}. Available: ${productBefore.quantity}, Requested: ${item.quantity}`
            );
          }

          stockChanges.push({
            name: product.name,
            oldQuantity: productBefore.quantity,
            newQuantity: product.quantity,
            oldThreshold: productBefore.lowStockThreshold ?? 10,
            newThreshold: product.lowStockThreshold ?? 10
          });
        }
      }

      if (previousStatus === "Processing" && status === "Pending") {
        for (const item of order.items) {
          const productBefore = await Inventory.findOne({
            _id: item.product,
            userId: req.admin._id
          }).session(session);

          if (!productBefore) {
            throw new Error("Product not found. Cannot restore stock.");
          }

          const product = await Inventory.findOneAndUpdate(
            {
              _id: item.product,
              userId: req.admin._id
            },
            {
              $inc: { quantity: item.quantity }
            },
            {
              new: true,
              session
            }
          );

          stockChanges.push({
            name: product.name,
            oldQuantity: productBefore.quantity,
            newQuantity: product.quantity,
            oldThreshold: productBefore.lowStockThreshold ?? 10,
            newThreshold: product.lowStockThreshold ?? 10
          });
        }
      }

      order.status = status;
      updatedOrder = await order.save({ session });
    });

    if (previousStatus !== status) {
      await createNotification(
        req.admin._id,
        "Order Status Updated",
        `Order ${updatedOrder.orderId} changed from ${previousStatus} to ${status}.`,
        "order"
      );

      await notifyStockChanges(req.admin._id, stockChanges);
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error("Order update error:", error);

    res.status(400).json({
      message: error.message || "Unable to update order"
    });
  } finally {
    await session.endSession();
  }
});

// DELETE ORDER
app.delete("/api/orders/:id", async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.admin._id
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    if (order.status !== "Pending") {
      return res.status(400).json({
        message: "Only Pending orders can be deleted."
      });
    }

    await Order.deleteOne({
      _id: order._id,
      userId: req.admin._id
    });

    await createNotification(
      req.admin._id,
      "Order Deleted",
      `Order ${order.orderId} was deleted.`,
      "order"
    );

    res.json({
      message: "Pending order deleted successfully"
    });
  } catch (error) {
    console.error("Order delete error:", error);

    res.status(400).json({
      message: "Invalid order ID"
    });
  }
});
// INVENTORY ROUTES

app.get("/api/inventory", async (req, res) => {
  try {
    const products = await Inventory.find({
      userId: req.admin._id
    }).sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    console.error("Inventory fetch error:", error);

    res.status(500).json({
      message: "Unable to load inventory"
    });
  }
});

// ADD PRODUCT
app.post("/api/inventory", async (req, res) => {
  try {
    const {
      name,
      price,
      quantity,
      lowStockThreshold,
      image
    } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      (
        lowStockThreshold !== undefined &&
        (
          !Number.isInteger(lowStockThreshold) ||
          lowStockThreshold < 0
        )
      ) ||
      (image !== undefined && typeof image !== "string")
    ) {
      return res.status(400).json({
        message: "Invalid product details."
      });
    }

    const product = await Inventory.create({
      userId: req.admin._id,
      name: name.trim(),
      price,
      quantity,
      lowStockThreshold: lowStockThreshold ?? 10,
      image: image ?? ""
    });

    await createNotification(
      req.admin._id,
      "Product Added",
      `${product.name} was added to inventory.`,
      "inventory"
    );

    await notifyStockChanges(req.admin._id, [
      {
        name: product.name,
        oldQuantity: null,
        newQuantity: product.quantity,
        oldThreshold: 0,
        newThreshold: product.lowStockThreshold ?? 10
      }
    ]);

    res.status(201).json(product);
  } catch (error) {
    console.error("Inventory create error:", error);

    res.status(400).json({
      message: "Unable to create product"
    });
  }
});

// UPDATE PRODUCT
app.put("/api/inventory/:id", async (req, res) => {
  try {
    const allowed = [
      "name",
      "price",
      "quantity",
      "lowStockThreshold",
      "image"
    ];

    const updates = {};

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid fields provided"
      });
    }

    if (
      updates.name !== undefined &&
      (
        typeof updates.name !== "string" ||
        !updates.name.trim()
      )
    ) {
      return res.status(400).json({
        message: "Product name cannot be empty"
      });
    }

    if (
      updates.price !== undefined &&
      (
        !Number.isFinite(updates.price) ||
        updates.price <= 0
      )
    ) {
      return res.status(400).json({
        message: "Price must be greater than zero"
      });
    }

    if (
      updates.quantity !== undefined &&
      (
        !Number.isInteger(updates.quantity) ||
        updates.quantity < 0
      )
    ) {
      return res.status(400).json({
        message: "Quantity must be a non-negative integer"
      });
    }

    if (
      updates.lowStockThreshold !== undefined &&
      (
        !Number.isInteger(updates.lowStockThreshold) ||
        updates.lowStockThreshold < 0
      )
    ) {
      return res.status(400).json({
        message: "Invalid low stock threshold"
      });
    }

    if (
      updates.image !== undefined &&
      typeof updates.image !== "string"
    ) {
      return res.status(400).json({
        message: "Image must be a valid string"
      });
    }

    if (updates.name !== undefined) {
      updates.name = updates.name.trim();
    }

    const previousProduct = await Inventory.findOne({
      _id: req.params.id,
      userId: req.admin._id
    });

    if (!previousProduct) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    const product = await Inventory.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.admin._id
      },
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    await createNotification(
      req.admin._id,
      "Product Updated",
      `${product.name}'s inventory details were updated.`,
      "inventory"
    );

    await notifyStockChanges(req.admin._id, [
      {
        name: product.name,
        oldQuantity: previousProduct.quantity,
        newQuantity: product.quantity,
        oldThreshold: previousProduct.lowStockThreshold ?? 10,
        newThreshold: product.lowStockThreshold ?? 10
      }
    ]);

    res.json(product);
  } catch (error) {
    console.error("Inventory update error:", error);

    res.status(400).json({
      message: "Invalid product update"
    });
  }
});

// DELETE PRODUCT
app.delete("/api/inventory/:id", async (req, res) => {
  try {
    const product = await Inventory.findOneAndDelete({
      _id: req.params.id,
      userId: req.admin._id
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    await createNotification(
      req.admin._id,
      "Product Deleted",
      `${product.name} was removed from inventory.`,
      "inventory"
    );

    res.json({
      message: "Product deleted successfully"
    });
  } catch (error) {
    console.error("Inventory delete error:", error);

    res.status(400).json({
      message: "Invalid product ID"
    });
  }
});

// NOTIFICATION ROUTES

app.get("/api/notifications", async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.admin._id
    })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(notifications);
  } catch (error) {
    console.error("Notification fetch error:", error);

    res.status(500).json({
      message: "Unable to load notifications"
    });
  }
});

// MARK ONE NOTIFICATION AS READ
app.patch("/api/notifications/:id/read", async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.admin._id
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found"
      });
    }

    res.json(notification);
  } catch (error) {
    res.status(400).json({
      message: "Invalid notification ID"
    });
  }
});

// MARK ALL NOTIFICATIONS AS READ
app.patch("/api/notifications/read-all", async (req, res) => {
  try {
    await Notification.updateMany(
      {
        userId: req.admin._id,
        isRead: false
      },
      {
        $set: { isRead: true }
      }
    );

    res.json({
      message: "All notifications marked as read"
    });
  } catch (error) {
    res.status(500).json({
      message: "Unable to update notifications"
    });
  }
});

// DELETE ALL NOTIFICATIONS
app.delete("/api/notifications", async (req, res) => {
  try {
    await Notification.deleteMany({
      userId: req.admin._id
    });

    res.json({
      message: "All notifications cleared"
    });
  } catch (error) {
    res.status(500).json({
      message: "Unable to clear notifications"
    });
  }
});

// MIGRATE EXISTING DATA TO THE ORIGINAL ADMIN ACCOUNT
async function migrateLegacyData() {
  try {
    const owner = await Admin.findOne().sort({
      createdAt: 1,
      _id: 1
    });

    if (!owner) {
      console.log(
        "No existing account found. Migration will retry later."
      );
      return false;
    }

    const models = [
      Customer,
      Inventory,
      Order,
      Notification
    ];

    for (const Model of models) {
      const result = await Model.collection.updateMany(
        {
          $or: [
            { userId: { $exists: false } },
            { userId: null }
          ]
        },
        {
          $set: {
            userId: owner._id
          }
        }
      );

      console.log(
        `${Model.modelName}: ${result.modifiedCount} existing records migrated.`
      );
    }

    console.log(
      `Existing data assigned to Admin: ${owner.email}`
    );

    return true;
  } catch (error) {
    console.error("Data migration failed:", error);
    throw error;
  }
}

// EXPORT EXPRESS APP FOR VERCEL SERVERLESS DEPLOYMENT
module.exports = app;