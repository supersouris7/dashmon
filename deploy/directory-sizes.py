#!/usr/bin/env python3
"""Measure explicitly selected directories and publish a Dashmon report."""
import argparse
import json
import os
import subprocess
import tempfile
import time


def measure(directory):
    if not os.path.isabs(directory) or not os.path.isdir(directory):
        return {"path": directory, "bytes": None, "error": "invalid_directory"}
    try:
        result = subprocess.run(
            ["du", "-s", "-B1", "--", directory],
            capture_output=True, text=True, timeout=300, check=True,
        )
        return {"path": directory, "bytes": int(result.stdout.split()[0]), "error": ""}
    except (subprocess.SubprocessError, ValueError, IndexError, OSError):
        return {"path": directory, "bytes": None, "error": "measurement_failed"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", default="dashmon")
    parser.add_argument("--output", help="Write a local report instead of copying into Docker")
    parser.add_argument("directories", nargs="+")
    args = parser.parse_args()
    if len(args.directories) > 50:
        parser.error("At most 50 directories are supported")
    report = json.dumps({"updatedAt": int(time.time()),
                         "directories": [measure(p) for p in dict.fromkeys(args.directories)]})
    if args.output:
        target = os.path.abspath(args.output)
        fd, temporary = tempfile.mkstemp(dir=os.path.dirname(target))
        try:
            with os.fdopen(fd, "w") as stream:
                stream.write(report)
            os.chmod(temporary, 0o644)
            os.replace(temporary, target)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    else:
        subprocess.run(
            ["docker", "exec", "-i", args.container, "sh", "-c",
             "umask 022; cat > /app/data/directory-sizes.json.tmp && "
             "mv /app/data/directory-sizes.json.tmp /app/data/directory-sizes.json"],
            input=report, text=True, check=True,
        )


if __name__ == "__main__":
    main()
