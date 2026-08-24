#!/usr/bin/env python3
"""
Persistent launcher for `bun run dev`.
Uses double-fork to fully detach from the bash tool process tree
so the dev server survives after the tool returns.
"""
import os
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path("/home/z/my-project")
LOG_FILE = PROJECT_ROOT / "dev.log"
PID_FILE = PROJECT_ROOT / "dev.pid"


def is_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def find_dev_server() -> int | None:
    if PID_FILE.exists():
        try:
            pid = int(PID_FILE.read_text().strip())
            if is_running(pid):
                return pid
        except (ValueError, OSError):
            pass
    return None


def start() -> int:
    log_fd = os.open(str(LOG_FILE), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)

    if os.fork() > 0:
        time.sleep(1)
        if PID_FILE.exists():
            pid = int(PID_FILE.read_text().strip())
            print(f"DEV_SERVER_PID={pid}")
        return 0

    os.setsid()

    if os.fork() > 0:
        os._exit(0)

    os.dup2(log_fd, 0)
    os.dup2(log_fd, 1)
    os.dup2(log_fd, 2)
    os.close(log_fd)

    pid = os.getpid()
    PID_FILE.write_text(str(pid))

    os.execvp("bun", ["bun", "run", "dev"])


def main() -> int:
    existing = find_dev_server()
    if existing:
        print(f"DEV_SERVER_PID={existing} (already running)")
        return 0
    rc = start()
    time.sleep(2)
    pid = find_dev_server()
    if pid:
        print(f"DEV_SERVER_PID={pid} (newly started)")
    return rc


if __name__ == "__main__":
    sys.exit(main())
