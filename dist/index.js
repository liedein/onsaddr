// server/index.ts
import dotenv from "dotenv";
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage = class {
  usageRecords;
  constructor() {
    this.usageRecords = /* @__PURE__ */ new Map();
  }
  // IP와 날짜로 사용량 조회
  async getUsageByIpAndDate(ipAddress, date) {
    return Array.from(this.usageRecords.values()).find(
      (record) => record.ipAddress === ipAddress && record.date === date
    );
  }
  // 새로운 사용량 기록 생성
  async createUsageRecord(insertUsage) {
    const id = randomUUID();
    const now = /* @__PURE__ */ new Date();
    const usage = {
      ...insertUsage,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.usageRecords.set(id, usage);
    return usage;
  }
  // 사용량 업데이트
  async updateUsageCount(id, count) {
    const existing = this.usageRecords.get(id);
    if (!existing) {
      throw new Error("Usage record not found");
    }
    const updated = {
      ...existing,
      usageCount: count,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.usageRecords.set(id, updated);
    return updated;
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var usageTracking = pgTable("usage_tracking", {
  id: varchar("id").primaryKey(),
  // 기본키로 사용되는 ID
  ipAddress: text("ip_address").notNull(),
  // IP 주소 (필수)
  usageCount: integer("usage_count").notNull().default(0),
  // 사용 횟수 (기본값 0)
  date: text("date").notNull(),
  // 날짜 (YYYY-MM-DD 형식으로 저장)
  createdAt: timestamp("created_at").defaultNow(),
  // 생성일시 (기본값 현재 시각)
  updatedAt: timestamp("updated_at").defaultNow()
  // 수정일시 (기본값 현재 시각)
});
var insertUsageTrackingSchema = createInsertSchema(usageTracking).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var coordinateToAddressSchema = z.object({
  lat: z.number(),
  // 위도
  lng: z.number()
  // 경도
});
var addressResponseSchema = z.object({
  address: z.string(),
  // 변환된 주소
  lat: z.number(),
  // 위도
  lng: z.number()
  // 경도
});

// server/routes.ts
import axios from "axios";
function getClientIp(req) {
  return req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0] || // req.connection은 deprecated될 수 있으므로 최근 Express에서는 req.socket 사용 권장
  req.socket && req.socket.remoteAddress || "127.0.0.1";
}
function getTodayDateString() {
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
async function checkUsageLimit(ipAddress) {
  const today = getTodayDateString();
  const existingUsage = await storage.getUsageByIpAndDate(ipAddress, today);
  if (!existingUsage) {
    await storage.createUsageRecord({ ipAddress, usageCount: 0, date: today });
    return { allowed: true, currentCount: 0 };
  }
  if (existingUsage.usageCount >= 100) {
    return { allowed: false, currentCount: existingUsage.usageCount };
  }
  return { allowed: true, currentCount: existingUsage.usageCount };
}
async function incrementUsageCount(ipAddress) {
  const today = getTodayDateString();
  const existingUsage = await storage.getUsageByIpAndDate(ipAddress, today);
  if (!existingUsage) {
    await storage.createUsageRecord({ ipAddress, usageCount: 1, date: today });
    return 1;
  }
  const newCount = existingUsage.usageCount + 1;
  await storage.updateUsageCount(existingUsage.id, newCount);
  return newCount;
}
async function registerRoutes(app2) {
  app2.get("/api/usage", async (req, res) => {
    try {
      const ipAddress = getClientIp(req);
      const today = getTodayDateString();
      const usage = await storage.getUsageByIpAndDate(ipAddress, today);
      res.json({
        count: usage?.usageCount || 0,
        limit: 100,
        date: today
      });
    } catch (error) {
      console.error("Error getting usage:", error);
      res.status(500).json({ message: "Failed to get usage information" });
    }
  });
  app2.post("/api/static-map", async (req, res) => {
    try {
      const ipAddress = getClientIp(req);
      const { allowed } = await checkUsageLimit(ipAddress);
      if (!allowed) {
        return res.status(429).json({
          message: "Daily usage limit exceeded (100 requests per day)"
        });
      }
      const parseResult = coordinateToAddressSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "Invalid request body",
          errors: parseResult.error.errors
        });
      }
      const { lat, lng } = parseResult.data;
      const width = 800;
      const height = 600;
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#1F2937"/>
  <rect x="20" y="20" width="${width - 40}" height="${height - 80}" fill="#374151" stroke="#4B5563" stroke-width="2"/>
  <defs>
    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#4B5563" stroke-width="1" opacity="0.3"/>
    </pattern>
  </defs>
  <rect x="20" y="20" width="${width - 40}" height="${height - 80}" fill="url(#grid)"/>
  <circle cx="${width / 2}" cy="${height / 2}" r="8" fill="#10B981"/>
  <circle cx="${width / 2}" cy="${height / 2}" r="4" fill="#065F46"/>
  <text x="${width / 2}" y="${height / 2 + 40}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#F9FAFB">
    \uC704\uB3C4: ${lat.toFixed(6)}
  </text>
  <text x="${width / 2}" y="${height / 2 + 65}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#F9FAFB">
    \uACBD\uB3C4: ${lng.toFixed(6)}
  </text>
  <rect x="10" y="${height - 80}" width="${width - 20}" height="70" fill="rgba(0,0,0,0.7)" rx="8"/>
  <text x="20" y="${height - 50}" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#10B981">
    \uC9C0\uB3C4 \uC704\uCE58: ${lat.toFixed(4)}, ${lng.toFixed(4)}
  </text>
  <text x="20" y="${height - 25}" font-family="Arial, sans-serif" font-size="14" fill="#F9FAFB">
    \uC88C\uD45C \uAE30\uBC18 \uC9C0\uB3C4 \uC774\uBBF8\uC9C0
  </text>
</svg>`;
      await incrementUsageCount(ipAddress);
      const buffer = Buffer.from(svgContent, "utf8");
      res.set({
        "Content-Type": "image/svg+xml",
        "Content-Length": buffer.length,
        "Cache-Control": "no-cache"
      });
      res.send(buffer);
    } catch (error) {
      console.error("Error creating map image:", error);
      res.status(500).json({ message: "Failed to create map image" });
    }
  });
  app2.post("/api/coordinate-to-address", async (req, res) => {
    try {
      const ipAddress = getClientIp(req);
      const { allowed } = await checkUsageLimit(ipAddress);
      if (!allowed) {
        return res.status(429).json({
          message: "Daily usage limit exceeded (100 requests per day)"
        });
      }
      const parseResult = coordinateToAddressSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "Invalid request body",
          errors: parseResult.error.errors
        });
      }
      const { lat, lng } = parseResult.data;
      const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY || "";
      if (!kakaoRestApiKey) {
        console.warn("KAKAO_REST_API_KEY is not set.");
        return res.status(500).json({ message: "Missing Kakao API key" });
      }
      const response = await axios.get(
        "https://dapi.kakao.com/v2/local/geo/coord2address.json",
        {
          headers: {
            Authorization: `KakaoAK ${kakaoRestApiKey}`
          },
          params: {
            x: lng,
            y: lat,
            input_coord: "WGS84"
          }
        }
      );
      if (!response.data?.documents || response.data.documents.length === 0) {
        return res.status(404).json({ message: "Address not found for the given coordinates" });
      }
      const document = response.data.documents[0];
      const address = document.address?.address_name || document.road_address?.address_name || "\uC8FC\uC18C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4";
      const usageCount = await incrementUsageCount(ipAddress);
      res.json({
        address,
        lat,
        lng,
        usageCount
      });
    } catch (error) {
      console.error("Error converting coordinates to address:", error);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 500;
        if (status === 401) {
          return res.status(500).json({ message: "Kakao API \uC778\uC99D \uC2E4\uD328" });
        } else if (status === 429) {
          return res.status(429).json({ message: "Kakao API \uC694\uCCAD \uD55C\uB3C4 \uCD08\uACFC" });
        } else {
          return res.status(500).json({ message: "Kakao API \uC624\uB958" });
        }
      }
      res.status(500).json({ message: "Failed to convert coordinates to address" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var vite_config_default = defineConfig(async () => ({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      (await import("@replit/vite-plugin-cartographer")).cartographer()
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets")
      // 역슬래시 제거
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
      // 역슬래시 없이 와일드카드 패턴 사용
    }
  }
}));

// server/vite.ts
import { nanoid } from "nanoid";
import { fileURLToPath as fileURLToPath2 } from "url";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: "all"
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(__dirname2, "..", "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      if (e instanceof Error) {
        vite.ssrFixStacktrace(e);
      }
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "..", "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
dotenv.config();
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse;
  const originalResJson = res.json.bind(res);
  res.json = (bodyJson, ...args) => {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  try {
    const server = await registerRoutes(app);
    app.use((err, _req, res, _next) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    const port = parseInt(process.env.PORT || "5000", 10);
    server.listen(
      {
        port,
        host: "0.0.0.0"
      },
      () => {
        log(`serving on port ${port}`);
      }
    );
  } catch (err) {
    log("Server initialization error:", err);
    process.exit(1);
  }
})();
