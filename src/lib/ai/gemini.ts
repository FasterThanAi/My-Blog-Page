import { env } from "@/lib/env";
export const GEMINI_MODEL = env.GEMINI_MODEL;

/**
 * Helper to generate Gemini REST URL
 */
function getGeminiUrl(action: "generateContent" | "streamGenerateContent") {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:${action}?key=${env.GEMINI_API_KEY}`;
}

/**
 * Helper for request headers
 */
function getHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

/**
 * Queries Gemini for standard text response (non-streaming)
 */
export async function queryGemini(
  prompt: string,
  systemPrompt: string = "You are a helpful assistant."
): Promise<string> {
  const url = getGeminiUrl("generateContent");

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/**
 * Queries Gemini Vision with base64 image data
 */
export async function queryGeminiVision(
  base64Data: string,
  mediaType: string,
  prompt: string
): Promise<string> {
  const url = getGeminiUrl("generateContent");

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mediaType,
                data: base64Data,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Vision API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/**
 * Streams Gemini response using Server-Sent Events (SSE) / stream REST API
 */
export async function streamGemini(
  prompt: string,
  systemPrompt: string = "You are a helpful assistant."
): Promise<ReadableStream> {
  const url = getGeminiUrl("streamGenerateContent");

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Stream API Error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get reader from Gemini response stream.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Save the last incomplete line to process with next buffer chunk
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            // Regex matches "text": "value" pattern dynamically from Gemini JSON stream chunk
            const matches = cleanLine.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
            for (const match of matches) {
              if (match[1]) {
                try {
                  const textVal = JSON.parse(`"${match[1]}"`);
                  if (textVal) {
                    controller.enqueue(new TextEncoder().encode(textVal));
                  }
                } catch {
                  // Ignore JSON parse errors for escaped characters
                }
              }
            }
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
