import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";
const orderStatuses = ["Placed", "Accepted", "Preparing", "Ready for Pickup", "Completed"];

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("campusbite_token");
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

function normalizeOrder(order) {
  return {
    ...order,
    id: order.orderId || order.id,
    orderId: order.orderId || order.id,
    date: order.date || order.createdAt || new Date().toISOString(),
    items: (order.items || []).map((item) => ({
      ...item,
      id: item.id ?? item.foodId,
      foodId: item.foodId ?? item.id,
      emoji: item.emoji || "🍽️",
    })),
  };
}
function getFoodImage(food) {
  const name = food.name.toLowerCase().trim();

  const images = {
    "cheese pizza":
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600",

    "pizza":
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600",

    "sandwich":
      "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600",

    "masala sandwich":
      "https://images.unsplash.com/photo-1553909489-cd47e0ef937f?w=600",

    "burger":
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600",

    "pasta":
      "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600",
  };

  return food.image || images[name] || "";
}

function FoodCard({ food, onAdd, disabled }) {
  const imageUrl = getFoodImage(food);

  return (
    <div className="food-card">

      <div className="food-image-container">

        {imageUrl && (
          <img
            src={imageUrl}
            alt={food.name}
            className="food-image"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}

        <span className="food-image-fallback">
          {food.emoji || "🍽️"}
        </span>

      </div>

      <span className="food-category-badge">
        {food.category || "Other"}
      </span>

      <h3>{food.name}</h3>

      <p>{food.description}</p>

      <h4>₹{food.price}</h4>

      <button
        type="button"
        onClick={() => onAdd(food)}
        disabled={disabled || !food.available}
      >
        {!food.available ? "Out of Stock" : "Add to Cart"}
      </button>

    </div>
  );
}


function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [setupKey, setSetupKey] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
const [selectedCategory, setSelectedCategory] = useState("All");
const [newFoodCategory, setNewFoodCategory] = useState("Other");
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [editedCategory, setEditedCategory] = useState("Other");
  const [editedStock, setEditedStock] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("Cash on Pickup");
  const [orderConfirmation, setOrderConfirmation] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [newFoodName, setNewFoodName] = useState("");
  const [newFoodPrice, setNewFoodPrice] = useState("");
  const [newFoodImage, setNewFoodImage] = useState("");
  const [editingFoodId, setEditingFoodId] = useState(null);
  const [editedPrice, setEditedPrice] = useState("");
  const [editedName, setEditedName] = useState("");
  const [editedImage, setEditedImage] = useState("");
  const [newFoodStock, setNewFoodStock] = useState("10");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffOrderFilter, setStaffOrderFilter] = useState("All Orders");
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  // Stock Management Calculations
const totalStock = menuItems.reduce(
  (total, food) => total + Number(food.stockQuantity || 0),
  0
);

const lowStockFoods = menuItems.filter(
  (food) =>
    Number(food.stockQuantity || 0) > 0 &&
    Number(food.stockQuantity || 0) <= 5
);

 const outOfStockFoods = menuItems.filter(
  (food) => Number(food.stockQuantity || 0) === 0
);

  const totalAmount = useMemo(
    () => cart.reduce((total, food) => total + Number(food.price) * food.quantity, 0),
    [cart]
  );

  async function loadFoods() {
    const data = await apiRequest("/foods");
    setMenuItems(Array.isArray(data) ? data : data.foods || []);
  }

  async function loadOrders(role = user?.role) {
    if (!role) {
      setOrders([]);
      return;
    }
    const data = await apiRequest("/orders");
    const savedOrders = Array.isArray(data) ? data : data.orders || [];
    setOrders(savedOrders.map(normalizeOrder));
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const foods = await apiRequest("/foods");
        if (active) setMenuItems(Array.isArray(foods) ? foods : foods.foods || []);
      } catch (error) {
        if (active) setPageError("Could not connect to the backend. Check that MongoDB and the backend server are running.");
      }

      const token = localStorage.getItem("campusbite_token");
      if (token) {
        try {
          const data = await apiRequest("/auth/me");
          if (active) {
            setUser(data.user);
            const orderData = await apiRequest("/orders");
            const savedOrders = Array.isArray(orderData) ? orderData : orderData.orders || [];
            setOrders(savedOrders.map(normalizeOrder));
          }
        } catch {
          localStorage.removeItem("campusbite_token");
          localStorage.removeItem("campusbite_user");
        }
      }
      if (active) {
        setAuthLoading(false);
        setIsLoading(false);
      }
    }
    initialize();
    return () => { active = false; };
  }, []);

  async function refreshOrders() {
    const data = await apiRequest("/orders");
    const savedOrders = Array.isArray(data) ? data : data.orders || [];
    setOrders(savedOrders.map(normalizeOrder));
  }

// Automatically refresh orders every 10 seconds
useEffect(() => {
  if (!user) return;

  const intervalId = setInterval(() => {
    refreshOrders().catch((error) => {
      console.error("Unable to refresh orders:", error);
    });
  }, 10000);

  return () => clearInterval(intervalId);
}, [user]);



  async function submitAuth(event) {    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    try {
      let result;
      if (authMode === "register") {
        result = await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }),
        });
      } else if (authMode === "setup") {
        result = await apiRequest("/auth/setup-admin", {
          method: "POST",
          body: JSON.stringify({ name: authName, email: authEmail, password: authPassword, setupKey }),
        });
      } else {
        result = await apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: authEmail, password: authPassword }),
        });
      }

      if (result.token && result.user) {
        localStorage.setItem("campusbite_token", result.token);
        localStorage.setItem("campusbite_user", JSON.stringify(result.user));
        setUser(result.user);
        setAuthPassword("");
        setSetupKey("");
        setAuthMessage(`Welcome, ${result.user.name}!`);
        if (result.user.role === "customer") await refreshOrders();
        else await refreshOrders();
      } else {
        setAuthMessage(result.message || "Account created. Please log in.");
        setAuthMode("login");
        setAuthPassword("");
      }
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem("campusbite_token");
    localStorage.removeItem("campusbite_user");
    setUser(null);
    setOrders([]);
    setCart([]);
    setOrderConfirmation("");
    setAuthMode("login");
    setAuthMessage("You have been logged out.");
  }

 
function addToCart(food) {
  const availableStock = Number(food.stockQuantity || 0);

  if (!food.available || availableStock <= 0) {
    alert("Sorry! This item is out of stock.");
    return;
  }

  setCart((previous) => {
    const existing = previous.find((item) => item.id === food.id);

    const currentQuantity = existing ? existing.quantity : 0;

    if (currentQuantity >= availableStock) {
      alert(`Only ${availableStock} items are available in stock!`);
      return previous;
    }

    return existing
      ? previous.map((item) =>
          item.id === food.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      : [...previous, { ...food, quantity: 1 }];
  });

  setOrderConfirmation("");
}


function updateQuantity(id, change) {
  setCart((previous) => {
    const item = previous.find((food) => food.id === id);

    if (!item) return previous;

    const newQuantity = item.quantity + change;
    const availableStock = Number(item.stockQuantity || 0);

    if (change > 0 && newQuantity > availableStock) {
      alert(`Only ${availableStock} items are available in stock!`);
      return previous;
    }

    return previous
      .map((food) =>
        food.id === id
          ? { ...food, quantity: newQuantity }
          : food
      )
      .filter((food) => food.quantity > 0);
  });
}


  function removeItem(id) {
    setCart((previous) => previous.filter((item) => item.id !== id));
  }

  
async function placeOrder(event) {
  event.preventDefault();

  if (!user || user.role !== "customer") {
    setAuthMessage("Please log in with a customer account to place an order.");
    document.getElementById("account")?.scrollIntoView({ behavior: "smooth" });
    return;
  }

  if (!cart.length) return alert("Your cart is empty!");

  setIsPlacingOrder(true);

  try {
    const data = await apiRequest("/orders", {
      method: "POST",
      body: JSON.stringify({
        items: cart.map((food) => ({
          foodId: food.id,
          name: food.name,
          price: food.price,
          quantity: food.quantity,
          emoji: food.emoji || "🍽️",
        })),
        paymentMethod,
      }),
    });

    const savedOrder = normalizeOrder(data.order);

    setOrders((previous) => [savedOrder, ...previous]);
    setOrderConfirmation(savedOrder.orderId);
    setCart([]);
    setPaymentMethod("Cash on Pickup");

    // Refresh menu with updated stock
    await loadFoods();

    alert(`Order placed successfully! Your Order ID is ${savedOrder.orderId}`);
  } catch (error) {
    alert(error.message);
  } finally {
    setIsPlacingOrder(false);
  }
}


 async function addNewFood(event) {
  event.preventDefault();

  try {
    const data = await apiRequest("/foods", {
      method: "POST",
      body: JSON.stringify({
        name: newFoodName.trim(),
        category: newFoodCategory,
        price: Number(newFoodPrice),
        description: "Freshly prepared food",
        emoji: "🍽️",
        image: newFoodImage.trim(),
        stockQuantity: Number(newFoodStock),
      }),
    });

    setMenuItems((previous) => [...previous, data.food]);

    setNewFoodName("");
    setNewFoodPrice("");
    setNewFoodImage("");
    setNewFoodCategory("Other");
    setNewFoodStock("10");

    alert("Food added successfully!");
  } catch (error) {
    alert(error.message);
  }
}
  async function deleteFood(foodId) {
    if (!window.confirm("Are you sure you want to delete this food item?")) return;
    try {
      await apiRequest(`/foods/${foodId}`, { method: "DELETE" });
      setMenuItems((previous) => previous.filter((food) => food.id !== foodId));
      setCart((previous) => previous.filter((item) => item.id !== foodId));
    } catch (error) { alert(error.message); }
  }

 
async function updateFood(foodId) {
  if (!editedName.trim() || Number(editedPrice) <= 0) {
    return alert("Enter a valid name and price.");
  }

  try {
    const data = await apiRequest(`/foods/${foodId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: editedName.trim(),
        category: editedCategory,
        price: Number(editedPrice),
        image: editedImage.trim(),
        stockQuantity: Number(editedStock),
      }),
    });

    setMenuItems((previous) =>
      previous.map((food) =>
        food.id === foodId ? data.food : food
      )
    );

    setEditingFoodId(null);
    setEditedName("");
    setEditedPrice("");
    setEditedImage("");
    setEditedCategory("Other");
    setEditedStock("0");

    alert("Food updated successfully!");
  } catch (error) {
    alert(error.message);
  }
}



  async function toggleAvailability(foodId, available) {
    try {
      const data = await apiRequest(`/foods/${foodId}/availability`, {
        method: "PATCH",
        body: JSON.stringify({ available: !available }),
      });
      setMenuItems((previous) => previous.map((food) => food.id === foodId ? data.food : food));
    } catch (error) { alert(error.message); }
  }

  async function updateOrderStatus(orderId, status) {
    try {
      const data = await apiRequest(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const updated = normalizeOrder(data.order);
      setOrders((previous) => previous.map((order) => order.orderId === orderId ? updated : order));
    } catch (error) { alert(error.message); }
  }

  async function createStaff(event) {
    event.preventDefault();
    try {
      await apiRequest("/auth/users", {
        method: "POST",
        body: JSON.stringify({ name: staffName, email: staffEmail, password: staffPassword, role: "staff" }),
      });
      setStaffName("");
      setStaffEmail("");
      setStaffPassword("");
      alert("Staff account created successfully.");
    } catch (error) { alert(error.message); }
  }

  const isCustomer = user?.role === "customer";
  const isStaff = user?.role === "staff";
  const isAdmin = user?.role === "admin";
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalFoods = menuItems.length;

const availableFoods = menuItems.filter(
  (food) => food.available
).length;



const totalOrders = orders.length;
const filteredOrders =
  staffOrderFilter === "All Orders"
    ? orders
    : orders.filter((order) => order.status === staffOrderFilter);
    const placedOrders = orders.filter(
  (order) => order.status === "Placed"
).length;

const preparingOrders = orders.filter(
  (order) => order.status === "Preparing"
).length;

const readyOrders = orders.filter(
  (order) => order.status === "Ready for Pickup"
).length;

const completedOrders = orders.filter(
  (order) => order.status === "Completed"
).length;

function getFoodCategory(food) {
  return food.category || "Other";
}
const categories = [
  "All",
  "Pizza",
  "Burger",
  "Sandwich",
  "Pasta",
  "Beverages",
  "Snacks",
  "Other",
];

const filteredMenuItems = menuItems.filter((food) => {
  const matchesSearch = food.name
    .toLowerCase()
    .includes(searchQuery.toLowerCase());

  const matchesCategory =
    selectedCategory === "All" ||
    getFoodCategory(food) === selectedCategory;

  return food.available && matchesSearch && matchesCategory;
});

  return (
    <div className="app">
      <nav className="navbar">
        <h2>CampusBite 🍽️</h2>
        <div className="nav-links">
          <a href="#">Home</a>
          <a href="#menu">Menu</a>
          <a href="#cart">Cart ({cartCount})</a>
          {isCustomer && <a href="#orders">My Orders</a>}
          {isStaff && <a href="#staff">Staff Dashboard</a>}
          {isAdmin && <><a href="#staff">Orders</a><a href="#admin">Admin</a></>}
          <a href="#about">About</a>
          {user ? <><span className="nav-user">{user.name} ({user.role})</span><button className="login-btn" onClick={logout}>Logout</button></>
            : <a href="#account" className="login-btn">Login</a>}
        </div>
      </nav>

      <section className="hero">
        <div>
          <p className="tagline">Welcome to CampusBite</p>
          <h1>Delicious Food, Just a Click Away!</h1>
          <p>Order your favourite food from your college canteen and enjoy fresh meals without waiting in long queues.</p>
          <a href="#menu" className="explore-btn">Explore Menu</a>
        </div>
        <div className="hero-emoji">🍔</div>
      </section>

      {pageError && <p className="error-message">{pageError}</p>}

      
<section className="menu-section" id="menu">
  <h2>Our Delicious Menu 🍽️</h2>
  <p>Find your favourite food at CampusBite</p>

  {/* Search Bar */}
  <div className="menu-search">
    <span>🔍</span>
    <input
      type="text"
      placeholder="Search pizza, burger, sandwich..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  </div>

  {/* Category Filters */}
  <div className="category-filters">
    {categories.map((category) => (
      <button
        key={category}
        type="button"
        className={
          selectedCategory === category ? "active-category" : ""
        }
        onClick={() => setSelectedCategory(category)}
      >
        {category}
      </button>
    ))}
  </div>

  {/* Food Items */}
  {isLoading ? (
    <p>Loading menu...</p>
  ) : filteredMenuItems.length === 0 ? (
    <p className="no-food-message">
      No food items found. Try another search!
    </p>
  ) : (
    <div className="food-container">
      {filteredMenuItems.map((food) => (
        <FoodCard
          key={food.id}
          food={food}
          onAdd={addToCart}
        />
      ))}
    </div>
  )}
</section>

      
<section className="cart-section" id="cart">
  <h2>Your Cart 🛒</h2>
  <p className="cart-subtitle">Review your items before placing your order.</p>

  {!cart.length ? (
    <div className="empty-cart">
      <span>🛒</span>
      <h3>Your cart is empty!</h3>
      <p>Add some delicious food from our menu.</p>
    </div>
  ) : (
    <div className="cart-layout">

      {/* Cart Items */}
      <div className="cart-items-container">
        <h3>Order Items ({cart.length})</h3>

        {cart.map((food) => (
          <div className="cart-item" key={food.id}>
            <div className="cart-food-info">
              <span className="cart-food-emoji">{food.emoji || "🍽️"}</span>
              <div>
                <strong>{food.name}</strong>
                <p>₹{food.price} per item</p>
              </div>
            </div>

            <div className="quantity-controls">
              <button type="button" onClick={() => updateQuantity(food.id, -1)}>−</button>
              <span>{food.quantity}</span>
              <button type="button" onClick={() => updateQuantity(food.id, 1)}>+</button>
            </div>

            <strong>₹{food.price * food.quantity}</strong>

            <button
              type="button"
              className="remove-btn"
              onClick={() => removeItem(food.id)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Checkout Summary */}
      <div className="checkout-summary">
        <h3>Order Summary</h3>

        <div className="summary-row">
          <span>Total Items</span>
          <span>{cart.reduce((sum, food) => sum + food.quantity, 0)}</span>
        </div>

        <div className="summary-row">
          <span>Subtotal</span>
          <span>₹{totalAmount}</span>
        </div>

        <div className="summary-row">
          <span>Pickup Charges</span>
          <span>Free</span>
        </div>

        <div className="summary-total">
          <strong>Grand Total</strong>
          <strong>₹{totalAmount}</strong>
        </div>

        <form className="checkout-form" onSubmit={placeOrder}>
          <h3>Checkout</h3>

          {user && isCustomer ? (
            <p>Ordering as: <strong>{user.name}</strong></p>
          ) : (
            <p>Please log in as a customer before placing your order.</p>
          )}

          <div className="pickup-info">
            <strong>📍 Pickup Location</strong>
            <p>Collect your order from the College Canteen.</p>
          </div>

          <div className="payment-section">
            <h3>Select Payment Method</h3>

            <label>
              <input
                type="radio"
                value="Cash on Pickup"
                checked={paymentMethod === "Cash on Pickup"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              Cash on Pickup
            </label>

            <label>
              <input
                type="radio"
                value="Online Payment (Demo)"
                checked={paymentMethod === "Online Payment (Demo)"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              Online Payment (Demo)
            </label>
          </div>

          <button
            type="submit"
            disabled={isPlacingOrder || !user || !isCustomer}
          >
            {isPlacingOrder ? "Placing Order..." : "Place Order"}
          </button>
        </form>
      </div>
    </div>
  )}
</section>

            
      {!user && <section className="account-section" id="account">
        <h2>CampusBite Account</h2>
        <p>Log in or create a customer account to continue.</p>
        <div className="auth-tabs">
          <button className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setAuthMessage(""); }}>Login</button>
          <button className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); setAuthMessage(""); }}>Customer Register</button>
          <button className={authMode === "setup" ? "active" : ""} onClick={() => { setAuthMode("setup"); setAuthMessage(""); }}>First Admin Setup</button>
        </div>
        <form className="auth-form" onSubmit={submitAuth}>
          {(authMode === "register" || authMode === "setup") && <input placeholder="Full name" value={authName} onChange={(e) => setAuthName(e.target.value)} required />}
          <input type="email" placeholder="Email address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
<div className="password-input-wrapper">
  <input
    type={showAuthPassword ? "text" : "password"}
    placeholder="Password (minimum 8 characters)"
    value={authPassword}
    onChange={(e) => setAuthPassword(e.target.value)}
    minLength="8"
    required
  />

  <button
    type="button"
    className="password-toggle"
    onClick={() => setShowAuthPassword((previous) => !previous)}
    aria-label={showAuthPassword ? "Hide password" : "Show password"}
    title={showAuthPassword ? "Hide password" : "Show password"}
  >
    {showAuthPassword ? "🙈" : "👁️"}
  </button>
</div>          {authMode === "setup" && <input type="password" placeholder="Admin setup key from backend .env" value={setupKey} onChange={(e) => setSetupKey(e.target.value)} required />}
          <button type="submit" disabled={authBusy}>{authBusy ? "Please wait..." : authMode === "register" ? "Create Customer Account" : authMode === "setup" ? "Create First Admin" : "Login"}</button>
        </form>
        {authMessage && <p className="auth-message">{authMessage}</p>}
        {authMode === "setup" && <p className="auth-hint">This works only once, when no Admin account exists, and requires the secret configured in the backend .env file.</p>}
      </section>}

    
{user && isCustomer && (
  <section className="orders-section" id="orders">
    <h2>My Orders 📦</h2>
    <p className="orders-subtitle">
      Track your food orders and pickup progress.
    </p>

    {!orders.length ? (
      <p>You haven't placed any orders yet.</p>
    ) : (
      orders.map((order) => {
        const currentIndex = orderStatuses.indexOf(order.status);

        const progress =
          orderStatuses.length > 1
            ? (currentIndex / (orderStatuses.length - 1)) * 100
            : 0;

        return (
          <div className="order-card" key={order.orderId}>
            <div className="order-header">
              <div>
                <h3>Order #{order.orderId}</h3>
                <small>
                  {new Date(order.date).toLocaleString()}
                </small>
              </div>

              <span className="order-status">
                {order.status}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="order-progress">
              <div
                className="order-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Order Timeline */}
            <div className="order-tracker">
              {orderStatuses.map((status, index) => {
                const isCompleted = index < currentIndex;
                const isCurrent = index === currentIndex;

                return (
                  <div
                    key={status}
                    className={`tracker-step ${
                      isCompleted ? "completed" : ""
                    } ${isCurrent ? "current" : ""}`}
                  >
                    <div className="tracker-circle">
                      {isCompleted ? "✓" : index + 1}
                    </div>

                    <small>{status}</small>

                    {isCurrent && (
                      <span className="current-step-label">
                        Current
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="order-details">
              <h4>🍽️ Ordered Items</h4>

              {order.items.map((food, index) => (
                <p key={`${food.foodId}-${index}`}>
                  {food.emoji || "🍽️"} {food.name} × {food.quantity}
                </p>
              ))}

              <div className="order-total">
                <h3>Total: ₹{order.total}</h3>
                <p>
                  <strong>Payment:</strong> {order.paymentMethod}
                </p>
              </div>
            </div>
          </div>
        );
      })
    )}
  </section>
)}


      
{user && (isStaff || isAdmin) && (
  <section className="staff-section" id="staff">
    🍽️
    <h2>Canteen Staff Dashboard</h2>
    <p>Manage incoming food orders</p>
      <div className="staff-stats">
  <div className="staff-stat-card">
    <span>📥</span>
    <h3>New Orders</h3>
    <h2>{placedOrders}</h2>
  </div>

  <div className="staff-stat-card">
    <span>👨‍🍳</span>
    <h3>Preparing</h3>
    <h2>{preparingOrders}</h2>
  </div>

  <div className="staff-stat-card">
    <span>🛍️</span>
    <h3>Ready for Pickup</h3>
    <h2>{readyOrders}</h2>
  </div>

  <div className="staff-stat-card">
    <span>✅</span>
    <h3>Completed</h3>
    <h2>{completedOrders}</h2>
  </div>
</div>


    {/* Order Filters */}
    <div className="order-filters">
      <label htmlFor="order-filter">Filter Orders:</label>

      <select
        id="order-filter"
        value={staffOrderFilter}
        onChange={(e) => setStaffOrderFilter(e.target.value)}
      >
        <option value="All Orders">All Orders</option>

        {orderStatuses.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </div>

    <p>
      Showing {filteredOrders.length} of {orders.length} orders
    </p>

    {!filteredOrders.length ? (
      <p>No orders found for this status.</p>
    ) : (
      filteredOrders.map((order) => (
        <div className="staff-order-card" key={order.orderId}>
          <h3>Order #{order.orderId}</h3>

          <p>
            <strong>Customer:</strong> {order.customerName}
          </p>

          <p><strong>Order Items:</strong></p>

          <ul>
            {order.items.map((item, index) => (
              <li key={`${item.foodId}-${index}`}>
                {item.name} × {item.quantity} — ₹
                {item.price * item.quantity}
              </li>
            ))}
          </ul>

          <p><strong>Total Amount:</strong> ₹{order.total}</p>
          <p><strong>Payment:</strong> {order.paymentMethod}</p>

          <p>
            <strong>Order Date:</strong>{" "}
            {new Date(order.date).toLocaleString()}
          </p>

         <p>
  <strong>Current Status:</strong>
  <span
    className={`order-status-badge order-status-${order.status
      .toLowerCase()
      .replace(/\s+/g, "-")}`}
  >
    {order.status}
  </span>
</p>

          <label htmlFor={`status-${order.orderId}`}>
            Update Order Status:
          </label>

          <select
            id={`status-${order.orderId}`}
            value={order.status}
            onChange={(e) =>
              updateOrderStatus(order.orderId, e.target.value)
            }
          >
            {orderStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      ))
    )}
  </section>
)}

      {user && isAdmin && <section className="admin-section" id="admin">
        ⚙️<h2>Admin Dashboard</h2><p>Manage your canteen food menu and staff accounts</p>
        <div className="admin-stats">
          <div className="stat-card">
  <span className="stat-icon">📦</span>
  <h3>Total Stock</h3>
  <h2>{totalStock}</h2>
  <p>Items available in inventory</p>
</div>

<div className="stat-card">
  <span className="stat-icon">⚠️</span>
  <h3>Low Stock Items</h3>
  <h2>{lowStockFoods.length}</h2>
  <p>Stock quantity 5 or less</p>
</div>

<div className="stat-card">
  <span className="stat-icon">❌</span>
  <h3>Out of Stock</h3>
  <h2>{outOfStockFoods.length}</h2>
  <p>Items with zero stock</p>
</div>

  <div className="stat-card">
    <span className="stat-icon">🍽️</span>
    <h3>Total Food Items</h3>
    <h2>{totalFoods}</h2>
  </div>

  <div className="stat-card">
    <span className="stat-icon">✅</span>
    <h3>Available Items</h3>
    <h2>{availableFoods}</h2>
  </div>

  

  <div className="stat-card">
    <span className="stat-icon">🛒</span>
    <h3>Total Orders</h3>
    <h2>{totalOrders}</h2>
  </div>

</div>
<div className="stock-alert-section">
  <h2>📦 Inventory Alerts</h2>

  {lowStockFoods.length === 0 &&
   outOfStockFoods.length === 0 ? (
    <p>All food items have sufficient stock!</p>
  ) : (
    <>
      {lowStockFoods.map((food) => (
        <div className="stock-alert" key={food.id}>
          <span>{food.name}</span>
          <strong>Only {food.stockQuantity} left</strong>
        </div>
      ))}

      {outOfStockFoods.map((food) => (
        <div className="stock-alert out-stock" key={food.id}>
          <span>{food.name}</span>
          <strong>Out of Stock</strong>
        </div>
      ))}
    </>
  )}
</div>
       
  <form className="admin-form" onSubmit={addNewFood}>
  <h3>Add New Food</h3>

  <input
    placeholder="Enter food name"
    value={newFoodName}
    onChange={(e) => setNewFoodName(e.target.value)}
    required
  />

  <select
    value={newFoodCategory}
    onChange={(e) => setNewFoodCategory(e.target.value)}
    required
  >
    <option value="Other">Select Category</option>
    <option value="Pizza">Pizza</option>
    <option value="Burger">Burger</option>
    <option value="Sandwich">Sandwich</option>
    <option value="Pasta">Pasta</option>
    <option value="Beverages">Beverages</option>
    <option value="Snacks">Snacks</option>
  </select>

  <input
    type="number"
    min="1"
    placeholder="Enter price"
    value={newFoodPrice}
    onChange={(e) => setNewFoodPrice(e.target.value)}
    required
  />
  <input
  type="number"
  min="0"
  placeholder="Enter stock quantity"
  value={newFoodStock}
  onChange={(e) => setNewFoodStock(e.target.value)}
  required
/>

  <input
    type="url"
    placeholder="Paste food image URL (optional)"
    value={newFoodImage}
    onChange={(e) => setNewFoodImage(e.target.value)}
  />

  <button type="submit">Add Food</button>
</form>
        <h3>Manage Food Items</h3>
        {menuItems.map((food) => <div className="admin-food-item" key={food.id}>
          <div className="admin-food-details">
<span>
  {food.emoji} {food.name} - ₹{food.price}
  <br />
  Category: {food.category || "Other"}
  <br />
  <p>
  Stock: {food.stockQuantity ?? 0} items
</p>
  Status: {food.available ? "Available" : "Out of Stock"}
</span>            </div>
          <div className="admin-food-actions">
            <button
  type="button"
  onClick={() => {
    setEditingFoodId(food.id);
    setEditedName(food.name);
    setEditedPrice(String(food.price));
    setEditedImage(food.image || "");
    setEditedCategory(food.category || "Other");
    setEditedStock(String(food.stockQuantity ?? 0));
  }}
>
  Edit Food
</button>
            <button type="button" onClick={() => deleteFood(food.id)}>Delete</button>
            <button type="button" className="availability-btn" onClick={() => toggleAvailability(food.id, food.available)}>{food.available ? "Mark Out of Stock" : "Mark Available"}</button>
           {editingFoodId === food.id && (
  <div className="edit-food-form">

    <input
      placeholder="Food name"
      value={editedName}
      onChange={(e) => setEditedName(e.target.value)}
    />
    <select
  value={editedCategory}
  onChange={(e) => setEditedCategory(e.target.value)}
  required
>
  <option value="Other">Select Category</option>
  <option value="Pizza">Pizza</option>
  <option value="Burger">Burger</option>
  <option value="Sandwich">Sandwich</option>
  <option value="Pasta">Pasta</option>
  <option value="Beverages">Beverages</option>
  <option value="Snacks">Snacks</option>
</select>

    <input
      type="number"
      min="1"
      placeholder="Price"
      value={editedPrice}
      onChange={(e) => setEditedPrice(e.target.value)}
    />
    <input
  type="number"
  min="0"
  placeholder="Stock quantity"
  value={editedStock}
  onChange={(e) => setEditedStock(e.target.value)}
  required
/>

    <input
      type="url"
      placeholder="Food image URL"
      value={editedImage}
      onChange={(e) => setEditedImage(e.target.value)}
    />

    <button
      type="button"
      onClick={() => updateFood(food.id)}
    >
      Save Changes
    </button>

    <button
      type="button"
      className="cancel-btn"
      onClick={() => {
        setEditingFoodId(null);
        setEditedName("");
        setEditedPrice("");
        setEditedImage("");
        setEditedCategory("Other");
        setEditedStock(String(food.stockQuantity ?? 0));
      }}
    >
      Cancel
    </button>

  </div>
)}
          </div>
        </div>)}
        <form className="admin-form staff-create-form" onSubmit={createStaff}>
          <h3>Create Staff Account</h3>
          <input placeholder="Staff full name" value={staffName} onChange={(e) => setStaffName(e.target.value)} required />
          <input type="email" placeholder="Staff email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} required />
<div className="password-input-wrapper">
  <input
    type={showStaffPassword ? "text" : "password"}
    minLength="8"
    placeholder="Temporary password (8+ characters)"
    value={staffPassword}
    onChange={(e) => setStaffPassword(e.target.value)}
    required
  />

  <button
    type="button"
    className="password-toggle"
    onClick={() => setShowStaffPassword((previous) => !previous)}
    aria-label={showStaffPassword ? "Hide password" : "Show password"}
    title={showStaffPassword ? "Hide password" : "Show password"}
  >
    {showStaffPassword ? "🙈" : "👁️"}
  </button>
</div>          <button type="submit">Create Staff Account</button>
        </form>
      </section>}

      <section className="about-section" id="about"><h2>About CampusBite</h2><p>CampusBite makes ordering food from your college canteen simple, quick and convenient.</p></section>
      <footer><p>© 2026 CampusBite | College Canteen Food Ordering App</p></footer>
      {authLoading && <div className="loading-overlay">Checking account...</div>}
    </div>
  );
}

export default App;