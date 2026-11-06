import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "./api";

type OrderStatus = "Pending" | "Processing" | "Completed";

interface OrderItem {
  product: string | {
    _id: string;
    name: string;
    price: number;
  };
  productName?: string;
  quantity: number;
  price: number;
}

interface OrderData {
  _id: string;
  orderId: string;
  customer: string;
  customerId?: string;
  items?: OrderItem[];
  amount: number;
  status: OrderStatus;
  createdAt?: string;
}

interface CustomerOption {
  _id: string;
  name: string;
  email?: string;
}

interface ProductOption {
  _id: string;
  name: string;
  price: number;
  quantity: number;
}

interface SelectedItem {
  product: string;
  quantity: number;
}

export default function Order() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);
  const [error, setError] = useState("");
  const [stockError, setStockError] = useState("");

  const [form, setForm] = useState({
    customerId: "",
    items: [{ product: "", quantity: 1 }] as SelectedItem[],
    status: "Pending" as OrderStatus,
  });

  // Fetch all required data using authenticated requests
  const fetchData = async () => {
    try {
      setError("");

      const [ordersResponse, customersResponse, productsResponse] =
        await Promise.all([
          apiFetch("/api/orders"),
          apiFetch("/api/customers"),
          apiFetch("/api/inventory"),
        ]);

      if (!ordersResponse.ok) {
        throw new Error(
          ordersResponse.status === 401
            ? "Session expired. Please log in again."
            : "Unable to fetch orders"
        );
      }

      if (!customersResponse.ok) {
        throw new Error("Unable to fetch customers");
      }

      if (!productsResponse.ok) {
        throw new Error("Unable to fetch inventory");
      }

      const [ordersData, customersData, productsData] = await Promise.all([
        ordersResponse.json(),
        customersResponse.json(),
        productsResponse.json(),
      ]);

      const sortedOrders = [...ordersData].sort(
        (a: OrderData, b: OrderData) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );

      setOrders(sortedOrders);
      setCustomers(customersData);
      setProducts(productsData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate order total
  const orderTotal = form.items.reduce((total, item) => {
    const product = products.find((p) => p._id === item.product);

    if (!product) return total;

    return total + product.price * item.quantity;
  }, 0);

  // Open Add Order Modal
  const openAddModal = () => {
    setForm({
      customerId: "",
      items: [{ product: "", quantity: 1 }],
      status: "Pending",
    });

    setError("");
    setStockError("");
    setShowModal(true);
  };

  // Add product row
  const addProductRow = () => {
    setStockError("");

    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { product: "", quantity: 1 }],
    }));
  };

  // Remove product row
  const removeProductRow = (index: number) => {
    setStockError("");

    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Calculate available stock after considering other rows
  const getAvailableQuantity = (
    index: number,
    productId: string
  ) => {
    const product = products.find((p) => p._id === productId);

    if (!product) return 0;

    const quantityInOtherRows = form.items.reduce(
      (total, item, i) => {
        if (i !== index && item.product === productId) {
          return total + item.quantity;
        }

        return total;
      },
      0
    );

    return Math.max(0, product.quantity - quantityInOtherRows);
  };

  // Update selected product
  const updateProduct = (index: number, productId: string) => {
    setStockError("");

    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index
          ? { product: productId, quantity: 1 }
          : item
      ),
    }));
  };

  // Update product quantity with stock restriction
  const updateQuantity = (index: number, quantity: number) => {
    const item = form.items[index];

    if (!item.product) {
      setStockError("Please select a product first.");
      return;
    }

    const available = getAvailableQuantity(index, item.product);

    if (quantity > available) {
      setStockError(
        `Stock unavailable! Only ${available} units are available for this product.`
      );
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setStockError("");
      return;
    }

    setStockError("");

    setForm((prev) => ({
      ...prev,
      items: prev.items.map((currentItem, i) =>
        i === index
          ? { ...currentItem, quantity }
          : currentItem
      ),
    }));
  };

  // Create Order
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.customerId) {
      setError("Please select a customer.");
      return;
    }

    if (form.items.length === 0) {
      setError("Please add at least one product.");
      return;
    }

    for (const item of form.items) {
      if (!item.product) {
        setError("Please select a product for every row.");
        return;
      }

      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        setError("Product quantity must be at least 1.");
        return;
      }
    }

    // Combine duplicate product rows
    const quantityByProduct = new Map<string, number>();

    form.items.forEach((item) => {
      quantityByProduct.set(
        item.product,
        (quantityByProduct.get(item.product) || 0) + item.quantity
      );
    });

    // Validate stock for all orders
    for (const [productId, requestedQuantity] of quantityByProduct) {
      const product = products.find((p) => p._id === productId);

      if (!product || requestedQuantity > product.quantity) {
        setError(
          `Stock unavailable for ${product?.name || "selected product"}. Available stock: ${product?.quantity ?? 0} units.`
        );
        return;
      }
    }

    try {
      setError("");
      setStockError("");

      const response = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerId: form.customerId,
          items: form.items.map((item) => ({
            product: item.product,
            quantity: item.quantity,
          })),
          status: form.status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to create order");
      }

      setShowModal(false);
      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    }
  };

  // Delete Pending Order only
  const deleteOrder = async (order: OrderData) => {
    if (order.status !== "Pending") {
      setError(
        "Only Pending orders can be deleted. Processing and Completed orders are protected."
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this Pending order?"
    );

    if (!confirmed) return;

    try {
      setError("");

      const response = await apiFetch(`/api/orders/${order._id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete order");
      }

      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete order"
      );
    }
  };

  // Update Order Status
  const updateStatus = async (id: string, status: OrderStatus) => {
    try {
      setError("");

      const response = await apiFetch(`/api/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Status update failed");
      }

      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Status update failed"
      );
    }
  };

  // Get product name for order details
  const getProductName = (item: OrderItem): string => {
    if (item.productName) {
      return item.productName;
    }

    if (typeof item.product === "object" && item.product !== null) {
      return item.product.name;
    }

    const product = products.find((p) => p._id === item.product);

    return product?.name || "Product details unavailable";
  };

  // Search and sort orders by newest first
  const filteredOrders = orders
    .filter((order) => {
      const query = search.toLowerCase();

      return (
        order.orderId.toLowerCase().includes(query) ||
        order.customer.toLowerCase().includes(query) ||
        order.status.toLowerCase().includes(query)
      );
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );

  // Statistics
  const totalRevenue = orders
    .filter((order) => order.status === "Completed")
    .reduce(
      (total, order) => total + Number(order.amount || 0),
      0
    );

  const completedOrders = orders.filter(
    (order) => order.status === "Completed"
  ).length;

  const pendingOrders = orders.filter(
    (order) => order.status === "Pending"
  ).length;

  const processingOrders = orders.filter(
    (order) => order.status === "Processing"
  ).length;

  return (
    <div className="order-management">

      <style>{`
        .order-management {
          color: #F8F7FF;
        }

        .order-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .order-stat {
          background: #222139;
          border: 1px solid #3A394F;
          border-radius: 13px;
          padding: 18px;
        }

        .order-stat p {
          color: #A8B6D8;
          font-size: 13px;
          margin: 0 0 12px;
        }

        .order-stat h2 {
          font-size: 25px;
          margin: 0;
          color: #A78BFA;
        }

        .order-stat:nth-child(2) h2 {
          color: #00D99A;
        }

        .order-stat:nth-child(3) h2 {
          color: #FFC400;
        }

        .order-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .order-search {
          background: #121426;
          border: 1px solid #3A394F;
          color: white;
          padding: 12px 15px;
          border-radius: 9px;
          outline: none;
          min-width: 230px;
        }

        .order-search::placeholder {
          color: #A8B6D8;
        }

        .order-search:focus,
        .order-input:focus,
        .order-select:focus {
          border-color: #8B2CF5;
        }

        .order-btn {
          border: 0;
          border-radius: 9px;
          padding: 11px 17px;
          cursor: pointer;
          font-weight: 600;
          transition: .2s;
        }

        .order-primary {
          background: #8B2CF5;
          color: white;
        }

        .order-primary:hover {
          background: #A34CFF;
        }

        .order-actions {
          display: flex;
          gap: 8px;
        }

        .order-action {
          background: #263B70;
          color: #A8C7FF;
          border: 1px solid #ffffff12;
          padding: 7px 11px;
          border-radius: 7px;
          cursor: pointer;
        }

        .order-delete {
          background: #57283D;
          color: #FF9AAE;
        }

        .order-action:hover {
          opacity: .8;
        }

        .order-action:disabled {
          opacity: .35;
          cursor: not-allowed;
        }

        .order-status-select {
          background: #25233F;
          color: white;
          border: 1px solid #3A394F;
          border-radius: 7px;
          padding: 7px;
          cursor: pointer;
          outline: none;
        }

        .order-status-select option {
          background: #222139;
          color: white;
        }

        .order-modal-overlay {
          position: fixed;
          inset: 0;
          background: #000000a6;
          backdrop-filter: blur(5px);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 16px;
          z-index: 1000;
          overflow-y: auto;
        }

        .order-modal {
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          background: #222139;
          border: 1px solid #3A394F;
          border-radius: 17px;
          padding: 26px;
          box-shadow: 0 20px 70px #0008;
        }

        .order-modal h2 {
          margin: 0 0 7px;
          color: #F8F7FF;
        }

        .order-modal p {
          color: #A8B6D8;
          font-size: 13px;
          margin-bottom: 23px;
        }

        .order-form-group {
          margin-bottom: 17px;
        }

        .order-form-group label {
          display: block;
          font-size: 13px;
          margin-bottom: 8px;
          color: #C5C1DC;
        }

        .order-input,
        .order-select {
          width: 100%;
          box-sizing: border-box;
          background: #121426;
          border: 1px solid #3A394F;
          border-radius: 8px;
          padding: 12px;
          color: white;
          outline: none;
        }

        .order-select option {
          background: #222139;
          color: white;
        }

        .order-product-row {
          display: grid;
          grid-template-columns: 1fr 95px 35px;
          gap: 8px;
          margin-bottom: 10px;
          align-items: center;
        }

        .order-remove-product {
          background: #57283D;
          color: #FF9AAE;
          border: 0;
          border-radius: 7px;
          height: 40px;
          cursor: pointer;
          font-size: 18px;
        }

        .order-remove-product:disabled {
          opacity: .35;
          cursor: not-allowed;
        }

        .order-add-product {
          background: #34324B;
          color: #C5B5FF;
          border: 1px solid #514B70;
          border-radius: 8px;
          padding: 9px 13px;
          cursor: pointer;
          margin-top: 5px;
        }

        .order-total {
          background: #121426;
          border: 1px solid #514B70;
          border-radius: 9px;
          padding: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 18px;
        }

        .order-total span {
          color: #A8B6D8;
          font-size: 13px;
        }

        .order-total strong {
          color: #00D99A;
          font-size: 20px;
        }

        .order-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
        }

        .order-cancel {
          background: #34324B;
          color: white;
        }

        .order-error {
          background: #54252E;
          color: #FFAAAA;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 15px;
          font-size: 13px;
        }

        .order-stock-error {
          grid-column: 1 / -1;
          color: #FF6474;
          font-size: 11px;
          margin-top: -4px;
        }

        .order-stock-info {
          grid-column: 1 / -1;
          color: #A8B6D8;
          font-size: 11px;
          margin-top: -4px;
        }

        .order-empty {
          text-align: center;
          padding: 45px 15px;
          color: #A8B6D8;
        }

        .order-detail-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #3A394F;
          color: #C5C1DC;
          font-size: 13px;
        }

        .order-detail-row strong {
          color: #F8F7FF;
          text-align: right;
        }

        @media (max-width: 650px) {
          .order-stats {
            grid-template-columns: 1fr;
          }

          .order-toolbar {
            align-items: stretch;
          }

          .order-search {
            width: 100%;
            box-sizing: border-box;
          }

          .order-modal {
            padding: 20px;
          }

          .order-product-row {
            grid-template-columns: 1fr 75px 32px;
          }
        }
      `}</style>

      <div className="order-stats">
        <div className="order-stat">
          <p>Total Orders</p>
          <h2>{orders.length}</h2>
        </div>

        <div className="order-stat">
          <p>Completed Revenue</p>
          <h2>PKR {totalRevenue.toLocaleString()}</h2>
        </div>

        <div className="order-stat">
          <p>Completed / Pending</p>
          <h2>{completedOrders} / {pendingOrders}</h2>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h3>📦 Order Management</h3>
          <p>Manage and track your customer orders</p>
        </div>

        <div style={{ padding: "18px" }}>
          {error && (
            <div className="order-error">
              {error}
            </div>
          )}

          <div className="order-toolbar">
            <input
              type="text"
              className="order-search"
              placeholder="⌕  Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button
              className="order-btn order-primary"
              onClick={openAddModal}
            >
              + Add New Order
            </button>
          </div>

          {loading ? (
            <div className="order-empty">Loading orders...</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ORDER</th>
                    <th>CUSTOMER</th>
                    <th>AMOUNT</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="order-empty">
                          {search
                            ? "No matching orders found."
                            : "No orders yet. Add your first order!"}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order._id}>
                        <td className="highlight">
                          {order.orderId}
                        </td>

                        <td>{order.customer}</td>

                        <td>
                          PKR {Number(order.amount).toLocaleString()}
                        </td>

                        <td>
                          <select
                            className="order-status-select"
                            value={order.status}
                            disabled={order.status === "Completed"}
                            onChange={(e) =>
                              updateStatus(
                                order._id,
                                e.target.value as OrderStatus
                              )
                            }
                            style={{
                              borderColor:
                                order.status === "Completed"
                                  ? "#00D99A"
                                  : order.status === "Pending"
                                  ? "#FFC400"
                                  : "#8B2CF5",
                            }}
                          >
                            <option value="Pending">Pending</option>

                            {order.status === "Pending" && (
                              <option value="Processing">Processing</option>
                            )}

                            {order.status === "Processing" && (
                              <>
                                <option value="Processing">Processing</option>
                                <option value="Completed">Completed</option>
                                <option value="Pending">Pending</option>
                              </>
                            )}

                            {order.status === "Completed" && (
                              <option value="Completed">Completed</option>
                            )}
                          </select>
                        </td>

                        <td>
                          <div className="order-actions">
                            <button
                              className="order-action"
                              onClick={() => setSelectedOrder(order)}
                            >
                              View
                            </button>

                            <button
                              className="order-action order-delete"
                              disabled={order.status !== "Pending"}
                              title={
                                order.status !== "Pending"
                                  ? "Only Pending orders can be deleted"
                                  : "Delete order"
                              }
                              onClick={() => deleteOrder(order)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ color: "#A8B6D8", fontSize: "12px", marginTop: "12px" }}>
            Processing orders: {processingOrders}
          </div>
        </div>
      </section>

      {showModal && (
        <div
          className="order-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="order-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Create New Order</h2>
            <p>Select a customer and the products they want to purchase.</p>

            <form onSubmit={handleSubmit}>
              <div className="order-form-group">
                <label>Customer</label>

                <select
                  className="order-select"
                  value={form.customerId}
                  onChange={(e) =>
                    setForm({ ...form, customerId: e.target.value })
                  }
                  required
                >
                  <option value="">Select customer</option>

                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name}
                      {customer.email ? ` (${customer.email})` : ""}
                    </option>
                  ))}
                </select>

                {customers.length === 0 && (
                  <small style={{ color: "#FFC400" }}>
                    No customers found. Add a customer first.
                  </small>
                )}
              </div>

              <div className="order-form-group">
                <label>Products</label>

                {form.items.map((item, index) => {
                  const selectedProduct = products.find(
                    (product) => product._id === item.product
                  );

                  const availableQuantity = item.product
                    ? getAvailableQuantity(index, item.product)
                    : 0;

                  return (
                    <div className="order-product-row" key={index}>
                      <select
                        className="order-select"
                        value={item.product}
                        onChange={(e) =>
                          updateProduct(index, e.target.value)
                        }
                        required
                      >
                        <option value="">Select product</option>

                        {products.map((product) => (
                          <option
                            key={product._id}
                            value={product._id}
                            disabled={
                              product.quantity <= 0 &&
                              item.product !== product._id
                            }
                          >
                            {product.name} — PKR {product.price} (Stock: {product.quantity})
                          </option>
                        ))}
                      </select>

                      <input
                        className="order-input"
                        type="number"
                        min="1"
                        max={availableQuantity}
                        step="1"
                        value={item.quantity}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) =>
                          updateQuantity(index, Number(e.target.value))
                        }
                        required
                        aria-label="Product quantity"
                      />

                      <button
                        type="button"
                        className="order-remove-product"
                        onClick={() => removeProductRow(index)}
                        disabled={form.items.length === 1}
                        title="Remove product"
                      >
                        ×
                      </button>

                      {selectedProduct && (
                        <>
                          <small className="order-stock-info">
                            Available stock: {availableQuantity} units
                          </small>

                          <small className="order-stock-info">
                            Subtotal: PKR{" "}
                            {(selectedProduct.price * item.quantity).toLocaleString()}
                          </small>
                        </>
                      )}

                      {stockError && (
                        <small className="order-stock-error">
                          {stockError}
                        </small>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="order-add-product"
                  onClick={addProductRow}
                >
                  + Add another product
                </button>

                {products.length === 0 && (
                  <small style={{ color: "#FFC400" }}>
                    No inventory products found. Add products to Inventory first.
                  </small>
                )}
              </div>

              <div className="order-form-group">
                <label>Order Status</label>

                <select
                  className="order-select"
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as OrderStatus,
                    })
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                </select>
              </div>

              <div className="order-total">
                <span>Order Total</span>
                <strong>PKR {orderTotal.toLocaleString()}</strong>
              </div>

              <div className="order-modal-actions">
                <button
                  type="button"
                  className="order-btn order-cancel"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="order-btn order-primary"
                  disabled={customers.length === 0 || products.length === 0}
                >
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div
          className="order-modal-overlay"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="order-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Order Details</h2>
            <p>{selectedOrder.orderId}</p>

            <div className="order-detail-row">
              <span>Customer</span>
              <strong>{selectedOrder.customer}</strong>
            </div>

            <div className="order-detail-row">
              <span>Status</span>
              <strong>{selectedOrder.status}</strong>
            </div>

            <h3 style={{ marginTop: "22px", fontSize: "15px" }}>
              Products Ordered
            </h3>

            {selectedOrder.items && selectedOrder.items.length > 0 ? (
              selectedOrder.items.map((item, index) => (
                <div className="order-detail-row" key={index}>
                  <span>
                    {getProductName(item)} × {item.quantity}
                  </span>

                  <strong>
                    PKR {(item.price * item.quantity).toLocaleString()}
                  </strong>
                </div>
              ))
            ) : (
              <div className="order-empty">
                Product details are unavailable for this older order.
              </div>
            )}

            <div className="order-total">
              <span>Total Amount</span>
              <strong>
                PKR {selectedOrder.amount.toLocaleString()}
              </strong>
            </div>

            <div className="order-modal-actions">
              <button
                className="order-btn order-cancel"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}