#!/usr/bin/env python3
"""The fast lane's prompt checks, against a built Dot binary (never the installed one's config: --prompt reads the
config without writing it back).

    scripts/test_job_prompts.py [path/to/Dot]      default: .build/debug/Dot, else build/Dot.app/Contents/MacOS/Dot

- `--prompt talk --jobs off` is the old talk prompt: none of the jobs lines, all of the old doing lines;
- `--prompt talk --jobs on` has every jobs line and none of the replaced ones;
- `--prompt job` is under 6000 characters and carries the CLAUDE.md override line, the blocked: ending and the
  PROFILE.md line for his own details in a form.
"""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

OLD = [
    "a [do] line: he asked for something to be done, not explained.",
    "dot then drives it one step at a time with your rings",
    "goes to an agent with [AGENT:...] and the words",
    "that goes through an agent and his yes.",
    "an agent is for work that takes a while or touches his files",
    "opening, finding, scrolling and a few clicks on what is in front are yours, never an agent's.",
]
NEW = [
    "dot does it as a job: write [GO:",
    "[GO:goal] starts a job: dot does it step by step itself with no step or time limit",
    "a jobs line: what dot is doing itself right now",
    "never [AGENT] or [NEW_AGENT] unless he said agent",
    "dot takes it over as a job; you don't ring more steps.",
    "is a job: [GO:research <the question> with the research skill",
    "a send goes through a job ([GO]) and his yes on dot's card.",
]


def prompt(binary, *args):
    return subprocess.run([binary, "--prompt", *args], capture_output=True, text=True, check=True).stdout


def main():
    binary = sys.argv[1] if len(sys.argv) > 1 else next(
        (p for p in [os.path.join(ROOT, ".build/debug/Dot"), os.path.join(ROOT, "build/Dot.app/Contents/MacOS/Dot")] if os.path.exists(p)), None)
    if not binary:
        print("no Dot binary; swift build first")
        return 2
    failures = []
    off = prompt(binary, "talk", "--jobs", "off")
    on = prompt(binary, "talk", "--jobs", "on")
    job = prompt(binary, "job")
    for line in OLD:
        if line not in off: failures.append(f"flag off lacks the old line: {line}")
        if line in on: failures.append(f"flag on still has: {line}")
    for line in NEW:
        if line in off: failures.append(f"flag off has a jobs line: {line}")
        if line not in on: failures.append(f"flag on lacks: {line}")
    if len(job) >= 6000: failures.append(f"job prompt is {len(job)} chars (limit 6000)")
    for line in ["his CLAUDE.md's browser and texting routes don't apply", 'end with one sentence starting "blocked:"',
                 "never hand it to an agent", "waiting for your yes on the card",
                 "read ~/Dot/jobs/PROFILE.md", "never type a password, an id number or payment details. submit stays his."]:
        if line not in job: failures.append(f"job prompt lacks: {line}")
    print(f"talk off {len(off)} chars, talk on {len(on)} chars, job {len(job)} chars")
    for f in failures: print("FAIL", f)
    print("ok" if not failures else f"{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
