import * as React from "react";
import { common, createLowlight } from "lowlight";
import { CopyButton } from "@/components/ui/copy-button";
import { DrawingBlock } from "@/components/post/drawing-block";

// Initialize lowlight engine
const low = createLowlight(common);

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TiptapNode {
  type: string;
  text?: string;
  content?: TiptapNode[];
  attrs?: Record<string, unknown>;
  marks?: TiptapMark[];
}

interface LowlightTextNode {
  type: "text";
  value: string;
}

interface LowlightElementNode {
  type: "element";
  tagName: string;
  properties?: {
    className?: string[];
  };
  children: (LowlightTextNode | LowlightElementNode)[];
}

type LowlightNode = LowlightTextNode | LowlightElementNode;

// Renders the HAST nodes output by lowlight recursively
function renderAst(node: LowlightNode, idx: number): React.ReactNode {
  if (node.type === "text") {
    return node.value;
  }
  if (node.type === "element") {
    const children = node.children.map((child, i) => renderAst(child, i));
    const className = node.properties?.className?.join(" ") || "";
    return React.createElement(node.tagName, { key: idx, className }, children);
  }
  return null;
}

function renderNode(node: TiptapNode, index: number): React.ReactNode {
  if (!node) return null;

  const key = `${node.type}-${index}`;
  const children = node.content
    ? node.content.map((child, idx) => renderNode(child, idx))
    : null;

  switch (node.type) {
    case "doc":
      return <div key={key} className="prose-renderer">{children}</div>;

    case "paragraph":
      return <p key={key} className="mb-5 text-17 text-text leading-relaxed">{children}</p>;

    case "heading": {
      const level = Number(node.attrs?.level || 1);
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      const classes =
        level === 1
          ? "text-32 font-semibold tracking-tight text-text mt-8 mb-4"
          : level === 2
          ? "text-24 font-semibold tracking-tight text-text mt-8 mb-4"
          : "text-20 font-semibold tracking-tight text-text mt-6 mb-3";
      return <Tag key={key} className={classes}>{children}</Tag>;
    }

    case "text": {
      let element: React.ReactNode = node.text || "";
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === "bold") {
            element = <strong key={`${key}-bold`}>{element}</strong>;
          } else if (mark.type === "italic") {
            element = <em key={`${key}-italic`}>{element}</em>;
          } else if (mark.type === "strike") {
            element = <s key={`${key}-strike`}>{element}</s>;
          } else if (mark.type === "code") {
            element = (
              <code key={`${key}-code`} className="bg-border/20 px-1.5 py-0.5 rounded-6 text-13 font-mono text-accent">
                {element}
              </code>
            );
          } else if (mark.type === "link") {
            const href = String(mark.attrs?.href || "#");
            element = (
              <a
                key={`${key}-link`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline decoration-1 underline-offset-2"
              >
                {element}
              </a>
            );
          }
        }
      }
      return element;
    }

    case "blockquote":
      return (
        <blockquote key={key} className="border-l-3 border-accent pl-5 italic text-muted my-6">
          {children}
        </blockquote>
      );

    case "bulletList":
      return <ul key={key} className="list-disc pl-6 mb-5 flex flex-col gap-1.5 text-17 text-text">{children}</ul>;

    case "orderedList":
      return <ol key={key} className="list-decimal pl-6 mb-5 flex flex-col gap-1.5 text-17 text-text">{children}</ol>;

    case "listItem":
      return <li key={key}>{children}</li>;

    case "horizontalRule":
      return <hr key={key} className="border-t border-border my-8" />;

    case "table":
      return (
        <div key={key} className="overflow-x-auto w-full my-6 border border-border rounded-12">
          <table className="min-w-full border-collapse">
            <tbody>{children}</tbody>
          </table>
        </div>
      );

    case "tableRow":
      return <tr key={key} className="border-b border-border last:border-0">{children}</tr>;

    case "tableHeader":
      return (
        <th key={key} className="px-4 py-3 bg-raised border-r border-border last:border-0 text-left text-15 font-semibold text-text">
          {children}
        </th>
      );

    case "tableCell":
      return (
        <td key={key} className="px-4 py-3 border-r border-border last:border-0 text-15 text-text">
          {children}
        </td>
      );

    case "image": {
      const src = node.attrs?.src ? String(node.attrs.src).trim() : "";
      const alt = String(node.attrs?.alt || "");
      if (!src) return null;
      return (
        <figure key={key} className="my-8 flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="rounded-16 max-w-full h-auto border border-border/50" />
          {alt && <figcaption className="text-center text-13 text-muted">{alt}</figcaption>}
        </figure>
      );
    }

    case "codeBlock": {
      const language = String(node.attrs?.language || "javascript");
      const codeText = node.content?.[0]?.text || "";
      let highlightedCode: React.ReactNode = codeText;

      try {
        const highlighted = low.highlight(language, codeText);
        highlightedCode = highlighted.children.map((child, i) =>
          renderAst(child as LowlightNode, i)
        );
      } catch {
        // Fallback to plain text
      }

      return (
        <div key={key} className="relative group my-6">
          <pre className="bg-surface border border-border p-5 rounded-16 overflow-x-auto font-mono text-13 leading-relaxed text-text">
            <code className="hljs">{highlightedCode}</code>
          </pre>
          <CopyButton text={codeText} />
        </div>
      );
    }

    case "drawing": {
      const drawingId = String(node.attrs?.drawingId || "");
      const previewUrl = String(node.attrs?.previewUrl || "");
      const aspect = String(node.attrs?.aspect || "16/9");

      return (
        <DrawingBlock
          key={key}
          drawingId={drawingId}
          previewUrl={previewUrl}
          aspect={aspect}
        />
      );
    }

    default:
      return children;
  }
}

interface TiptapRendererProps {
  content: unknown;
}

export function TiptapRenderer({ content }: TiptapRendererProps) {
  if (!content) return null;

  let parsed: TiptapNode | null = null;
  try {
    parsed = (typeof content === "string" ? JSON.parse(content) : content) as TiptapNode;
  } catch {
    return null;
  }

  if (!parsed) return null;
  return <>{renderNode(parsed, 0)}</>;
}
