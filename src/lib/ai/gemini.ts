import { env } from "@/lib/env";
export const GEMINI_MODEL = env.GEMINI_MODEL;
export const GEMINI_IMAGE_MODEL = env.GEMINI_IMAGE_MODEL;

/**
 * Helper to generate Gemini REST URL
 */
function getGeminiUrl(action: "generateContent" | "streamGenerateContent", model: string = GEMINI_MODEL) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${action}?key=${env.GEMINI_API_KEY}`;
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
 * Generates an image with Gemini's image-generation model. Returns the raw
 * base64 image data + mime type. Requires GEMINI_IMAGE_MODEL to be a model
 * your API key actually has access to — image generation is not enabled
 * for every Gemini API key/tier, so callers should surface a clear error
 * if this fails rather than assuming it will always work.
 */
export async function generateGeminiImage(
  prompt: string
): Promise<{ base64: string; mimeType: string }> {
  const url = getGeminiUrl("generateContent", GEMINI_IMAGE_MODEL);

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
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Image API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error(
      "Gemini did not return an image. Your GEMINI_API_KEY may not have access to the image generation model."
    );
  }

  return {
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
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
