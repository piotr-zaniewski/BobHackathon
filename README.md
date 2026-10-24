# BobLab

BobLab is a hackathon project: a local MVP for lecturer-assigned programming practice. Students get one workspace with a C++/Python editor, a Socratic coaching chat, a sample structure check, dark mode, and visible learning/process evidence. The coach connects to IBM Consulting Advantage (ICA) Developer API using the attached Developer API Overview.

## Requirements

- Node.js 24 or newer (the API uses Node's built-in `node:sqlite` module)
- npm
- An IBM Consulting Advantage (ICA) Developer API key with entitlement to at least one chat model. A Google Gemini API key is not an ICA key and will not authenticate to these endpoints.

## Run locally

```powershell
npm.cmd install
```

Create `.env` from `.env.example` only if you do not already have a local `.env`:

```powershell
Copy-Item .env.example .env
```

Set `ICA_API_KEY` in `.env` yourself using the developer key issued in the ICA UI under **Settings → API Keys → ICA APIs**. The current local env file may still contain `GEMINI_*` names from the earlier setup; the ICA backend does not read those. Replace the old provider variable names with the ICA variables shown below, entering the ICA-issued key yourself. Never paste the key into chat, source code, or a committed file. `.env` is excluded by `.gitignore`.

Start the client and API together:

```powershell
npm.cmd run dev
```

Open the Vite URL printed in the terminal, normally `http://localhost:5173`. The API health endpoint is `http://localhost:3001/api/health`. Use `Ctrl+C` in the dev terminal to stop both services.

The editor opens in C++ by default. Use the language buttons above the editor to switch between C++ and Python; each language keeps its current text while switching. The sun/moon button in the header toggles light and dark themes and remembers your choice.

## Paste a sample solution

Open [`test_solution.cpp`](test_solution.cpp), copy its contents, select C++ in the app, and paste into the editor. The app records the paste event and character count, but does not save clipboard contents as a separate record. It acknowledges the paste neutrally and asks the coach to pose two questions about the data structure/invariant and linear-time complexity. Paste detection is a learning prompt, not a cheating verdict.

## Configure ICA

The attached ICA API guide specifies OpenAI-compatible chat completions under `https://api.servicesessentials.ibm.com/v1`. Authentication is `Authorization: Bearer <ICA key>`. This app uses the raw-model namespace by default:

- Model discovery: `GET /chat-models/models`
- Chat: `POST /chat-models/chat/completions`

The local backend exposes an authenticated discovery proxy. After entering `ICA_API_KEY` in `.env` and starting the app, run:

```powershell
Invoke-RestMethod http://localhost:3001/api/provider/models | ConvertTo-Json -Depth 6
```

The model list available to the configured ICA account was checked during setup. The highest Claude tier returned was **Claude Opus 5.5**, ID `claude-opus-5-5`; `.env.example` pins that exact ID. If this model is not entitled on another ICA account, or you want to discover that account's best Claude model, set `ICA_MODEL=auto-claude` (or leave it blank). The backend then selects the highest listed Claude tier in this order: Opus, Sonnet, then Haiku, choosing the newest-looking version within the tier. `GET /api/provider/models` returns the exact available IDs and the automatic `recommendedModel`. Any manually configured model must be an exact `id` returned by ICA.

`ICA_CHAT_NAMESPACE` defaults to `chat-models`; the guide also documents `assistants`, `agents`, and `digital-workforce`. Only change the namespace if the chosen model ID belongs to that namespace and the key is entitled to it. `ICA_BASE_URL` defaults to the guide's base URL. The full template is:

```dotenv
PORT=3001
ICA_API_KEY=
ICA_BASE_URL=https://api.servicesessentials.ibm.com/v1
ICA_CHAT_NAMESPACE=chat-models
ICA_MODEL=claude-opus-5-5
```

The server sends the key directly to ICA in the Bearer header; it is never bundled into the browser. Chat messages and the current editor contents are sent to ICA when the student asks the coach. Do not enter personal or sensitive information. Without a key, the coach uses a deterministic local demo fallback. If ICA lists no Claude model the key is entitled to, the coach returns a clear model-access error instead of silently choosing a non-Claude model.

ICA errors documented by the guide: `400` indicates invalid request data, `401` missing/unknown/revoked key, `403` missing entitlement, and `404` an invalid resource/model. The app returns the HTTP status with a short configuration hint. The model discovery proxy only returns model IDs, names, and descriptions; it does not send the API key to the browser.

## Build and run API only

```powershell
npm.cmd run build
npm.cmd start
```

## What the MVP measures

- Check attempts and the result of the latest sample structure check
- Debounced editor-change events, without storing code snapshots or raw keystrokes
- Coach exchanges as a count of student explanations
- Approximate recent active browser time, based on visible, recently interacted sessions
- Paste event count and pasted character count; clipboard text itself is not stored

These are formative signals shown to the student. A large paste may raise a review signal, but it is not evidence that cheating occurred. No camera, microphone, screen recording, or hidden monitoring is used.

The “Check solution” action is deliberately not a test runner. It inspects the submitted source text for three language-specific patterns (a lookup map/dictionary, complement lookup, and index storage); it does not compile or execute code and does not prove correctness. Do not use this checker to grade students.

The local SQLite database is stored in `server/learning-lab.sqlite` and is ignored by Git.

## MVP boundaries

This is a single-user local prototype with a seeded Two Sum task. Authentication, lecturer task authoring, multi-course administration, a real sandboxed grader, and production-ready AI assessment are not included. Before classroom deployment, add authentication and authorization, privacy/retention controls, a validated isolated execution service, and instructor-reviewed assessment criteria.