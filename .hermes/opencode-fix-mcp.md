Task: Fix MCP server persistent connection — 66 tools, won't stay alive

Repository:
C:\Users\User\AppData\Local\hermes\systems\directive-kernel

Primary specs:
- hosts/mcp-host/cli.ts (MCP server entry point)
- hosts/mcp-host/server.ts (stdio transport)
- hosts/mcp-host/tool-registry.ts (tool registry builder)
- The MCP server starts, connects, discovers 66 tools, but exits immediately after the client disconnects

Allowed files:
- hosts/mcp-host/server.ts
- hosts/mcp-host/cli.ts

Forbidden:
- Do not modify files outside the allowed list.
- Do not change the tool registry or executor modules.
- Do not change how tools are registered or discovered.
- Do not change the launcher script at ~/hermes/scripts/dk-mcp-server.sh.
- Do not modify the web host, standalone host, or any kernel logic.

Required implementation:
1. In server.ts, make the MCP server survive client disconnection and reconnection:
   - After creating the StdioServerTransport, the server should stay alive even when the client disconnects
   - Use a keep-alive mechanism: when the transport closes, wait and recreate it
   - The server should listen for SIGTERM/SIGINT to shut down cleanly, not exit on transport close
   - The process lock must be acquired once on startup and released only on shutdown, not on transport close

2. In cli.ts, ensure --directive-root validation happens before server creation:
   - Validate the path exists before starting the server
   - Print clear error messages on exit
   - Exit code 1 for invalid args, exit code 0 for clean shutdown

3. The server must:
   - Start once, stay alive across multiple client connections
   - Re-accept new transport connections after disconnection  
   - Log connection/disconnection events to stderr
   - Not hold stale state between connections (re-read the tool registry on each new connection)

Required command:
pnpm run typecheck

Self-check before final:
| Check | Pass/Fail | Evidence |
| --- | --- | --- |
| Server stays alive after client disconnection | | |
| Server accepts reconnection within 5 seconds | | |
| Server shuts down cleanly on SIGTERM | | |
| 66 tools discovered on first connection | | |
| 66 tools discovered on reconnection | | |
| Lock released only on shutdown, not on disconnect | | |
| CLI rejects missing --directive-root | | |
| CLI rejects non-existent path | | |
| pnpm run typecheck passes | | |

Final report must include:
1. Files changed
2. Exact changes made (with line numbers)
3. pnpm run typecheck result
4. Self-check table
5. How to verify: `hermes mcp test directive-kernel` twice in a row without "Connection closed" between calls
6. Anything not completed and why
