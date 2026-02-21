import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../src/lib/worker-api";
import {
  createGitWorkspaceRuntime,
  getGitWorkspaceErrorMessage,
  toGitWorkspaceError,
} from "../src/lib/git-workspace-runtime";

test("maps missing GitHub token errors to explicit runtime code", () => {
  const error = new ApiError(401, "GitHub account not connected");
  const normalized = toGitWorkspaceError(error);

  assert.equal(normalized.code, "missing_github_token");
  assert.equal(
    getGitWorkspaceErrorMessage(error),
    "Connect your GitHub account before using GitHub controls."
  );
});

test("maps branch conflict errors to explicit runtime code", () => {
  const error = new ApiError(409, "GitHub branch already exists");
  const normalized = toGitWorkspaceError(error);

  assert.equal(normalized.code, "branch_already_exists");
  assert.equal(
    getGitWorkspaceErrorMessage(error),
    "Branch already exists on GitHub."
  );
});

test("maps pull request conflict errors to explicit runtime code", () => {
  const error = new ApiError(409, "GitHub pull request already exists");
  const normalized = toGitWorkspaceError(error);

  assert.equal(normalized.code, "pull_request_already_exists");
  assert.equal(
    getGitWorkspaceErrorMessage(error),
    "A pull request for this branch already exists."
  );
});

test("creates a web runtime for cloud workspaces", () => {
  const runtime = createGitWorkspaceRuntime({
    id: "workspace-id",
    user_id: "user-id",
    project_id: "project-id",
    kind: "cloud",
    name: "Workspace",
    base_branch: "main",
    working_branch: "nosis/workspace",
    remote_url: "https://github.com/acme/repo",
    local_path: null,
    status: "ready",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(runtime.target, "web");
});
