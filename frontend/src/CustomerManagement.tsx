
import { useEffect, useState } from "react";
import {
  Plus, Search, Pencil, Trash2,
  Users, X, Save, Loader2,
  ClipboardList, Package, CalendarDays
} from "lucide-react";
import { apiFetch } from "./api";

type Customer = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  status: "Active" | "Inactive";
  createdAt?: string;
};

type CustomerForm = Omit<Customer, "_id" | "createdAt">;

type InventoryProduct = {
  _id: string;
  name: string;
  price: number;
};

type OrderItem = {
  product: string | {
    _id: string;
    name?: string;
    price?: number;
  };
  productName?: string;
  quantity: number;
  price?: number;
};

type Order = {
  _id: string;
  orderId: string;
  customer: string;
  customerId?: string | null;
  items: OrderItem[];
  amount: number;
  status: "Pending" | "Processing" | "Completed";
  createdAt?: string;
};

const emptyForm: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  city: "",
  status: "Active"
};

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);

  const [search, setSearch] = useState("");
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCustomers() {
    setLoading(true);
    setError("");

    try {
      const [customersResult, ordersResult, inventoryResult] =
        await Promise.all([
          apiFetch("/api/customers"),
          apiFetch("/api/orders"),
          apiFetch("/api/inventory")
        ]);

      if (!customersResult.ok) {
        throw new Error("Could not load customers");
      }

      const customerData: Customer[] =
        await customersResult.json();

      const sortedCustomers = [...customerData].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );

      setCustomers(sortedCustomers);

      if (ordersResult.ok) {
        const orderData: Order[] = await ordersResult.json();

        setOrders(
          [...orderData].sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() -
              new Date(a.createdAt || 0).getTime()
          )
        );
      }

      if (inventoryResult.ok) {
        const inventoryData: InventoryProduct[] =
          await inventoryResult.json();

        setInventory(inventoryData);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Cannot connect to the server."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  // Open Add Customer Form
  function openAddForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setMessage("");
    setShowForm(true);
  }

  // Open Edit Customer Form
  function openEditForm(customer: Customer) {
    setForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      status: customer.status
    });

    setEditingId(customer._id);
    setError("");
    setMessage("");
    setShowForm(true);
  }

  // Update form fields
  function updateField(
    field: keyof CustomerForm,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value
    }));
  }

  // Add or Update Customer
  async function saveCustomer(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.city.trim()
    ) {
      setError("Please complete all fields.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const endpoint = editingId
        ? `/api/customers/${editingId}`
        : "/api/customers";

      const response = await apiFetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const data = await response.json();

        throw new Error(
          data.message || "Unable to save customer"
        );
      }

      setMessage(
        editingId
          ? "Customer updated successfully!"
          : "Customer registered successfully!"
      );

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);

      await loadCustomers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );
    } finally {
      setSaving(false);
    }
  }

  // Delete Customer
  async function deleteCustomer(customer: Customer) {
    const confirmed = window.confirm(
      `Delete ${customer.name}?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        `/api/customers/${customer._id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();

        throw new Error(
          data.message || "Unable to delete customer"
        );
      }

      setMessage("Customer deleted successfully!");
      await loadCustomers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Customer could not be deleted."
      );
    }
  }

  // Get orders belonging to a customer
  function getCustomerOrders(customer: Customer) {
    return orders.filter(
      (order) => order.customerId === customer._id
    );
  }

  // Get product name
  function getProductName(item: OrderItem) {
    if (item.productName) {
      return item.productName;
    }

    if (
      typeof item.product === "object" &&
      item.product?.name
    ) {
      return item.product.name;
    }

    const productId =
      typeof item.product === "string"
        ? item.product
        : item.product?._id;

    const product = inventory.find(
      (product) => product._id === productId
    );

    return product?.name || "Product unavailable";
  }

  // Get product price
  function getItemPrice(item: OrderItem) {
    if (typeof item.price === "number") {
      return item.price;
    }

    if (
      typeof item.product === "object" &&
      typeof item.product.price === "number"
    ) {
      return item.product.price;
    }

    const productId =
      typeof item.product === "string"
        ? item.product
        : item.product?._id;

    const product = inventory.find(
      (product) => product._id === productId
    );

    return product?.price ?? 0;
  }

  // Search customers and show newest first
  const filtered = customers
    .filter((customer) =>
      `${customer.name} ${customer.email} ${customer.phone} ${customer.city}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );

  const activeCount = customers.filter(
    (customer) => customer.status === "Active"
  ).length;

  const fieldStyle =
    "w-full rounded-xl border border-white/15 " +
    "bg-[#11152b] px-4 py-3 text-white " +
    "outline-none focus:border-violet-400";

  const customerOrders = selectedCustomer
    ? getCustomerOrders(selectedCustomer)
    : [];

  const completedSpending = customerOrders
    .filter((order) => order.status === "Completed")
    .reduce((total, order) => total + order.amount, 0);

  const totalOrderValue = customerOrders.reduce(
    (total, order) => total + order.amount,
    0
  );

  const completedCount = customerOrders.filter(
    (order) => order.status === "Completed"
  ).length;

  // Format date
  function formatDate(date?: string) {
    if (!date) return "Date unavailable";

    return new Date(date).toLocaleDateString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  return (
    <div className="space-y-6 text-white">

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            title: "Total Customers",
            value: customers.length,
            color: "text-violet-400"
          },
          {
            title: "Active Customers",
            value: activeCount,
            color: "text-emerald-400"
          },
          {
            title: "Inactive Customers",
            value: customers.length - activeCount,
            color: "text-amber-400"
          }
        ].map((stat) => (
          <div
            key={stat.title}
            className="rounded-2xl border border-white/10 bg-[#222139] p-5"
          >
            <p className="text-sm text-slate-400">
              {stat.title}
            </p>

            <h2 className={`mt-3 text-3xl font-bold ${stat.color}`}>
              {stat.value}
            </h2>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#222139] p-5">

        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="text-violet-400" />
              Customer Directory
            </h2>
          </div>

          <button
            onClick={openAddForm}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium hover:bg-violet-500"
          >
            <Plus size={18} />
            Add Customer
          </button>
        </div>

        <div className="mb-5 flex max-w-md items-center gap-3 rounded-xl border border-white/15 bg-[#11152b] px-4">
          <Search size={18} className="text-slate-400" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customers..."
            className="w-full bg-transparent py-3 text-sm text-white outline-none"
          />
        </div>

        {message && (
          <p className="mb-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">
            {message}
          </p>
        )}

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <p className="flex items-center gap-2 text-slate-400">
            <Loader2 className="animate-spin" size={18} />
            Loading customers...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-slate-400">
                  <th className="px-3 py-4">Customer</th>
                  <th className="px-3 py-4">Phone</th>
                  <th className="px-3 py-4">City</th>
                  <th className="px-3 py-4">Status</th>
                  <th className="px-3 py-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((customer) => (
                  <tr
                    key={customer._id}
                    className="border-b border-white/5"
                  >
                    <td className="px-3 py-4">
                      <p className="font-semibold">
                        {customer.name}
                      </p>

                      <p className="text-xs text-slate-400">
                        {customer.email}
                      </p>
                    </td>

                    <td className="px-3 py-4">
                      {customer.phone}
                    </td>

                    <td className="px-3 py-4">
                      {customer.city}
                    </td>

                    <td className="px-3 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        customer.status === "Active"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}>
                        {customer.status}
                      </span>
                    </td>

                    <td className="px-3 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedCustomer(customer)}
                          className="rounded-lg bg-violet-500/15 p-2 text-violet-300 hover:bg-violet-500/25"
                          title="View order history"
                        >
                          <ClipboardList size={16} />
                        </button>

                        <button
                          onClick={() => openEditForm(customer)}
                          className="rounded-lg bg-blue-500/15 p-2 text-blue-300"
                          title="Edit customer"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => deleteCustomer(customer)}
                          className="rounded-lg bg-red-500/15 p-2 text-red-300"
                          title="Delete customer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <p className="py-8 text-center text-slate-400">
                No customers found.
              </p>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#222139] p-6 shadow-2xl">

            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editingId ? "Edit Customer" : "Register New Customer"}
              </h2>

              <button onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveCustomer} className="space-y-4">
              <input
                className={fieldStyle}
                placeholder="Full Name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />

              <input
                className={fieldStyle}
                type="email"
                placeholder="Email Address"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
              />

              <input
                className={fieldStyle}
                placeholder="Phone Number"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                required
              />

              <input
                className={fieldStyle}
                placeholder="City"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
                required
              />

              <select
                className={fieldStyle}
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 font-semibold hover:bg-violet-500 disabled:opacity-50"
              >
                <Save size={18} />
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Customer"
                  : "Save Customer"}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4">

          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#222139] p-5 shadow-2xl sm:p-7">

            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardList className="text-violet-400" />

                  <h2 className="text-xl font-bold">
                    Customer Order History
                  </h2>
                </div>

                <p className="mt-2 text-sm text-slate-400">
                  {selectedCustomer.name} · {selectedCustomer.email}
                </p>
              </div>

              <button
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">

              <div className="rounded-xl border border-white/10 bg-[#11152b] p-4">
                <p className="text-sm text-slate-400">
                  Total Orders
                </p>

                <h3 className="mt-2 text-2xl font-bold">
                  {customerOrders.length}
                </h3>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#11152b] p-4">
                <p className="text-sm text-slate-400">
                  Completed Orders
                </p>

                <h3 className="mt-2 text-2xl font-bold text-emerald-400">
                  {completedCount}
                </h3>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#11152b] p-4">
                <p className="text-sm text-slate-400">
                  Total Spent
                </p>

                <h3 className="mt-2 text-2xl font-bold text-violet-400">
                  PKR {completedSpending.toLocaleString()}
                </h3>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-white/10 bg-[#11152b] p-4">
              <p className="text-sm text-slate-400">
                Total Value of All Orders
              </p>

              <h3 className="mt-1 text-xl font-bold">
                PKR {totalOrderValue.toLocaleString()}
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Includes Pending, Processing and Completed orders.
              </p>
            </div>

            <div>
              <h3 className="mb-4 text-lg font-semibold">
                Orders
              </h3>

              {customerOrders.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-[#11152b] p-8 text-center">
                  <Package size={32} className="mx-auto mb-3 text-slate-500" />

                  <p className="font-medium">
                    No orders found
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    This customer has not placed any orders yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {[...customerOrders]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt || 0).getTime() -
                        new Date(a.createdAt || 0).getTime()
                    )
                    .map((order) => (
                    <div
                      key={order._id}
                      className="rounded-xl border border-white/10 bg-[#11152b] p-4"
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

                        <div>
                          <p className="font-semibold">
                            {order.orderId}
                          </p>

                          <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                            <CalendarDays size={14} />
                            {formatDate(order.createdAt)}
                          </p>
                        </div>

                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          order.status === "Completed"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : order.status === "Processing"
                            ? "bg-blue-500/15 text-blue-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {order.items?.length > 0 ? (
                          order.items.map((item, index) => {
                            const price = getItemPrice(item);

                            return (
                              <div
                                key={`${order._id}-${index}`}
                                className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3"
                              >
                                <div>
                                  <p className="text-sm font-medium">
                                    {getProductName(item)}
                                  </p>

                                  <p className="text-xs text-slate-400">
                                    Quantity: {item.quantity} × PKR{" "}
                                    {price.toLocaleString()}
                                  </p>
                                </div>

                                <p className="text-sm font-semibold">
                                  PKR{" "}
                                  {(price * item.quantity).toLocaleString()}
                                </p>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-slate-400">
                            Product details are unavailable for this order.
                          </p>
                        )}
                      </div>

                      <div className="mt-4 flex justify-between border-t border-white/10 pt-3">
                        <span className="text-sm text-slate-400">
                          Order Total
                        </span>

                        <span className="font-bold text-violet-300">
                          PKR {order.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedCustomer(null)}
              className="mt-6 w-full rounded-xl border border-white/15 py-3 text-sm font-medium hover:bg-white/5"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
