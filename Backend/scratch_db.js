import mongoose from "mongoose";
import AMFIMaster from "./src/models/AMFI_Master_Fund.model.js";

async function run() {
  await mongoose.connect("mongodb+srv://ombichare:jaishreeram@cluster2.bkt1son.mongodb.net");
  
  const funds = await AMFIMaster.find({}).sort({ updatedAt: -1 }).limit(30).lean();
  
  console.log("Recent 30 AMFIMaster Records:");
  funds.forEach(f => {
    console.log(`- ${f.scheme_name}`);
    console.log(`  AMFI: ${f.amfi_code}, Risk: ${f.risk_level}, Source: ${f.risk_source_type}, Status: ${f.risk_lookup_status}`);
    console.log(`  Notes: ${f.risk_notes}`);
  });

  process.exit(0);
}

run().catch(console.error);
