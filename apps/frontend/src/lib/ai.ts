import OpenAI from "openai";

export const OPENAI_API_KEY = "sk-xx";
export const API_BASE_URL = "https://api.chatanywhere.tech/v1";
export const ai = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: API_BASE_URL, dangerouslyAllowBrowser: true });

export async function aiSuggestMapping(prompt: string): Promise<string> {
  const res = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You map database schemas conservatively and precisely." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2,
  });
  return res.choices[0]?.message?.content ?? "";
}
