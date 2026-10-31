#!/usr/bin/env python3
"""Lossless APK hotfix: remove obsolete S Online integration, refresh Wazo plugin.

Operates on a backup of v2.5.0; preserves package id, app data, icons,
activity, and every class besides exact audited JS string constants.
Must be signed with the SAME original debug certificate.
"""
import hashlib
import pathlib
import sys
import zipfile
import zlib

source = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])
assert source.exists() and source.resolve() != target.resolve()
original = source.read_bytes()
with zipfile.ZipFile(source) as archive:
    dex = bytearray(archive.read("classes.dex"))
    manifest = archive.read("AndroidManifest.xml")
    patch = b"if(window.__wazoAlternatePlayer)return;"
    replacement = b"if(true)return;" + b" " * (len(patch) - len(b"if(true)return;"))
    assert len(replacement) == len(patch)
    assert dex.count(patch) == 1
    dex = dex.replace(patch, replacement)
    query_old = b"js?v=20261030"
    query_new = b"js?v=20261031"
    assert len(query_old) == len(query_new) and dex.count(query_old) == 1
    dex = dex.replace(query_old, query_new)
    # DEX signature & checksum must be calculated in this order.
    dex[12:32] = hashlib.sha1(dex[32:]).digest()
    dex[8:12] = (zlib.adler32(dex[12:]) & 0xFFFFFFFF).to_bytes(4, "little")
    version_old = "2.5.0".encode("utf-16le")
    version_new = "2.5.1".encode("utf-16le")
    assert manifest.count(version_old) == 1
    manifest = manifest.replace(version_old, version_new)

    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, "w") as output:
        for info in archive.infolist():
            if info.filename.startswith("META-INF/"):
                continue
            payload = (
                bytes(dex) if info.filename == "classes.dex"
                else manifest if info.filename == "AndroidManifest.xml"
                else archive.read(info.filename)
            )
            output.writestr(info, payload)
print(f"Generated {target}: {target.stat().st_size} bytes; source sha256={hashlib.sha256(original).hexdigest()[:16]}")
