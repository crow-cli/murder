# planning document
A place to keep more than a TODO list but a set of priorities and approach for the TODO list items. A plan instead of just reacting to shifting priorities and bugs we encounter (those those are critical and should be fixed when encountered)

# TODO Files
- **IDE features**: `ide/TODO.md` — visual/layout parity, editor, explorer, terminal, keyboard/focus
- **ACP client**: `acp_client/TODO.md` — chat panel, agent integration, MCP endpoints

# STRATEGY
1. **IDE first** — Achieve side-by-side parity with the VSCode server at `localhost:9888`. The VSCode server is the reference for UI/UX, layout, interactions.
2. **ACP second** — Agent chat is a dockable panel inside the IDE. It does NOT dictate IDE architecture.
3. **Zed patterns for chat** — Open tool call accordions, streaming content visible, not collapsed.
4. **DO NOT copy VSCode ACP client** — Their tool calling UX is bad (closed accordions, grouped together, bare iframe). Use VSCode server for IDE patterns, Zed for chat patterns.

# PLAN
- keep working on UI/UX improvements to frontend
- add necessary functionality to backend to support new frontend features and improvements
- add service endpoint to murder backend for agent orchestration through session/prompt and session/cancel
- create evaluations where we have a version of vscode web app open for playwright browser tools to interact with target/ground truth web app IDE
- use early hand crafted version of iterative refinement loop inside murder to iteratively improve murder based on plan and evaluation/improvement loops
- use [local vscode server](http://localhost:9888?tkn=bbdc3117-57f8-49b5-abb6-ecc275fffdf0) to work with running version of vscode server and ACP client. The ACP Client code is [here](/home/thomas/src/crow-ai/murder-sidex/vscode-acp) so we can pull things out of a working ACP Client that we might need. This implementation lacks several things we need but has other things we lack, namely being inside a fully functional IDE, so yeah we have a target/reference example. But we want to build a fully functional IDE inside our multiple ACP Client Orchestrator/IDE. So do NOT COPY ANYTHING ABOUT WHAT THEY DO WITH TOOL CALLING. Their accordians are all closed and group together, which feels insane to me. We want to use zed's agent patterns and have the above server for reference in terms of frontend UI/UX and how it connects back to murder-ide
