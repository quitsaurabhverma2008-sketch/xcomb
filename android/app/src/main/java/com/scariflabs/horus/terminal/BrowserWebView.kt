package com.scariflabs.horus.terminal

import android.annotation.SuppressLint
import android.content.Context
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.net.http.SslError
import android.webkit.SslErrorHandler
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event

/**
 * A plain Android WebView for previewing dev servers next to the terminal. It
 * stays inside the app: navigation never leaves for another browser, and only
 * web URLs are loaded.
 */
@SuppressLint("SetJavaScriptEnabled")
class BrowserWebView(context: Context) : WebView(context) {
  private var requestedUrl: String? = null
  private var lastReload = 0
  private var lastBack = 0
  private var lastForward = 0

  init {
    layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.loadWithOverviewMode = true
    settings.useWideViewPort = true
    settings.builtInZoomControls = true
    settings.displayZoomControls = false
    settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
    // Dev servers change constantly; never serve a stale copy.
    settings.cacheMode = WebSettings.LOAD_NO_CACHE
    // Not a file browser: block local file and content access.
    settings.allowFileAccess = false
    settings.allowContentAccess = false
    webChromeClient = WebChromeClient()
    webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
        when (classify(request.url.toString())) {
          UrlKind.PAGE -> false
          UrlKind.EXTERNAL -> {
            openExternally(request.url.toString())
            true
          }
          UrlKind.BLOCKED -> true
        }

      // Dev servers often use self-signed certificates. Accept those only for
      // this device and the local network; every other host keeps the check.
      override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
        if (isLocalHost(runCatching { android.net.Uri.parse(error.url).host }.getOrNull())) handler.proceed() else handler.cancel()
      }

      override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) = emitState(loading = true, error = null)

      override fun onPageFinished(view: WebView, url: String?) = emitState(loading = false, error = null)

      override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
        if (request.isForMainFrame) emitState(loading = false, error = error.description?.toString() ?: "Could not load page")
      }
    }
  }

  fun setUrl(value: String?) {
    val next = value?.trim().orEmpty()
    if (next.isEmpty() || next == requestedUrl) return
    requestedUrl = next
    when (classify(next)) {
      UrlKind.PAGE -> loadUrl(next)
      UrlKind.EXTERNAL -> openExternally(next)
      UrlKind.BLOCKED -> emitState(loading = false, error = "This kind of address is blocked for your safety")
    }
  }

  fun setReloadRequest(value: Int) {
    if (value != lastReload) {
      lastReload = value
      if (value != 0) reload()
    }
  }

  fun setBackRequest(value: Int) {
    if (value != lastBack) {
      lastBack = value
      if (value != 0 && canGoBack()) goBack()
    }
  }

  fun setForwardRequest(value: Int) {
    if (value != lastForward) {
      lastForward = value
      if (value != 0 && canGoForward()) goForward()
    }
  }

  /** Links such as mailto:, tel: or an app's own scheme go to the matching app, like a normal browser. */
  private fun openExternally(target: String) {
    try {
      context.startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(target)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: ActivityNotFoundException) {
      emitState(loading = false, error = "No app can open this address")
    } catch (_: SecurityException) {
      emitState(loading = false, error = "This address could not be opened")
    }
  }

  fun release() {
    stopLoading()
    webViewClient = WebViewClient()
    destroy()
  }

  private fun emitState(loading: Boolean, error: String?) {
    val reactContext = context as? ReactContext ?: return
    val surfaceId = UIManagerHelper.getSurfaceId(this)
    val dispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, id) ?: return
    val payload = Arguments.createMap().apply {
      putString("url", url ?: "")
      putString("title", title ?: "")
      putBoolean("canGoBack", canGoBack())
      putBoolean("canGoForward", canGoForward())
      putBoolean("loading", loading)
      if (error != null) putString("error", error)
    }
    dispatcher.dispatchEvent(BrowserStateEvent(surfaceId, id, payload))
  }

  companion object {
    const val EVENT_NAME = "topBrowserState"

    enum class UrlKind { PAGE, EXTERNAL, BLOCKED }

    /**
     * Pages load in the window (http, https, about, data, blob, view-source).
     * Script and local-file/content addresses are blocked, because a page must
     * never reach the app's private files. Anything else with a scheme is
     * handed to the app that handles it.
     */
    fun classify(value: String): UrlKind {
      val scheme = value.substringBefore(':', "").lowercase()
      return when {
        scheme.isEmpty() || !value.contains(':') -> UrlKind.BLOCKED
        scheme in setOf("http", "https", "about", "data", "blob", "view-source") -> UrlKind.PAGE
        scheme in setOf("javascript", "file", "content") -> UrlKind.BLOCKED
        else -> UrlKind.EXTERNAL
      }
    }

    fun isLocalHost(host: String?): Boolean {
      if (host == null) return false
      if (host == "localhost" || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.")) return true
      val parts = host.split(".")
      return parts.size == 4 && parts[0] == "172" && (parts[1].toIntOrNull() ?: -1) in 16..31
    }
  }
}

private class BrowserStateEvent(surfaceId: Int, viewId: Int, private val payload: WritableMap) :
  Event<BrowserStateEvent>(surfaceId, viewId) {
  override fun getEventName(): String = BrowserWebView.EVENT_NAME

  override fun getEventData(): WritableMap = payload
}
