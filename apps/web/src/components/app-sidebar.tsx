"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ChatBubble,
  CodeBrackets,
  Database,
  NavArrowDown,
  NavArrowLeft,
  Plus,
  Puzzle,
  UserCircle,
} from "iconoir-react";
import type { Conversation, Project, Workspace } from "@nosis/lib/worker-api";

type SidebarNavItem = "habits" | "integrations" | "chat" | "code";

interface AppSidebarProps {
  conversations: Conversation[];
  projects: Project[];
  allWorkspaces: Workspace[];
  selectedProjectId: string | null;
  activeConversationId: string | null;
  isSidebarOpen: boolean;
  isLoading: boolean;
  isProjectsLoading: boolean;
  error: string | null;
  onCreateConversation: (mode: "chat" | "code") => void;
  onToggleSidebar: () => void;
  onSelectConversation: (input: {
    conversationId: string;
    projectId: string | null;
    workspaceId: string | null;
    mode: "chat" | "code";
  }) => void;
}

interface ConversationStats {
  added: number;
  removed: number;
}

interface ConversationGroup {
  key: string;
  label: string;
  projectId: string | null;
  rows: Conversation[];
}

function deriveRouteMode(pathname: string): "chat" | "code" {
  if (pathname.startsWith("/code")) {
    return "code";
  }
  if (
    pathname === "/" ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/chats")
  ) {
    return "chat";
  }
  return "code";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getConversationStats(
  conversation: Conversation
): ConversationStats | null {
  const row = conversation as Conversation & {
    additions?: unknown;
    deletions?: unknown;
    lines_added?: unknown;
    lines_removed?: unknown;
  };

  const added = row.lines_added ?? row.additions;
  const removed = row.lines_removed ?? row.deletions;
  if (!(isNumber(added) && isNumber(removed))) {
    return null;
  }

  return {
    added: Math.max(0, Math.floor(added)),
    removed: Math.max(0, Math.floor(removed)),
  };
}

function WorkspaceHeader({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  return (
    <div className="flex h-10 items-center justify-between px-4">
      <div className="flex items-center gap-2.5">
        <Database className="size-4 text-[#808080]" />

        <p className="text-[13px] text-black tracking-[-0.39px]">Workspace</p>

        <NavArrowDown className="size-3 text-[#808080]" />
      </div>

      <button
        aria-label="Toggle sidebar"
        className="flex size-3 items-center justify-center"
        onClick={onToggleSidebar}
        type="button"
      >
        <NavArrowLeft className="size-3 text-[#808080]" />
      </button>
    </div>
  );
}

function SidebarIcon({
  item,
  className,
}: {
  item: SidebarNavItem;
  className: string;
}) {
  if (item === "chat") {
    return <ChatBubble className={className} />;
  }
  if (item === "code") {
    return <CodeBrackets className={className} />;
  }
  if (item === "integrations") {
    return <Puzzle className={className} />;
  }
  return <Activity className={className} />;
}

function SidebarButton({
  item,
  label,
  selected,
  onClick,
}: {
  item: SidebarNavItem;
  label: string;
  selected: boolean;
  onClick?: () => void;
}) {
  const toneClass = selected ? "text-[#0080ff]" : "text-black";

  return (
    <div className="w-full px-2 py-1">
      <button
        className={`flex h-8 w-full items-center gap-3 rounded-[4px] px-2 text-left ${
          selected ? "bg-[#f6fbff]" : "hover:bg-[#f7f7f7]"
        }`}
        onClick={onClick}
        type="button"
      >
        <SidebarIcon className={`size-4 shrink-0 ${toneClass}`} item={item} />

        <p className={`text-[13px] tracking-[-0.39px] ${toneClass}`}>{label}</p>
      </button>
    </div>
  );
}

function SectionHeader({
  label,
  muted = false,
  showIcon = true,
  onCreate,
}: {
  label: string;
  muted?: boolean;
  showIcon?: boolean;
  onCreate?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2.5">
        {showIcon ? <Database className="size-3.5 text-[#808080]" /> : null}
        <p
          className={`text-xs tracking-[-0.36px] ${
            muted ? "text-[#808080]" : "text-black"
          }`}
        >
          {label}
        </p>
      </div>

      {onCreate ? (
        <button
          aria-label="Create thread"
          className="flex size-3 items-center justify-center"
          onClick={onCreate}
          type="button"
        >
          <Plus className="size-3 text-[#808080]" />
        </button>
      ) : null}
    </div>
  );
}

function ConversationRow({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}) {
  const stats = getConversationStats(conversation);

  return (
    <div className="px-2 py-1">
      <button
        className={`flex h-9 w-full items-center justify-between rounded-[4px] px-2 text-left ${
          isActive ? "bg-[#f6fbff]" : "bg-white"
        }`}
        onClick={onClick}
        type="button"
      >
        <p
          className={`truncate text-[14px] tracking-[-0.42px] ${
            isActive ? "text-[#0080ff]" : "text-black"
          }`}
        >
          {conversation.title}
        </p>

        {stats ? (
          <div className="ml-3 flex items-center gap-2 text-[13px] leading-[1.2] tracking-[-0.39px]">
            <p className="text-[#00ec7e]">+{stats.added}</p>
            <p className="text-[#f53b3a]">-{stats.removed}</p>
          </div>
        ) : null}
      </button>
    </div>
  );
}

export default function AppSidebar({
  conversations,
  projects,
  allWorkspaces,
  selectedProjectId,
  activeConversationId,
  isLoading,
  isProjectsLoading,
  error,
  onCreateConversation,
  onToggleSidebar,
  onSelectConversation,
}: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeMode = useMemo(() => deriveRouteMode(pathname), [pathname]);

  const workspaceById = useMemo(
    () => new Map(allWorkspaces.map((workspace) => [workspace.id, workspace])),
    [allWorkspaces]
  );

  const codeConversations = useMemo(
    () =>
      conversations.filter(
        (conversation) => conversation.execution_target === "sandbox"
      ),
    [conversations]
  );

  const chatConversations = useMemo(
    () =>
      conversations.filter(
        (conversation) => conversation.execution_target === "default"
      ),
    [conversations]
  );

  const groups = useMemo<ConversationGroup[]>(() => {
    const groupedByProjectId = new Map<string, Conversation[]>();
    const unassigned: Conversation[] = [];

    for (const project of projects) {
      groupedByProjectId.set(project.id, []);
    }

    for (const conversation of codeConversations) {
      if (!conversation.workspace_id) {
        unassigned.push(conversation);
        continue;
      }

      const workspace = workspaceById.get(conversation.workspace_id);
      if (!workspace) {
        unassigned.push(conversation);
        continue;
      }

      const rows = groupedByProjectId.get(workspace.project_id);
      if (!rows) {
        unassigned.push(conversation);
        continue;
      }
      rows.push(conversation);
    }

    const projectGroups: ConversationGroup[] = projects
      .map((project) => ({
        key: project.id,
        label: project.repo,
        projectId: project.id,
        rows: groupedByProjectId.get(project.id) ?? [],
      }))
      .filter((group) => group.rows.length > 0 || isProjectsLoading);

    if (unassigned.length > 0) {
      projectGroups.push({
        key: "general",
        label: "General",
        projectId: null,
        rows: unassigned,
      });
    }

    return projectGroups;
  }, [codeConversations, isProjectsLoading, projects, workspaceById]);

  return (
    <div className="flex size-full flex-col justify-between bg-white">
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="border-[#f0f0f0] border-b pt-1 pb-2">
          <WorkspaceHeader onToggleSidebar={onToggleSidebar} />

          <SidebarButton item="habits" label="Habits" selected={false} />
          <SidebarButton
            item="integrations"
            label="Integrations"
            selected={false}
          />
          <SidebarButton
            item="chat"
            label="Chat"
            onClick={() => {
              if (pathname !== "/" && !pathname.startsWith("/chat")) {
                router.push("/");
              }
            }}
            selected={activeMode === "chat"}
          />
          <SidebarButton
            item="code"
            label="Code"
            onClick={() => {
              if (!pathname.startsWith("/code")) {
                router.push("/code");
              }
            }}
            selected={activeMode === "code"}
          />
        </div>

        <div className="min-h-0 overflow-y-auto">
          {activeMode === "code" ? (
            <>
              {groups.map((group) => (
                <section key={group.key}>
                  <SectionHeader
                    label={group.label}
                    muted={selectedProjectId !== group.projectId}
                    onCreate={() => onCreateConversation("code")}
                  />

                  {group.rows.map((conversation) => (
                    <ConversationRow
                      conversation={conversation}
                      isActive={conversation.id === activeConversationId}
                      key={conversation.id}
                      onClick={() => {
                        onSelectConversation({
                          conversationId: conversation.id,
                          projectId: group.projectId,
                          workspaceId: conversation.workspace_id ?? null,
                          mode: "code",
                        });
                      }}
                    />
                  ))}
                </section>
              ))}

              {isProjectsLoading ? (
                <p className="px-4 py-3 text-[#808080] text-sm tracking-[-0.42px]">
                  Loading projects...
                </p>
              ) : null}

              {isLoading ? (
                <p className="px-4 py-3 text-[#808080] text-sm tracking-[-0.42px]">
                  Loading threads...
                </p>
              ) : null}

              {!(isProjectsLoading || isLoading) && groups.length === 0 ? (
                <p className="px-4 py-3 text-[#808080] text-sm tracking-[-0.42px]">
                  No code threads yet
                </p>
              ) : null}
            </>
          ) : null}

          {activeMode === "chat" ? (
            <>
              <SectionHeader
                label="Chats"
                onCreate={() => onCreateConversation("chat")}
                showIcon={false}
              />

              {chatConversations.map((conversation) => (
                <ConversationRow
                  conversation={conversation}
                  isActive={conversation.id === activeConversationId}
                  key={conversation.id}
                  onClick={() => {
                    onSelectConversation({
                      conversationId: conversation.id,
                      projectId: null,
                      workspaceId: conversation.workspace_id ?? null,
                      mode: "chat",
                    });
                  }}
                />
              ))}

              {!isLoading && chatConversations.length === 0 ? (
                <p className="px-4 py-3 text-[#808080] text-sm tracking-[-0.42px]">
                  No chat threads yet
                </p>
              ) : null}

              {isLoading ? (
                <p className="px-4 py-3 text-[#808080] text-sm tracking-[-0.42px]">
                  Loading threads...
                </p>
              ) : null}
            </>
          ) : null}

          {error ? (
            <p className="px-4 py-3 text-red-600 text-sm tracking-[-0.42px]">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex h-10 items-center justify-between border-[#f1f1f2] border-t py-2 pr-[10px] pl-4">
        <button
          className="flex items-center gap-2"
          onClick={() => router.push("/code/new")}
          type="button"
        >
          <Plus className="size-4 text-black" />
          <p className="text-black text-xs tracking-[-0.36px]">Add Project</p>
        </button>

        <div className="flex items-center gap-4">
          <button
            aria-label="Toggle sidebar"
            className="flex size-4 items-center justify-center"
            onClick={onToggleSidebar}
            type="button"
          >
            <NavArrowLeft className="size-4 text-[#808080]" />
          </button>

          <UserCircle className="size-5 text-[#808080]" />
        </div>
      </div>
    </div>
  );
}
