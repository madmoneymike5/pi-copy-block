# pi-copy-block

Grab a code block out of pi's last reply and put it on your clipboard.

![demo](https://raw.githubusercontent.com/joelazar/pi-copy-block/main/assets/demo.gif)

Pi ends a lot of turns with something you're meant to run or paste: a fenced block in its prose, or a `bash` tool call waiting for approval. Selecting that text with the mouse inside a TUI is fiddly, and it picks up the surrounding borders. `/copy-block` pulls it out cleanly.

## Install

```bash
pi install npm:@joelazar/pi-copy-block
```

## Usage

Run `/copy-block`. The extension scans the ten most recent assistant replies, newest first, and gathers, in the order they appear:

- the body of every fenced code block in the message text, with the fences and language tag stripped
- the `command` argument of every `bash` tool call

One match goes straight to the clipboard. If more than one reply has copyable blocks, the first picker chooses the reply and shows its age (`Reply 1` is the latest; `Reply 10` is the oldest searched). If the selected reply has several blocks, a second picker chooses the block. Each choice shows a truncated first line, and the selected content is copied without its markdown fences.

If none of the ten replies has a block, you get a warning and the clipboard is left alone.

## License

MIT
