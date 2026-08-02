interface TiptapNode {
  type: string;
  text?: string;
  content?: TiptapNode[];
}

/**
 * Flattens a Tiptap/ProseMirror JSON document into plain text.
 * Used anywhere we need to feed post content to an AI prompt
 * (summaries, repurposing, translation) without HTML/node noise.
 */
export function tiptapToPlainText(doc: unknown, maxChars = 12000): string {
  if (!doc || typeof doc !== "object") return "";

  const parts: string[] = [];

  const walk = (node: TiptapNode | undefined) => {
    if (!node) return;
    if (node.type === "text" && node.text) {
      parts.push(node.text);
    }
    if (node.content) {
      node.content.forEach(walk);
    }
    if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") {
      parts.push("\n");
    }
  };

  walk(doc as TiptapNode);

  return parts.join(" ").replace(/\s+/g, " ").replace(/ \n/g, "\n").trim().slice(0, maxChars);
}

/**
 * Flattens a Tiptap/ProseMirror JSON document into an array of paragraph
 * strings (one per top-level block node). Used for translation, where we
 * want to preserve paragraph breaks without carrying over rich formatting.
 */
export function tiptapToParagraphs(doc: unknown, maxParagraphs = 60): string[] {
  if (!doc || typeof doc !== "object") return [];

  const paragraphs: string[] = [];

  const extractText = (node: TiptapNode): string => {
    if (node.type === "text" && node.text) return node.text;
    if (node.content) return node.content.map(extractText).join(" ");
    return "";
  };

  const root = doc as TiptapNode;
  if (root.content) {
    for (const block of root.content) {
      const text = extractText(block).replace(/\s+/g, " ").trim();
      if (text) paragraphs.push(text);
      if (paragraphs.length >= maxParagraphs) break;
    }
  }

  return paragraphs;
}
