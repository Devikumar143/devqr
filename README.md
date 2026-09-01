# DevQR - Laptop Errors. Phone Intelligence.

> **Turn any laptop error into a portable debugging session on your phone.**  
> *No DevQR cloud backend. Your debugging session belongs to you.*

📖 **[Read the Full Technical Documentation & Architecture Guide (DOCUMENTATION.md)](./DOCUMENTATION.md)**

---

## Architecture Overview

DevQR consists of **two standalone components** with **zero DevQR backend**:

```text
                 DEVQR
                    │
          ┌─────────┴─────────┐
          │                   │
      DevQR CLI           DevQR Mobile
          │                   │ (Expo / React Native)
   Collect context        Scan QR
          │                   │
   Sanitize data          SQLite Local Storage
          │                   │
   Create bundle          AI Engine (Gemini / Groq / OpenRouter)
          │                   │
      Terminal QR       ┌─────┴─────────────────────────┐
          │              │ Unit Tests & Security Audit   │
          │              │ Big-O Complexity Profiler     │
          │              │ [ 1-Click Auto-Fix ]          │
          │              │ [ Undo / Revert Patch ]       │
          │              │ [ Run Test on Laptop ]        │
          │              └───────────────────────────────┘
          │                              │
      LAN Bridge <───────────────────────┘
```

---

## 1. Interactive CLI Context Picker (`devqr -i`)

Run `devqr -i` for an interactive terminal arrow-key menu:
- Select which modified Git files to include in the QR bundle.
- Enter custom error descriptions or inspect logs.
- Confirm secret sanitization.

```bash
# Launch interactive mode
devqr -i
```

---

## 2. Mobile Smart Action Chips

Inside **DevQR Mobile**, tap any of the smart chips below the AI diagnosis:

- **"Generate Unit Test"**: Creates a tailored regression test case to ensure the bug never happens again.
- **"Security Audit"**: Scans the code diff for SQL injection, XSS, prototype pollution, and memory leaks.
- **"Performance Impact"**: Analyzes time and space complexity of the fix.
- **"Explain for Junior Dev"**: Generates a beginner-friendly breakdown with analogies.

---

## 3. Real-Time 1-Click Auto-Fix & Remote Verification

1. Run `devqr -i` or `devqr` on your laptop.
2. Scan the terminal QR code with **DevQR Mobile**.
3. Tap **`[ 1-CLICK AUTO FIX (ON LAPTOP) ]`**.
4. Your laptop catches the signal over local Wi-Fi, creates an automatic `.devqr.bak` snapshot, and patches your code in real time.
5. Tap **`[ Run & Verify on Laptop ]`** to execute your script live from your phone screen, or **`[ Undo / Revert ]`** to instantly restore the original file!

---

## 4. IDE Remote Cursor Beacon (VS Code / Cursor Jump)

Tap **`[ Focus in IDE ]`** or tap any line in the code diff on your phone screen:
- Your phone fires an IDE beacon signal over the local bridge.
- Your laptop instantly jumps the active cursor in VS Code, Cursor, or Neovim directly to the exact file and line number in real time!

---

## 5. Code Architecture & Health Studio (`devqr arch`)

```text
Git Repository
      ↓
Repository Scanner (CLI)
      ↓
Code Structure & Import AST
      ↓
Dependency Graph & Module Tree
      ↓
Local / Cloud AI Engine (Mobile)
      ↓
┌──────────────────────────────────────────┐
│ Architecture Pattern & System Blueprint  │
│ File Responsibilities & Module Hierarchy │
│ End-to-End Request & Data Flow Pipeline  │
│ Dependency Graph & Circular Imports      │
│ Dead Code & Unused Modules               │
│ Duplicate Logic & Antipatterns           │
│ Security & Vulnerability Hotspots        │
│ Technical Debt Score & Debt Hours        │
└──────────────────────────────────────────┘
```

Run `devqr arch` in your project root to scan your codebase AST and explore the full architectural blueprint, file responsibilities, data flow, and dead code auditor directly on your mobile screen.

---

## 6. Automated Regression Test File Synthesizer

1. When viewing an AI Diagnosis on **DevQR Mobile**, tap **`[ Write Test File to Laptop ]`**.
2. DevQR synthesizes a production-ready regression unit test file tailored to your language and framework (`pytest`, `unittest`, `jest`, `vitest`).
3. Over local Wi-Fi, the laptop writes the new test file directly into your workspace test suite and immediately executes the test suite.
4. Live pass/fail status, execution duration, and stdout/stderr are streamed directly to your mobile screen.
5. Tap **`[ Focus in IDE ]`** to open the new test file in your laptop editor!

---

## 7. Executive Technical Audit PDF Export

In the **Architecture Studio (`/arch`)**, tap **`[ Export Architecture PDF ]`** (or the top **`PDF`** action):
- Generates a styled A4 PDF technical audit document containing:
  - System Architecture Blueprint & Pattern Description.
  - Maintainability Grade (`Grade: A`), Scorecard, and Estimated Debt Hours.
  - Formatted Module Responsibilities Table.
  - Numbered End-to-End Data Flow Pipeline.
  - Dead Code & Security Vulnerabilities Breakdown.
- Instantly opens the native system share sheet to send the PDF via AirDrop, Email, Slack, WhatsApp, or save to files.

---

## 8. Incident Post-Mortem PDF Export

On the **AI Diagnosis (`/result`)** screen, under the **INCIDENT POST-MORTEM** card, tap **`[ Export Post-Mortem PDF ]`** (or the top **`PDF`** pill):
- Generates a publication-grade Incident Remediation PDF report containing:
  - Incident Error Message & Timestamp.
  - Root Cause Deep-Dive Analysis.
  - Algorithmic Big-O Performance & Memory Impact.
  - Surgical Code Patch Diff (syntax-highlighted).
  - Verification Command & Action Items Checklist.
- Automatically opens the native system share sheet for sharing with leads, managers, and post-mortem repositories.

---

## 9. Multi-File Atomic Batch Patcher

When a bug or refactoring spans multiple files (e.g. `types.ts`, `api.ts`, and `index.tsx`):
- **Interactive Multi-File Tabs**: Tab through each modified file directly on mobile to inspect individual unified diffs, original files, and patched files.
- **`[ Focus in IDE ]` per File**: Jump VS Code / Cursor cursor to each specific target file and line.
- **1-Click Atomic Batch Fix**: Tap **`[ 1-CLICK BATCH FIX (N FILES) ]`** to apply all surgical file patches simultaneously in a single atomic transaction.
- **Automatic Rollback Protection**: If any file fails to patch cleanly, all previously modified files are automatically reverted.
- **1-Tap Unified Rollback**: Tap **`[ Undo / Revert ]`** to restore all modified files to their original `.devqr.bak` state simultaneously.

---

## 10. AI App & File Studio (`devqr gen` / `devqr new`)

Run `devqr gen` or `devqr new` inside any custom, new, or empty folder on your laptop:

```bash
# In any folder on your laptop:
mkdir my-python-game
cd my-python-game

# Launch AI App Studio QR
devqr gen
```

1. **Scan Terminal QR**: Point **DevQR Mobile** at the generated terminal QR code.
2. **Specify Requirements on Phone**:
   - Describe what you want to build (e.g. *"Create a Python number guessing game with 3 difficulty levels, leaderboard, and colored CLI output"*).
   - Or select from presets (*Number Guessing Game*, *CLI Todo Manager*, *FastAPI Microservice*, *Terminal Snake Game*, *CSV Analyzer*).
3. **AI Synthesizes Complete Code**: Generates full production code with auto-detected filenames.
4. **Push to IDE & Run**:
   - Tap **`[ PUSH & OPEN IN IDE ]`**: Automatically writes the file into your laptop folder and opens it inside **VS Code** / **Cursor**.
   - Tap **`[ RUN ON LAPTOP ]`**: Executes `python <file>.py` or `node <file>.js` live on your laptop and streams terminal results to your phone screen!
