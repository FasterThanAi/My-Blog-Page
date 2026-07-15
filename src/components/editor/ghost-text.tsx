import * as React from "react";
import { Node, mergeAttributes, ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from "@tiptap/react";

/**
 * Interactive React component rendering the ghost text continuation
 */
function GhostTextComponent(props: NodeViewProps) {
  const { node } = props;
  const text = node.attrs.text || "";

  return (
    <NodeViewWrapper as="span" className="text-muted opacity-45 select-none pointer-events-none italic mx-0.5 align-middle">
      {text}
    </NodeViewWrapper>
  );
}

/**
 * Tiptap Inline Node Extension for AI Text Continuation (Ghost Text)
 */
export const GhostText = Node.create({
  name: "ghostText",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-ghost-text") || "",
        renderHTML: (attributes) => ({
          "data-ghost-text": attributes.text || "",
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-ghost-text]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-ghost-text": "" }), HTMLAttributes.text];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GhostTextComponent);
  },
});
