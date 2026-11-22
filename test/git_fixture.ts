import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** Run fixture commands without a caller's repository, index or command-line Git config. */
export function git(cwd: string, ...args: string[]): string {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.toUpperCase().startsWith("GIT_")) {
      delete env[name];
    }
  }
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = os.devNull;
  return execFileSync("git", args, {
    cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

export function initTestRepository(directory: string): void {
  git(directory, "init", "-q", "--template=");
  mkdirSync(path.join(directory, ".git", "info"), { recursive: true });
  git(directory, "symbolic-ref", "HEAD", "refs/heads/main");
  git(directory, "config", "--local", "user.name", "Daily Notes Test");
  git(directory, "config", "--local", "user.email", "test@example.invalid");
  git(directory, "config", "--local", "commit.gpgSign", "false");
  git(directory, "config", "--local", "core.hooksPath", path.join(directory, ".git", "hooks"));
}

export function addTestRemote(directory: string, repository: string): string {
  const remote = path.join(directory, "backup.git");
  git(directory, "init", "-q", "--bare", "--template=", remote);
  git(repository, "remote", "add", "backup", remote);
  git(repository, "push", "-qu", "backup", "main");
  return remote;
}
