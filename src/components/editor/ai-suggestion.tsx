import * as React from "react";
import { Node, mergeAttributes, ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

/**
 * Interactive React component rendering the inline Accept / Reject controls
 */
function AiSuggestionComponent(props: NodeViewProps) {
  const { node, getPos, editor } = props;
  const original = node.attrs.original || "";
  const suggested = node.attrs.suggested || "";

  const handleAccept = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof getPos !== "function") return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    // Replaces suggestion node with the accepted text
    editor.chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .insertContentAt(pos, suggested)
      .run();
  };

  const handleReject = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof getPos !== "function") return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    // Replaces suggestion node with original text
    editor.chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .insertContentAt(pos, original)
      .run();
  };

  return (
    <NodeViewWrapper as="span" className="inline-flex items-center gap-1.5 bg-raised border border-border px-1.5 py-0.5 rounded-12 select-none mx-0.5 align-middle">
      <span className="line-through text-red-500 bg-red-500/10 px-1 rounded-8 text-13 decoration-red-500/60 font-medium">
        {original}
      </span>
      <span className="text-green-600 bg-green-500/10 px-1 rounded-8 text-13 font-medium">
        {suggested}
      </span>
      
      <div className="h-3 w-[1px] bg-border mx-0.5" />
      
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className="h-5 w-5 p-0 hover:bg-green-500/10 text-green-600 rounded-4 cursor-pointer"
        onClick={handleAccept}
        title="Accept edit"
      >
        <Check className="w-3 h-3" />
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className="h-5 w-5 p-0 hover:bg-red-500/10 text-red-500 rounded-4 cursor-pointer"
        onClick={handleReject}
        title="Reject edit"
      >
        <X className="w-3 h-3" />
      </Button>
    </NodeViewWrapper>
  );
}

/**
 * Tiptap Inline Node Extension for AI Suggestion Diffs
 */
export const AiSuggestion = Node.create({
  name: "aiSuggestion",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      original: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-original") || "",
        renderHTML: (attributes) => ({
          "data-original": attributes.original || "",
        }),
      },
      suggested: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-suggested") || "",
        renderHTML: (attributes) => ({
          "data-suggested": attributes.suggested || "",
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-original]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-original": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AiSuggestionComponent);
  },
});
