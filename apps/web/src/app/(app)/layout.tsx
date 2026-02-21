"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AuthGuard from "@nosis/components/auth-guard";
import AppSidebar from "@nosis/components/app-sidebar";
import {
  CodeWorkspaceProvider,
  useCodeWorkspace,
} from "@nosis/components/code-workspace-provider";
import ResizableGrid from "@nosis/components/resizable-grid";
import type { ResizableGridHandle } from "@nosis/components/resizable-grid";

const LEFT_SIDEBAR_EXPANDED_WIDTH = 325;
const LEFT_SIDEBAR_COLLAPSED_WIDTH = 56;
const CODE_PATH_REGEX = /^\/code\/chat\/([0-9a-f-]+)$/i;
const CHAT_PATH_REGEX = /^\/chat\/([0-9a-f-]+)$/i;

function AppShellLayoutContent({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const gridRef = useRef<ResizableGridHandle | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const {
    conversations,
    isLoading,
    error,
    createNewConversation,
    projects,
    allWorkspaces,
    selectedProjectId,
    selectedWorkspaceId,
    isProjectsLoading,
    projectError,
    selectProject,
    selectWorkspace,
  } = useCodeWorkspace();

  const activeConversationId = useMemo(() => {
    const codeMatch = pathname.match(CODE_PATH_REGEX);
    if (codeMatch?.[1]) {
      return codeMatch[1];
    }
    const chatMatch = pathname.match(CHAT_PATH_REGEX);
    return chatMatch?.[1] ?? null;
  }, [pathname]);

  const handleCreateConversation = useCallback(
    (mode: "chat" | "code") => {
      if (mode === "chat") {
        createNewConversation({
          executionTarget: "sandbox",
          workspaceId: null,
        })
          .then((conversation) => {
            router.push(`/chat/${conversation.id}`);
          })
          .catch(() => undefined);
        return;
      }

      if (!selectedWorkspaceId) {
        if (selectedProjectId) {
          router.push(`/code/${selectedProjectId}`);
          return;
        }
        router.push("/code");
        return;
      }

      createNewConversation({ executionTarget: "sandbox" })
        .then((conversation) => {
          router.push(`/code/chat/${conversation.id}`);
        })
        .catch(() => undefined);
    },
    [createNewConversation, router, selectedProjectId, selectedWorkspaceId]
  );

  const handleToggleSidebar = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }
    const isExpanded =
      grid.widths.left > LEFT_SIDEBAR_COLLAPSED_WIDTH + Number.EPSILON;

    if (isExpanded) {
      grid.setWidths(LEFT_SIDEBAR_COLLAPSED_WIDTH, 0, 180);
      setIsSidebarOpen(false);
      return;
    }

    grid.setWidths(LEFT_SIDEBAR_EXPANDED_WIDTH, 0, 180);
    setIsSidebarOpen(true);
  }, []);

  const handleSelectConversation = useCallback(
    (input: {
      conversationId: string;
      projectId: string | null;
      workspaceId: string | null;
      mode: "chat" | "code";
    }) => {
      selectProject(input.projectId);
      selectWorkspace(input.workspaceId);
      router.push(
        input.mode === "chat"
          ? `/chat/${input.conversationId}`
          : `/code/chat/${input.conversationId}`
      );
    },
    [router, selectProject, selectWorkspace]
  );

  const sidebarError = error ?? projectError;

  return (
    <div className="flex h-dvh overflow-hidden bg-white">
      <ResizableGrid
        allowRightResize={false}
        allowUserResize={false}
        center={
          <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            {children}
          </div>
        }
        initialLeft={LEFT_SIDEBAR_EXPANDED_WIDTH}
        initialRight={0}
        left={
          <AppSidebar
            activeConversationId={activeConversationId}
            allWorkspaces={allWorkspaces}
            conversations={conversations}
            error={sidebarError}
            isLoading={isLoading}
            isProjectsLoading={isProjectsLoading}
            isSidebarOpen={isSidebarOpen}
            onCreateConversation={handleCreateConversation}
            onSelectConversation={handleSelectConversation}
            onToggleSidebar={handleToggleSidebar}
            projects={projects}
            selectedProjectId={selectedProjectId}
          />
        }
        ref={gridRef}
        right={null}
      />
    </div>
  );
}

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <CodeWorkspaceProvider>
        <AppShellLayoutContent>{children}</AppShellLayoutContent>
      </CodeWorkspaceProvider>
    </AuthGuard>
  );
}
