import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { bundleProject } from "./bundle";

const runSchema = z.object({
  runner: z.string().min(1).max(32),
  /** Language id used to pick the multi-file bundling strategy. */
  language: z.string().min(1).max(32),
  entry: z.string().min(1).max(256),
  files: z
    .array(z.object({ path: z.string().min(1).max(256), content: z.string().max(200_000) }))
    .min(1)
    .max(60),
  packages: z
    .array(z.object({ name: z.string().min(1).max(120), version: z.string().max(60).nullable() }))
    .max(40)
    .optional(),
  stdin: z.string().max(20_000).optional(),
});

export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
};

const ALLOWED_RUNNERS = new Set([
  "python3",
  "javascript",
  "typescript",
  "go",
  "rust",
  "java",
  "cpp",
  "c",
  "ruby",
  "php",
  "bash",
]);

const API = "https://api.paiza.io";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Executes a single source file on a sandboxed code-execution service and
 * returns its output. Swapping execution providers means editing only this file.
 */
export const runCode = createServerFn({ method: "POST" })
  .inputValidator((data) => runSchema.parse(data))
  .handler(async ({ data }): Promise<RunResult> => {
    if (!ALLOWED_RUNNERS.has(data.runner)) {
      return {
        stdout: "",
        stderr: `This language can't be run here (${data.runner}).`,
        exitCode: null,
        durationMs: 0,
        timedOut: false,
      };
    }

    const started = Date.now();

    const createBody = new URLSearchParams({
      source_code: data.source,
      language: data.runner,
      input: data.stdin ?? "",
      longpoll: "true",
      api_key: "guest",
    });

    const createRes = await fetch(`${API}/runners/create`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: createBody.toString(),
    });

    if (!createRes.ok) {
      return {
        stdout: "",
        stderr: `The run service is unavailable right now (${createRes.status}). Try again in a moment.`,
        exitCode: null,
        durationMs: Date.now() - started,
        timedOut: false,
      };
    }

    const created = (await createRes.json()) as { id?: string; error?: string };
    if (!created.id) {
      return {
        stdout: "",
        stderr: created.error ?? "The run service rejected this request.",
        exitCode: null,
        durationMs: Date.now() - started,
        timedOut: false,
      };
    }

    type Details = {
      status?: string;
      result?: string;
      stdout?: string | null;
      stderr?: string | null;
      build_stderr?: string | null;
      build_exit_code?: string | null;
      exit_code?: string | null;
    };

    let details: Details | null = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const res = await fetch(
        `${API}/runners/get_details?id=${encodeURIComponent(created.id)}&api_key=guest`,
      );
      if (res.ok) {
        const body = (await res.json()) as Details;
        if (body.status === "completed") {
          details = body;
          break;
        }
      }
      await sleep(600);
    }

    if (!details) {
      return {
        stdout: "",
        stderr: "The program took too long and was stopped.",
        exitCode: null,
        durationMs: Date.now() - started,
        timedOut: true,
      };
    }

    const buildFailed = details.result === "failure" && (details.build_stderr ?? "").length > 0;
    const stderr = [buildFailed ? details.build_stderr : null, details.stderr]
      .filter((part): part is string => Boolean(part && part.length))
      .join("\n");

    const exitRaw = buildFailed ? details.build_exit_code : details.exit_code;
    const exitCode = exitRaw != null && exitRaw !== "" ? Number(exitRaw) : null;

    return {
      stdout: details.stdout ?? "",
      stderr,
      exitCode: Number.isNaN(exitCode) ? null : exitCode,
      durationMs: Date.now() - started,
      timedOut: details.result === "timeout",
    };
  });
