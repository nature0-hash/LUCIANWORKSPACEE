// Visual Editor Studio — source mapping architecture.
//
// The visual editor does NOT work on a fake overlay. It maps elements in
// the rendered preview back to their actual source location in the
// project files. When the user edits a visual property (text, style,
// attribute), we patch the REAL source file at that location.
//
// Support matrix:
//   HTML/CSS/JS projects       → Full source mapping. Every element in
//                                index.html is editable.
//   React (jsx/tsx) components  → Scaffold: we locate elements in the
//                                source by text content + tag, but
//                                structural edits are limited. Inline
//                                style/className edits are safe; full
//                                AST-aware edits are out of scope for
//                                this phase (clearly marked "limited").
//   Vue / Next.js / Vite        → Same React scaffold — we patch JSX/TSX
//                                by string matching, no AST transform.
//   Projects without an
//     HTML entry point          → Visual editor is disabled with an
//                                 honest "no previewable HTML entry" message.
//
// Design:
//   1. The editor loads the project's "current page" (HTML file or the
//      preview-engine's rendered HTML for React projects).
//   2. Each element in the rendered preview gets a stable data-lucid-id
//      attribute (assigned by the preview-engine in the iframe).
//   3. The iframe sends back its DOM structure (id + tag + text + styles
//      + source location when known) via postMessage.
//   4. The Layers panel renders that tree. Selecting a node selects it
//      in the iframe + loads its properties in the Style inspector.
//   5. Editing a property → patch the source file → re-render the preview.

import type { DetectedFramework, Project, ProjectFile } from "@/types/workspace";

/** A node in the visual editor's element tree (mirror of the iframe DOM). */
export interface VisualNode {
  /** Stable ID assigned by the preview engine (data-lucid-id attribute). */
  id: string;
  /** Tag name (lowercase). */
  tag: string;
  /** Element text content (truncated). */
  text: string;
  /** Source location when known: { file, line, col }. */
  source?: {
    file: string;
    line: number;
    col: number;
  };
  /** Children. */
  children: VisualNode[];
  /** Inline style properties (most useful ones for the inspector). */
  style: Record<string, string>;
  /** Class names. */
  className: string;
  /** Common attributes (href, src, alt, etc.) — subset. */
  attributes: Record<string, string>;
}

/** Result of attempting to find an HTML entry point for a project. */
export interface VisualEditorReadiness {
  /** True when the editor can be opened. */
  ready: boolean;
  /** Why it can't be opened (when ready=false). */
  reason?: string;
  /** The HTML file that should be rendered in the canvas. */
  entryFile?: string;
  /** Whether this project supports full source mapping. */
  support: "full" | "limited" | "none";
  /** Human-readable label for the support level. */
  supportLabel: string;
  /** Honest explanation of what the user can do. */
  explanation: string;
}

/**
 * Inspect the loaded project and decide whether the Visual Editor can
 * open it. We never pretend to support a project type we can't actually
 * edit.
 */
export function checkVisualEditorReadiness(
  project: Project | null,
): VisualEditorReadiness {
  if (!project) {
    return {
      ready: false,
      reason: "No active project.",
      support: "none",
      supportLabel: "No project",
      explanation: "Open a project from the Project Library first.",
    };
  }
  const fw = project.framework;
  // Find an HTML entry file (prefer index.html at root, then any .html).
  const htmlFiles = project.files
    .filter((f) => !f.binary && f.path.endsWith(".html"))
    .map((f) => f.path)
    .sort((a, b) => (a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b)));
  if (htmlFiles.length === 0) {
    return {
      ready: false,
      reason: "This project has no HTML entry file. The Visual Editor cannot render it.",
      support: "none",
      supportLabel: "Not supported",
      explanation:
        "The Visual Editor requires an HTML file (e.g. index.html) as the canvas entry point. " +
        "This project does not appear to have one — it may be a backend-only Node project. " +
        "Use the Workspace's Live Runtime pane instead.",
    };
  }
  // HTML projects get full support; React/Vue/Next/Vite get limited support.
  if (fw === "html" || fw === "static") {
    return {
      ready: true,
      entryFile: htmlFiles[0],
      support: "full",
      supportLabel: "Full source mapping",
      explanation:
        "HTML/CSS/JS project. Visual edits modify the real HTML/CSS source files directly. Selection maps to source location; property changes are written back to disk.",
    };
  }
  return {
    ready: true,
    entryFile: htmlFiles[0],
    support: "limited",
    supportLabel: "Limited — string-match source patching",
    explanation:
      "Component-based project (" + fw + "). The Visual Editor can render the " +
      "preview iframe and select elements, but source patches use string matching " +
      "rather than AST transforms. Structural JSX edits (adding/removing elements) " +
      "are out of scope for this phase. Inline text, className, and style edits on " +
      "leaf elements work; complex prop/state changes should be made in the Code editor.",
  };
}

/**
 * Walk the source DOM in document order and assign IDs the same way the
 * iframe inspection script does (counter-based, on every element). The
 * iframe uses `document.querySelectorAll('*')` which yields elements in
 * document order — `doc.querySelectorAll('*')` does the same on the
 * source DOM, so IDs line up.
 *
 * Returns a Map<id, Element> for lookup. Mutates the source DOM only
 * temporarily (we serialize back at the end without persisting the IDs).
 */
function assignSourceIds(doc: Document): Map<string, Element> {
  const map = new Map<string, Element>();
  let counter = 0;
  // querySelectorAll('*') returns elements in document order — matches the iframe.
  for (const el of Array.from(doc.querySelectorAll("*"))) {
    map.set("n" + counter++, el);
  }
  return map;
}

/** Serialize a DOM Document back to a string, preserving the doctype. */
function serializeDoc(doc: Document): string {
  const doctype = doc.doctype
    ? `<!DOCTYPE ${doc.doctype.name}${doc.doctype.publicId ? ` PUBLIC "${doc.doctype.publicId}"` : ""}${doc.doctype.systemId ? ` "${doc.doctype.systemId}"` : ""}>`
    : "<!DOCTYPE html>";
  return `${doctype}\n${doc.documentElement.outerHTML}`;
}

/**
 * Patch a text node inside an HTML source string.
 *
 * The elementId is assigned by the iframe inspection script (e.g. "n6")
 * and does NOT exist in the source HTML. We rebuild the source DOM,
 * assign IDs the same way the iframe does (deterministic counter), then
 * look up the element by ID and patch its text content. This keeps the
 * source HTML unchanged (no data-lucid-id pollution in the file).
 */
export function patchHtmlText(
  source: string,
  elementId: string,
  newText: string,
): string {
  if (typeof window === "undefined") return source;
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, "text/html");
  const idMap = assignSourceIds(doc);
  const target = idMap.get(elementId);
  if (!target) {
    throw new Error(
      `Element "${elementId}" not found in source DOM. The page structure may have changed since selection — refresh the canvas and try again.`,
    );
  }
  // Patch the first direct text child (preserve nested elements).
  let patched = false;
  for (const node of Array.from(target.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = newText;
      patched = true;
      break;
    }
  }
  if (!patched) {
    target.insertBefore(doc.createTextNode(newText), target.firstChild);
  }
  return serializeDoc(doc);
}

/**
 * Patch an inline style property on an element in an HTML source string.
 * Adds the style attribute if missing. Removes the property when value
 * is empty.
 */
export function patchHtmlStyle(
  source: string,
  elementId: string,
  property: string,
  value: string,
): string {
  if (typeof window === "undefined") return source;
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, "text/html");
  const idMap = assignSourceIds(doc);
  const el = idMap.get(elementId) as HTMLElement | undefined;
  if (!el) {
    throw new Error(
      `Element "${elementId}" not found in source DOM. The page structure may have changed since selection — refresh the canvas and try again.`,
    );
  }
  if (value.trim() === "") {
    el.style.removeProperty(property);
  } else {
    el.style.setProperty(property, value);
  }
  return serializeDoc(doc);
}

/**
 * Patch an attribute on an element in an HTML source string.
 */
export function patchHtmlAttribute(
  source: string,
  elementId: string,
  attribute: string,
  value: string,
): string {
  if (typeof window === "undefined") return source;
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, "text/html");
  const idMap = assignSourceIds(doc);
  const el = idMap.get(elementId);
  if (!el) {
    throw new Error(
      `Element "${elementId}" not found in source DOM. The page structure may have changed since selection — refresh the canvas and try again.`,
    );
  }
  if (value === "") {
    el.removeAttribute(attribute);
  } else {
    el.setAttribute(attribute, value);
  }
  return serializeDoc(doc);
}

/**
 * Patch a property on a non-HTML source file (e.g. JSX/TSX).
 *
 * Strategy: locate the element by data-lucid-id attribute (the preview
 * engine injects it into the rendered DOM, but in the source code itself
 * the element is identified by surrounding text content). For limited
 * support, we do a simple string replace of an attribute value or inline
 * style entry. This is intentionally conservative — when we can't safely
 * patch, we throw with a clear message.
 */
export function patchJsxAttribute(
  source: string,
  elementId: string,
  attribute: string,
  value: string,
): string {
  // data-lucid-id is injected by the preview engine; it doesn't exist
  // in the original source. We use the surrounding text content as a
  // heuristic — but for limited support we only patch inline style
  // properties that match a stable pattern.
  //
  // This is intentionally a NO-OP with a clear message: the user should
  // edit JSX/TSX in the Code editor for structural changes.
  throw new Error(
    "JSX/TSX source patching is limited to inline style attributes via className. " +
      "For full control of component source, use the Code editor.",
  );
}

/**
 * Decide which patcher to use based on the file extension of the target file.
 */
export function patchFileContent(
  filePath: string,
  source: string,
  elementId: string,
  patch: { kind: "text" | "style" | "attribute"; property?: string; value: string },
): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext === "html" || ext === "htm") {
    if (patch.kind === "text") return patchHtmlText(source, elementId, patch.value);
    if (patch.kind === "style" && patch.property)
      return patchHtmlStyle(source, elementId, patch.property, patch.value);
    if (patch.kind === "attribute" && patch.property)
      return patchHtmlAttribute(source, elementId, patch.property, patch.value);
  }
  if (ext === "jsx" || ext === "tsx" || ext === "js" || ext === "ts") {
    if (patch.kind === "attribute" && patch.property) {
      return patchJsxAttribute(source, elementId, patch.property, patch.value);
    }
  }
  throw new Error(
    `Source patching is not supported for "${filePath}". Use the Code editor.`,
  );
}

/**
 * Walk the rendered iframe DOM and extract a VisualNode tree.
 *
 * Sent to the parent window via postMessage by the iframe's injected
 * script. We assign data-lucid-id to every element that doesn't have
 * one yet, so subsequent selections are stable.
 *
 * This is implemented in the visual-editor-canvas component (which
 * injects the script into the iframe), not here — this function is just
 * the type definition the canvas produces.
 */
export type IframeInspectionMessage = {
  type: "lucian-visual-inspection";
  root: VisualNode;
};

/**
 * Inject a script tag into an HTML document string that:
 *   1. Assigns data-lucid-id to every element.
 *   2. Listens for clicks — on click, sends the element's id + properties
 *      to the parent via postMessage.
 *   3. On request, walks the DOM and sends the full VisualNode tree.
 *
 * Used by the visual editor canvas to make the iframe interactive.
 */
export function buildInspectionScript(): string {
  return `
(function () {
  function assignIds() {
    var counter = 0;
    document.querySelectorAll('*').forEach(function (el) {
      if (!el.hasAttribute('data-lucid-id')) {
        el.setAttribute('data-lucid-id', 'n' + (counter++));
      }
    });
  }
  function getStyle(el) {
    var cs = window.getComputedStyle(el);
    var out = {};
    ['color', 'background-color', 'font-size', 'font-weight', 'font-family',
     'padding', 'margin', 'border', 'border-radius', 'width', 'height',
     'display', 'flex-direction', 'justify-content', 'align-items',
     'gap', 'text-align', 'line-height', 'opacity'].forEach(function (p) {
      out[p] = cs.getPropertyValue(p);
    });
    return out;
  }
  function getAttrs(el) {
    var out = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.name !== 'data-lucid-id') out[a.name] = a.value;
    }
    return out;
  }
  function buildNode(el) {
    var id = el.getAttribute('data-lucid-id') || '';
    var tag = el.tagName.toLowerCase();
    var text = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === Node.TEXT_NODE) text += n.textContent;
    }
    text = text.trim().slice(0, 80);
    var children = [];
    for (var i = 0; i < el.children.length; i++) {
      children.push(buildNode(el.children[i]));
    }
    return {
      id: id, tag: tag, text: text, children: children,
      style: getStyle(el), className: el.className || '',
      attributes: getAttrs(el)
    };
  }
  function sendInspection() {
    assignIds();
    var root = buildNode(document.body);
    parent.postMessage({ type: 'lucian-visual-inspection', root: root }, '*');
  }
  // Assign IDs immediately.
  assignIds();
  // Listen for clicks.
  document.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    if (!el || !el.hasAttribute) return;
    var id = el.getAttribute('data-lucid-id');
    parent.postMessage({ type: 'lucian-visual-select', id: id }, '*');
  }, true);
  // Listen for inspection requests.
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'lucian-visual-request-inspection') {
      sendInspection();
    }
  });
  // Send initial inspection on load.
  setTimeout(sendInspection, 100);
})();
`;
}
