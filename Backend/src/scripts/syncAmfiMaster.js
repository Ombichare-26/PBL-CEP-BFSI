import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../db/index.js";
import { importRiskLevels, parseRiskImportFile, syncAmfiMasterFromNav } from "../services/masterData/amfiMaster.service.js";

dotenv.config({ path: ".env" });

async function main() {
  const riskFilePath = process.argv[2] || "";

  await connectDB();

  const syncResult = await syncAmfiMasterFromNav();
  console.log("AMFI master sync complete:", syncResult);

  if (riskFilePath) {
    const entries = await parseRiskImportFile(riskFilePath);
    const importResult = await importRiskLevels({
      entries,
      overwrite: true,
      defaultSourceType: "OFFICIAL_IMPORT",
    });
    console.log("Risk-level import complete:", importResult);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (_disconnectError) {
    // ignore disconnect failure on exit
  }
  process.exit(1);
});
