# LLM Token Viewer

A small React + TypeScript app for visualizing how OpenAI-style tokenizer encodings split text into tokens.

## Features

- Paste any text and inspect token segmentation
- Switch between `o200k_base` and `cl100k_base`
- View token IDs, rendered pieces, UTF-8 bytes, and character ranges
- Filter the token table by token text, token ID, or byte sequence
- Copy token IDs or token pieces
- Includes built-in sanity checks for core tokenizer behavior

## Local development

```bash
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## Build

```bash
npm run build
```

## Notes

The original app was first prototyped in ChatGPT canvas using ChatGPT-specific UI components. This repo contains a standalone version adapted to run normally in a standard Vite environment.
