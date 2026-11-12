// lib/supabase/env.ts must read the Supabase settings from the running
// server, not from the build. The bundler writes the build time value of
// NEXT_PUBLIC_ settings into .next/server for every process.env lookup it can
// follow, so the read has to go through Reflect.get. These tests keep it so.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { SUPABASE_KEY_ENV, SUPABASE_URL_ENV, readSupabaseConfig } from "../lib/supabase/env.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = "lib/supabase/env.ts";

/** The file without its comments, so the explanation in it cannot trip the checks. */
const code = (path) =>
  readFileSync(join(root, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

function sourceFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mjs)$/.test(entry.name) ? [path] : [];
  });
}

function withEnv(values, run) {
  const names = [SUPABASE_URL_ENV, SUPABASE_KEY_ENV];
  const before = names.map((name) => process.env[name]);
  try {
    for (const name of names) {
      if (values[name] === undefined) delete process.env[name];
      else process.env[name] = values[name];
    }
    run();
  } finally {
    names.forEach((name, i) => {
      if (before[i] === undefined) delete process.env[name];
      else process.env[name] = before[i];
    });
  }
}

test("the Supabase settings are read through Reflect.get", () => {
  const source = code(envFile);
  assert.match(source, /Reflect\.get\(\s*process\.env\s*,/, "the read must be Reflect.get(process.env, name)");
  const direct = source.replace(/Reflect\.get\(\s*process\.env\s*,/g, "");
  assert.doesNotMatch(direct, /process\.env/, "process.env is only touched inside Reflect.get, or the build freezes the values");
});

test("no other file reads a NEXT_PUBLIC setting itself", () => {
  const files = ["app", "components", "lib"].flatMap(sourceFiles).concat("proxy.ts", "next.config.ts", "site.config.ts");
  for (const file of files) {
    const path = relative(root, join(root, file)).replaceAll("\\", "/");
    if (path === envFile) continue;
    const source = code(path);
    assert.doesNotMatch(source, /process\.env\s*(\.|\[\s*["'`])NEXT_PUBLIC_/, `${path} reads a NEXT_PUBLIC setting from process.env`);
    assert.doesNotMatch(source, /SUPABASE_(URL|KEY)_ENV\s*\]/, `${path} looks the Supabase settings up itself, use readSupabaseConfig()`);
  }
});

test("readSupabaseConfig follows the environment of the running process", () => {
  withEnv({}, () => assert.equal(readSupabaseConfig(), null));
  withEnv({ [SUPABASE_URL_ENV]: " https://one.example.test ", [SUPABASE_KEY_ENV]: " key-one " }, () =>
    assert.deepEqual(readSupabaseConfig(), { url: "https://one.example.test", key: "key-one" }),
  );
  withEnv({ [SUPABASE_URL_ENV]: "https://two.example.test", [SUPABASE_KEY_ENV]: "key-two" }, () =>
    assert.deepEqual(readSupabaseConfig(), { url: "https://two.example.test", key: "key-two" }),
  );
  withEnv({ [SUPABASE_URL_ENV]: "https://two.example.test" }, () => assert.equal(readSupabaseConfig(), null));
  withEnv({ [SUPABASE_URL_ENV]: "  ", [SUPABASE_KEY_ENV]: "key" }, () => assert.equal(readSupabaseConfig(), null));
});
