# hooktrap

Catch, inspect and replay webhooks. Built on [BoxExpress](https://github.com/robertz/boxlang-express).

A bin is a throwaway URL. Anything sent to `/in/<bin>` or below it, on any
method, is stored exactly as it arrived and shows up live in the browser with
its headers, query and body. Any captured request can be sent again, byte for
byte, to another server.

## Run

```bash
box install boxlang-express --local
./start.sh
```

Then open http://localhost:3000. Settings are environment variables; copy
`.env.example` to `.env` to change them.

## How it's laid out

```
server.bxs            settings → services → app → listen
services/             BinStore (in-memory bins), Replayer, Payload, ApiError, Bootstrap
routes/Web.bx         builds the app: capture routes, API router, pages, error handler
routes/CaptureRoutes  /in/:bin and /in/:bin/*rest, any method, raw body
routes/BinRoutes      /api: list, detail, clear, delete, replay, and the SSE stream
routes/PageRoutes     / and /b/:id
views/, public/       .bxm pages and the vanilla JS inspector
```

## Things to know

- Bins live in memory. A restart empties them, and with `ENV=development` the
  server restarts whenever a `.bx` or `.bxs` file changes.
- A bin keeps its newest 100 requests and is removed after 24 hours without
  traffic or a viewer.
- Replay only reaches hosts in `HOOKTRAP_REPLAY_HOSTS` (loopback by default),
  so the server can't be pointed at other machines on its network.
- A bin's id is its only protection. To receive real webhooks, put the app
  behind a tunnel and set `HOOKTRAP_PUBLIC_URL` to the tunnel's address.
