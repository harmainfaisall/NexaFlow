
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "./api";

interface Product {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  lowStockThreshold: number;
  image?: string;
}

type StockStatus = "Active" | "Low Stock" | "Out of Stock";

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    price: "",
    quantity: "",
    lowStockThreshold: "10",
    image: "",
  });

  // Fetch products using authenticated API
  const fetchProducts = async () => {
    try {
      setError("");

      const response = await apiFetch("/api/inventory");

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Session expired. Please log in again."
            : "Unable to fetch inventory products"
        );
      }

      const data = await response.json();
      setProducts(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Stock status
  const getStockStatus = (product: Product): StockStatus => {
    if (product.quantity === 0) return "Out of Stock";

    if (product.quantity <= product.lowStockThreshold) {
      return "Low Stock";
    }

    return "Active";
  };

  // Add modal
  const openAddModal = () => {
    setEditingProduct(null);

    setForm({
      name: "",
      price: "",
      quantity: "",
      lowStockThreshold: "10",
      image: "",
    });

    setError("");
    setShowModal(true);
  };

  // Edit modal
  const openEditModal = (product: Product) => {
    setEditingProduct(product);

    setForm({
      name: product.name,
      price: String(product.price),
      quantity: String(product.quantity),
      lowStockThreshold: String(product.lowStockThreshold),
      image: product.image || "",
    });

    setError("");
    setShowModal(true);
  };

  // Add or update product
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const price = Number(form.price);
    const quantity = Number(form.quantity);
    const lowStockThreshold = Number(form.lowStockThreshold);

    if (
      !form.name.trim() ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      !Number.isInteger(lowStockThreshold) ||
      lowStockThreshold < 0
    ) {
      setError("Please enter valid product details.");
      return;
    }

    try {
      setError("");

      const endpoint = editingProduct
        ? `/api/inventory/${editingProduct._id}`
        : "/api/inventory";

      const response = await apiFetch(endpoint, {
        method: editingProduct ? "PUT" : "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          price,
          quantity,
          lowStockThreshold,
          image: form.image.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save product");
      }

      setShowModal(false);
      await fetchProducts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    }
  };

  // Delete product
  const deleteProduct = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this product?"
    );

    if (!confirmed) return;

    try {
      setError("");

      const response = await apiFetch(`/api/inventory/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete product");
      }

      await fetchProducts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete product"
      );
    }
  };

  // Search
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  // Statistics
  const totalProducts = products.length;

  const totalUnits = products.reduce(
    (total, product) => total + product.quantity,
    0
  );

  const lowStockProducts = products.filter(
    (product) => getStockStatus(product) === "Low Stock"
  ).length;

  const outOfStockProducts = products.filter(
    (product) => getStockStatus(product) === "Out of Stock"
  ).length;

  const totalValue = products.reduce(
    (total, product) => total + product.price * product.quantity,
    0
  );

  return (
    <div className="inventory-management">
      <style>{`
        .inventory-management {
          color: #F8F7FF;
        }

        .inventory-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .inventory-stat {
          background: #222139;
          border: 1px solid #3A394F;
          border-radius: 13px;
          padding: 18px;
        }

        .inventory-stat p {
          color: #A8B6D8;
          font-size: 13px;
          margin: 0 0 12px;
        }

        .inventory-stat h2 {
          font-size: 25px;
          margin: 0;
          color: #A78BFA;
        }

        .inventory-stat:nth-child(2) h2 {
          color: #00D99A;
        }

        .inventory-stat:nth-child(3) h2 {
          color: #FFC400;
        }

        .inventory-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .inventory-search {
          background: #121426;
          border: 1px solid #3A394F;
          color: white;
          padding: 12px 15px;
          border-radius: 9px;
          outline: none;
          min-width: 230px;
        }

        .inventory-search::placeholder {
          color: #A8B6D8;
        }

        .inventory-search:focus,
        .inventory-input:focus {
          border-color: #8B2CF5;
        }

        .inventory-btn {
          border: 0;
          border-radius: 9px;
          padding: 11px 17px;
          cursor: pointer;
          font-weight: 600;
          transition: .2s;
        }

        .inventory-primary {
          background: #8B2CF5;
          color: white;
        }

        .inventory-primary:hover {
          background: #A34CFF;
        }

        .inventory-actions {
          display: flex;
          gap: 8px;
        }

        .inventory-action {
          background: #263B70;
          color: #A8C7FF;
          border: 1px solid #ffffff12;
          padding: 7px 11px;
          border-radius: 7px;
          cursor: pointer;
        }

        .inventory-delete {
          background: #57283D;
          color: #FF9AAE;
        }

        .inventory-action:hover {
          opacity: .8;
        }

        .stock-badge {
          display: inline-block;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .stock-active {
          background: #064E3B;
          color: #00E5A0;
        }

        .stock-low {
          background: #51391B;
          color: #FFC04D;
        }

        .stock-out {
          background: #57283D;
          color: #FF9AAE;
        }

        .inventory-product-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .inventory-product-card {
          background: #222139;
          border: 1px solid #3A394F;
          border-radius: 13px;
          padding: 20px;
          transition: .2s;
          min-width: 0;
        }

        .inventory-product-card:hover {
          border-color: #7252A8;
          transform: translateY(-2px);
        }

        .inventory-product-image {
          width: 100%;
          height: 180px;
          object-fit: cover;
          border-radius: 10px;
          margin-bottom: 14px;
          background: #121426;
          display: block;
        }

        .inventory-product-icon {
          color: #A78BFA;
          font-size: 25px;
          margin-bottom: 13px;
        }

        .inventory-product-card h3 {
          color: #F8F7FF;
          font-size: 15px;
          margin: 0 0 8px;
          overflow-wrap: anywhere;
        }

        .inventory-product-price {
          color: #A8B6D8;
          font-size: 12px;
          margin: 0 0 10px;
        }

        .inventory-product-quantity {
          color: #A8B6D8;
          font-size: 12px;
          margin-top: 8px;
        }

        .inventory-product-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 15px;
          padding-top: 13px;
          border-top: 1px solid #3A394F;
        }

        .inventory-modal-overlay {
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

        .inventory-modal {
          width: 100%;
          max-width: 440px;
          max-height: 90vh;
          overflow-y: auto;
          background: #222139;
          border: 1px solid #3A394F;
          border-radius: 17px;
          padding: 26px;
          box-shadow: 0 20px 70px #0008;
        }

        .inventory-modal h2 {
          margin: 0 0 7px;
          color: #F8F7FF;
        }

        .inventory-modal-description {
          color: #A8B6D8;
          font-size: 13px;
          margin-bottom: 23px;
        }

        .inventory-form-group {
          margin-bottom: 17px;
        }

        .inventory-form-group label {
          display: block;
          font-size: 13px;
          margin-bottom: 8px;
          color: #C5C1DC;
        }

        .inventory-input {
          width: 100%;
          box-sizing: border-box;
          background: #121426;
          border: 1px solid #3A394F;
          border-radius: 8px;
          padding: 12px;
          color: white;
          outline: none;
        }

        .inventory-image-preview {
          width: 100%;
          height: 140px;
          object-fit: contain;
          background: #121426;
          border: 1px solid #3A394F;
          border-radius: 9px;
          margin-top: 10px;
        }

        .inventory-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
        }

        .inventory-cancel {
          background: #34324B;
          color: white;
        }

        .inventory-error {
          background: #54252E;
          color: #FFAAAA;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 15px;
          font-size: 13px;
        }

        .inventory-empty {
          text-align: center;
          padding: 45px 15px;
          color: #A8B6D8;
          background: #222139;
          border: 1px solid #3A394F;
          border-radius: 13px;
        }

        @media (max-width: 700px) {
          .inventory-stats {
            grid-template-columns: 1fr;
          }

          .inventory-product-grid {
            grid-template-columns: 1fr;
          }

          .inventory-toolbar {
            align-items: stretch;
          }

          .inventory-search {
            width: 100%;
            box-sizing: border-box;
          }

          .inventory-modal {
            padding: 20px;
          }
        }
      `}</style>

      {/* Statistics */}
      <div className="inventory-stats">
        <div className="inventory-stat">
          <p>Total Products</p>
          <h2>{totalProducts}</h2>
        </div>

        <div className="inventory-stat">
          <p>Total Units Available</p>
          <h2>{totalUnits}</h2>
        </div>

        <div className="inventory-stat">
          <p>Low / Out of Stock</p>
          <h2>{lowStockProducts + outOfStockProducts}</h2>
        </div>
      </div>

      {/* Inventory Section */}
      <section className="panel">
        <div className="panel-heading">
          <h3>📦 Inventory Management</h3>
          <p>Manage your products, stock and inventory details</p>
        </div>

        <div style={{ padding: "18px" }}>
          {error && (
            <div className="inventory-error">{error}</div>
          )}

          <div className="inventory-toolbar">
            <input
              type="text"
              className="inventory-search"
              placeholder="⌕  Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button
              className="inventory-btn inventory-primary"
              onClick={openAddModal}
            >
              + Add Product
            </button>
          </div>

          {loading ? (
            <div className="inventory-empty">
              Loading inventory...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="inventory-empty">
              {search
                ? "No matching products found."
                : "No products yet. Add your first product!"}
            </div>
          ) : (
            <div className="inventory-product-grid">
              {filteredProducts.map((product) => {
                const status = getStockStatus(product);

                return (
                  <div
                    className="inventory-product-card"
                    key={product._id}
                  >
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="inventory-product-image"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="inventory-product-icon">
                        ◈
                      </div>
                    )}

                    <h3>{product.name}</h3>

                    <p className="inventory-product-price">
                      PKR {product.price.toLocaleString()}
                    </p>

                    <span
                      className={`stock-badge ${
                        status === "Active"
                          ? "stock-active"
                          : status === "Low Stock"
                          ? "stock-low"
                          : "stock-out"
                      }`}
                    >
                      ● {status}
                    </span>

                    <p className="inventory-product-quantity">
                      {product.quantity} units available
                    </p>

                    <div className="inventory-product-footer">
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#A8B6D8",
                        }}
                      >
                        Stock alert at {product.lowStockThreshold}
                      </span>

                      <div className="inventory-actions">
                        <button
                          className="inventory-action"
                          onClick={() => openEditModal(product)}
                        >
                          Edit
                        </button>

                        <button
                          className="inventory-action inventory-delete"
                          onClick={() => deleteProduct(product._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Inventory Value */}
      <p
        style={{
          textAlign: "center",
          color: "#A8B6D8",
          fontSize: "11px",
          marginTop: "25px",
        }}
      >
        Total Inventory Value: PKR {totalValue.toLocaleString()}
      </p>

      {/* Add / Edit Modal */}
      {showModal && (
        <div
          className="inventory-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="inventory-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              {editingProduct ? "Edit Product" : "Add New Product"}
            </h2>

            <p className="inventory-modal-description">
              Enter your product details below.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="inventory-form-group">
                <label>Product Name</label>
                <input
                  className="inventory-input"
                  type="text"
                  placeholder="Enter product name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="inventory-form-group">
                <label>Product Image URL</label>
                <input
                  className="inventory-input"
                  type="url"
                  placeholder="Paste product image URL"
                  value={form.image}
                  onChange={(e) =>
                    setForm({ ...form, image: e.target.value })
                  }
                />

                {form.image && (
                  <img
                    src={form.image}
                    alt="Product preview"
                    className="inventory-image-preview"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                    onLoad={(e) => {
                      e.currentTarget.style.display = "block";
                    }}
                  />
                )}
              </div>

              <div className="inventory-form-group">
                <label>Product Price (PKR)</label>
                <input
                  className="inventory-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Enter product price"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: e.target.value })
                  }
                  required
                />
              </div>

              <div className="inventory-form-group">
                <label>Available Quantity</label>
                <input
                  className="inventory-input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Enter stock quantity"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                  required
                />
              </div>

              <div className="inventory-form-group">
                <label>Low Stock Alert Threshold</label>
                <input
                  className="inventory-input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Default: 10"
                  value={form.lowStockThreshold}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lowStockThreshold: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="inventory-modal-actions">
                <button
                  type="button"
                  className="inventory-btn inventory-cancel"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inventory-btn inventory-primary"
                >
                  {editingProduct ? "Update Product" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
