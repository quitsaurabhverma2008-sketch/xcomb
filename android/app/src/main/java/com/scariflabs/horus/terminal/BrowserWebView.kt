package com.scariflabs.horus.terminal

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
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
        !isWebUrl(request.url.toString())

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
    if (!isWebUrl(next)) {
      emitState(loading = false, error = "Only http and https addresses can be opened")
      return
    }
    requestedUrl = next
    loadUrl(next)
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

    fun isWebUrl(value: String): Boolean {
      val lower = value.lowercase()
      return lower.startsWith("http://") || lower.startsWith("https://")
    }
  }
}

private class BrowserStateEvent(surfaceId: Int, viewId: Int, private val payload: WritableMap) :
  Event<BrowserStateEvent>(surfaceId, viewId) {
  override fun getEventName(): String = BrowserWebView.EVENT_NAME

  override fun getEventData(): WritableMap = payload
}
