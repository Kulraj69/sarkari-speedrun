# Local source handoff

This ZIP is for reviewing the current local code, including uncommitted fixes. It is not a Devpost upload format, public release, signed attestation or evidence of live sponsor use. The public repository and deployment may differ.

From the supplied source root, with Python 3.10+:

```bash
python -m unittest discover -s tests -p 'test_package_review.py' -v
python scripts/package_review.py --source . --output ../sarkari-review.zip
python scripts/package_review.py --verify ../sarkari-review.zip
```

The last command prints `verification: passed` and the number of source files. That verifies inventory integrity, not whether the application builds. An existing output is never overwritten. Repeat with a different output name: unchanged input produces identical bytes with the same Python/zlib toolchain. Cross-toolchain byte identity is not guaranteed. The archive contains REVIEW-INVENTORY.json with sizes and SHA-256 hashes. This detects accidental changes, not a malicious replacement of both source and inventory. Inspect the producer script before trusting an archive; do not run scripts from unknown senders.

The packager reads an explicit root-file list and approved extensions under src, public, scripts, tests and docs, plus the vendored SHADCN-LICENSE.txt notice. It omits environment files, git history, media, dependencies and build output. It rejects source-tree symlinks, limits traversal depth/visited entries, and bounds payload file/count/total size. Use only a trusted local checkout with no concurrent writers: filesystem checks and reads are not an atomic snapshot or a security boundary against a process replacing files. It is not a general secret detector: do not put credentials in source code. No credential file is needed for review.

Extraction is supported on Linux case-sensitive filesystems only. The verifier does not reject all Windows-reserved names or case-folding collisions; a verified archive is not a portable cross-platform package. After verification, extract into a NEW empty directory, enter it, and run the README commands:

```bash
npm ci
npm test
npm run lint
npm run build
npm run typecheck
RECEIPTS_MODE=mock npm run eval
RECEIPTS_MODE=mock npm run demo
```

Open http://127.0.0.1:41731 and select Renew a driving licence: see the cached map, source quote and checklist. The mode banner must say cached. This uses fixtures, not current government advice or a live provider test. Stop the server with Ctrl-C.

The archive intentionally excludes demo videos. The operator handoff identifies local recordings separately; none is a public YouTube URL. Actual submitted fields, firsthand feedback, current live-provider compatibility, media and source/deployment parity remain operator gates. Never replace valid existing submission fields with local paths.
