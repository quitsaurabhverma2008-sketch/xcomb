package com.scariflabs.xcomb.terminal

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.ModuleSpec
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Registers the typed runtime module and the native terminal view. */
class TerminalRuntimePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      TerminalRuntimeContract.MODULE_NAME -> TerminalRuntimeModule(reactContext)
      XCombDeviceModule.NAME -> XCombDeviceModule(reactContext)
      XCombFilesModule.NAME -> XCombFilesModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      TerminalRuntimeContract.MODULE_NAME to ReactModuleInfo(
        TerminalRuntimeContract.MODULE_NAME,
        TerminalRuntimeModule::class.java.name,
        false,
        false,
        false,
        true,
      ),
      XCombDeviceModule.NAME to ReactModuleInfo(
        XCombDeviceModule.NAME,
        XCombDeviceModule::class.java.name,
        false,
        false,
        false,
        false,
      ),
      XCombFilesModule.NAME to ReactModuleInfo(
        XCombFilesModule.NAME,
        XCombFilesModule::class.java.name,
        false,
        false,
        false,
        false,
      ),
    )
  }

  override fun getViewManagers(reactContext: ReactApplicationContext): List<ModuleSpec> = listOf(
    ModuleSpec.viewManagerSpec { TerminalCanvasViewManager() },
    ModuleSpec.viewManagerSpec { TerminalInputViewManager() },
    ModuleSpec.viewManagerSpec { BrowserWebViewManager() },
  )
}
