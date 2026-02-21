import type { Metadata } from "next";
import CodeHomeClient from "../code/code-home-client";

export const metadata: Metadata = {
  title: "Chat",
  description: "Start and manage a code conversation workspace.",
};

export default function ChatHome() {
  return <CodeHomeClient />;
}
