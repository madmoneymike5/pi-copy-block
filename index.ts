/**
 * pi-copy-block - copy a code block out of pi's last reply.
 *
 * `/copy-block` collects every fenced code block and bash tool call from the
 * ten most recent assistant messages. One hit goes straight to the clipboard;
 * multiple replies or blocks open a picker.
 */

import {
  copyToClipboard,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

const COMMAND = "copy-block";
const MAX_ASSISTANT_MESSAGES = 10;

export type CopyableReply = {
  /** 1 is the latest assistant reply, 10 is the oldest searched reply. */
  age: number;
  blocks: string[];
};

/** Pull the body of every fenced code block out of a markdown string. */
export function extractFencedBlocks(text: string): string[] {
  const fence = /```(?:\w*)?\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text)) !== null) {
    const content = match[1]?.trim();
    if (content) blocks.push(content);
  }
  return blocks;
}

function collectCopyableBlocks(content: unknown): string[] {
  const blocks: string[] = [];

  if (!Array.isArray(content)) return blocks;

  for (const block of content) {
    if (!block || typeof block !== "object") continue;

    const record = block as Record<string, unknown>;
    if (record.type === "toolCall" && typeof record.name === "string") {
      const args = record.arguments;
      const command =
        args && typeof args === "object"
          ? (args as Record<string, unknown>).command
          : undefined;

      if (
        record.name.toLowerCase() === "bash" &&
        typeof command === "string"
      ) {
        blocks.push(command);
      }
    } else if (record.type === "text" && typeof record.text === "string") {
      blocks.push(...extractFencedBlocks(record.text));
    }
  }

  return blocks;
}

/** Find copyable blocks in the ten most recent assistant replies. */
export function findRecentCopyableReplies(
  branch: readonly unknown[],
): CopyableReply[] {
  const replies: CopyableReply[] = [];
  let assistantAge = 0;

  for (
    let index = branch.length - 1;
    index >= 0 && assistantAge < MAX_ASSISTANT_MESSAGES;
    index -= 1
  ) {
    const entry = branch[index];
    if (!entry || typeof entry !== "object") continue;

    const entryRecord = entry as Record<string, unknown>;
    if (entryRecord.type !== "message") continue;

    const message = entryRecord.message;
    if (!message || typeof message !== "object") continue;

    const messageRecord = message as Record<string, unknown>;
    if (messageRecord.role !== "assistant") continue;

    assistantAge += 1;
    const blocks = collectCopyableBlocks(messageRecord.content);
    if (blocks.length > 0) replies.push({ age: assistantAge, blocks });
  }

  return replies;
}

/** First line of `text`, ellipsized to `max` characters. */
function truncate(text: string, max: number): string {
  const firstLine = text.split("\n")[0] ?? "";
  return firstLine.length > max ? `${firstLine.slice(0, max - 3)}...` : firstLine;
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand(COMMAND, {
    description: "Copy a code block from the last 10 assistant replies to clipboard",
    handler: async (_args, ctx) => {
      const replies = findRecentCopyableReplies(ctx.sessionManager.getBranch());

      if (replies.length === 0) {
        ctx.ui.notify(
          "No code blocks in the last 10 assistant replies",
          "warning",
        );
        return;
      }

      let selectedReply = replies[0] as CopyableReply;
      if (replies.length > 1) {
        const choices = replies.map(
          (reply) =>
            `Reply ${reply.age} (${reply.blocks.length} block${reply.blocks.length === 1 ? "" : "s"}): ${truncate(reply.blocks[0] as string, 64)}`,
        );
        const choice = await ctx.ui.select("Which assistant reply?", choices);
        if (choice === undefined) {
          ctx.ui.notify("Cancelled", "info");
          return;
        }
        selectedReply = replies[choices.indexOf(choice)] as CopyableReply;
      }

      let selected = selectedReply.blocks[0] as string;
      if (selectedReply.blocks.length > 1) {
        const choices = selectedReply.blocks.map(
          (block, index) => `${index + 1}. ${truncate(block, 80)}`,
        );
        const choice = await ctx.ui.select("Which block to copy?", choices);
        if (choice === undefined) {
          ctx.ui.notify("Cancelled", "info");
          return;
        }
        selected = selectedReply.blocks[choices.indexOf(choice)] as string;
      }

      try {
        await copyToClipboard(selected);
        ctx.ui.notify(
          `Copied from reply ${selectedReply.age}: ${truncate(selected, 60)}`,
          "info",
        );
      } catch (err) {
        ctx.ui.notify(`Failed to copy: ${err}`, "error");
      }
    },
  });
}
