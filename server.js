import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3002;

// ---------------- CORS CONFIG ---------------- //
const allowedOrigins = [
  "https://my-project-ovwmn55cv-lhehlolbro123-2933s-projects.vercel.app",
  "http://localhost:3000",
  "https://my-project-78bhaky0t-lhehlolbro123-2933s-projects.vercel.app",
];

app.use((req, res, next) => {
  console.log("➡ Incoming request:", req.method, req.path, "Origin:", req.headers.origin);

  next();
});

app.use(cors({
  origin: (origin, callback) => {
    console.log("🔹 CORS check for origin:", origin);
    if (!origin) {
      console.log("   → No origin (server/Postman request) allowed");
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      console.log("   → Origin allowed");
      return callback(null, true);
    }
    console.log("   → Origin blocked");
    return callback(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true,
}));

app.options("*", (req, res) => {
  console.log("⚡ OPTIONS preflight received for path:", req.path, "Origin:", req.headers.origin);
  res.sendStatus(204);
});

// ---------------- MIDDLEWARE ---------------- //
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- HEALTH CHECK ---------------- //
app.get('/', (req, res) => {
  console.log("🏥 Health check request received");
  res.json({ message: 'Backend running', timestamp: new Date() });
});

// ---------------- SAMPLE ROUTE ---------------- //
app.post('/api/auth/signin', (req, res) => {
  console.log("📝 /api/auth/signin request body:", req.body);
  res.json({ success: true, message: "Signin route hit" });
});

// ---------------- ERROR HANDLING ---------------- //
app.use((err, req, res, next) => {
  console.error("🔥 ERROR middleware:", err.message);
  if (err.message.includes('CORS')) {
    return res.status(403).json({ success: false, message: 'CORS violation', error: err.message });
  }
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

// ---------------- START SERVER ---------------- //
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
