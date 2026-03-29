# Installation

## Requirements

- **Node.js 18+** — the SDK uses native `fetch` (available from Node 18) and native `WebSocket` (available from Node 22). For Node 18–21, pass a WebSocket implementation — see below.
- **TypeScript 5+** — recommended for full type safety

## Install

::: code-group

```bash [npm]
npm install kredence
```

```bash [pnpm]
pnpm add kredence
```

```bash [yarn]
yarn add kredence
```

:::

The package ships dual ESM and CJS builds, so it works in Next.js, Vite, plain Node.js, and browser environments without any bundler configuration.

## Node.js < 22 — WebSocket polyfill

Native WebSocket is available in Node.js 22+. On older versions you need to pass an implementation:

```bash
npm install ws
```

```ts
import WebSocket from 'ws';
import { KredenceClient } from 'kredence';

const client = new KredenceClient({ WebSocket });
```

## Self-hosted server

If you are running the Kredence server yourself, point the client at your instance:

```ts
const client = new KredenceClient({
  baseUrl: 'http://localhost:3001',
});
```

The SDK derives the WebSocket URL automatically from `baseUrl` (`http://` → `ws://`, `https://` → `wss://`).

## TypeScript

All types are exported directly from `kredence` — no separate `@types/` package needed:

```ts
import type {
  HypercertPayload,
  EcosystemInput,
  PipelineSummary,
  ServerMessage,
} from 'kredence';
```

See the [Types reference](/sdk/types) for a complete list.
