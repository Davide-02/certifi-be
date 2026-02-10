/**
 * Script to fix MongoDB indexes
 * Removes old 'hash' index and ensures correct indexes exist
 * 
 * Usage: node scripts/fix-mongodb-indexes.js
 */

require("dotenv/config");
const mongoose = require("mongoose");

async function fixIndexes() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI not found in .env");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("documents");

    // List all indexes
    console.log("\n📋 Current indexes:");
    const indexes = await collection.indexes();
    indexes.forEach((idx) => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Try to drop old 'hash' index if it exists
    try {
      await collection.dropIndex("hash_1");
      console.log("\n✅ Dropped old 'hash_1' index");
    } catch (error) {
      if (error.code === 27) {
        console.log("\n⚠️  Index 'hash_1' does not exist (already removed or never existed)");
      } else {
        console.log(`\n⚠️  Could not drop 'hash_1' index: ${error.message}`);
      }
    }

    // Try to drop duplicate 'fileHash_1' index (covered by compound index)
    try {
      await collection.dropIndex("fileHash_1");
      console.log("✅ Dropped duplicate 'fileHash_1' index (covered by compound index)");
    } catch (error) {
      if (error.code === 27) {
        console.log("⚠️  Index 'fileHash_1' does not exist");
      } else {
        console.log(`⚠️  Could not drop 'fileHash_1' index: ${error.message}`);
      }
    }

    // Clean up any documents with null fileHash (shouldn't exist, but just in case)
    const result = await collection.deleteMany({ fileHash: null });
    if (result.deletedCount > 0) {
      console.log(`\n🧹 Cleaned up ${result.deletedCount} documents with null fileHash`);
    }

    // Ensure compound index exists (will be created by Mongoose schema on next app start)
    console.log("\n📝 Note: Compound index {companyId: 1, fileHash: 1} will be created automatically by Mongoose schema");

    // List indexes again
    console.log("\n📋 Updated indexes:");
    const updatedIndexes = await collection.indexes();
    updatedIndexes.forEach((idx) => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log("\n✅ Index fix completed!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixIndexes();
