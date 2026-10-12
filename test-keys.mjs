import dotenv from "dotenv";

dotenv.config();

console.log("\n=== CHECKING API KEYS ===\n");

const geminiKey = process.env.GEMINI_API_KEY?.trim();
const hfKey = process.env.HUGGINGFACE_API_KEY?.trim();

console.log(`✓ GEMINI_API_KEY: ${geminiKey ? `${geminiKey.substring(0, 10)}...` : "❌ MISSING"}`);
console.log(`✓ GEMINI_MODEL: ${process.env.GEMINI_MODEL || "not set"}`);
console.log(`✓ HUGGINGFACE_API_KEY: ${hfKey ? `${hfKey.substring(0, 10)}...` : "❌ MISSING"}`);
console.log(`✓ HF_MODEL: ${process.env.HF_MODEL || "not set"}`);

console.log("\n=== TESTING GEMINI ===\n");

if (!geminiKey) {
  console.log("❌ GEMINI_API_KEY is missing!");
  process.exit(1);
}

try {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: "Say hello",
    config: { maxOutputTokens: 50 }
  });
  
  console.log("✅ GEMINI WORKS!");
  console.log("Response:", response?.text?.substring(0, 100) || "Empty");
} catch (err) {
  console.log("❌ GEMINI FAILED!");
  console.log("Error:", err.message);
}

console.log("\n=== TESTING HUGGING FACE ===\n");

if (!hfKey) {
  console.log("❌ HUGGINGFACE_API_KEY is missing!");
  process.exit(1);
}

try {
  const response = await fetch(`https://api-inference.huggingface.co/models/google/flan-t5-large`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${hfKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: "Say hello in one sentence"
    })
  });
  
  if (response.ok) {
    const data = await response.json();
    console.log("✅ HUGGING FACE WORKS!");
    console.log("Response:", JSON.stringify(data).substring(0, 100));
  } else {
    const text = await response.text();
    console.log("❌ HUGGING FACE FAILED!");
    console.log(`Status ${response.status}:`, text.substring(0, 200));
  }
} catch (err) {
  console.log("❌ HUGGING FACE ERROR!");
  console.log("Error:", err.message);
}
