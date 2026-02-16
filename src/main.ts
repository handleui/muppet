// Muppet — minimal frontend entry point
// Backend commands are exposed via Tauri IPC and can be tested from the console.

import { invoke } from "@tauri-apps/api/core";

// Expose invoke globally for console testing
(window as any).invoke = invoke;

async function init() {
  console.log("[muppet] Frontend loaded. Use invoke() to test backend commands.");
  console.log("[muppet] DB commands:");
  console.log('  invoke("create_conversation", { title: "Test" })');
  console.log('  invoke("list_conversations")');
  console.log('  invoke("get_messages", { conversationId: "..." })');
  console.log(
    '  invoke("save_message", { conversationId: "...", role: "user", content: "Hello" })',
  );
  console.log('  invoke("delete_conversation", { id: "..." })');
  console.log(
    '  invoke("update_conversation_title", { id: "...", title: "New title" })',
  );
  console.log("[muppet] Stronghold (key storage) is managed via @tauri-apps/plugin-stronghold JS API.");
}

init();
