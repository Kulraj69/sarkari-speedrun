"""Offline review-archive regressions. No provider or environment file reads."""
import importlib.util

import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SPEC = importlib.util.spec_from_file_location('package_review', Path(__file__).parents[1] / 'scripts/package_review.py')
assert SPEC is not None and SPEC.loader is not None
review = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(review)


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR'))
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'source'
        self.root.mkdir()
        for name in ('README.md', 'LICENSE', 'package.json', 'package-lock.json'):
            (self.root / name).write_text('{}')
        (self.root / 'src').mkdir()
        (self.root / 'src/app.ts').write_text('export {};')
        self.output = self.root.parent / 'review.zip'

    def rewrite(self, change):
        review.package(self.root, self.output)
        with zipfile.ZipFile(self.output) as z:
            entries = [(item, z.read(item)) for item in z.infolist()]
        with zipfile.ZipFile(self.output, 'w') as z:
            for item, data in entries:
                z.writestr(item, change(item.filename, data))

    def test_roundtrip_and_reproducible(self):
        result = review.package(self.root, self.output)
        second = self.root.parent / 'second.zip'
        review.package(self.root, second)
        self.assertEqual(self.output.read_bytes(), second.read_bytes())
        self.assertEqual(len(result['files']), 5)
        self.assertEqual(review.verify(self.output), result)

    def test_excluded_files_not_read(self):
        # Dummy sentinel data only; never inspect actual credential files.
        for name in ('.env.local', 'credentials.json'):
            (self.root / name).write_text('dummy fixture')
        original = Path.open
        def guarded(path, *args, **kwargs):
            self.assertNotIn(path.name, ('.env.local', 'credentials.json'))
            return original(path, *args, **kwargs)
        with patch.object(Path, 'open', guarded):
            result = review.package(self.root, self.output)
        self.assertEqual(len(result['files']), 5)

    def test_path_rules(self):
        for name in ('../README.md', '/README.md', 'src/../README.md', 'src//app.ts', 'src\\app.ts', 'src/.env.ts', 'src/secrets/key.ts', 'src/password.ts', 'node_modules/a.ts', 'demo/test.mp4'):
            with self.subTest(name=name):
                self.assertFalse(review.allowed(name))
        self.assertTrue(review.allowed('src/lib/env.ts'))

    def test_vendored_notice_retained(self):
        (self.root / 'src/styles').mkdir()
        (self.root / 'src/styles/shadcn-tailwind.css').write_text('/* fixture */')
        (self.root / 'src/styles/SHADCN-LICENSE.txt').write_text('fixture notice')
        result = review.package(self.root, self.output)
        self.assertIn('src/styles/SHADCN-LICENSE.txt', [row['path'] for row in result['files']])

    def test_symlink_file(self):
        (self.root / 'src/link.ts').symlink_to(self.root / 'README.md')
        with self.assertRaises(ValueError):
            review.package(self.root, self.output)
        self.assertFalse(self.output.exists())

    def test_symlink_tree(self):
        (self.root / 'tests').symlink_to(self.root / 'src', target_is_directory=True)
        with self.assertRaises(ValueError):
            review.collect(self.root)

    def test_broken_symlink(self):
        (self.root / 'src/broken.ts').symlink_to(self.root / 'missing')
        with self.assertRaises(ValueError):
            review.collect(self.root)

    def test_missing_required(self):
        (self.root / 'LICENSE').unlink()
        with self.assertRaises(ValueError):
            review.package(self.root, self.output)

    def test_overwrite_refused(self):
        self.output.write_bytes(b'preserve')
        with self.assertRaises(FileExistsError):
            review.package(self.root, self.output)
        self.assertEqual(self.output.read_bytes(), b'preserve')

    def test_partial_write_removed(self):
        with patch.object(zipfile.ZipFile, 'writestr', side_effect=OSError('fixture failure')):
            with self.assertRaises(OSError):
                review.package(self.root, self.output)
        self.assertFalse(self.output.exists())

    def test_file_size_limit(self):
        with patch.object(review, 'MAX_FILE', 1):
            with self.assertRaises(ValueError):
                review.package(self.root, self.output)

    def test_total_limit(self):
        with patch.object(review, 'MAX_TOTAL', 3):
            with self.assertRaises(ValueError):
                review.package(self.root, self.output)

    def test_depth_limit(self):
        directory = self.root / 'src'
        for _ in range(26):
            directory = directory / 'nested'
            directory.mkdir()
        with self.assertRaisesRegex(ValueError, 'too deep'):
            review.collect(self.root)

    def test_traversal_limit_is_lazy(self):
        consumed = []
        def entries(directory):
            for i in range(5000):
                consumed.append(i)
                yield directory / f'ignored-{i}.bin'
        with patch.object(Path, 'iterdir', entries):
            with self.assertRaisesRegex(ValueError, 'too many entries'):
                review.collect(self.root)
        self.assertEqual(len(consumed), 4097)

    def test_count_limit(self):
        with patch.object(review, 'MAX_FILES', 2):
            with self.assertRaises(ValueError):
                review.package(self.root, self.output)

    def test_hash_tamper(self):
        self.rewrite(lambda name, data: b'changed' if name == 'README.md' else data)
        with self.assertRaises(ValueError):
            review.verify(self.output)

    def test_manifest_tamper(self):
        self.rewrite(lambda name, data: b'{}' if name == review.MANIFEST else data)
        with self.assertRaises(ValueError):
            review.verify(self.output)

    def test_extra_path(self):
        review.package(self.root, self.output)
        with zipfile.ZipFile(self.output, 'a') as z:
            info = zipfile.ZipInfo('../escape')
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            z.writestr(info, b'bad')
        with self.assertRaises(ValueError):
            review.verify(self.output)

    def test_archive_symlink(self):
        review.package(self.root, self.output)
        with zipfile.ZipFile(self.output, 'a') as z:
            info = zipfile.ZipInfo('src/link.ts')
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            z.writestr(info, b'outside')
        with self.assertRaises(ValueError):
            review.verify(self.output)


if __name__ == '__main__':
    unittest.main()
