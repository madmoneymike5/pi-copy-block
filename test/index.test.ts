import assert from "node:assert/strict";
import test from "node:test";

import {
  extractFencedBlocks,
  findRecentCopyableReplies,
} from "../index.ts";

test("searches the ten most recent assistant replies in newest-first order", () => {
  const branch = Array.from({ length: 11 }, (_, index) => [
    {
      type: "message",
      message: {
        role: "assistant",
        content: [{ type: "text", text: `\`\`\`bash\ncommand-${index}\n\`\`\`` }],
      },
    },
    {
      type: "message",
      message: { role: "user", content: `prompt-${index}` },
    },
  ]).flat();

  const replies = findRecentCopyableReplies(branch);

  assert.equal(replies.length, 10);
  assert.deepEqual(replies[0], { age: 1, blocks: ["command-10"] });
  assert.deepEqual(replies[9], { age: 10, blocks: ["command-1"] });
  assert.equal(replies.some((reply) => reply.blocks.includes("command-0")), false);
});

test("keeps the existing latest-reply behavior for fenced blocks and Bash calls", () => {
  const branch = [
    {
      type: "message",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "```sh\necho from prose\n```" },
          {
            type: "toolCall",
            name: "bash",
            arguments: { command: "printf '%s\\n' from-tool" },
          },
        ],
      },
    },
  ];

  assert.deepEqual(findRecentCopyableReplies(branch), [
    {
      age: 1,
      blocks: ["echo from prose", "printf '%s\\n' from-tool"],
    },
  ]);
});

test("preserves meaningful newlines inside a copied fenced script", () => {
  const script = "for file in *.txt; do\n  printf '%s\\n' \"$file\"\ndone";
  const fenced = "```bash\n" + script + "\n```\n";

  assert.deepEqual(extractFencedBlocks(fenced), [script]);
});

test("ignores assistant replies without copyable blocks", () => {
  const branch = [
    {
      type: "message",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "There is no command in this reply." }],
      },
    },
  ];

  assert.deepEqual(findRecentCopyableReplies(branch), []);
});
