import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize with your API Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    // Changed to a stable, widely available model name
    model: "gemini-2.5-flash",
    systemInstruction: `You are an expert in MERN and Development. 
    Follow best practices, write modular code, and always return a JSON fileTree structure.
    Response must strictly follow this JSON format:
    {
      "text": "description",
      "fileTree": { 
          "file.js": { 
              "file": { "contents": "code" } 
          } 
      },
      "buildCommand": { "mainItem": "npm", "commands": ["install"] },
      "startCommand": { "mainItem": "node", "commands": ["app.js"] }
    }`
});

export const generateResult = async (prompt) => {
    try {
        // Using generateContent with a simple string first to ensure connection
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });

        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini API Error:", error.message);
        throw error;
    }
};