"""Smoke test for webui_backend pure functions (no AstrBot required).

Run: python -m webui.tests.test_backend   (or:  python webui/tests/test_backend.py)
"""
import os
import sys
import shutil
import tempfile
import unittest
from pathlib import Path

# 把 webui_backend 加入路径
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import webui_backend as wb  # noqa: E402


class TestValidation(unittest.TestCase):
    def test_group_id(self):
        self.assertTrue(wb._validate_group_id("123456"))
        self.assertTrue(wb._validate_group_id("abc_def-123"))
        self.assertFalse(wb._validate_group_id("../etc"))
        self.assertFalse(wb._validate_group_id(""))
        self.assertFalse(wb._validate_group_id("a" * 200))

    def test_filename(self):
        self.assertEqual(wb._validate_filename("image_123.jpg"), "image_123.jpg")
        self.assertEqual(wb._validate_filename("黑历史.png"), "黑历史.png")
        self.assertIsNone(wb._validate_filename("../etc/passwd"))
        self.assertIsNone(wb._validate_filename("foo.exe"))
        self.assertIsNone(wb._validate_filename("a/b.png"))


class TestDiskOps(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.orig_root = wb.DATA_ROOT
        self.orig_thumb = wb.THUMB_ROOT
        wb.DATA_ROOT = self.tmp
        wb.THUMB_ROOT = self.tmp / ".thumbs"

    def tearDown(self):
        wb.DATA_ROOT = self.orig_root
        wb.THUMB_ROOT = self.orig_thumb
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_list_groups_empty(self):
        self.assertEqual(wb._list_groups(), [])

    def test_upload_and_list_and_delete(self):
        gid = "g1"
        # upload
        res = wb._save_uploaded(gid, "test.jpg", b"\xff\xd8\xff\xe0fake-jpg-data")
        self.assertEqual(res["status"], "ok")
        name = res["data"]["name"]

        # list
        listing = wb._list_images(gid, page=1, page_size=10)
        self.assertEqual(listing["total"], 1)
        self.assertEqual(listing["items"][0]["name"], name)

        # delete
        d = wb._delete_images(gid, [name])
        self.assertEqual(d["deleted"], [name])
        self.assertEqual(wb._list_images(gid, 1, 10)["total"], 0)

    def test_move(self):
        a, b = "gA", "gB"
        wb._save_uploaded(a, "x.png", b"x")
        wb._save_uploaded(a, "y.png", b"y")
        names = [it["name"] for it in wb._list_images(a, 1, 100)["items"]]
        m = wb._move_images(a, b, names)
        self.assertEqual(len(m["moved"]), 2)
        self.assertEqual(wb._list_images(a, 1, 100)["total"], 0)
        self.assertEqual(wb._list_images(b, 1, 100)["total"], 2)

    def test_rename(self):
        gid = "gZ"
        wb._save_uploaded(gid, "old.png", b"x")
        # 我们的 _rename_image 返回 _ok({"new_name": ...})
        r = wb._rename_image(gid, "old.png", "new.png")
        self.assertEqual(r["status"], "ok")
        names = [it["name"] for it in wb._list_images(gid, 1, 100)["items"]]
        self.assertIn("new.png", names)
        self.assertNotIn("old.png", names)

    def test_settings(self):
        gid = "gS"
        s = wb._load_settings(gid)
        self.assertEqual(s.get("mode", 0), 0)
        wb._save_settings(gid, {"mode": 2, "coldown": 30})
        s2 = wb._load_settings(gid)
        self.assertEqual(s2["mode"], 2)
        self.assertEqual(s2["coldown"], 30)

    def test_group_summary(self):
        for i in range(3):
            wb._save_uploaded("ga", f"a{i}.jpg", b"x" * 100)
        for i in range(2):
            wb._save_uploaded("gb", f"b{i}.jpg", b"y" * 50)
        groups = wb._list_groups()
        self.assertEqual(len(groups), 2)
        # 按 count 倒序
        self.assertEqual(groups[0]["group_id"], "ga")
        self.assertEqual(groups[0]["count"], 3)
        self.assertEqual(groups[1]["count"], 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
