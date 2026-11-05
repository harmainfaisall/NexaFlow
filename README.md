# ⚡ NexaFlow

### Business Management, Simplified.

A modern full-stack business management system built to bring customers, inventory, orders, and business insights together in one workspace.

<p align="center">
  <img src="https://img.shields.io/badge/React-2026-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-Ready-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
</p>

<p align="center">
  <strong>Manage smarter. Stay organized. Grow confidently.</strong>
</p>

---

## ✨ About NexaFlow

NexaFlow is a full-stack business management application designed to simplify everyday business operations.

From managing customer records and monitoring product availability to processing orders and tracking business performance, NexaFlow provides a centralized workspace to keep everything organized.

Instead of managing business activities across multiple tools, NexaFlow brings essential operations into one streamlined platform.

## 🚀 Core Features

| Feature | Description |
|---|---|
| 📊 Dashboard | Business overview, analytics, statistics, and recent orders. |
| 👥 Customer Management | Create, update, search, and manage customer records. |
| 📦 Inventory Management | Manage products, prices, quantities, and stock levels. |
| 🛒 Order Management | Create orders with multiple products and track their status. |
| 🔐 Authentication | Admin login with JWT-based authentication and password hashing. |
| 📈 Business Insights | Visual charts and summaries to understand business activity. |
| 📥 CSV Export | Export order records for external use. |
| 📱 Responsive UI | Dashboard layout designed for different screen sizes. |

## 🎯 How It Works

NexaFlow follows a simple business workflow:

```text
       ADMIN LOGIN
            |
            ▼
      DASHBOARD
            |
      ┌─────┼──────────┐
      ▼     ▼          ▼
  CUSTOMERS INVENTORY ORDERS
      |     |          |
      └─────┴────┬─────┘
                 ▼
         BUSINESS OVERVIEW
                 |
                 ▼
          TRACK & MANAGE
```

**Order and inventory workflow:**
- Select an existing customer.
- Add one or more products to an order.
- Set quantities and calculate the order total.
- Manage order status: Pending, Processing, or Completed.
- Inventory stock is adjusted when an order enters Processing status.

## 🛠️ Built With

### Frontend
- React.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React
- Recharts
- Vite

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JSON Web Tokens (JWT)
- bcryptjs

### Development Tools
- Git
- GitHub
- npm
- VS Code

## 📁 Project Structure

```text
NexaFlow/
│
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   └── .env.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── App.tsx
│   │   ├── Auth.tsx
│   │   ├── CustomerManagement.tsx
│   │   ├── Inventory.tsx
│   │   ├── Order.tsx
│   │   ├── api.ts
│   │   ├── index.css
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── .gitignore
└── README.md
```

## ⚙️ Installation & Setup

Follow these steps to run NexaFlow on your local machine.

### Prerequisites

- Node.js and npm
- MongoDB database or MongoDB Atlas account
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/harmainfaisall/NexaFlow.git
```

### 2. Open the Project

```bash
cd NexaFlow
```

### 3. Configure the Backend

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` folder and configure:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
ADMIN_EMAIL=your_admin_email
ADMIN_PASSWORD=your_admin_password
```

Use your own MongoDB connection string and secure credentials.

Start the backend:

```bash
npm run dev
```

If your backend does not have a development script, use:

```bash
node server.js
```

Backend URL:

`http://localhost:3000`

### 4. Configure the Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite in your browser.

## 🔒 Environment & Security

NexaFlow uses environment variables to keep sensitive configuration separate from application code.

| Variable | Purpose |
|---|---|
| `PORT` | Backend server port |
| `MONGO_URI` | MongoDB database connection |
| `JWT_SECRET` | JWT signing secret |
| `ADMIN_EMAIL` | Admin email |
| `ADMIN_PASSWORD` | Admin password |

> **Security Note:** Never commit actual `.env` files, database credentials, JWT secrets, or passwords to GitHub. Only commit example configuration files.

## 🗺️ Roadmap

Some areas for future development:

- [ ] Advanced business analytics and reports
- [ ] Enhanced notification system
- [ ] Product image upload support
- [ ] More detailed sales insights
- [ ] Production deployment
- [ ] Additional dashboard improvements

## 📌 Project Status

**In Development**

NexaFlow is an ongoing full-stack development project. Features and improvements are being introduced as the application evolves.

## 👩‍💻 Developer

**Harmain Faisal**

Full Stack Web Developer | Aspiring DevOps Engineer

- **GitHub:** [harmainfaisall](https://github.com/harmainfaisall)
- **LinkedIn:** [Harmain Faisal](https://www.linkedin.com/in/harmain-faisall/)

---

<p align="center">
  Made with ❤️ and lots of code.
  <br />
  <strong>NexaFlow — One Workspace. Better Business.</strong>
</p>
