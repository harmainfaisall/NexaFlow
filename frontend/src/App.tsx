
import Auth from "./Auth";
import { apiFetch, getToken, removeToken } from "./api";
import Inventory from "./Inventory";
import Order from "./Order";
import CustomerManagement from "./CustomerManagement";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, ShoppingBag, Package,
  BarChart3, Bell, Menu, X, Zap,
  ArrowUpRight, Download, ShieldCheck, LogOut
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  PieChart, Pie, ResponsiveContainer,
  Tooltip, XAxis, CartesianGrid
} from "recharts";

type Page = "Dashboard" | "Customers" | "Orders" | "Inventory";

type RevenueFilter =
  | "Today"
  | "This Week"
  | "This Month"
  | "This Year"
  | "All Time";

interface OrderData {
  _id: string;
  orderId: string;
  customer: string;
  amount: number;
  status: string;
  createdAt?: string;
}

interface CustomerData {
  _id: string;
  name: string;
}

interface InventoryData {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  lowStockThreshold?: number;
}

interface NotificationData {
  _id: string;
  title: string;
  message: string;
  type: "customer" | "order" | "inventory" | "stock";
  isRead: boolean;
  createdAt: string;
}

interface AuthUser {
  name: string;
  email: string;
  role: string;
}

const API_URL = "http://localhost:3000";

const menu = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Customers", icon: Users },
  { name: "Orders", icon: ShoppingBag },
  { name: "Inventory", icon: Package },
] as const;

const revenueFilters: RevenueFilter[] = [
  "Today",
  "This Week",
  "This Month",
  "This Year",
  "All Time"
];

function Panel({
  title, subtitle, children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Status({ value }: { value: string }) {
  return (
    <span className={`status ${value === "Completed" || value === "Active"
        ? "success"
        : value === "Processing"
          ? "info"
          : "warning"
      }`}>
      ● {value}
    </span>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("Dashboard");
 const [, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [revenueFilter, setRevenueFilter] =
    useState<RevenueFilter>("This Year");

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [inventory, setInventory] = useState<InventoryData[]>([]);

  const [ordersLoading, setOrdersLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Verify existing login session
  useEffect(() => {
    const verifyLogin = async () => {
      if (!getToken()) {
        setAuthLoading(false);
        return;
      }

      try {
        const response = await apiFetch("/api/auth/me");

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const data = await response.json();
        const user = data.user || data.admin || data;

        setCurrentUser({
          name: user.name,
          email: user.email,
          role: user.role || "User",
        });
      } catch {
        removeToken();
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    verifyLogin();
  }, []);

  // Login handler
  function handleLogin(user: AuthUser) {
    setCurrentUser(user);
    setPage("Dashboard");
    setDashboardError("");
  }

  // Logout handler
  function handleLogout() {
    removeToken();
    setCurrentUser(null);
    setNotifications([]);
    setOrders([]);
    setCustomers([]);
    setInventory([]);
    setShowNotifications(false);
    setPage("Dashboard");
    setDashboardError("");
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  // Check backend health
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_URL}/api/health`);

        if (!response.ok) {
          throw new Error("Backend offline");
        }

        const data = await response.json();
        setBackendOnline(data.status === "healthy");
      } catch {
        setBackendOnline(false);
      }
    };

    checkBackend();

    const interval = window.setInterval(checkBackend, 5000);

    return () => window.clearInterval(interval);
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    if (!currentUser || page !== "Dashboard") return;

    let isActive = true;

    const fetchDashboardData = async () => {
      try {
        const [
          ordersResponse,
          customersResponse,
          inventoryResponse
        ] = await Promise.all([
          apiFetch("/api/orders"),
          apiFetch("/api/customers"),
          apiFetch("/api/inventory")
        ]);

        if (
          !ordersResponse.ok ||
          !customersResponse.ok ||
          !inventoryResponse.ok
        ) {
          throw new Error("Unable to fetch dashboard data");
        }

        const ordersData: OrderData[] = await ordersResponse.json();
        const customersData: CustomerData[] = await customersResponse.json();
        const inventoryData: InventoryData[] = await inventoryResponse.json();

        if (isActive) {
          setOrders(ordersData);
          setCustomers(customersData);
          setInventory(inventoryData);
          setDashboardError("");
        }
      } catch {
        if (isActive) {
          setDashboardError(
            "Unable to load dashboard data. Check backend connection."
          );
        }
      } finally {
        if (isActive) {
          setOrdersLoading(false);
        }
      }
    };

    setOrdersLoading(true);
    fetchDashboardData();

    const interval = window.setInterval(fetchDashboardData, 10000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [page, currentUser]);

  // Fetch notifications
  useEffect(() => {
    if (!currentUser) return;

    let isActive = true;

    const fetchNotifications = async () => {
      try {
        const response = await apiFetch("/api/notifications");

        if (!response.ok) {
          throw new Error("Unable to fetch notifications");
        }

        const data: NotificationData[] = await response.json();

        if (isActive) {
          setNotifications(data);
        }
      } catch (error) {
        console.error("Notification fetch error:", error);
      } finally {
        if (isActive) {
          setNotificationsLoading(false);
        }
      }
    };

    setNotificationsLoading(true);
    fetchNotifications();

    const interval = window.setInterval(fetchNotifications, 5000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [currentUser]);

  // Mark one notification as read
  async function markAsRead(id: string) {
    try {
      const response = await apiFetch(
        `/api/notifications/${id}/read`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        throw new Error("Unable to update notification");
      }

      setNotifications((previous) =>
        previous.map((notification) =>
          notification._id === id
            ? { ...notification, isRead: true }
            : notification
        )
      );
    } catch (error) {
      console.error("Mark notification as read error:", error);
    }
  }

  // Mark all notifications as read
  async function markAllAsRead() {
    try {
      const response = await apiFetch(
        "/api/notifications/read-all",
        { method: "PATCH" }
      );

      if (!response.ok) {
        throw new Error("Unable to update notifications");
      }

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          isRead: true
        }))
      );
    } catch (error) {
      console.error("Mark all notifications error:", error);
    }
  }

  // Clear all notifications
  async function clearAllNotifications() {
    try {
      const response = await apiFetch(
        "/api/notifications",
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Unable to clear notifications");
      }

      setNotifications([]);
    } catch (error) {
      console.error("Clear notifications error:", error);
    }
  }

  // Format notification time
  function getNotificationTime(date: string) {
    const notificationDate = new Date(date);

    if (Number.isNaN(notificationDate.getTime())) {
      return "";
    }

    const difference = Date.now() - notificationDate.getTime();
    const minutes = Math.floor(difference / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);

    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);

    if (days < 7) return `${days}d ago`;

    return notificationDate.toLocaleDateString();
  }

  function navigate(next: Page) {
    setPage(next);
    setSearch("");
    setSidebarOpen(false);
  }

  // Calculate dashboard statistics
  const totalCustomers = customers.length;
  const totalOrders = orders.length;

  const totalRevenue = orders
    .filter((order) => order.status === "Completed")
    .reduce(
      (total, order) => total + Number(order.amount || 0),
      0
    );

  // Revenue date filter
  const now = new Date();

  const filteredRevenueOrders = orders.filter((order) => {
    if (order.status !== "Completed" || !order.createdAt) {
      return false;
    }

    const orderDate = new Date(order.createdAt);

    if (Number.isNaN(orderDate.getTime())) {
      return false;
    }

    switch (revenueFilter) {
      case "Today":
        return (
          orderDate.getDate() === now.getDate() &&
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        );

      case "This Week": {
        const startOfWeek = new Date(now);
        startOfWeek.setHours(0, 0, 0, 0);

        const day = startOfWeek.getDay();
        startOfWeek.setDate(
          startOfWeek.getDate() - (day === 0 ? 6 : day - 1)
        );

        return orderDate >= startOfWeek && orderDate <= now;
      }

      case "This Month":
        return (
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        );

      case "This Year":
        return orderDate.getFullYear() === now.getFullYear();

      case "All Time":
        return true;

      default:
        return false;
    }
  });

  const filteredRevenue = filteredRevenueOrders.reduce(
    (total, order) => total + Number(order.amount || 0),
    0
  );

  // Calculate revenue for selected period
  const monthlyRevenue = (() => {
    if (revenueFilter === "Today") {
      return Array.from({ length: 24 }, (_, index) => {
        const value = filteredRevenueOrders
          .filter((order) => {
            const date = new Date(order.createdAt!);
            return date.getHours() === index;
          })
          .reduce(
            (total, order) => total + Number(order.amount || 0),
            0
          );

        return { month: `${index}:00`, value };
      });
    }

    if (revenueFilter === "This Week") {
      return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);

        const day = date.getDay();
        date.setDate(
          date.getDate() - (day === 0 ? 6 : day - 1) + index
        );

        const value = filteredRevenueOrders
          .filter((order) => {
            const orderDate = new Date(order.createdAt!);

            return (
              orderDate.getDate() === date.getDate() &&
              orderDate.getMonth() === date.getMonth() &&
              orderDate.getFullYear() === date.getFullYear()
            );
          })
          .reduce(
            (total, order) => total + Number(order.amount || 0),
            0
          );

        return {
          month: date.toLocaleDateString("en-US", {
            weekday: "short"
          }),
          value
        };
      });
    }

    if (revenueFilter === "This Month") {
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();

      return Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;

        const value = filteredRevenueOrders
          .filter((order) => {
            const date = new Date(order.createdAt!);
            return date.getDate() === day;
          })
          .reduce(
            (total, order) => total + Number(order.amount || 0),
            0
          );

        return { month: String(day), value };
      });
    }

    if (revenueFilter === "This Year") {
      return Array.from({ length: 12 }, (_, index) => {
        const value = filteredRevenueOrders
          .filter((order) => {
            const date = new Date(order.createdAt!);
            return date.getMonth() === index;
          })
          .reduce(
            (total, order) => total + Number(order.amount || 0),
            0
          );

        return {
          month: new Date(now.getFullYear(), index, 1)
            .toLocaleString("en-US", { month: "short" }),
          value
        };
      });
    }

    const years = Array.from(
      new Set(
        filteredRevenueOrders.map(
          (order) => new Date(order.createdAt!).getFullYear()
        )
      )
    ).sort((a, b) => a - b);

    if (years.length === 0) {
      return [{ month: String(now.getFullYear()), value: 0 }];
    }

    return years.map((year) => ({
      month: String(year),
      value: filteredRevenueOrders
        .filter(
          (order) =>
            new Date(order.createdAt!).getFullYear() === year
        )
        .reduce(
          (total, order) => total + Number(order.amount || 0),
          0
        )
    }));
  })();

  // Calculate weekly order activity
  const weeklyActivity = Array.from(
    { length: 7 },
    (_, index) => {
      const date = new Date();

      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayOrders = orders.filter((order) => {
        if (!order.createdAt) return false;

        const orderDate = new Date(order.createdAt);

        return orderDate >= date && orderDate < nextDate;
      });

      return {
        day: date.toLocaleDateString("en-US", {
          weekday: "short"
        }),
        value: dayOrders.length
      };
    }
  );

  // Order status distribution
  const statusColors = {
    Pending: "#ffc56e",
    Processing: "#48b8ff",
    Completed: "#32d5c5"
  };

  const sources = (
    ["Pending", "Processing", "Completed"] as const
  ).map((status) => {
    const count = orders.filter(
      (order) => order.status === status
    ).length;

    const percentage = totalOrders > 0
      ? Math.round((count / totalOrders) * 100)
      : 0;

    return {
      name: status,
      value: percentage,
      color: statusColors[status]
    };
  });

  const lowStockCount = inventory.filter(
    (product) =>
      product.quantity <= (product.lowStockThreshold ?? 5)
  ).length;

  // Get products that need stock attention
  const lowStockProducts = inventory
    .filter(
      (product) =>
        product.quantity <= (product.lowStockThreshold ?? 5)
    )
    .sort((a, b) => a.quantity - b.quantity);

  const stats = [
    {
      label: "Total Revenue",
      value: `PKR ${totalRevenue.toLocaleString()}`,
      change: "Completed orders",
      icon: BarChart3,
      color: "purple"
    },
    {
      label: "Total Customers",
      value: totalCustomers.toLocaleString(),
      change: "Registered customers",
      icon: Users,
      color: "cyan"
    },
    {
      label: "Total Orders",
      value: totalOrders.toLocaleString(),
      change: "All orders",
      icon: ShoppingBag,
      color: "pink"
    },
    {
      label: "Low Stock",
      value: lowStockCount.toLocaleString(),
      change: "Products need attention",
      icon: Package,
      color: "gold"
    },
  ];

  // Export orders
  function exportOrders() {
    const rows = [
      ["Order", "Customer", "Amount", "Status"],
      ...orders.map((order) => [
        order.orderId,
        order.customer,
        String(order.amount),
        order.status
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((value) =>
          `"${String(value).replace(/"/g, '""')}"`
        ).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "nexaflow-orders.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  // Show session loading screen
  if (authLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          Checking your session...
        </div>
      </div>
    );
  }

  // Show login/signup screen when logged out
  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      {sidebarOpen && (
        <div
          className="overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="logo">
          <span className="logo-icon">
            <Zap size={23} />
          </span>

          <div>
            <strong>NexaFlow<span className="accent">.</span></strong>
            <small>ANALYTICS STUDIO</small>
          </div>

          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="workspace">
          <span className="workspace-icon">N</span>
          <div>
            <strong>NexaFlow Studio</strong>
            <small>Premium Workspace</small>
          </div>
        </div>

        <p className="nav-label">GENERAL</p>

        <nav>
          {menu.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={`nav-item ${page === item.name ? "active" : ""}`}
                onClick={() => navigate(item.name)}
              >
                <Icon size={19} />
                {item.name}
              </button>
            );
          })}
        </nav>

        <p className="nav-label second-label">SYSTEM</p>

        <button
          className="nav-item"
          onClick={() => setShowNotifications(true)}
        >
          <Bell size={19} />
          Notifications

          {unreadCount > 0 && (
            <span className="sidebar-notification-count">
              {unreadCount}
            </span>
          )}
        </button>

        <div className="sidebar-bottom">
          <div className="upgrade">
            <span className="upgrade-icon">✦</span>
            <h3>Power your business</h3>
            <p>
              Smart automation and advanced analytics coming soon.
            </p>
            <span className="coming-soon">COMING SOON</span>
          </div>

          <div className="connection">
            <span className={backendOnline ? "dot green" : "dot red"} />
            {backendOnline ? "Backend Connected" : "Backend Offline"}
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={22} />
            </button>

            <span>Workspace</span>
            <span className="muted">/</span>
            <strong>{page}</strong>
          </div>

          <div className="top-actions">
            <span className="health">
              <span className={backendOnline ? "dot green" : "dot red"} />
              {backendOnline ? "Live system health" : "Backend offline"}
            </span>

            <button
              className="bell"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Notifications"
            >
              <Bell size={19} />

              {unreadCount > 0 && (
                <span className="notification-count">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            <span className="avatar">
              {currentUser.name.slice(0, 2).toUpperCase()}
            </span>

            <div className="profile">
              <strong>{currentUser.name}</strong>
              <small>{currentUser.role}</small>
            </div>

            <button
              className="logout-button"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut size={17} />
              <span>Logout</span>
            </button>
          </div>
        </header>
        {showNotifications && (
          <>
            <div
              className="notification-overlay"
              onClick={() => setShowNotifications(false)}
            />

            <div className="notifications">
              <div className="notification-header">
                <div>
                  <h3>Notifications</h3>
                  <p>
                    {unreadCount > 0
                      ? `${unreadCount} unread notifications`
                      : "You're all caught up"}
                  </p>
                </div>

                <button
                  className="notification-close"
                  onClick={() => setShowNotifications(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="notification-actions">
                <button
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                >
                  Mark all as read
                </button>

                <button
                  onClick={clearAllNotifications}
                  disabled={notifications.length === 0}
                >
                  Clear all
                </button>
              </div>

              <div className="notification-list">
                {notificationsLoading && notifications.length === 0 ? (
                  <p className="notification-empty">
                    Loading notifications...
                  </p>
                ) : notifications.length === 0 ? (
                  <div className="notification-empty">
                    <Bell size={25} />
                    <strong>No notifications yet</strong>
                    <p>Your business updates will appear here.</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification._id}
                      className={`notification-item ${notification.isRead ? "read" : "unread"
                        }`}
                      onClick={() => {
                        if (!notification.isRead) {
                          markAsRead(notification._id);
                        }
                      }}
                    >
                      <div className={`notification-icon ${notification.type}`}>
                        {notification.type === "customer" && (
                          <Users size={18} />
                        )}
                        {notification.type === "order" && (
                          <ShoppingBag size={18} />
                        )}
                        {notification.type === "inventory" && (
                          <Package size={18} />
                        )}
                        {notification.type === "stock" && (
                          <Bell size={18} />
                        )}
                      </div>

                      <div className="notification-content">
                        <div className="notification-title">
                          <strong>{notification.title}</strong>

                          {!notification.isRead && (
                            <span className="unread-dot" />
                          )}
                        </div>

                        <p>{notification.message}</p>

                        <small>
                          {getNotificationTime(notification.createdAt)}
                        </small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">✦ YOUR BUSINESS AT A GLANCE</p>
              <h1>
                {page === "Dashboard" ? "Overview Dashboard" : page}
              </h1>
              <p>
                Monitor your business performance and operations in one place.
              </p>
            </div>

            {page === "Dashboard" && (
              <button
                className="export-button"
                onClick={exportOrders}
              >
                <Download size={16} /> Export CSV
              </button>
            )}
          </div>

          {page === "Dashboard" && (
            <>
              {dashboardError && (
                <p className="error-message">{dashboardError}</p>
              )}

              <div className="stats">
                {stats.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <div
                      className={`stat-card ${stat.color}`}
                      key={stat.label}
                    >
                      <div className="stat-heading">
                        <span>{stat.label}</span>
                        <Icon size={20} />
                      </div>

                      <h2>
                        {ordersLoading &&
                          orders.length === 0 &&
                          customers.length === 0 &&
                          inventory.length === 0
                          ? "..."
                          : stat.value}
                      </h2>

                      <div className="stat-footer">
                        <span className="growth">
                          <ArrowUpRight size={14} /> Live
                        </span>
                        <span>{stat.change}</span>
                      </div>

                      <div className="stat-glow" />
                    </div>
                  );
                })}
              </div>

              <div className="analytics-grid">
                <Panel
                  title="Revenue Analytics"
                  subtitle="Revenue from completed orders"
                >
                  <div className="revenue-filter">
                    {revenueFilters.map((filter) => (
                      <button
                        key={filter}
                        className={revenueFilter === filter ? "active" : ""}
                        onClick={() => setRevenueFilter(filter)}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  <div className="chart-summary">
                    <h2>
                      PKR {filteredRevenue.toLocaleString()}
                    </h2>
                    <span className="growth">
                      {revenueFilter} revenue
                    </span>
                  </div>

                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyRevenue}>
                        <defs>
                          <linearGradient
                            id="revenueGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#9875ff"
                              stopOpacity={0.5}
                            />
                            <stop
                              offset="100%"
                              stopColor="#9875ff"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>

                        <CartesianGrid
                          stroke="#ffffff12"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="month"
                          stroke="#9393b4"
                          tickLine={false}
                          axisLine={false}
                        />

                        <Tooltip
                          contentStyle={{
                            background: "#24243d",
                            border: "1px solid #ffffff25",
                            borderRadius: 12,
                            color: "#fff",
                          }}
                        />

                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#a58aff"
                          strokeWidth={3}
                          fill="url(#revenueGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel
                  title="Weekly Activity"
                  subtitle="Actual orders created in the last 7 days"
                >
                  <div className="chart-summary">
                    <h2>
                      {weeklyActivity.reduce(
                        (total, day) => total + day.value,
                        0
                      )}
                    </h2>
                    <span className="growth">Orders this week</span>
                  </div>

                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyActivity}>
                        <XAxis
                          dataKey="day"
                          stroke="#9393b4"
                          tickLine={false}
                          axisLine={false}
                        />

                        <Tooltip
                          cursor={{ fill: "#ffffff10" }}
                          contentStyle={{
                            background: "#24243d",
                            border: "1px solid #ffffff25",
                            borderRadius: 12,
                            color: "#fff",
                          }}
                        />

                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          {weeklyActivity.map((item, index) => (
                            <Cell
                              key={item.day}
                              fill={[
                                "#9875ff", "#40c8ec", "#31d1b7",
                                "#b4d86e", "#f5c16d", "#ef9a8b",
                                "#e17ac2"
                              ][index]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>

              <div className="bottom-grid">
                <Panel
                  title="Order Status Distribution"
                  subtitle="Actual orders grouped by status"
                >
                  <div className="source-layout">
                    <div className="donut">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sources}
                            dataKey="value"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={3}
                            stroke="none"
                          >
                            {sources.map((source) => (
                              <Cell
                                key={source.name}
                                fill={source.color}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="donut-center">
                        <strong>{totalOrders}</strong>
                        <small>Total Orders</small>
                      </div>
                    </div>

                    <div className="legend">
                      {sources.map((source) => (
                        <div key={source.name}>
                          <span>
                            <i style={{ background: source.color }} />
                            {source.name}
                          </span>
                          <strong>{source.value}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>

                <Panel
                  title="Recent Orders"
                  subtitle="Latest transactions"
                >
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>ORDER</th>
                          <th>CUSTOMER</th>
                          <th>AMOUNT</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>

                      <tbody>
                        {ordersLoading && orders.length === 0 ? (
                          <tr>
                            <td colSpan={4}>Loading orders...</td>
                          </tr>
                        ) : dashboardError && orders.length === 0 ? (
                          <tr>
                            <td colSpan={4}>{dashboardError}</td>
                          </tr>
                        ) : orders.length === 0 ? (
                          <tr>
                            <td colSpan={4}>
                              No orders found. Add your first order!
                            </td>
                          </tr>
                        ) : (
                          [...orders]
                            .sort(
                              (a, b) =>
                                new Date(b.createdAt || 0).getTime() -
                                new Date(a.createdAt || 0).getTime()
                            )
                            .slice(0, 4)
                            .map((order) => (
                              <tr key={order._id}>
                                <td className="highlight">
                                  {order.orderId}
                                </td>
                                <td>{order.customer}</td>
                                <td>
                                  PKR {Number(order.amount).toLocaleString()}
                                </td>
                                <td>
                                  <Status value={order.status} />
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>

              {/* Low Stock Alerts - added top spacing */}
              <div style={{ marginTop: "18px" }}>
                <Panel
                  title="Low Stock Alerts"
                  subtitle="Products that need restocking"
                >
                  <div className="stock-alerts">
                    {lowStockProducts.length === 0 ? (
                      <div className="stock-empty">
                        <span>✓</span>
                        <strong>All stock levels are healthy!</strong>
                        <p>No products need restocking right now.</p>
                      </div>
                    ) : (
                      lowStockProducts.map((product) => {
                        const isOutOfStock = product.quantity === 0;

                        return (
                          <div
                            className="stock-alert-item"
                            key={product._id}
                          >
                            <div className="stock-product-info">
                              <div
                                className={`stock-product-icon ${isOutOfStock ? "out" : "low"
                                  }`}
                              >
                                <Package size={19} />
                              </div>

                              <div>
                                <strong>{product.name}</strong>
                                <small>
                                  Threshold: {product.lowStockThreshold ?? 5} units
                                </small>
                              </div>
                            </div>

                            <div className="stock-product-status">
                              <strong
                                className={
                                  isOutOfStock ? "out-text" : "low-text"
                                }
                              >
                                {isOutOfStock
                                  ? "Out of Stock"
                                  : `${product.quantity} left`}
                              </strong>

                              <span
                                className={
                                  isOutOfStock ? "out-badge" : "low-badge"
                                }
                              >
                                {isOutOfStock
                                  ? "Unavailable"
                                  : "Restock Soon"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Panel>
              </div>

              <div className="system-banner">
                <ShieldCheck size={24} />
                <div>
                  <strong>System Connections</strong>
                  <p>
                    {backendOnline
                      ? "Express API connected successfully. Dashboard analytics are connected to MongoDB."
                      : "Start the Express server to connect your API."}
                  </p>
                </div>
              </div>
            </>
          )}

          {page === "Customers" && <CustomerManagement />}
          {page === "Orders" && <Order />}
          {page === "Inventory" && <Inventory />}

          <footer>
            © 2026 NexaFlow Studio · Business Workspace
          </footer>
        </main>
      </div>
    </div>
  );
}
