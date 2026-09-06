/**
 * Minimal Markdown renderer for the PRE-4 Read view.
 * Supports: headings, bold, italic, flat lists, links, inline code,
 * fenced code blocks. Everything else is inert text.
 *
 * Safety: the full input is HTML-escaped first; only tags emitted by this
 * module ever reach the DOM, and rendering uses `dangerouslySetInnerHTML`
 * with that output. `javascript:`-style link targets are never linked.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/\n/g, " ");
}

/** http(s)/mailto links may be opened externally; anything else is plain text. */
function isSafeLinkTarget(url: string): boolean {
  const t = url.trim();
  return /^(https?:\/\/|mailto:)/i.test(t);
}

function renderInline(src: string): string {
  // src is already HTML-escaped; inline code spans are pulled out first so
  // `**` etc inside code stays literal.
  const codeSpans: string[] = [];
  let out = src.replace(/`([^`\n]+)`/g, (_, code: string) => {
    codeSpans.push(`<code>${code}</code>`);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });
  out = out.replace(/\[([^\]]+)\]\(((?:[^()]*|\([^()]*\))*)\)/g, (_m, text: string, url: string) => {
    const rawUrl = url.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    if (!isSafeLinkTarget(rawUrl)) return text;
    return `<a href="${escapeAttr(rawUrl)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*\w])\*([^*\n]+)\*(?![*\w])/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_\w])_([^_\n]+)_(?![_\w])/g, "$1<em>$2</em>");
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codeSpans[Number(i)] ?? "");
  return out;
}

export function renderMarkdown(md: string): string {
  const lines = escapeHtml(md).split("\n");
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    const fence = /^```/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // consume closing fence (or EOF)
      blocks.push(`<pre><code>${code.join("\n")}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*([-+*])\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-+*])\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*([-+*])\s+/, ""))}</li>`);
        i++;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+[.)]\s+/, ""))}</li>`);
        i++;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*([-+*])\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(`<p>${para.map((l) => renderInline(l)).join("<br />")}</p>`);
  }
  return blocks.join("\n");
}
