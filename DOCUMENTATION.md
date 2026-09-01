# DevQR — Complete Technical & Architectural Documentation

> **Laptop Errors. Phone Intelligence.**  
> *Turn any workstation error into a portable, AI-powered debugging session on your phone with zero cloud backend.*

---

## Table of Contents

1. [Executive Summary & Philosophy](#1-executive-summary--philosophy)
2. [High-Level Architecture](#2-high-level-architecture)
3. [System Subsystems & Directory Structure](#3-system-subsystems--directory-structure)
4. [CLI & Workstation Bridge (`cli/`)](#4-cli--workstation-bridge-cli)
   - [4.1 Multi-Language Error Detector](#41-multi-language-error-detector)
   - [4.2 Secret Redaction & Sanitization](#42-secret-redaction--sanitization)
   - [4.3 Compression & Chunking Protocol](#43-compression--chunking-protocol)
   - [4.4 Local LAN RPC Bridge & IDE Beacon](#44-local-lan-rpc-bridge--ide-beacon)
   - [4.5 Multi-File Atomic Patcher & Rollback](#45-multi-file-atomic-patcher--rollback)
   - [4.6 WebSocket PTY Terminal Server](#46-websocket-pty-terminal-server)
5. [Mobile Application (`mobile/`)](#5-mobile-application-mobile)
   - [5.1 Navigation & Screen Architecture](#51-navigation--screen-architecture)
   - [5.2 AI Engine & Multi-Provider Architecture](#52-ai-engine--multi-provider-architecture)
   - [5.3 Air-Gapped / On-Device Local LLM](#53-air-gapped--on-device-local-llm)
   - [5.4 Smart Action Chips & Unit Test Synthesizer](#54-smart-action-chips--unit-test-synthesizer)
   - [5.5 Codebase Architecture & Health Studio (`devqr arch`)](#55-codebase-architecture--health-studio-devqr-arch)
   - [5.6 AI App & File Synthesizer (`devqr gen`)](#56-ai-app--file-synthesizer-devqr-gen)
   - [5.7 Remote Interactive PTY Terminal Client](#57-remote-interactive-pty-terminal-client)
   - [5.8 Executive PDF Audit & Post-Mortem Exporters](#58-executive-pdf-audit--post-mortem-exporters)
   - [5.9 Encrypted Offline SQLite Persistence](#59-encrypted-offline-sqlite-persistence)
6. [Communication Protocols & API Specification](#6-communication-protocols--api-specification)
   - [6.1 QR Code Wire Payload Format](#61-qr-code-wire-payload-format)
   - [6.2 Bridge HTTP / RPC Endpoints](#62-bridge-http--rpc-endpoints)
   - [6.3 WebSocket Terminal Stream Protocol](#63-websocket-terminal-stream-protocol)
7. [Security & Privacy Architecture](#7-security--privacy-architecture)
8. [CLI Command Reference](#8-cli-command-reference)
9. [Build, Installation & Deployment Guide](#9-build-installation--deployment-guide)
   - [9.1 Workstation CLI Setup](#91-workstation-cli-setup)
   - [9.2 Mobile App Setup (Expo)](#92-mobile-app-setup-expo)
   - [9.3 Standalone Android APK Build (GitHub Actions)](#93-standalone-android-apk-build-github-actions)

---

## 1. Executive Summary & Philosophy

Debugging often occurs under tight deadlines when developers are on the move, away from their desks, or reviewing errors with peers. Traditional cloud debugging solutions require uploading source code and logs to third-party servers, posing critical compliance, IP, and security risks.

**DevQR** solves this by establishing a decentralized, zero-cloud bridge between your workstation and your smartphone:

1. **Zero DevQR Cloud Backend**: No code, stack traces, or session data are ever routed through a DevQR server. Data flow is strictly point-to-point via optical QR codes and encrypted local Wi-Fi RPCs.
2. **Air-Gapped & Offline Ready**: In addition to leading cloud AI APIs (Google Gemini, Groq, OpenRouter), DevQR embeds a fully offline **On-Device Local LLM engine** (quantized GGUF models) for classified or air-gapped environments.
3. **Automated Secret Stripping**: All environment variables, API tokens, passwords, bearer credentials, and private keys are scrubbed before payload serialization.
4. **Bi-Directional Workstation Control**: The phone is not merely a read-only viewer; it can remotely apply atomic code patches, trigger test suites, jump IDE cursors (VS Code, Cursor, Neovim), and open interactive PTY terminal sessions over your local network.

---

## 2. High-Level Architecture

```text
 ┌──────────────────────────────────────────────────────────────────────────┐
 │                         DEVELOPER WORKSTATION                            │
 │                                                                          │
 │   [ Git Repo / Project Files ] ──► [ AST & Error Detector ]              │
 │                                             │                            │
 │   [ PTY Remote Terminal ] ◄──┐              ▼                            │
 │   [ VS Code / Cursor IDE ] ◄─┼─── [ Secret Sanitizer ]                   │
 │   [ Multi-File Patcher ] ◄───┼──────────────│                            │
 │              ▲               │              ▼                            │
 │              │               │     [ Zlib Compression ]                  │
 │              │               │              │                            │
 │   ┌──────────────────────┐   │              ▼                            │
 │   │ DevQR Bridge Server  │   │     ┌──────────────────┐                  │
 │   │ (HTTP / WebSocket)   │   │     │   Terminal QR    │                  │
 │   └──────────▲───────────┘   │     └────────┬─────────┘                  │
 └──────────────┼───────────────┼──────────────┼────────────────────────────┘
                │ Local Wi-Fi   │              │ Optical Scan
                │ LAN / mDNS    │              │ (Camera / Fast Decoder)
 ┌──────────────┼───────────────┴──────────────┼────────────────────────────┐
 │              ▼                              ▼                            │
 │   ┌──────────────────────────────────────────────────┐                   │
 │   │                 DevQR MOBILE APP                 │                   │
 │   │              (Expo / React Native)               │                   │
 │   │                                                  │                   │
 │   │  • QR Chunk Decompressor   • SQLite Local Store  │                   │
 │   │  • Cloud & On-Device LLM   • Unified Diff Viewer │                   │
 │   │  • Remote Terminal Client  • PDF Report Exporter │                   │
 │   │  • Architecture Explorer   • App Generator Studio│                   │
 │   └──────────────────────────────────────────────────┘                   │
 │                              MOBILE DEVICE                               │
 └──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. System Subsystems & Directory Structure

```
devqr/
├── cli/                                # DevQR Workstation CLI & Bridge Server
│   ├── src/
│   │   ├── index.ts                    # CLI entrypoint, argument parsing, QR rendering
│   │   ├── bridge.ts                   # HTTP/WebSocket RPC bridge server & IDE controller
│   │   ├── terminalServer.ts           # PTY WebSocket server for remote shell access
│   │   ├── detector.ts                 # Multi-language error parser & stack trace extractor
│   │   ├── patcher.ts                  # Multi-file atomic patcher & rollback snapshot engine
│   │   ├── compressor.ts               # Zlib Deflate & Base64 payload serializer
│   │   ├── sanitizer.ts                # Regex-based credential & secret scrubbing
│   │   ├── picker.ts                   # Interactive CLI file selection inquirer prompt
│   │   ├── git.ts                      # Git status, diff, and branch context helper
│   │   └── types.ts                    # CLI TypeScript interfaces
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/                             # DevQR Mobile Application (React Native / Expo)
│   ├── app/                            # Expo Router File-Based Navigation
│   │   ├── _layout.tsx                 # Root navigation stack & theme provider
│   │   ├── index.tsx                   # Dashboard, quick actions & session history
│   │   ├── scanner.tsx                 # Camera QR scanner with animated HUD reticle
│   │   ├── result.tsx                  # AI Diagnosis, diff viewer, 1-click laptop auto-fix
│   │   ├── arch.tsx                    # Architecture & Health Studio, AST visualizer
│   │   ├── generator.tsx               # AI App & File Synthesizer Studio
│   │   ├── terminal.tsx                # Interactive PTY terminal client over WebSocket
│   │   ├── preview.tsx                 # Fullscreen code & test previewer
│   │   ├── sessions.tsx                # Filterable SQLite session archives
│   │   ├── settings.tsx                # AI providers, model keys, on-device LLM config
│   │   ├── onboarding.tsx              # First-launch onboarding walkthrough
│   │   └── context-viewer.tsx          # Raw payload and stack trace inspector
│   ├── src/
│   │   ├── components/                 # Reusable UI components
│   │   │   ├── InteractiveTerminalModal.tsx  # Floating terminal modal
│   │   │   ├── CreateFileModal.tsx           # Modal for creating files on laptop
│   │   │   ├── FixQRModal.tsx                # Offline patch QR generator
│   │   │   ├── QuantumLoader.tsx             # Animated multi-stage AI loader
│   │   │   ├── BottomAlert.tsx               # Toast notification drawer
│   │   │   └── SvgIcons.tsx                  # Vector icon library
│   │   ├── services/                   # Application Services
│   │   │   ├── aiEngine.ts                   # Multi-provider LLM prompt orchestrator
│   │   │   ├── onDeviceLLM.ts                # On-Device GGUF/Local model runner
│   │   │   ├── pdfExporter.ts                # HTML to A4 PDF technical report generator
│   │   │   ├── sqliteStorage.ts              # Local session storage & indexing
│   │   │   ├── qrDecoder.ts                  # QR chunk decompressor & parser
│   │   │   └── secureStore.ts                # Encrypted API key storage
│   │   └── types.ts                    # Shared mobile TypeScript definitions
│   ├── app.json                        # Expo build configuration
│   └── package.json
│
├── .github/workflows/
│   └── build-apk.yml                   # Automated Android APK CI/CD pipeline
├── README.md                           # Quickstart & feature highlights
└── DOCUMENTATION.md                    # Complete technical specification
```

---

## 4. CLI & Workstation Bridge (`cli/`)

### 4.1 Multi-Language Error Detector
The detector (`detector.ts`) automatically parses stderr, uncaught exceptions, and build traces across major programming languages:
- **Python**: `Traceback (most recent call last)`, syntax errors, `NameError`, `TypeError`, etc.
- **Node / TypeScript / JavaScript**: V8 stack traces, `ReferenceError`, `TypeError`, module resolution failures.
- **Go**: Panic stack traces, compilation errors (`undefined:`, `cannot use`).
- **Rust**: `cargo build` panic output, `error[E0...]` borrow checker traces.
- **Java / Kotlin**: JVM exception stack traces with package and line coordinates.
- **C / C++**: GCC / Clang compiler diagnostics and segfault notices.
- **Ruby & PHP**: Fatal exceptions and stack traces.

It extracts:
- Offending filename and line number
- Error type and message
- Surrounding lines of source code context (before & after the error)
- Active Git branch and uncommitted `git diff`

### 4.2 Secret Redaction & Sanitization
The sanitizer (`sanitizer.ts`) runs as a mandatory pipeline stage before bundle creation. It uses high-entropy pattern matching to scrub:
- AWS Access Keys (`AKIA...`), Secret Keys
- GitHub / GitLab Personal Access Tokens (`ghp_...`, `glpat-...`)
- JWTs (`eyJhbGci...`) and Bearer authentication headers
- Private keys (`-----BEGIN RSA PRIVATE KEY-----`)
- Database connection URIs (`mongodb://`, `postgres://`, `mysql://`)
- Sensitive `.env` keys (passwords, auth tokens, secret salts)

All detected secrets are replaced with `[REDACTED_SECRET]`.

### 4.3 Compression & Chunking Protocol
To maximize QR scanning throughput:
1. Context is converted to compact JSON.
2. Compressed using **Zlib Deflate** with maximum compression.
3. Encoded in URL-safe Base64.
4. If the payload fits under 2.5KB, a single static QR is rendered.
5. If larger, it is split into sequential chunks (`DEVQR:1/N:...`, `DEVQR:2/N:...`) and rendered as a looping terminal animation for high-capacity multi-frame scanning.

### 4.4 Local LAN RPC Bridge & IDE Beacon
When started, `bridge.ts` spins up a lightweight HTTP server on port `8765` (configurable) and binds to all local network interfaces (`0.0.0.0`).

- **Authentication**: A secure single-use or session token is generated and embedded in the QR code. The mobile client sends this token with every RPC request.
- **IDE Beacon**: When the user taps **`[ Focus in IDE ]`** or clicks any line in the diff viewer on their phone, the mobile app posts `{ file, line }` to `/focus-ide`. The bridge executes `code --goto <file>:<line>` or `cursor --goto <file>:<line>`, immediately focusing the developer's laptop editor on that exact location.

### 4.5 Multi-File Atomic Patcher & Rollback
The patcher (`patcher.ts`) supports multi-file surgical code updates:
- Performs fuzzy line-matching to apply diffs even if local code has shifted slightly.
- Creates pre-patch snapshot backups: `<filename>.devqr.bak`.
- **Atomic Rollback Guarantee**: If any file in a multi-file batch fails to patch, all previously touched files are automatically restored from their `.devqr.bak` snapshot.
- Tap **`[ Undo / Revert ]`** on the mobile screen at any time to restore the entire workspace to its pre-patch state.

### 4.6 WebSocket PTY Terminal Server
`terminalServer.ts` establishes a WebSocket server bound to `/terminal`.
- Spawns a real pseudo-terminal process (`powershell.exe` on Windows, `/bin/bash` or `/bin/zsh` on macOS/Linux).
- Allows bidirectional streaming of raw ANSI terminal output and keyboard inputs (including control characters `Ctrl+C`, `Tab`, arrow keys).

---

## 5. Mobile Application (`mobile/`)

### 5.1 Navigation & Screen Architecture
Built with **Expo Router** with a dark, high-contrast, cyberpunk-inspired design system:
- **`app/index.tsx`**: Dashboard showcasing system health, quick actions (Scan Error, Architecture Studio, App Generator, Terminal), and recent sessions.
- **`app/scanner.tsx`**: High-performance camera scanner with animated HUD crosshairs and instant chunk assembler.
- **`app/result.tsx`**: Main diagnosis workspace with multi-file diff viewer, smart action chips, 1-click auto-fix, and test execution.
- **`app/arch.tsx`**: Visual Codebase Architecture Studio and dead-code auditor.
- **`app/generator.tsx`**: Prompt-driven new app & file synthesizer.
- **`app/terminal.tsx`**: Fullscreen remote terminal console with virtual modifier keys.
- **`app/settings.tsx`**: AI model selection, API key vault, and on-device model manager.

### 5.2 AI Engine & Multi-Provider Architecture
`aiEngine.ts` unifies multiple LLM providers behind a robust streaming and structured JSON interface:
- **Google Gemini**: Gemini 2.5 Flash, Gemini 3.0 Pro.
- **Groq**: Ultra-low latency Llama-3.3-70B Versatile.
- **OpenRouter**: DeepSeek-R1, Claude 3.5 Sonnet, GPT-4o.
- **Custom OpenAI-Compatible Endpoints**: LM Studio, LocalAI, vLLM, Ollama.
- **On-Device Local Engine**: Air-gapped offline inference.

### 5.3 Air-Gapped / On-Device Local LLM
`onDeviceLLM.ts` provides 100% offline intelligence for developers working without internet access:
- Executes quantized GGUF weights directly on the mobile device hardware (via NPU/GPU/CPU acceleration).
- Implements prompt templates structured for zero-shot code repair and architectural analysis.

### 5.4 Smart Action Chips & Unit Test Synthesizer
Inside `result.tsx`, one-tap action chips enhance the debugging workflow:
- **Generate Unit Test**: Produces a regression test case tailored to `pytest`, `jest`, `vitest`, or `unittest`.
- **Write Test File to Laptop**: The phone automatically synthesizes the test file, writes it to the workstation workspace, executes the test suite, and streams the pass/fail results back to mobile.
- **Security Audit**: Scans for SQL injection, XSS vulnerabilities, prototype pollution, and memory leaks.
- **Big-O Performance Profiler**: Computes algorithmic time and space complexity before and after the fix.
- **Explain for Junior Dev**: Formats the explanation using intuitive real-world metaphors.

### 5.5 Codebase Architecture & Health Studio (`devqr arch`)
Run `devqr arch` on your laptop to inspect the full system architecture on your phone:
- System Architecture Blueprint & Pattern Classification (e.g. Clean Architecture, MVC, Microservices).
- Module Responsibility Hierarchy.
- End-to-End Request & Data Flow Pipeline.
- Dead Code, Circular Dependencies & Unused Imports.
- Maintainability Scorecard (`Grade: A/B/C`) and Technical Debt Hours calculation.

### 5.6 AI App & File Synthesizer (`devqr gen`)
Run `devqr gen` inside an empty folder to create new projects on mobile:
- Choose from preset templates (FastAPI Microservice, CLI Todo Manager, Terminal Game, etc.) or write custom prompts.
- AI generates complete, production-ready source code.
- Tap **`[ PUSH & OPEN IN IDE ]`** to write files to your workstation and open them in VS Code.
- Tap **`[ RUN ON LAPTOP ]`** to execute scripts live and monitor output.

### 5.7 Remote Interactive PTY Terminal Client
`terminal.tsx` provides a mobile terminal interface:
- Virtual keyboard accessory bar: `ESC`, `TAB`, `CTRL+C`, `CTRL+D`, `UP`, `DOWN`, `LEFT`, `RIGHT`.
- ANSI color rendering for full terminal UI fidelity (colored test runners, htop, etc.).

### 5.8 Executive PDF Audit & Post-Mortem Exporters
`pdfExporter.ts` transforms debugging and architectural sessions into publication-grade A4 PDF documents:
1. **Architecture Technical Audit PDF**: Contains system blueprints, maintainability scorecards, and dependency breakdowns.
2. **Incident Post-Mortem PDF**: Formats incident error traces, root-cause analyses, unified diffs, and remediation checklists.
3. Automatically opens the native OS Share Sheet (AirDrop, Email, Slack, WhatsApp, Google Drive).

### 5.9 Encrypted Offline SQLite Persistence
`sqliteStorage.ts` indexes all sessions locally on the device using SQLite:
- Full search across error messages, file names, and timestamps.
- Star, tag, or export past debugging sessions without internet connection.

---

## 6. Communication Protocols & API Specification

### 6.1 QR Code Wire Payload Format
The QR payload follows this structure:

```typescript
interface DevQRWirePayload {
  v: number;            // Version (e.g. 2)
  type: 'error' | 'arch' | 'gen' | 'term';
  e?: {                 // Error Context
    message: string;
    type: string;
    file: string;
    line: number;
    stack: string;
    codeContext: string;
  };
  f?: Array<{           // Modified Files & Diff Context
    path: string;
    content: string;
  }>;
  g?: {                 // Git Context
    branch: string;
    lastCommit: string;
    diff: string;
  };
  b?: string;           // Bridge LAN URL (e.g. "http://192.168.1.50:8765")
  k?: string;           // Authentication Token
}
```

### 6.2 Bridge HTTP / RPC Endpoints

| Method | Route | Payload | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/status` | — | Verifies bridge server health and returns workspace path |
| `POST` | `/patch` | `{ files: [{ path, content }], token }` | Atomically applies patches and creates `.devqr.bak` backups |
| `POST` | `/undo` | `{ files: string[], token }` | Restores files from `.devqr.bak` snapshot |
| `POST` | `/run` | `{ command: string, token }` | Runs shell command on workstation and returns stdout/stderr |
| `POST` | `/focus-ide` | `{ file: string, line: number, token }` | Dispatches cursor jump command to VS Code / Cursor |
| `POST` | `/write-file`| `{ path: string, content: string, token }` | Writes newly synthesized files or unit tests |
| `GET` | `/tree` | `?token=...` | Returns repository file tree and AST metadata |

### 6.3 WebSocket Terminal Stream Protocol
- **Endpoint**: `ws://<laptop-ip>:8765/terminal?token=<token>`
- **Client to Server**: Raw input string / keystrokes (e.g. `"ls -la\r"`, `"\x03"` for `Ctrl+C`).
- **Server to Client**: Raw ANSI terminal stream output.

---

## 7. Security & Privacy Architecture

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                     SECURITY PRINCIPLES                     │
 ├─────────────────────────────────────────────────────────────┤
 │ 1. Zero Cloud Intermediary (P2P Local Wi-Fi Only)          │
 │ 2. In-Flight Secret & Credential Redaction                 │
 │ 3. Cryptographic Session Token Verification on Bridge       │
 │ 4. Automatic Pre-Patch .devqr.bak Snapshots & Rollbacks    │
 │ 5. Local Encrypted SQLite Device Vault                      │
 └─────────────────────────────────────────────────────────────┘
```

1. **No External Telemetry**: No user code or telemetry is logged to third-party servers.
2. **Strict Local Network Binding**: The bridge server operates solely within the user's private LAN / Wi-Fi subnet.
3. **Session Authentication Tokens**: Every bridge session generates a random alphanumeric token embedded in the QR code. RPC requests without valid tokens are rejected with `401 Unauthorized`.
4. **Non-Destructive Patching**: Every file write is preceded by a snapshot. A one-click revert is always available.

---

## 8. CLI Command Reference

| Command | Options | Description |
| :--- | :--- | :--- |
| `devqr` | `[-p, --port <number>]` | Scans current directory for latest error / git diff and renders QR |
| `devqr -i` | — | Interactive Mode: Select modified files, input error notes, review redactions |
| `devqr arch` | — | Codebase Architecture Studio: Scans AST and renders Architecture QR |
| `devqr gen` | `[directory]` | AI App Synthesizer: Launches empty-folder app generator studio |
| `devqr term` | `[-p, --port <number>]` | Standalone Remote Terminal: Launches PTY server and terminal QR |
| `devqr run "<cmd>"` | — | Runs command; if it exits with non-zero status, auto-launches DevQR |
| `devqr --watch` | — | Watcher Mode: Continuously monitors project for test/build errors |

---

## 9. Build, Installation & Deployment Guide

### 9.1 Workstation CLI Setup

```bash
# Clone the repository
git clone https://github.com/Devikumar143/devqr.git
cd devqr/cli

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Link globally for system-wide access
npm link
```

Verify installation:
```bash
devqr --help
```

### 9.2 Mobile App Setup (Expo)

```bash
cd devqr/mobile

# Install dependencies
npm install

# Start the Expo development server
npx expo start
```

Scan the Metro QR code using the **Expo Go** app on Android or iOS.

### 9.3 Standalone Android APK Build (GitHub Actions)

DevQR is configured with a fully automated CI/CD pipeline in [`.github/workflows/build-apk.yml`](file:///d:/devqr/.github/workflows/build-apk.yml).

- Every push or pull request to `main` triggers a complete standalone release APK build.
- To download the compiled `.apk`:
  1. Go to the [DevQR GitHub Actions Page](https://github.com/Devikumar143/devqr/actions).
  2. Click on the latest workflow run.
  3. Under **Artifacts**, download `devqr-android-apk`.
