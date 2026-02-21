// services/recommendation/test.js

import { analyzePortfolio } from "./recommendationEngine.js";

const tests = [
  {
    name: "CONSERVATIVE CASE",
    input: {
      categoryPercentages: {
        ETF: 80,
        FLEXI: 20,
        SMALL: 0,
      },
      durationMonths: 12,
      investmentAmount: 500000,
    },
  },
  {
    name: "BALANCED CASE",
    input: {
      categoryPercentages: {
        ETF: 40,
        FLEXI: 40,
        SMALL: 20,
      },
      durationMonths: 36,
      investmentAmount: 300000,
    },
  },
  {
    name: "AGGRESSIVE CASE",
    input: {
      categoryPercentages: {
        ETF: 10,
        FLEXI: 30,
        SMALL: 60,
      },
      durationMonths: 60,
      investmentAmount: 100000,
    },
  },
];

for (const test of tests) {
  const result = analyzePortfolio(test.input);

  console.log(`\n🔹 ${test.name}`);
  console.log("Input:", test.input);
  console.log("Output:", result);
}