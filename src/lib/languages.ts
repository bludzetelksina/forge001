export type LanguageId =
  | "python"
  | "javascript"
  | "typescript"
  | "go"
  | "rust"
  | "java"
  | "cpp"
  | "c"
  | "ruby"
  | "php"
  | "bash"
  | "web";

export type TemplateFile = { path: string; content: string };

export type LanguageSpec = {
  id: LanguageId;
  label: string;
  blurb: string;
  /** Runner id used by the execution service. `null` = runs in the browser. */
  runner: string | null;
  entry: string;
  files: TemplateFile[];
};

export const LANGUAGES: LanguageSpec[] = [
  {
    id: "python",
    label: "Python",
    blurb: "3.x with the standard library",
    runner: "python3",
    entry: "main.py",
    files: [
      {
        path: "main.py",
        content: `def greet(name: str) -> str:
    return f"Hello, {name}!"


if __name__ == "__main__":
    print(greet("world"))
    print("Sum 1..10 =", sum(range(1, 11)))
`,
      },
    ],
  },
  {
    id: "javascript",
    label: "JavaScript",
    blurb: "Node runtime, console output",
    runner: "javascript",
    entry: "main.js",
    files: [
      {
        path: "main.js",
        content: `const greet = (name) => \`Hello, \${name}!\`;

console.log(greet("world"));
console.log(
  "Squares:",
  [1, 2, 3, 4, 5].map((n) => n * n).join(", "),
);
`,
      },
    ],
  },
  {
    id: "typescript",
    label: "TypeScript",
    blurb: "Typed, compiled then run",
    runner: "typescript",
    entry: "main.ts",
    files: [
      {
        path: "main.ts",
        content: `type User = { name: string; streak: number };

const users: User[] = [
  { name: "ada", streak: 12 },
  { name: "linus", streak: 4 },
];

for (const user of users) {
  console.log(\`\${user.name} — \${user.streak} day streak\`);
}
`,
      },
    ],
  },
  {
    id: "go",
    label: "Go",
    blurb: "Compiled, fast startup",
    runner: "go",
    entry: "main.go",
    files: [
      {
        path: "main.go",
        content: `package main

import "fmt"

func main() {
	total := 0
	for i := 1; i <= 10; i++ {
		total += i
	}
	fmt.Println("Hello from Go")
	fmt.Println("Total:", total)
}
`,
      },
    ],
  },
  {
    id: "rust",
    label: "Rust",
    blurb: "Release-mode compile and run",
    runner: "rust",
    entry: "main.rs",
    files: [
      {
        path: "main.rs",
        content: `fn main() {
    let names = ["ferris", "world"];
    for name in names {
        println!("Hello, {name}!");
    }
}
`,
      },
    ],
  },
  {
    id: "java",
    label: "Java",
    blurb: "Single public class named Main",
    runner: "java",
    entry: "Main.java",
    files: [
      {
        path: "Main.java",
        content: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java");
        System.out.println("2^10 = " + (1 << 10));
    }
}
`,
      },
    ],
  },
  {
    id: "cpp",
    label: "C++",
    blurb: "GCC, modern standard",
    runner: "cpp",
    entry: "main.cpp",
    files: [
      {
        path: "main.cpp",
        content: `#include <iostream>
#include <vector>

int main() {
    std::vector<int> xs{1, 2, 3, 4, 5};
    int sum = 0;
    for (int x : xs) sum += x;
    std::cout << "Hello from C++\\n";
    std::cout << "Sum: " << sum << "\\n";
}
`,
      },
    ],
  },
  {
    id: "c",
    label: "C",
    blurb: "GCC, C17",
    runner: "c",
    entry: "main.c",
    files: [
      {
        path: "main.c",
        content: `#include <stdio.h>

int main(void) {
    printf("Hello from C\\n");
    for (int i = 1; i <= 3; i++) printf("tick %d\\n", i);
    return 0;
}
`,
      },
    ],
  },
  {
    id: "ruby",
    label: "Ruby",
    blurb: "Scripting with the stdlib",
    runner: "ruby",
    entry: "main.rb",
    files: [
      {
        path: "main.rb",
        content: `def greet(name)
  "Hello, #{name}!"
end

puts greet("world")
puts (1..5).map { |n| n * n }.inspect
`,
      },
    ],
  },
  {
    id: "php",
    label: "PHP",
    blurb: "CLI mode",
    runner: "php",
    entry: "main.php",
    files: [
      {
        path: "main.php",
        content: `<?php

function greet(string $name): string
{
    return "Hello, {$name}!";
}

echo greet("world"), PHP_EOL;
echo implode(", ", array_map(fn ($n) => $n * $n, [1, 2, 3])), PHP_EOL;
`,
      },
    ],
  },
  {
    id: "bash",
    label: "Bash",
    blurb: "Shell script, one shot",
    runner: "bash",
    entry: "main.sh",
    files: [
      {
        path: "main.sh",
        content: `#!/usr/bin/env bash
set -euo pipefail

echo "Hello from bash"
for i in 1 2 3; do
  echo "line $i"
done
`,
      },
    ],
  },
  {
    id: "web",
    label: "Web (HTML/CSS/JS)",
    blurb: "Live preview, no server needed",
    runner: null,
    entry: "index.html",
    files: [
      {
        path: "index.html",
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My page</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main>
      <h1>Hello, web</h1>
      <button id="tap">Tap me</button>
      <p id="out">Nothing yet.</p>
    </main>
    <script src="script.js"></script>
  </body>
</html>
`,
      },
      {
        path: "style.css",
        content: `:root { color-scheme: dark; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: ui-sans-serif, system-ui, sans-serif;
  background: #0d1117;
  color: #e6edf3;
}

button {
  font: inherit;
  padding: 0.6rem 1.1rem;
  border: 0;
  border-radius: 8px;
  background: #b8f04a;
  color: #10160b;
  cursor: pointer;
}
`,
      },
      {
        path: "script.js",
        content: `let count = 0;

document.querySelector("#tap").addEventListener("click", () => {
  count += 1;
  document.querySelector("#out").textContent = \`Tapped \${count} time(s).\`;
});
`,
      },
    ],
  },
];

export const languageById = (id: string): LanguageSpec =>
  LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0]!;

export function editorLanguageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "py":
      return "python";
    case "js":
    case "mjs":
      return "javascript";
    case "ts":
      return "typescript";
    case "html":
      return "html";
    case "css":
      return "css";
    case "json":
      return "json";
    case "go":
      return "go";
    case "rs":
      return "rust";
    case "java":
      return "java";
    case "c":
    case "h":
    case "cpp":
    case "hpp":
    case "cc":
      return "cpp";
    case "php":
      return "php";
    default:
      return "text";
  }
}
