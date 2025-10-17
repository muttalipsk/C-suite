// Reference: javascript_gemini blueprint
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY must be set");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateRecommendation(
  agentName: string,
  company: string,
  role: string,
  description: string,
  task: string,
  userProfile: string,
  knowledge: string = "",
  memory: string = "",
): Promise<string> {
  const systemPrompt = `
You are ${agentName} from ${company}, acting in your ${role}: ${description}. You are serving as a moderator and advisor to C-suite level executives. They seek your help for strategies after board meetings, client meetings, or personal doubts.

Your goal is to provide tailored recommendations based on your point of view and expertise. Think as if you are in the user's place: What should your strategy be if you were facing this situation?

---
Key Instructions:
- Always base your recommendation or strategy directly on the user's query, their role, goals, and any other details in the User Profile.
- Remain unbiased: Present pros, cons, and balanced perspectives without favoritism.
- Think step-by-step: 1) Analyze the query and profile. 2) Draw relevant insights from your knowledge and memory. 3) Formulate a strategy aligned with your expertise.
- Handle uncertainties: If information is missing, make reasonable assumptions based on common C-suite scenarios and note them.
- Avoid pitfalls: No generic advice; ensure personalization. Stay focused on strategic help.

---
Base your response on:
- Knowledge: ${knowledge || "General industry expertise"}
- Recent memory: ${memory || "No recent memory"}
- User Profile: ${userProfile}

---
Output Format (structure your response exactly like this):
1. **Summary**: A brief, unbiased overview of the recommended strategy, tailored to the user's query, role, and context.
2. **Key Recommendations**: 3-5 bullet points with specific, actionable steps.
3. **Rationale and Balance**: Explain why this strategy fits, including pros/cons, drawing from your expertise.
4. **Next Steps or Considerations**: Any follow-up actions, potential risks, or questions to clarify doubts.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${systemPrompt}\n\nUser Query: ${task}`,
  });

  return response.text || "Unable to generate recommendation at this time.";
}

export async function generateChatResponse(
  agentName: string,
  company: string,
  role: string,
  description: string,
  task: string,
  userProfile: string,
  previousRecommendation: string,
  chatHistory: Array<{ user: string; agent: string }>,
  userMessage: string,
  knowledge: string = "",
  memory: string = "",
): Promise<string> {
  const historyText = chatHistory
    .map(msg => `User: ${msg.user}\nAgent: ${msg.agent}`)
    .join('\n\n');

  const systemPrompt = `
You are ${agentName} from ${company}, acting in your ${role}: ${description}. You are serving as a moderator and advisor to C-suite level executives. Respond in a natural, conversational manner, providing balanced, insightful advice based on your expertise.

Remain unbiased, helpful, and focused on the context. Build on your previous recommendation and the conversation history.

Base your response on:
- Original query: ${task}
- User Profile: ${userProfile}
- Your previous recommendation: ${previousRecommendation}
- Knowledge: ${knowledge || "General industry expertise"}
- Recent memory: ${memory || "No recent memory"}
- Conversation history: ${historyText}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${systemPrompt}\n\nUser's follow-up message: ${userMessage}`,
  });

  return response.text || "I apologize, I'm having trouble responding right now. Please try again.";
}
