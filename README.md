# hooktrap

Catch, inspect and replay webhooks. Built on [BoxExpress](https://github.com/robertz/boxlang-express).

A bin is a throwaway URL. Anything sent to `/in/<bin>` or below it, on any
method, is stored exactly as it arrived and shows up live in the browser with
its headers, query and body. Any captured request can be sent again, byte for
byte, to another server.

## Why you'd use it

Webhooks are awkward to develop against. The sender decides when they fire,
you can't see what was sent unless your handler logs it, and when your
handler has a bug you have to trigger the real event again to retry.
Hooktrap sits in between:

- **See exactly what a provider sends.** Point Stripe, GitHub, Shopify or
  anything else at a bin before you write a line of handler code, and read
  the real headers, signature and payload instead of the docs' example.
- **Develop against a recorded request.** Capture an event once, then replay
  it at your local handler as many times as it takes to get it right. No
  need to make another test payment or push another commit to fire it again.
- **Debug signature checks.** Bodies are stored and replayed as the exact
  bytes received, so an HMAC over the body still verifies on replay.
  Re-serialized JSON wouldn't. (A provider that also signs a timestamp, as
  Stripe does, will reject an old replay unless your handler's tolerance
  allows it.)
- **Check what your own code sends.** Use a bin as the target for an
  outbound webhook, an HTTP client or a form post, and inspect the request
  your app actually made.
- **Keep payloads on your machine.** Hosted request bins see everything you
  send them. This one runs locally.

## How to use it

1. Start the app and open it, then click **Create a bin**. The page shows the
   bin's capture URL.
2. Send requests to that URL. Any method and any path below it works, so
   `/in/<bin>/stripe/events` and `/in/<bin>/github` can share a bin:

   ```bash
   curl -X POST 'http://localhost:3000/in/<bin>/stripe/events?type=invoice.paid' \
     -H 'Content-Type: application/json' \
     -d '{"id":"evt_1","type":"invoice.paid"}'
   ```

3. Requests appear in the list as they arrive. Select one to see its query,
   headers and body. JSON is pretty-printed; a body that isn't text is shown
   as base64.
4. To replay, enter your local server's address (`http://localhost:8080`)
   and press **Replay**. The path and query the request arrived with are
   appended to the target, so a request captured at
   `/in/<bin>/stripe/events?type=invoice.paid` goes to
   `http://localhost:8080/stripe/events?type=invoice.paid`. The response's
   status, headers, body and timing are kept next to the request.

### Receiving webhooks from the internet

A provider can't reach `localhost`, so put a tunnel in front of the app
(ngrok, Cloudflare Tunnel, Tailscale Funnel) and give the provider the
tunnel's address plus `/in/<bin>`. Set `HOOKTRAP_PUBLIC_URL` to the tunnel's
address so the page shows the right capture URL. Every request is answered
with a `200`, so the provider treats the delivery as successful.

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
