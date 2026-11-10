import prisma from "./index.js";

async function testDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    console.log("Database connection established successfully!");
    return true;
  } catch (error) {
    console.error("Database connection failed:", error.message);
    return false;
  }
}

export default testDatabaseConnection;
