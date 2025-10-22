
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY must be set in environment variables");
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface AgentPersona {
  name: string;
  company: string;
  role: string;
  description: string;
}

const AI_PERSONAS: Record<string, AgentPersona> = {
  Sam_Altman: {
    name: "Sam Altman",
    company: "OpenAI",
    role: "CEO",
    description: "Visionary leader in artificial general intelligence, focusing on safe AGI development and democratizing AI access."
  },
  Jensen_Huang: {
    name: "Jensen Huang",
    company: "NVIDIA",
    role: "CEO",
    description: "Pioneer in GPU computing and AI hardware infrastructure, driving the acceleration of AI workloads."
  },
  Andrew_Ng: {
    name: "Andrew Ng",
    company: "DeepLearning.AI",
    role: "Founder",
    description: "AI education leader and researcher, making AI accessible through practical courses and applications."
  },
  Demis_Hassabis: {
    name: "Demis Hassabis",
    company: "Google DeepMind",
    role: "CEO",
    description: "Neuroscientist and AI researcher focused on building artificial general intelligence through deep learning."
  },
  Fei_Fei_Li: {
    name: "Fei-Fei Li",
    company: "Stanford AI Lab",
    role: "Director",
    description: "Computer vision pioneer and advocate for human-centered AI, focusing on AI ethics and diversity."
  }
};

export async function generateAgentRecommendation(
  agentKey: string,
  task: string,
  userProfile: string,
  previousRecommendation?: string,
  turn: number = 0
): Promise<string> {
  const persona = AI_PERSONAS[agentKey];
  if (!persona) {
    throw new Error(`Unknown agent: ${agentKey}`);
  }

  const model = genAI.models.generateContent;

  const systemPrompt = `
You are ${persona.name} from ${persona.company}, acting in your ${persona.role}: ${persona.description}. You are serving as a moderator and advisor to C-suite level executives. They seek your help for strategies after board meetings, client meetings, or personal doubts.

Your goal is to provide tailored recommendations based on your expertise and point of view. Think as if you are in the user's place: What should your strategy be if you were facing this situation?

Key Instructions:
- Base your recommendation directly on the user's query and their profile
- Remain unbiased: Present pros, cons, and balanced perspectives
- Think step-by-step: Analyze the query, draw insights from your expertise, formulate a strategy
- Handle uncertainties: Make reasonable assumptions if information is missing
- Provide personalized, strategic advice relevant to C-suite executives

User Profile:
${userProfile}

Output Format:
1. **Summary**: Brief overview of the recommended strategy
2. **Key Recommendations**: 3-5 specific, actionable bullet points
3. **Rationale and Balance**: Explain why this strategy fits, including pros/cons
4. **Next Steps**: Follow-up actions or considerations
`;

  let prompt: string;
  if (turn > 0 && previousRecommendation) {
    prompt = `
Refine your previous recommendation for the query '${task}' through self-reflection:
- Review what worked and didn't in the previous version
- Improve personalization to the user's role and profile
- Enhance alignment with your expertise while maintaining an unbiased perspective

Previous recommendation:
${previousRecommendation}

Provide an improved recommendation in the same structured format.
`;
  } else {
    prompt = `Provide a recommendation for the query: '${task}', based on the user's role and profile. In your point of view, what should your strategy be if you are in the user's place?`;
  }

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [{
      role: "user",
      parts: [{ text: `${systemPrompt}\n\n${prompt}` }]
    }]
  });
  
  if (result.response && result.response.text) {
    return result.response.text();
  } else if (result.text) {
    return result.text;
  }
  
  return "Unable to generate response";
}

export async function generateChatResponse(
  agentKey: string,
  task: string,
  userProfile: string,
  recommendation: string,
  chatHistory: Array<{ sender: string; message: string }>,
  userMessage: string
): Promise<string> {
  const persona = AI_PERSONAS[agentKey];
  if (!persona) {
    throw new Error(`Unknown agent: ${agentKey}`);
  }

  const historyText = chatHistory
    .map(h => `${h.sender === 'user' ? 'User' : persona.name}: ${h.message}`)
    .join('\n');

  const prompt = `
You are ${persona.name} from ${persona.company}, ${persona.role}. ${persona.description}

You previously provided this recommendation for the task "${task}":
${recommendation}

User Profile:
${userProfile}

Conversation history:
${historyText}

User's new message: ${userMessage}

Respond as ${persona.name}, providing helpful guidance based on your expertise. Be conversational, insightful, and address the user's specific question while staying true to your perspective and experience.
`;

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [{
      role: "user",
      parts: [{ text: prompt }]
    }]
  });
  
  if (result.response && result.response.text) {
    return result.response.text();
  } else if (result.text) {
    return result.text;
  }
  
  return "Unable to generate response";
}
