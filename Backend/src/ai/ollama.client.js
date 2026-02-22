import fs from "fs";
import path from "path";

const systemPrompt = fs.readFileSync(
  path.join(process.cwd(), "src/ai/system.prompt.txt"),
  "utf-8"
);

export async function callOllama(userPrompt) {
  const finalPrompt = `
SYSTEM:
${systemPrompt}

USER:
${userPrompt}
`;

  let response;
  try {
    response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      model: "llama3:8b",
        prompt: finalPrompt,
        stream: false
      })
    });
  } catch (error) {
    throw new Error("Ollama is not reachable at http://localhost:11434. Start it with 'ollama serve' and pull 'llama3:8b-instruct'.");
  }

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // AI is forced to return JSON
  try {
    return JSON.parse(data.response);
  } catch (error) {
    const text = String(data.response || "");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const possibleJson = text.slice(start, end + 1);
      return JSON.parse(possibleJson);
    }
    throw new Error(`AI returned non-JSON output: ${text.slice(0, 200)}`);
  }
}
