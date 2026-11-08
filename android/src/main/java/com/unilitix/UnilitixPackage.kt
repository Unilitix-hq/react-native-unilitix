package com.unilitix

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

/**
 * Registers the Unilitix module (a TurboModule when the New Architecture is
 * on, a bridge module otherwise) and the masking view managers used by
 * `<UnilitixMask>` / `<UnilitixUnmask>` (Fabric through codegen'd component
 * descriptors, Paper directly).
 */
class UnilitixPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext
  ): NativeModule? =
    if (name == UNILITIX_MODULE_NAME) UnilitixModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        UNILITIX_MODULE_NAME to ReactModuleInfo(
          UNILITIX_MODULE_NAME,
          UnilitixModule::class.java.name,
          false, // canOverrideExistingModule
          false, // needsEagerInit
          false, // isCxxModule
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED // isTurboModule
        )
      )
    }

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> =
    listOf(UnilitixMaskViewManager(), UnilitixUnmaskViewManager())
}
