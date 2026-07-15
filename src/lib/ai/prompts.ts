/**
 * System prompts and prompt templates for Claude API editor actions.
 * Centralized here to enforce a strict output contract per template.
 */

/**
 * CONTRACT FOR GRAMMAR CORRECTION:
 * - Must return the rewritten text containing inline suggestion tags: [DEL:original text][INS:suggested text]
 * - Only wrap the parts of the text that have been changed.
 * - Do not include any introductory or concluding remarks. Return only the annotated text.
 */
export const grammarPrompt = (text: string) => `
You are a precise copyeditor. Read the following text and fix spelling mistakes, grammar, punctuation typos, and clarity issues.

CRITICAL RULES:
1. You MUST format every suggested change inline using exactly: [DEL:original text][INS:corrected text].
   Example: "This is [DEL:a error][INS:an error] in the draft."
2. Do not wrap correct text in tags. Only wrap the specific parts that you corrected.
3. Keep all other text exactly as it is.
4. Return ONLY the rewritten text with inline tags. Do not include any intro, explanation, markdown headers, or comments.

Text to fix:
"""
${text}
"""
`.trim();

/**
 * CONTRACT FOR TONE REWRITE:
 * - Receives a selection and a tone preset (concise, formal, friendly, simpler).
 * - Must return the selection rewritten in that tone, with suggestions marked inline: [DEL:original text][INS:rewritten text].
 * - Return only the annotated rewrite without surrounding chat dialogue.
 */
export const rewritePrompt = (text: string, tone: string) => `
You are an expert editor. Rewrite the following text to make the tone "${tone}".

CRITICAL RULES:
1. You MUST format all changes inline using exactly: [DEL:original text][INS:rewritten text].
   Example: "I [DEL:wanted to say hi][INS:am writing to introduce myself] because..."
2. Only wrap changed parts in these tags. Keep unchanged text as-is.
3. Return ONLY the annotated text. No introductions, explanations, or chat headers.

Text to rewrite:
"""
${text}
"""
`.trim();

/**
 * CONTRACT FOR CONTINUE WRITING (GHOST TEXT):
 * - Streams a natural continuation of the text from the cursor point.
 * - Return ONLY the continuation text that should be appended to the cursor.
 * - Do not repeat any part of the context or selected text. No comments. Max 100 words.
 */
export const continuePrompt = (contextBefore: string, contextAfter: string) => `
You are a collaborative writing assistant. Continue writing the draft based on the context before the cursor.

Context before the cursor:
"""
${contextBefore}
"""

Context after the cursor (if any):
"""
${contextAfter}
"""

CRITICAL RULES:
1. Stream ONLY the text that naturally flows directly from the end of the "Context before the cursor".
2. DO NOT repeat the context.
3. DO NOT wrap the output in quotes, explanations, or markdown blocks.
4. Keep the continuation concise (maximum 100 words).

Start writing from the cursor:
`.trim();

/**
 * CONTRACT FOR METADATA GENERATION:
 * - Receives full draft text.
 * - Generates 3 title options and 1 SEO meta description.
 * - Must return a raw JSON block containing keys "titles" (array of 3 strings) and "description" (string).
 * - No markdown wrapping, no fluff. Only return valid, parsable JSON.
 */
export const metadataPrompt = (draft: string) => `
You are an SEO specialist. Review the following blog draft and generate exactly 3 title options and 1 SEO meta description.

CRITICAL RULES:
1. Return your output EXACTLY as a valid JSON object matching this schema:
   {
     "titles": [
       "First title option",
       "Second title option",
       "Third title option"
     ],
     "description": "Compelling SEO meta description summarizing the draft (max 150 characters)"
   }
2. DO NOT wrap the JSON in markdown code blocks (\`\`\`json).
3. DO NOT include any explanatory text. Return only the raw JSON string.

Draft:
"""
${draft}
"""
`.trim();

/**
 * CONTRACT FOR ALT TEXT:
 * - Receives description of the image or analysis request.
 * - Must return a short, descriptive alt-text sentence (no fluff, max 120 characters).
 * - No intro or comments.
 */
export const altTextPrompt = () => `
You are an accessibility expert. Describe the image provided in detail to generate a high-quality "alt" attribute for screen readers.

CRITICAL RULES:
1. Write a clear, concise description of the contents and style of the image.
2. Keep it under 120 characters.
3. Do not start with "Image of" or "Photo of". Start describing directly.
4. Return ONLY the alt text description string. No quotes, explanations, or labels.
`.trim();
