// Prisma config file
import * as dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// 手动加载 .env 文件
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL || "",
  },
});
