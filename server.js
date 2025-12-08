const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://my-project-plum-eta-90.vercel.app",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow Postman / server requests
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS not allowed for " + origin));
  },
  credentials: true,
}));

app.options("*", cors()); // <-- CRITICAL for Railway
