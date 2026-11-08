package com.scariflabs.xcomb.terminal

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.OpenableColumns
import android.provider.Settings
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import java.io.File
import java.util.concurrent.Executors

/**
 * Full file manager bridge: phone storage (All files access), the Linux home,
 * workspace and every agent's settings folder. Paths are absolute host paths,
 * accepted only below those roots.
 */
@ReactModule(name = XCombFilesModule.NAME)
class XCombFilesModule(
  private val appContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(appContext), ActivityEventListener {

  private val executor = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "xcomb-files").apply { isDaemon = true }
  }
  private var pickPromise: Promise? = null
  private var pickDestination: File? = null

  private val preferences by lazy { appContext.getSharedPreferences("xcomb_files", Context.MODE_PRIVATE) }

  init {
    appContext.addActivityEventListener(this)
  }

  override fun getName(): String = NAME

  private val storageDir: File get() = File(ProotSessionLauncher.SHARED_STORAGE_PATH)
  private val appPaths: DistroStorePaths
    get() = DistroStorePaths(File(appContext.filesDir, TerminalRuntimeContract.STORAGE_ROOT_DIR_NAME))

  private fun allowedRoots(): List<File> = listOf(storageDir, appPaths.base)

  private fun checked(path: String): File {
    val file = File(path)
    require(file.isAbsolute) { "invalid_path" }
    require(allowedRoots().any { FileOps.isUnder(it, file) }) { "invalid_path" }
    return file
  }

  private fun hasAllFilesAccess(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      Environment.isExternalStorageManager() && storageDir.canRead()
    } else {
      appContext.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) ==
        PackageManager.PERMISSION_GRANTED && storageDir.canRead()
    }

  private inline fun run(promise: Promise, crossinline block: () -> Any?) {
    try {
      executor.execute {
        try {
          promise.resolve(block())
        } catch (error: IllegalArgumentException) {
          promise.reject(error.message ?: "invalid_path", error.message ?: "invalid_path")
        } catch (error: java.io.IOException) {
          promise.reject(error.message ?: "failed", error.message ?: "failed")
        } catch (error: SecurityException) {
          promise.reject("permission_denied", "permission_denied")
        } catch (error: Exception) {
          promise.reject("failed", "failed")
        }
      }
    } catch (_: java.util.concurrent.RejectedExecutionException) {
      promise.reject("busy", "busy")
    }
  }

  private fun itemMap(parent: String?, item: FileOps.Item): WritableMap = Arguments.createMap().apply {
    putString("name", item.name)
    if (parent != null) putString("path", File(parent, item.name).absolutePath)
    putBoolean("isDirectory", item.isDirectory)
    putBoolean("isSymlink", item.isSymlink)
    putDouble("sizeBytes", item.sizeBytes.toDouble())
    putDouble("modifiedMs", item.modifiedMs.toDouble())
    putBoolean("canWrite", item.canWrite)
  }

  private fun paths(array: ReadableArray): List<File> =
    (0 until array.size()).map { checked(array.getString(it) ?: throw IllegalArgumentException("invalid_path")) }

  @ReactMethod
  fun getRoots(promise: Promise) = run(promise) {
    val roots = Arguments.createArray()
    fun add(id: String, label: String, dir: File, writable: Boolean = true) {
      roots.pushMap(Arguments.createMap().apply {
        putString("id", id)
        putString("label", label)
        putString("path", dir.absolutePath)
        putBoolean("writable", writable)
      })
    }
    add("storage", "Phone storage", storageDir)
    val store = appPaths
    add("home", "Linux home", store.homeFor(RootfsCatalog.DISTRO_ALPINE))
    add("workspace", "Workspace", store.defaultWorkspace)
    for (key in DistroStorePaths.HARNESS_HOME_KEYS) {
      add("agent:$key", key, store.harnessHomeFor(RootfsCatalog.DISTRO_ALPINE, key))
    }
    roots
  }

  @ReactMethod
  fun storageAccess(promise: Promise) {
    promise.resolve(hasAllFilesAccess())
  }

  /** Opens the system "All files access" screen for this app. */
  @ReactMethod
  fun requestStorageAccess(promise: Promise) {
    try {
      val activity = appContext.currentActivity
      val intents = buildList {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          add(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:${appContext.packageName}")))
          add(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
        }
        add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${appContext.packageName}")))
      }
      for (intent in intents) {
        try {
          if (activity == null) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          (activity ?: appContext).startActivity(intent)
          promise.resolve(true)
          return
        } catch (_: ActivityNotFoundException) {
          // Try the next screen.
        }
      }
      promise.resolve(false)
    } catch (_: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun listDir(path: String, promise: Promise) = run(promise) {
    val dir = checked(path)
    Arguments.createMap().apply {
      putString("path", dir.absolutePath)
      putArray("entries", Arguments.createArray().apply {
        FileOps.list(dir).forEach { pushMap(itemMap(dir.absolutePath, it)) }
      })
    }
  }

  @ReactMethod
  fun search(path: String, query: String, promise: Promise) = run(promise) {
    val dir = checked(path)
    Arguments.createArray().apply {
      FileOps.search(dir, query.trim(), 200).forEach { (file, item) ->
        pushMap(itemMap(file.parentFile?.absolutePath, item))
      }
    }
  }

  @ReactMethod
  fun makeDirectory(parent: String, name: String, promise: Promise) = run(promise) {
    FileOps.mkdir(checked(parent), name).absolutePath
  }

  @ReactMethod
  fun createFile(parent: String, name: String, promise: Promise) = run(promise) {
    FileOps.createFile(checked(parent), name).absolutePath
  }

  @ReactMethod
  fun deletePaths(targets: ReadableArray, promise: Promise) = run(promise) {
    val files = paths(targets)
    // Never delete a root itself.
    require(files.none { f -> allowedRoots().any { it.canonicalPath == f.canonicalPath } }) { "invalid_path" }
    files.forEach { FileOps.delete(it) }
    files.size
  }

  @ReactMethod
  fun renamePath(path: String, newName: String, promise: Promise) = run(promise) {
    val target = checked(path)
    require(allowedRoots().none { it.canonicalPath == target.canonicalPath }) { "invalid_path" }
    FileOps.rename(target, newName).absolutePath
  }

  @ReactMethod
  fun paste(sources: ReadableArray, destination: String, move: Boolean, promise: Promise) = run(promise) {
    val destDir = checked(destination)
    val files = paths(sources)
    files.forEach { if (move) FileOps.move(it, destDir) else FileOps.copy(it, destDir) }
    files.size
  }

  @ReactMethod
  fun info(path: String, promise: Promise) = run(promise) {
    val info = FileOps.info(checked(path))
    Arguments.createMap().apply {
      putString("name", info.name)
      putString("path", info.path)
      putBoolean("isDirectory", info.isDirectory)
      putDouble("sizeBytes", info.sizeBytes.toDouble())
      putInt("fileCount", info.fileCount)
      putInt("folderCount", info.folderCount)
      putDouble("modifiedMs", info.modifiedMs.toDouble())
      putBoolean("canRead", info.canRead)
      putBoolean("canWrite", info.canWrite)
      putBoolean("truncated", info.truncated)
    }
  }

  /** Compresses [sources] into `<name>.zip` inside [destination]. */
  @ReactMethod
  fun compress(sources: ReadableArray, destination: String, name: String, promise: Promise) = run(promise) {
    val destDir = checked(destination)
    val files = paths(sources)
    val base = name.trim().removeSuffix(".zip")
    require(FileOps.isValidName(base)) { "invalid_name" }
    val target = FileOps.uniqueIn(destDir, "$base.zip")
    FileOps.zip(files, target)
    target.absolutePath
  }

  /** "Open as archive": extracts a zip into a new folder beside it. */
  @ReactMethod
  fun extract(path: String, promise: Promise) = run(promise) {
    val zip = checked(path)
    require(zip.isFile) { "not_file" }
    val folder = FileOps.uniqueIn(zip.parentFile ?: throw IllegalArgumentException("invalid_path"), zip.nameWithoutExtension.ifEmpty { "extracted" })
    try {
      FileOps.unzip(zip, folder)
    } catch (error: Exception) {
      runCatching { FileOps.delete(folder) }
      throw error
    }
    folder.absolutePath
  }

  @ReactMethod
  fun readText(path: String, promise: Promise) = run(promise) { FileOps.readText(checked(path)) }

  @ReactMethod
  fun writeText(path: String, content: String, promise: Promise) = run(promise) {
    FileOps.writeText(checked(path), content)
    true
  }

  @ReactMethod
  fun share(path: String, promise: Promise) {
    try {
      val file = checked(path)
      require(file.isFile) { "not_file" }
      val uri = FileProvider.getUriForFile(appContext, "${appContext.packageName}.share", file)
      val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension.lowercase()) ?: "*/*"
      val send = Intent(Intent.ACTION_SEND).apply {
        type = mime
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val chooser = Intent.createChooser(send, file.name).apply {
        if (appContext.currentActivity == null) addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      (appContext.currentActivity ?: appContext).startActivity(chooser)
      promise.resolve(true)
    } catch (error: IllegalArgumentException) {
      promise.reject(error.message ?: "invalid_path", error.message ?: "invalid_path")
    } catch (_: Exception) {
      promise.reject("failed", "failed")
    }
  }

  @ReactMethod
  fun getFavorites(promise: Promise) {
    val stored = preferences.getStringSet(KEY_FAVORITES, emptySet()) ?: emptySet()
    promise.resolve(Arguments.createArray().apply { stored.sorted().forEach { pushString(it) } })
  }

  @ReactMethod
  fun setFavorite(path: String, favorite: Boolean, promise: Promise) {
    val next = (preferences.getStringSet(KEY_FAVORITES, emptySet()) ?: emptySet()).toMutableSet()
    if (favorite) next.add(path) else next.remove(path)
    preferences.edit().putStringSet(KEY_FAVORITES, next).apply()
    promise.resolve(true)
  }

  /** Lets the person choose phone files and copies them into [destination]. */
  @ReactMethod
  fun pickAndImport(destination: String, promise: Promise) {
    try {
      val destDir = checked(destination)
      val activity = appContext.currentActivity
      if (activity == null || pickPromise != null) {
        promise.reject("busy", "busy")
        return
      }
      pickPromise = promise
      pickDestination = destDir
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "*/*"
        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
      }
      activity.startActivityForResult(intent, REQUEST_PICK)
    } catch (error: IllegalArgumentException) {
      promise.reject(error.message ?: "invalid_path", error.message ?: "invalid_path")
    } catch (_: Exception) {
      pickPromise = null
      promise.reject("failed", "failed")
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_PICK) return
    val promise = pickPromise ?: return
    val destDir = pickDestination
    pickPromise = null
    pickDestination = null
    if (resultCode != Activity.RESULT_OK || data == null || destDir == null) {
      promise.resolve(0)
      return
    }
    val uris = buildList {
      data.data?.let { add(it) }
      val clip = data.clipData
      if (clip != null) for (i in 0 until clip.itemCount) add(clip.getItemAt(i).uri)
    }.distinct()
    executor.execute {
      var copied = 0
      try {
        for (uri in uris) {
          val name = displayName(uri)?.replace('/', '_')?.takeIf { FileOps.isValidName(it) } ?: "imported-file"
          val target = FileOps.uniqueIn(destDir, name)
          appContext.contentResolver.openInputStream(uri)?.use { input ->
            target.outputStream().use { out -> input.copyTo(out) }
            copied += 1
          }
        }
        promise.resolve(copied)
      } catch (_: Exception) {
        if (copied > 0) promise.resolve(copied) else promise.reject("failed", "failed")
      }
    }
  }

  private fun displayName(uri: Uri): String? =
    appContext.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) cursor.getString(0) else null
    } ?: uri.lastPathSegment

  override fun onNewIntent(intent: Intent) = Unit

  companion object {
    const val NAME = "XCombFiles"
    private const val REQUEST_PICK = 7311
    private const val KEY_FAVORITES = "favorites"
  }
}
