#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testDatabaseConnection() {
  try {
    console.log("🔍 Testing database connection...");

    // Test connection
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    // Test query
    const userCount = await prisma.user.count();
    console.log(`📊 Found ${userCount} users in database`);

    // Test account query
    const accountCount = await prisma.account.count();
    console.log(`📊 Found ${accountCount} accounts in database`);

    await prisma.$disconnect();
    console.log("✅ Database test completed");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
}

testDatabaseConnection();
