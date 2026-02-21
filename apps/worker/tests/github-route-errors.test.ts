import assert from "node:assert/strict";
import test from "node:test";
import { classifyGithubUnprocessable } from "../src/github";

test("classifies branch-already-exists conflict payloads", () => {
  const kind = classifyGithubUnprocessable(
    {
      message: "Validation Failed",
      errors: [{ code: "already_exists", field: "ref" }],
    },
    "/repos/acme/repo/git/refs"
  );

  assert.equal(kind, "branch_already_exists");
});

test("classifies pull-request-already-exists payloads", () => {
  const kind = classifyGithubUnprocessable(
    {
      message: "A pull request already exists for acme:feature-branch.",
    },
    "/repos/acme/repo/pulls"
  );

  assert.equal(kind, "pull_request_already_exists");
});

test("returns unknown for unrelated validation payloads", () => {
  const kind = classifyGithubUnprocessable(
    {
      message: "Validation Failed",
      errors: [{ code: "custom", message: "something else" }],
    },
    "/repos/acme/repo/pulls"
  );

  assert.equal(kind, "unknown");
});
