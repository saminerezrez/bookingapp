export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "0.0.0.0",
  databaseUrl: process.env.DATABASE_URL ?? "",
  appVersion: process.env.APP_VERSION ?? "dev",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
