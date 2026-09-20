import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { go } from "@codemirror/lang-go";
import { rust } from "@codemirror/lang-rust";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { php } from "@codemirror/lang-php";
import { EditorView, Decoration, WidgetType, type DecorationSet } from "@codemirror/view";
import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { useEffect, useMemo, useRef } from "react";

export type RemoteCursor = { userId: string; name: string; colour: string; anchor: number; head: number };

function extensionsFor(language: string): Extension[] {
  switch (language) {
    case "python":
      return [python()];
    case "javascript":
      return [javascript()];
    case "typescript":
      return [javascript({ typescript: true })];
    case "html":
      return [html()];
    case "css":
      return [css()];
    case "json":
      return [json()];
    case "go":
      return [go()];
    case "rust":
      return [rust()];
    case "java":
      return [java()];
    case "cpp":
      return [cpp()];
    case "php":
      return [php()];
    default:
      return [];
  }
}

class CaretWidget extends WidgetType {
  constructor(
    readonly name: string,
    readonly colour: string,
  ) {
    super();
  }
  eq(other: CaretWidget) {
    return other.name === this.name && other.colour === this.colour;
  }
  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "forge-caret";
    wrap.style.borderColor = this.colour;
    const label = document.createElement("span");
    label.className = "forge-caret-label";
    label.style.background = this.colour;
    label.textContent = this.name;
    wrap.appendChild(label);
    return wrap;
  }
}

const setRemote = StateEffect.define<RemoteCursor[]>();

const remoteField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let next = value.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setRemote)) continue;
      const docLength = tr.state.doc.length;
      const decorations = [];
      for (const cursor of effect.value) {
        const head = Math.max(0, Math.min(cursor.head, docLength));
        const anchor = Math.max(0, Math.min(cursor.anchor, docLength));
        if (anchor !== head) {
          decorations.push(
            Decoration.mark({
              attributes: { style: `background-color: color-mix(in oklch, ${cursor.colour} 22%, transparent)` },
            }).range(Math.min(anchor, head), Math.max(anchor, head)),
          );
        }
        decorations.push(
          Decoration.widget({ widget: new CaretWidget(cursor.name, cursor.colour), side: 1 }).range(head),
        );
      }
      next = Decoration.set(decorations, true);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const caretTheme = EditorView.baseTheme({
  ".forge-caret": {
    position: "relative",
    borderLeft: "2px solid",
    marginLeft: "-1px",
    height: "1.1em",
    display: "inline-block",
  },
  ".forge-caret-label": {
    position: "absolute",
    top: "-1.15em",
    left: "-2px",
    fontSize: "10px",
    lineHeight: "1.3",
    padding: "0 4px",
    borderRadius: "3px",
    whiteSpace: "nowrap",
    color: "#0b0f0b",
    fontFamily: "var(--font-mono, monospace)",
  },
});

export default function CodeEditor({
  value,
  language,
  readOnly = false,
  onChange,
  remoteCursors = [],
  onCursor,
}: {
  value: string;
  language: string;
  readOnly?: boolean;
  onChange?: (next: string) => void;
  remoteCursors?: RemoteCursor[];
  onCursor?: (range: { anchor: number; head: number }) => void;
}) {
  const viewRef = useRef<EditorView | null>(null);
  const cursorRef = useRef(onCursor);
  cursorRef.current = onCursor;

  const extensions = useMemo(
    () => [
      ...extensionsFor(language),
      remoteField,
      caretTheme,
      EditorView.updateListener.of((update) => {
        if (!update.selectionSet && !update.focusChanged) return;
        const range = update.state.selection.main;
        cursorRef.current?.({ anchor: range.anchor, head: range.head });
      }),
    ],
    [language],
  );

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setRemote.of(remoteCursors) });
  }, [remoteCursors]);

  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={oneDark}
      readOnly={readOnly}
      extensions={extensions}
      onCreateEditor={(view) => {
        viewRef.current = view;
      }}
      onChange={onChange ?? (() => undefined)}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        tabSize: 2,
      }}
      style={{ height: "100%", fontSize: 13.5 }}
      className="h-full [&_.cm-editor]:h-full [&_.cm-gutters]:border-r [&_.cm-scroller]:font-mono"
    />
  );
}
