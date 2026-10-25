# 🌿 Smart Irrigation & Farm Management System

A full-stack web application for Ethiopian agricultural organisations to manage irrigation, employees, payroll, finances, and farm operations in real time.

**Live Demo:**
- 🌐 Frontend: [smart-irrigation.vercel.app](https://smart-irrigation.vercel.app)
- ⚙️ Backend API: [smart-irrigation-api.onrender.com](https://smart-irrigation-api.onrender.com/api/health)

---

## ✨ Features

| Module | Description |
|--------|-------------|
| 🌱 Farm Control | Manage irrigation zones, pump control, real-time sensor data |
| 📡 Sensors | Live ESP8266/Arduino sensor readings via WebSocket |
| 👷 Employees | HR management, roles, bank accounts |
| 📅 Attendance | Daily attendance tracking per employee |
| 💰 Payroll | Monthly payroll with Chapa payment integration |
| 📊 Budget | Annual budget tracking with category breakdown |
| 💸 Expenses & Income | Financial transaction management |
| 📈 Financial Dashboard | Charts and KPIs for farm finances |
| 📋 Reports | Water usage, sensor logs, payroll, financial reports |
| 🔔 Notifications | Real-time alerts for sensor thresholds |
| 🌍 Bilingual | English & Amharic (አማርኛ) language support |

---

## 🛠 Tech Stack

**Frontend:** React 18 + Vite + React Router + Socket.IO client  
**Backend:** Node.js + Express + MongoDB (Atlas) + Socket.IO  
**Payments:** Chapa (Ethiopian payment gateway)  
**Database:** MongoDB Atlas  
**Auth:** JWT + bcrypt  

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Backend
```bash
cd backend
npm install
cp .env.example .env        # fill in your values
npm run dev                 # runs on http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env        # set VITE_API_URL
npm run dev                 # runs on http://localhost:5173
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```env
PORT=8000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/IRRIGATION
JWT_SECRET=your_jwt_secret
FRONTEND_URL=https://your-frontend.vercel.app
CHAPA_SECRET_KEY=CHASECK_TEST-your-key
CHAPA_CALLBACK_URL=https://your-backend.onrender.com/api/payroll/chapa/callback
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=https://your-backend.onrender.com/api
```

---

## 👥 User Roles

| Role | Access |
|------|--------|
| **Owner** | Full access — all modules |
| **Admin** | Farm control, sensors, users, reports |
| **Office Manager** | Employees, attendance, payroll, expenses |
| **Laborer** | Tasks, own attendance, irrigation work |

---

## 📱 Device Integration

ESP8266/Arduino devices push sensor data to:
```
POST https://your-backend.onrender.com/api/sensors/:deviceId/data
```

---

## 📄 License

MIT — Ethiopian Agricultural Organisation Edition
