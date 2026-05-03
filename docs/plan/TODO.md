## TODO 
- when user clicks off of chat they're now focused on the file they clicked out of. agent chat client sits waiting for them
- focus is generally all over the place. when agent panel shows all direction drifts back to it.
- the focus includes diff chunks instead of full diffs. if we only changed a line we just show the part that changed. this is generally part of better focus.
- if we open a new folder at the bottom of the explorer the next folder is also at the bottom of its list. focus needs to snap back to top of opened folder.
- Ctrl+S key doesn't work. Imagine Ctrl+V won't work either. We need to completely hijack vscode keyboard patterns.
- right click in editor is monaco-ified goodness so that's good. we want more of that everywhere.
- right click in file explorer is standard firefox/browser right click interface, same as terminal. we override right click everywhere in same way we take control of keyboard shortcuts is the plan
- terminal has some sporadic issues but seems to be working now
- ~~word wrap~~
- we need a monaco style syntax highlighting interface for the input to the agent in the client. right now it's a single bar of text area and it does not show up in chat above
- If you're typing something and click away from agent what you're typing disappears. what I'm trying to say is we need a document model for the text we're tying that hasn't been sent to session/prompt yet
- chat is not scrollable and cannot be unfocused/unselected from while it is open. neither of these is unacceptable
- an ACP client input interface needs to be able to handle all sorts of pasted information from the user that they might drag and drop. zed handles all of this with ease and so shall we. this means encoding session/prompt from the user's input in an appropriately structured was and displaying syntax highlighting for markdown with some wysiwyg-ish/codemirror6 features for images the user pastes, file selections, etcetera. study zed for this, which does something very similar. context @-mentions 
- following the agent capability to have editor focus on the files and locations the agent is editing (and we need to keep track of our own )
- tone down intellisense for markdown files to lower level, less hands on spell checking and grammar detection. Don't like it.
- move left side bar that open explorer to right side where explorer opens
- enable more than one terminal being open (tab terminal section)
- enable more than one chat being open (it should be able to be resized and dragged/dropped into the main editor window)
- enable letting everything be resizeable by dragging boundaries between regions.
- Make UX/UI look more professional and more similar to vscode
- Iterate on features of Zed ACP Chat if this wasn't abundantly clear
- Expose a service endpoint for an MCP server/tool to communicate with other agents through the rust backend. they should be able to session/prompt and session/cancel through the ACP client via API call. also an endpoint that says which agent are active/inactive (currently responding), so I guess we'll need some way of saying "user closed this agent manually it is no longer active" like a active session-id cache or something. seeing agent actions is not needed because they all share common sqlite database, but they need to be able to know who to talk to and how to tell them to do stuff or cancel/stop. <- realizing this isn't a wish list item. this was the entire point of building my own client
- make tool responses that show images render image preview in the chat
- go ahead and make custom tool fixtures for playwright tools mcp server. it's basically built in/required at this point. why we're building a web application and not a desktop UI. playwright MCP.
- build tests with playwright not the MCP that use agent to evaluate the tests (once we know pattern for testing features we can build a script that runs and then at the end says for a vision enabled crow-cli instance to review output and write score with specific format in specific file location) so we can automate the ad hoc automation fully for better testing patterns in the future

## Wish List

### Spec kit
Create some kind of spec-kit like workflow where the user chats with agent to create specs and then a set of agents with possibly different tools iterates over them and pass messages about what to do and how done they are with the plan between orchestrating agent and the agents up and down stream from them. iterates over a plan. frequent validation/verification. specialized agents/prompts for reviewing output. spec kit but for a create quick and dirty end2end and evals before handing off control to agent to iterate repeatedly.

Able to use spec-kit like system for orchestrating workflows to design in the UI your own agent wikis using different data stores and set up chron for agents that are set to search for new interests of user and how they integrate with current projects, newsletter writing agents for your specific interests that have both purely internal LLM documentation and human authored/centered wikis. agents as research assistants and writing tools stuff. AI scientist builder basically. 


### Fallback models
some kind of meta value in end_turn when the LLM provider hits limit so we can fall back to local model, though tbh I plan to try to use local model for bookkeeping and running through evals

### Journaling Tool
Integrate with a logseq/dendron/obsidian style notekeeping system that integrates with atproto and semantic search through embeddings, have the frontend of this be murder and be able to view LLM wikis

- Docker plugin
- Full transparency on agent server control, an agent server control pane where you spin them up and send them messages, place to refresh connections. Basically try to make it to where user never feels need to do restart because eventually this is going to be a server running in the web and that will be a pain. so a place to diagnose why agents and clients might not be talking to each other/debug that instead of punting hoping restart will fix (it's a web app!)


# BUGS 

#### worktree panic
Was trying to open a workspace and this happend on backend
```
thomas@coast-after-2:~/src/crow-ai/murder-sidex/murder-ide$ ./target/release/murder-server

thread 'tokio-rt-worker' (279251) panicked at backend/crates/murder-workspace/src/worktree_state.rs:120:10:
called `Result::unwrap()` on an `Err` value: Watcher(Error { kind: MaxFilesWatch, paths: ["/home/thomas/src/crow-ai/logseq/packages/ui/node_modules/.pnpm/@radix-ui+react-slot@1.2.4_@types+react@18.3.1_react@18.3.1/node_modules/@radix-ui/react-slot/dist"] })
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
Aborted (core dumped)
```
Proposed fix from gemini:
This is a classic Linux systems programming rite of passage.
```
The Cause: Linux has a kernel-level limit on how many files a single user can watch using inotify. By default, this is usually around 8,192 or 65,536. You pointed your Rust file watcher at a directory containing node_modules, which instantly blew past the OS limit, returned an Err, and because the code called .unwrap(), it panicked the entire Tokio worker thread and crashed the server.

The Quick OS Fix (The Band-Aid): You need to increase your kernel's watch limit. Run this in your terminal: sudo sysctl fs.inotify.max_user_watches=524288. (To make it permanent, add fs.inotify.max_user_watches=524288 to /etc/sysctl.conf).

The Real Architecture Fix: You cannot .unwrap() a file watcher result in a production backend. You need to handle the Err gracefully so the server stays alive. More importantly, your workspace initialization logic must implement an ignore list. You need to read the .gitignore file (or hardcode exceptions) and explicitly tell the notify crate not to traverse into node_modules, .git, or target directories.
```
