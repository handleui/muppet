"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useConversations } from "@nosis/hooks/use-conversations";
import {
  createProject,
  createWorkspace,
  listProjects,
  listWorkspaces,
  type Project,
  type Workspace,
  type WorkspaceKind,
  type WorkspaceStatus,
} from "@nosis/lib/worker-api";

const SELECTED_PROJECT_STORAGE_KEY = "nosis.code.selected_project_id";
const SELECTED_WORKSPACE_STORAGE_KEY = "nosis.code.selected_workspace_id";

type ConversationsValue = ReturnType<typeof useConversations>;
type CreateConversationOptions = Parameters<
  ConversationsValue["createNewConversation"]
>[0];

interface CodeWorkspaceContextValue
  extends Omit<ConversationsValue, "createNewConversation"> {
  projects: Project[];
  allWorkspaces: Workspace[];
  workspaces: Workspace[];
  activeProject: Project | null;
  activeWorkspace: Workspace | null;
  selectedProjectId: string | null;
  selectedWorkspaceId: string | null;
  isProjectsLoading: boolean;
  isWorkspacesLoading: boolean;
  isCreatingProject: boolean;
  isCreatingWorkspace: boolean;
  projectError: string | null;
  workspaceError: string | null;
  selectProject: (projectId: string | null) => void;
  selectWorkspace: (workspaceId: string | null) => void;
  refreshProjects: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  createProjectFromRepoUrl: (repoUrl: string) => Promise<Project>;
  createWorkspaceForProject: (options?: {
    projectId?: string;
    name?: string;
    kind?: WorkspaceKind;
    baseBranch?: string;
    workingBranch?: string;
    remoteUrl?: string;
    localPath?: string;
    status?: WorkspaceStatus;
  }) => Promise<Workspace>;
  createNewConversation: (
    options?: CreateConversationOptions
  ) => ReturnType<ConversationsValue["createNewConversation"]>;
}

const CodeWorkspaceContext = createContext<CodeWorkspaceContextValue | null>(
  null
);

function upsertById<T extends { id: string }>(existing: T[], next: T): T[] {
  const index = existing.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [next, ...existing];
  }
  const updated = [...existing];
  updated[index] = next;
  return updated;
}

function persistSelectedId(storageKey: string, value: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  if (value) {
    window.localStorage.setItem(storageKey, value);
  } else {
    window.localStorage.removeItem(storageKey);
  }
}

function resolveSelectedId<T extends { id: string }>(
  storageKey: string,
  current: string | null,
  rows: readonly T[]
): string | null {
  const validIds = new Set(rows.map((row) => row.id));

  if (current && validIds.has(current)) {
    return current;
  }

  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(storageKey);
    if (stored && validIds.has(stored)) {
      return stored;
    }
  }

  return rows[0]?.id ?? null;
}

export function CodeWorkspaceProvider({ children }: { children: ReactNode }) {
  const {
    conversations,
    isLoading,
    isCreating,
    error,
    refresh,
    createNewConversation: createConversation,
  } = useConversations();

  const [projects, setProjects] = useState<Project[]>([]);
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );

  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [isWorkspacesLoading, setIsWorkspacesLoading] = useState(true);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const workspaces = useMemo(
    () =>
      selectedProjectId
        ? allWorkspaces.filter(
            (workspace) => workspace.project_id === selectedProjectId
          )
        : [],
    [allWorkspaces, selectedProjectId]
  );

  const refreshProjects = useCallback(async () => {
    setIsProjectsLoading(true);
    setProjectError(null);
    try {
      const rows = await listProjects();
      setProjects(rows);
      setSelectedProjectId((current) =>
        resolveSelectedId(SELECTED_PROJECT_STORAGE_KEY, current, rows)
      );
    } catch (err) {
      setProjectError(
        err instanceof Error ? err.message : "Failed to load projects"
      );
    } finally {
      setIsProjectsLoading(false);
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    setIsWorkspacesLoading(true);
    setWorkspaceError(null);
    try {
      const rows = await listWorkspaces();
      setAllWorkspaces(rows);
    } catch (err) {
      setWorkspaceError(
        err instanceof Error ? err.message : "Failed to load workspaces"
      );
    } finally {
      setIsWorkspacesLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects().catch(() => undefined);
    refreshWorkspaces().catch(() => undefined);
  }, [refreshProjects, refreshWorkspaces]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedWorkspaceId(null);
      return;
    }

    setSelectedWorkspaceId((current) =>
      resolveSelectedId(SELECTED_WORKSPACE_STORAGE_KEY, current, workspaces)
    );
  }, [selectedProjectId, workspaces]);

  useEffect(() => {
    persistSelectedId(SELECTED_PROJECT_STORAGE_KEY, selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    persistSelectedId(SELECTED_WORKSPACE_STORAGE_KEY, selectedWorkspaceId);
  }, [selectedWorkspaceId]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const activeWorkspace = useMemo(
    () =>
      allWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
      null,
    [allWorkspaces, selectedWorkspaceId]
  );

  const createProjectFromRepoUrl = useCallback(async (repoUrl: string) => {
    const trimmed = repoUrl.trim();
    if (trimmed.length === 0) {
      throw new Error("Repository URL is required");
    }

    setIsCreatingProject(true);
    setProjectError(null);

    try {
      const project = await createProject({ repoUrl: trimmed });
      setProjects((existing) => upsertById(existing, project));
      setSelectedProjectId(project.id);
      return project;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create project";
      setProjectError(message);
      throw err;
    } finally {
      setIsCreatingProject(false);
    }
  }, []);

  const createWorkspaceForProject = useCallback(
    async (options?: {
      projectId?: string;
      name?: string;
      kind?: WorkspaceKind;
      baseBranch?: string;
      workingBranch?: string;
      remoteUrl?: string;
      localPath?: string;
      status?: WorkspaceStatus;
    }) => {
      const projectId = options?.projectId ?? selectedProjectId;
      if (!projectId) {
        throw new Error("Select a project first");
      }

      setIsCreatingWorkspace(true);
      setWorkspaceError(null);

      try {
        const workspace = await createWorkspace({
          projectId,
          kind: options?.kind ?? "cloud",
          name: options?.name,
          baseBranch: options?.baseBranch,
          workingBranch: options?.workingBranch,
          remoteUrl: options?.remoteUrl,
          localPath: options?.localPath,
          status: options?.status,
        });

        setAllWorkspaces((existing) => upsertById(existing, workspace));
        setSelectedProjectId(projectId);
        setSelectedWorkspaceId(workspace.id);

        return workspace;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create workspace";
        setWorkspaceError(message);
        throw err;
      } finally {
        setIsCreatingWorkspace(false);
      }
    },
    [selectedProjectId]
  );

  const createNewConversation = useCallback(
    async (options?: CreateConversationOptions) => {
      const executionTarget = options?.executionTarget ?? "sandbox";
      const workspaceId =
        options?.workspaceId ??
        (executionTarget === "sandbox"
          ? (selectedWorkspaceId ?? workspaces[0]?.id)
          : undefined);

      const response = await createConversation({
        title: options?.title,
        executionTarget,
        workspaceId,
      });
      return response;
    },
    [createConversation, selectedWorkspaceId, workspaces]
  );

  const value = useMemo<CodeWorkspaceContextValue>(
    () => ({
      conversations,
      isLoading,
      isCreating,
      error,
      refresh,
      createNewConversation,
      projects,
      allWorkspaces,
      workspaces,
      activeProject,
      activeWorkspace,
      selectedProjectId,
      selectedWorkspaceId,
      isProjectsLoading,
      isWorkspacesLoading,
      isCreatingProject,
      isCreatingWorkspace,
      projectError,
      workspaceError,
      selectProject: setSelectedProjectId,
      selectWorkspace: setSelectedWorkspaceId,
      refreshProjects,
      refreshWorkspaces,
      createProjectFromRepoUrl,
      createWorkspaceForProject,
    }),
    [
      activeProject,
      activeWorkspace,
      allWorkspaces,
      conversations,
      createNewConversation,
      createProjectFromRepoUrl,
      createWorkspaceForProject,
      error,
      isCreating,
      isCreatingProject,
      isCreatingWorkspace,
      isLoading,
      isProjectsLoading,
      isWorkspacesLoading,
      projectError,
      projects,
      refresh,
      refreshProjects,
      refreshWorkspaces,
      selectedProjectId,
      selectedWorkspaceId,
      workspaceError,
      workspaces,
    ]
  );

  return (
    <CodeWorkspaceContext.Provider value={value}>
      {children}
    </CodeWorkspaceContext.Provider>
  );
}

export function useCodeWorkspace() {
  const context = useContext(CodeWorkspaceContext);
  if (!context) {
    throw new Error(
      "useCodeWorkspace must be used within CodeWorkspaceProvider"
    );
  }
  return context;
}
