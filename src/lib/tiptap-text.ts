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
