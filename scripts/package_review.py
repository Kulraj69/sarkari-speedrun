"""Create/verify a local source review ZIP; never an official submission payload.

Only named project files and source extensions are read. Environment files,
credentials, media, dependencies and git history are outside the allowlist.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import zipfile

ROOT_FILES = frozenset({
    'AGENTS.md', 'LICENSE', 'README.md', 'REVIEW.md', 'STATUS.md',
    'components.json', 'demo-script.md', 'eslint.config.mjs', 'next.config.ts',
    'package-lock.json', 'package.json', 'render.yaml', 'submission-draft.md',
    'tsconfig.json', 'vercel.json', 'vitest.config.ts',
})
TREES = {
    'src': {'.ts', '.tsx', '.css', '.md', '.svg', '.ico'},
    'public': {'.svg', '.ico', '.png'},
    'tests': {'.ts', '.py'},
    'scripts': {'.ts', '.py'},
    'docs': {'.md'},
}
MANIFEST = 'REVIEW-INVENTORY.json'
MAX_FILE = 8 * 1024 * 1024
MAX_TOTAL = 16 * 1024 * 1024
MAX_FILES = 512
EXTRA_FILES = frozenset({'src/styles/SHADCN-LICENSE.txt'})


def allowed(name):
    path = PurePosixPath(name)
    parts = path.parts
    if not parts or str(path) != name or '\\' in name or path.is_absolute():
        return False
    if any(p.startswith('.') or p.lower() in {
        'secrets', 'credentials', 'node_modules', '__pycache__', 'uploads',
    } for p in parts):
        return False
    return name in ROOT_FILES or name in EXTRA_FILES or (
        len(parts) > 1 and parts[0] in TREES
        and path.suffix in TREES[parts[0]]
        and not any(s in path.stem.lower() for s in ('secret', 'credential', 'token', 'password'))
    )


def collect(root):
    root = Path(root)
    if root.is_symlink() or not root.is_dir():
        raise ValueError('Source must be a real directory')
    payload = {}

    def add(path):
        name = path.relative_to(root).as_posix()
        if not allowed(name):
            return
        if path.is_symlink() or not path.is_file():
            raise ValueError('Allowlisted source must be a regular file')
        if path.stat().st_size > MAX_FILE:
            raise ValueError('Source file too large')
        with path.open('rb') as handle:
            data = handle.read(MAX_FILE + 1)
        payload[name] = data
        if len(data) > MAX_FILE or sum(map(len, payload.values())) > MAX_TOTAL or len(payload) > MAX_FILES:
            raise ValueError('Source exceeds review limits')

    visited = 0

    def walk(directory, depth=0):
        nonlocal visited
        if depth > 24:
            raise ValueError('Source tree too deep')
        for path in directory.iterdir():
            visited += 1
            if visited > 4096:
                raise ValueError('Source tree has too many entries')
            if path.name.startswith('.') or path.name in {'node_modules', '__pycache__', 'secrets', 'credentials', 'uploads'}:
                continue
            if path.is_symlink():
                raise ValueError('Symlinks are not allowed in source trees')
            if path.is_dir():
                walk(path, depth + 1)
            else:
                add(path)

    for name in sorted(ROOT_FILES):
        path = root / name
        if path.exists() or path.is_symlink():
            add(path)
    for name in TREES:
        directory = root / name
        if directory.is_symlink():
            raise ValueError('Symlinked source tree')
        if directory.is_dir():
            walk(directory)
    if not {'README.md', 'package.json', 'package-lock.json', 'LICENSE'} <= payload.keys():
        raise ValueError('Required review files missing')
    return dict(sorted(payload.items()))


def inventory(payload):
    return {
        'format': 'sarkari-local-review-v1',
        'scope': 'Local uncommitted source snapshot; not published or submitted. No live-provider proof.',
        'files': [
            {'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
            for name, data in sorted(payload.items())
        ],
    }


def verify(archive):
    with zipfile.ZipFile(archive) as z:
        entries = z.infolist()
        names = [entry.filename for entry in entries]
        if len(names) != len(set(names)) or len(names) > MAX_FILES + 1 or names.count(MANIFEST) != 1:
            raise ValueError('Invalid archive inventory')
        if sum(entry.file_size for entry in entries) > MAX_TOTAL + MAX_FILE:
            raise ValueError('Archive too large')
        for entry in entries:
            if entry.filename != MANIFEST and not allowed(entry.filename):
                raise ValueError('Unapproved archive path')
            if entry.file_size > MAX_FILE or not stat.S_ISREG(entry.external_attr >> 16):
                raise ValueError('Invalid archive member')
        payload = {name: z.read(name) for name in names if name != MANIFEST}
        if not {'README.md', 'package.json', 'package-lock.json', 'LICENSE'} <= payload.keys():
            raise ValueError('Required review files missing')
        if sum(map(len, payload.values())) > MAX_TOTAL:
            raise ValueError('Payload too large')
        if json.loads(z.read(MANIFEST)) != inventory(payload):
            raise ValueError('Inventory mismatch')
        return inventory(payload)


def package(root, output):
    payload = collect(root)
    payload[MANIFEST] = (json.dumps(inventory(payload), indent=2) + '\n').encode()
    # Exclusive creation: never replace an existing artifact or follow its link.
    with Path(output).open('xb') as handle:
        try:
            with zipfile.ZipFile(handle, 'w', compression=zipfile.ZIP_DEFLATED) as z:
                for name, data in sorted(payload.items()):
                    info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
                    info.create_system = 3
                    info.external_attr = (stat.S_IFREG | 0o644) << 16
                    info.compress_type = zipfile.ZIP_DEFLATED
                    z.writestr(info, data)
            handle.flush()
            return verify(output)
        except BaseException:
            Path(output).unlink(missing_ok=True)
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--verify', type=Path)
    args = parser.parse_args()
    if args.verify and not args.source and not args.output:
        result = verify(args.verify)
    elif args.source and args.output and not args.verify:
        result = package(args.source, args.output)
    else:
        parser.error('Use --source DIR --output ZIP, or --verify ZIP')
    print(json.dumps({'files': len(result['files']), 'verification': 'passed', 'format': result['format']}))


if __name__ == '__main__':
    main()
