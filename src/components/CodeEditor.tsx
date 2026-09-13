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
import type { Extension } from "@codemirror/state";

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

export default function CodeEditor({
  value,
  language,
  readOnly = false,
  onChange,
}: {
  value: string;
  language: string;
  readOnly?: boolean;
  onChange?: (next: string) => void;
}) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={oneDark}
      readOnly={readOnly}
      extensions={extensionsFor(language)}
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
