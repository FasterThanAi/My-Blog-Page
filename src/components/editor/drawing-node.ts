import { Node, mergeAttributes } from "@tiptap/react";

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    drawing: {
      /**
       * Insert a drawing block into the editor document
       */
      setDrawing: (attributes: {
        drawingId: string;
        previewUrl: string;
        aspect?: string;
      }) => ReturnType;
    };
  }
}

export const DrawingNode = Node.create({
  name: "drawing",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      drawingId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-drawing-id"),
        renderHTML: (attributes) => ({
          "data-drawing-id": attributes.drawingId,
        }),
      },
      previewUrl: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-preview-url"),
        renderHTML: (attributes) => ({
          "data-preview-url": attributes.previewUrl,
        }),
      },
      aspect: {
        default: "16/9",
        parseHTML: (element) => element.getAttribute("data-aspect") || "16/9",
        renderHTML: (attributes) => ({
          "data-aspect": attributes.aspect || "16/9",
        }),
      },
      width: {
        default: "100%",
        parseHTML: (element) => element.getAttribute("data-width") || "100%",
        renderHTML: (attributes) => ({
          "data-width": attributes.width || "100%",
        }),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") || "center",
        renderHTML: (attributes) => ({
          "data-align": attributes.align || "center",
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-drawing-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const preview = HTMLAttributes["data-preview-url"] || HTMLAttributes.previewUrl;
    const aspect = HTMLAttributes["data-aspect"] || HTMLAttributes.aspect || "16/9";
    const width = HTMLAttributes["data-width"] || HTMLAttributes.width || "100%";
    const align = HTMLAttributes["data-align"] || HTMLAttributes.align || "center";

    let marginStyle = "margin: 0 auto;";
    if (align === "left") marginStyle = "margin-right: auto; margin-left: 0;";
    if (align === "right") marginStyle = "margin-left: auto; margin-right: 0;";

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "drawing-block cursor-pointer select-none",
        style: `aspect-ratio: ${aspect}; background-image: url(${preview}); background-size: contain; background-repeat: no-repeat; background-position: center; width: ${width}; max-width: 100%; display: block; ${marginStyle}`,
      }),
    ];
  },

  addCommands() {
    return {
      setDrawing:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },
});
