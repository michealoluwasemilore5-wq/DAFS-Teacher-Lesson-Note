import dotenv from "dotenv";

dotenv.config();

const geminiKey = process.env.GEMINI_API_KEY?.trim();
const hfKey = process.env.HUGGINGFACE_API_KEY?.trim();

const configuredModel = process.env.HF_MODEL?.trim();

const hfModel =
  !configuredModel ||
  configuredModel === "google/flan-t5-large"
    ? "openai/gpt-oss-20b:cheapest"
    : configuredModel;

console.log("=== DAFS AI CONNECTION TEST ===");

console.log(
  "Gemini API key:",
  geminiKey ? "Configured" : "Missing"
);

console.log(
  "Hugging Face API key:",
  hfKey ? "Configured" : "Missing"
);

console.log("Hugging Face model:", hfModel);

if (geminiKey) {
  try {
    const { GoogleGenAI } = await import("@google/genai");

    const ai = new GoogleGenAI({
      apiKey: geminiKey
    });

    const response = await ai.models.generateContent({
      model:
        process.env.GEMINI_MODEL ||
        "gemini-3.5-flash-lite",

      contents: "Reply with exactly: Gemini is working.",

      config: {
        maxOutputTokens: 30
      }
    });

    console.log(
      "Gemini response:",
      response?.text || "Empty response"
    );
  } catch (error) {
    console.error("Gemini error:", error.message);
  }
}

if (hfKey) {
  try {
    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${hfKey}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          model: hfModel,

          messages: [
            {
              role: "user",
              content:
                "Reply with exactly: Hugging Face is working."
            }
          ],

          max_tokens: 30,
          temperature: 0,
          stream: false
        }),

        signal: AbortSignal.timeout(60000)
      }
    );

    const body = await response.text();

    if (!response.ok) {
      console.error(
        "Hugging Face error:",
        response.status,
        body.slice(0, 500)
      );
    } else {
      const data = JSON.parse(body);

      console.log(
        "Hugging Face response:",
        data?.choices?.[0]?.message?.content ||
          "Empty response"
      );
    }
  } catch (error) {
    console.error(
      "Hugging Face connection error:",
      error.message
    );
  }
}

console.log("=== TEST COMPLETE ===");
