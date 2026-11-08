package com.scariflabs.xcomb.terminal

import java.io.File
import java.io.IOException
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * File-manager operations on absolute host paths. Uses java.io only so the
 * same code runs on Android 7.0 (API 24) and in JVM tests. Callers must
 * validate that a path lies under an allowed root with [isUnder] first.
 */
object FileOps {
  data class Item(
    val name: String,
    val isDirectory: Boolean,
    val isSymlink: Boolean,
    val sizeBytes: Long,
    val modifiedMs: Long,
    val canWrite: Boolean,
  )

  data class Info(
    val name: String,
    val path: String,
    val isDirectory: Boolean,
    val sizeBytes: Long,
    val fileCount: Int,
    val folderCount: Int,
    val modifiedMs: Long,
    val canRead: Boolean,
    val canWrite: Boolean,
    val truncated: Boolean,
  )

  const val TEXT_LIMIT_BYTES = 1_048_576
  const val UNZIP_MAX_BYTES = 4L * 1024 * 1024 * 1024
  const val UNZIP_MAX_ENTRIES = 50_000
  private const val INFO_SCAN_LIMIT = 100_000

  /** True when [candidate] is [root] or below it, comparing canonical paths. */
  fun isUnder(root: File, candidate: File): Boolean {
    return try {
      val base = root.canonicalPath
      val target = candidate.canonicalPath
      target == base || target.startsWith(base.trimEnd('/') + "/")
    } catch (_: IOException) {
      false
    }
  }

  fun isValidName(name: String): Boolean =
    name.isNotEmpty() && name != "." && name != ".." && !name.contains('/') && !name.contains('\u0000') &&
      name.toByteArray(Charsets.UTF_8).size <= 255

  /**
   * Symbolic links must never be followed by delete/copy. Android's lstat is
   * exact; JVM tests fall back to comparing canonical and absolute paths.
   */
  private fun isLink(file: File): Boolean {
    return try {
      val stat = android.system.Os.lstat(file.absolutePath)
      android.system.OsConstants.S_ISLNK(stat.st_mode)
    } catch (_: Throwable) {
      try {
        file.canonicalFile != file.absoluteFile
      } catch (_: IOException) {
        false
      }
    }
  }

  fun list(dir: File): List<Item> {
    val children = dir.listFiles() ?: throw IOException("not_readable")
    return children.map { child ->
      val link = isLink(child)
      Item(
        name = child.name,
        isDirectory = child.isDirectory,
        isSymlink = link,
        sizeBytes = if (child.isFile) child.length() else 0,
        modifiedMs = child.lastModified(),
        canWrite = child.canWrite(),
      )
    }.sortedWith(compareBy<Item>({ !it.isDirectory }, { it.name.lowercase() }))
  }

  fun search(dir: File, query: String, limit: Int, maxDepth: Int = 8): List<Pair<File, Item>> {
    val needle = query.lowercase()
    val out = ArrayList<Pair<File, Item>>()
    fun walk(current: File, depth: Int) {
      if (out.size >= limit || depth > maxDepth) return
      val children = current.listFiles() ?: return
      for (child in children) {
        if (out.size >= limit) return
        val link = isLink(child)
        if (child.name.lowercase().contains(needle)) {
          out += child to Item(child.name, child.isDirectory, link, if (child.isFile) child.length() else 0, child.lastModified(), child.canWrite())
        }
        if (child.isDirectory && !link) walk(child, depth + 1)
      }
    }
    walk(dir, 0)
    return out
  }

  fun mkdir(parent: File, name: String): File {
    require(isValidName(name)) { "invalid_name" }
    val target = File(parent, name)
    if (target.exists()) throw IOException("exists")
    if (!target.mkdirs()) throw IOException("failed")
    return target
  }

  fun createFile(parent: File, name: String): File {
    require(isValidName(name)) { "invalid_name" }
    val target = File(parent, name)
    if (target.exists()) throw IOException("exists")
    if (!target.createNewFile()) throw IOException("failed")
    return target
  }

  /** Deletes a file or folder tree without ever following a symlink. */
  fun delete(target: File) {
    if (isLink(target) || !target.isDirectory) {
      if (!target.delete()) throw IOException("failed")
      return
    }
    target.listFiles()?.forEach { delete(it) }
    if (!target.delete()) throw IOException("failed")
  }

  fun rename(target: File, newName: String): File {
    require(isValidName(newName)) { "invalid_name" }
    val dest = File(target.parentFile, newName)
    if (dest.exists()) throw IOException("exists")
    if (!target.renameTo(dest)) throw IOException("failed")
    return dest
  }

  /** A name that does not exist yet in [dir]: `a.txt`, `a (1).txt`, ... */
  fun uniqueIn(dir: File, name: String): File {
    var candidate = File(dir, name)
    if (!candidate.exists() && !isLink(candidate)) return candidate
    val dot = name.lastIndexOf('.')
    val stem = if (dot > 0) name.substring(0, dot) else name
    val ext = if (dot > 0) name.substring(dot) else ""
    var index = 1
    while (true) {
      candidate = File(dir, "$stem ($index)$ext")
      if (!candidate.exists() && !isLink(candidate)) return candidate
      index += 1
    }
  }

  fun copy(source: File, destDir: File): File {
    if (source.isDirectory && !isLink(source) && isUnder(source, destDir)) throw IOException("into_itself")
    val dest = uniqueIn(destDir, source.name)
    copyTree(source, dest)
    return dest
  }

  private fun copyTree(source: File, dest: File) {
    if (isLink(source)) {
      copyLink(source, dest)
    } else if (source.isDirectory) {
      if (!dest.mkdirs()) throw IOException("failed")
      source.listFiles()?.forEach { copyTree(it, File(dest, it.name)) }
      dest.setLastModified(source.lastModified())
    } else {
      source.inputStream().use { input ->
        dest.outputStream().use { output -> input.copyTo(output) }
      }
      dest.setLastModified(source.lastModified())
    }
  }

  private fun copyLink(source: File, dest: File) {
    try {
      val target = android.system.Os.readlink(source.absolutePath)
      android.system.Os.symlink(target, dest.absolutePath)
    } catch (_: Throwable) {
      throw IOException("symlink")
    }
  }

  fun move(source: File, destDir: File): File {
    if (source.isDirectory && !isLink(source) && isUnder(source, destDir)) throw IOException("into_itself")
    val dest = uniqueIn(destDir, source.name)
    if (source.renameTo(dest)) return dest
    // Across volumes a rename fails: copy, then remove the original.
    copyTree(source, dest)
    delete(source)
    return dest
  }

  fun info(target: File): Info {
    var size = 0L
    var files = 0
    var folders = 0
    var scanned = 0
    var truncated = false
    fun walk(current: File) {
      if (truncated) return
      if (++scanned > INFO_SCAN_LIMIT) {
        truncated = true
        return
      }
      if (isLink(current)) return
      if (current.isDirectory) {
        folders += 1
        current.listFiles()?.forEach { walk(it) }
      } else {
        files += 1
        size += current.length()
      }
    }
    walk(target)
    return Info(
      name = target.name,
      path = target.absolutePath,
      isDirectory = target.isDirectory,
      sizeBytes = size,
      fileCount = files,
      folderCount = if (target.isDirectory) (folders - 1).coerceAtLeast(0) else 0,
      modifiedMs = target.lastModified(),
      canRead = target.canRead(),
      canWrite = target.canWrite(),
      truncated = truncated,
    )
  }

  /** Writes [sources] (files or folders) into one zip archive at [zip]. */
  fun zip(sources: List<File>, zip: File) {
    if (zip.exists()) throw IOException("exists")
    if (sources.any { it.isDirectory && !isLink(it) && isUnder(it, zip) }) throw IOException("into_itself")
    try {
      ZipOutputStream(zip.outputStream().buffered()).use { out ->
        for (source in sources) addToZip(out, source, source.name)
      }
    } catch (error: Exception) {
      zip.delete()
      throw error
    }
  }

  private fun addToZip(out: ZipOutputStream, file: File, entryName: String) {
    if (isLink(file)) return
    if (file.isDirectory) {
      out.putNextEntry(ZipEntry("$entryName/").apply { time = file.lastModified() })
      out.closeEntry()
      file.listFiles()?.forEach { addToZip(out, it, "$entryName/${it.name}") }
    } else if (file.isFile) {
      out.putNextEntry(ZipEntry(entryName).apply { time = file.lastModified() })
      file.inputStream().use { it.copyTo(out) }
      out.closeEntry()
    }
  }

  /**
   * Extracts a zip into a fresh folder next to [destDir]'s chosen name.
   * Entries that would leave the folder (zip-slip), absolute names, and
   * anything past the size or count caps are refused.
   */
  fun unzip(zip: File, destDir: File): File {
    destDir.mkdirs()
    val base = destDir.canonicalFile
    var entries = 0
    var total = 0L
    ZipInputStream(zip.inputStream().buffered()).use { input ->
      while (true) {
        val entry = input.nextEntry ?: break
        if (++entries > UNZIP_MAX_ENTRIES) throw IOException("too_many_entries")
        val target = File(base, entry.name).canonicalFile
        if (!(target.path == base.path || target.path.startsWith(base.path + "/"))) throw IOException("unsafe_entry")
        if (entry.isDirectory) {
          target.mkdirs()
        } else {
          target.parentFile?.mkdirs()
          target.outputStream().buffered().use { out ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
              val read = input.read(buffer)
              if (read < 0) break
              total += read
              if (total > UNZIP_MAX_BYTES) throw IOException("too_large")
              out.write(buffer, 0, read)
            }
          }
        }
        input.closeEntry()
      }
    }
    return destDir
  }

  fun readText(file: File): String {
    if (!file.isFile) throw IOException("not_file")
    if (file.length() > TEXT_LIMIT_BYTES) throw IOException("too_large")
    val bytes = file.readBytes()
    val decoder = Charsets.UTF_8.newDecoder()
      .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
      .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
    return try {
      decoder.decode(java.nio.ByteBuffer.wrap(bytes)).toString()
    } catch (_: java.nio.charset.CharacterCodingException) {
      throw IOException("binary_or_invalid_text")
    }
  }

  fun writeText(file: File, content: String) {
    val bytes = content.toByteArray(Charsets.UTF_8)
    if (bytes.size > TEXT_LIMIT_BYTES) throw IOException("too_large")
    if (file.isDirectory) throw IOException("is_directory")
    file.writeBytes(bytes)
  }
}
