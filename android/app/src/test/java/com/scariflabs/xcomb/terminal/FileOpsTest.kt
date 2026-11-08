package com.scariflabs.xcomb.terminal

import java.io.File
import java.io.IOException
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class FileOpsTest {
  @get:Rule val tmp = TemporaryFolder()

  @Test
  fun mkdirCreateRenameDelete() {
    val root = tmp.newFolder()
    val dir = FileOps.mkdir(root, "docs")
    val file = FileOps.createFile(dir, "a.txt")
    val renamed = FileOps.rename(file, "b.txt")
    assertTrue(renamed.isFile)
    assertFalse(file.exists())
    FileOps.delete(dir)
    assertFalse(dir.exists())
  }

  @Test
  fun rejectsBadNamesAndDuplicates() {
    val root = tmp.newFolder()
    try {
      FileOps.mkdir(root, "../x")
      fail()
    } catch (_: IllegalArgumentException) {
    }
    FileOps.mkdir(root, "x")
    try {
      FileOps.mkdir(root, "x")
      fail()
    } catch (error: IOException) {
      assertEquals("exists", error.message)
    }
  }

  @Test
  fun copyAndMoveUseUniqueNames() {
    val root = tmp.newFolder()
    val src = File(root, "a.txt").apply { writeText("hi") }
    val dest = FileOps.mkdir(root, "d")
    File(dest, "a.txt").writeText("old")
    val copied = FileOps.copy(src, dest)
    assertEquals("a (1).txt", copied.name)
    assertEquals("hi", copied.readText())
    val moved = FileOps.move(src, dest)
    assertEquals("a (2).txt", moved.name)
    assertFalse(src.exists())
  }

  @Test
  fun refusesFolderIntoItself() {
    val root = tmp.newFolder()
    val a = FileOps.mkdir(root, "a")
    val inner = FileOps.mkdir(a, "b")
    try {
      FileOps.copy(a, inner)
      fail()
    } catch (error: IOException) {
      assertEquals("into_itself", error.message)
    }
  }

  @Test
  fun zipRefusesArchiveInsideSource() {
    val root = tmp.newFolder()
    val src = FileOps.mkdir(root, "src")
    try {
      FileOps.zip(listOf(src), File(src, "out.zip"))
      fail()
    } catch (error: IOException) {
      assertEquals("into_itself", error.message)
    }
  }

  @Test
  fun zipThenUnzipRoundTrips() {
    val root = tmp.newFolder()
    val src = FileOps.mkdir(root, "src")
    File(src, "one.txt").writeText("1")
    FileOps.mkdir(src, "sub")
    File(src, "sub/two.txt").writeText("22")
    val zip = File(root, "out.zip")
    FileOps.zip(listOf(src), zip)
    val out = File(root, "extracted")
    FileOps.unzip(zip, out)
    assertEquals("1", File(out, "src/one.txt").readText())
    assertEquals("22", File(out, "src/sub/two.txt").readText())
  }

  @Test
  fun unzipRejectsZipSlip() {
    val root = tmp.newFolder()
    val zip = File(root, "evil.zip")
    ZipOutputStream(zip.outputStream()).use {
      it.putNextEntry(ZipEntry("../escape.txt"))
      it.write("x".toByteArray())
      it.closeEntry()
    }
    try {
      FileOps.unzip(zip, File(root, "dest"))
      fail()
    } catch (error: IOException) {
      assertEquals("unsafe_entry", error.message)
    }
    assertFalse(File(root, "escape.txt").exists())
  }

  @Test
  fun isUnderBlocksSiblingsAndDotDot() {
    val root = tmp.newFolder("base")
    val sibling = tmp.newFolder("base-evil")
    assertTrue(FileOps.isUnder(root, File(root, "x/y")))
    assertFalse(FileOps.isUnder(root, sibling))
    assertFalse(FileOps.isUnder(root, File(root, "../base-evil")))
  }

  @Test
  fun searchInfoAndText() {
    val root = tmp.newFolder()
    val d = FileOps.mkdir(root, "d")
    File(d, "Notes.md").writeText("hello")
    assertEquals(1, FileOps.search(root, "notes", 10).size)
    val info = FileOps.info(root)
    assertEquals(1, info.fileCount)
    assertEquals(1, info.folderCount)
    assertEquals(5L, info.sizeBytes)
    val f = File(d, "Notes.md")
    FileOps.writeText(f, "héllo")
    assertEquals("héllo", FileOps.readText(f))
    f.writeBytes(byteArrayOf(0xC3.toByte(), 0x28))
    try {
      FileOps.readText(f)
      fail()
    } catch (error: IOException) {
      assertEquals("binary_or_invalid_text", error.message)
    }
  }
}
