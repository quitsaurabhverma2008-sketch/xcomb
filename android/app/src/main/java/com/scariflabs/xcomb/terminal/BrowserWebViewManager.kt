package com.scariflabs.xcomb.terminal

import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

/** Exposes the in-app preview browser to React as `XCombBrowserView`. */
class BrowserWebViewManager : SimpleViewManager<BrowserWebView>() {
  override fun getName(): String = REACT_CLASS

  override fun createViewInstance(reactContext: ThemedReactContext): BrowserWebView = BrowserWebView(reactContext)

  @ReactProp(name = "url")
  fun setUrl(view: BrowserWebView, value: String?) = view.setUrl(value)

  @ReactProp(name = "reloadRequest", defaultInt = 0)
  fun setReloadRequest(view: BrowserWebView, value: Int) = view.setReloadRequest(value)

  @ReactProp(name = "backRequest", defaultInt = 0)
  fun setBackRequest(view: BrowserWebView, value: Int) = view.setBackRequest(value)

  @ReactProp(name = "forwardRequest", defaultInt = 0)
  fun setForwardRequest(view: BrowserWebView, value: Int) = view.setForwardRequest(value)

  override fun onDropViewInstance(view: BrowserWebView) {
    view.release()
    super.onDropViewInstance(view)
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    MapBuilder.builder<String, Any>()
      .put(BrowserWebView.EVENT_NAME, MapBuilder.of("registrationName", "onBrowserState"))
      .build()
      .toMutableMap()

  companion object {
    const val REACT_CLASS = "XCombBrowserView"
  }
}
