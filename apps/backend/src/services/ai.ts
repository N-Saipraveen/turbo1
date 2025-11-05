import OpenAI from "openai";

export const OPENAI_API_KEY = "sk-xx";
export const API_BASE_URL = "https://api.chatanywhere.tech/v1";
export const ai = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: API_BASE_URL });

export async function aiRefineMapping(summary: string): Promise<string> {
  const res = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Return JSON with refined mapping decisions. Keep constraints." },
      { role: "user", content: summary }
    ],
    temperature: 0.1,
  });
  return res.choices[0]?.message?.content ?? "{}";
}
