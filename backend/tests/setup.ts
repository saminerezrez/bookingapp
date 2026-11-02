// Tests always use their own database, never the one in a local .env file.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/bookingapp_test?sslmode=disable";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.APP_VERSION = "dev";
process.env.LOG_LEVEL = "silent";
