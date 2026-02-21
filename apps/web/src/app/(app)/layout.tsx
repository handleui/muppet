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

const LEFT_SIDEBAR_WIDTH = 325;
const CODE_PATH_REGEX = /^\/code\/([0-9a-f-]+)$/i;
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
        createNewConversation({ executionTarget: "default" })
          .then((conversation) => {
            router.push(`/chat/${conversation.id}`);
          })
          .catch(() => undefined);
        return;
      }

      if (!selectedWorkspaceId) {
        router.push("/code");
        return;
      }

      createNewConversation({ executionTarget: "sandbox" })
        .then((conversation) => {
          router.push(`/code/${conversation.id}`);
        })
        .catch(() => undefined);
    },
    [createNewConversation, router, selectedWorkspaceId]
  );

  const handleToggleSidebar = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }
    const isCurrentlyOpen = grid.widths.left > 0;
    if (isCurrentlyOpen) {
      grid.setWidths(0, 0, 180);
      return;
    }
    grid.setWidths(LEFT_SIDEBAR_WIDTH, 0, 180);
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
          : `/code/${input.conversationId}`
      );
    },
    [router, selectProject, selectWorkspace]
  );

  const sidebarError = error ?? projectError;

  return (
    <div className="flex h-dvh overflow-hidden bg-white">
      <ResizableGrid
        allowRightResize={false}
        allowUserResize
        center={
          <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            {isSidebarOpen ? null : (
              <button
                className="absolute top-3 left-3 z-20 rounded border border-subtle bg-white px-2 py-1 font-normal text-[#808080] text-xs hover:bg-[#f6f6f6]"
                onClick={handleToggleSidebar}
                type="button"
              >
                Show chats
              </button>
            )}
            {children}
          </div>
        }
        initialLeft={LEFT_SIDEBAR_WIDTH}
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
        onLeftCollapsedChange={(collapsed) => setIsSidebarOpen(!collapsed)}
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
