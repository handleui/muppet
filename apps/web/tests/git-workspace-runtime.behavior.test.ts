import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@nosis/features/github/lib/git-ops", () => ({
  buildWorkspaceBranchName: vi.fn().mockReturnValue("nosis/default"),
  createWorkspaceBranch: vi.fn(),
  openPullRequest: vi.fn(),
  parseGithubRepoUrl: vi.fn(),
}));

import {
  createWorkspaceBranch,
  openPullRequest,
  parseGithubRepoUrl,
} from "@nosis/features/github/lib/git-ops";
import {
  createGitWorkspaceRuntime,
  type GitWorkspaceError,
} from "@nosis/features/github/lib/git-workspace-runtime";

const mockCreateWorkspaceBranch = vi.mocked(createWorkspaceBranch);
const mockOpenPullRequest = vi.mocked(openPullRequest);
const mockParseGithubRepoUrl = vi.mocked(parseGithubRepoUrl);

const project = {
  id: "project-1",
  user_id: "user-1",
  office_id: null,
  repo_url: "https://github.com/acme/repo",
  owner: "acme",
  repo: "repo",
  default_branch: "main",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const workspace = {
  id: "workspace-1",
  user_id: "user-1",
  project_id: "project-1",
  kind: "cloud" as const,
  name: "Workspace",
  base_branch: "main",
  working_branch: "nosis/workspace-1",
  remote_url: null,
  local_path: null,
  status: "ready" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("git workspace runtime behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParseGithubRepoUrl.mockReturnValue({ owner: "acme", repo: "repo" });
  });

  it("rejects ensureRepo when project URL is not a GitHub repo", async () => {
    mockParseGithubRepoUrl.mockReturnValueOnce(null);
    const runtime = createGitWorkspaceRuntime(workspace);

    await expect(runtime.ensureRepo(project)).rejects.toMatchObject({
      code: "invalid_repo",
      message: "Project repository URL must point to github.com",
    });
  });

  it("rejects ensureWorkspaceBranch before repository setup", async () => {
    const runtime = createGitWorkspaceRuntime(workspace);

    await expect(
      runtime.ensureWorkspaceBranch(workspace)
    ).rejects.toMatchObject({
      code: "invalid_state",
    });
  });

  it("uses prepared branch as default PR head when head is omitted", async () => {
    mockCreateWorkspaceBranch.mockResolvedValueOnce({
      name: "feat/runtime",
      commit: { sha: "abc" },
      protected: false,
    });
    mockOpenPullRequest.mockResolvedValueOnce({
      number: 9,
      title: "WIP",
      state: "open",
      head: { ref: "feat/runtime", sha: "abc" },
      base: { ref: "main" },
      user: { login: "me", avatar_url: "" },
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    const runtime = createGitWorkspaceRuntime(workspace);
    await runtime.ensureRepo(project);
    await runtime.ensureWorkspaceBranch(workspace, {
      name: "feat/runtime",
      from: "main",
    });

    await runtime.openPullRequest({
      title: "WIP",
      base: "main",
    });

    expect(mockOpenPullRequest).toHaveBeenCalledWith(
      { owner: "acme", repo: "repo" },
      {
        title: "WIP",
        head: "feat/runtime",
        base: "main",
        body: undefined,
      }
    );
  });

  it("throws not_supported for local commit and push", () => {
    const runtime = createGitWorkspaceRuntime(workspace);

    const commitError = (() => {
      try {
        runtime.commit("msg", []);
        return null;
      } catch (error) {
        return error as GitWorkspaceError;
      }
    })();

    const pushError = (() => {
      try {
        runtime.push();
        return null;
      } catch (error) {
        return error as GitWorkspaceError;
      }
    })();

    expect(commitError?.code).toBe("not_supported");
    expect(pushError?.code).toBe("not_supported");
  });
});
