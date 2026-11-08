package com.unilitix

import android.content.Context
import android.view.ViewGroup
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import io.unilitix.sdk.Unilitix
import io.unilitix.sdk.UnilitixPrivate

/**
 * Container whose whole subtree is blacked out in session replay
 * (screenshots and snapshots) and whose taps are not recorded: the SDK
 * honours `@UnilitixPrivate` on the view's class. React Native positions the
 * children (Yoga), so layout is a no-op here.
 */
@UnilitixPrivate
class UnilitixMaskView(context: Context) : ViewGroup(context) {
  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) = Unit
}

/**
 * Container shown in replay even with `maskAllText` / `maskImages`
 * (`Unilitix.unmask(view)`); text inputs inside stay masked.
 */
class UnilitixUnmaskView(context: Context) : ViewGroup(context) {
  init {
    Unilitix.unmask(this)
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) = Unit
}

/** Paper view manager and Fabric host for `UnilitixMaskView`. */
@ReactModule(name = UnilitixMaskViewManager.NAME)
class UnilitixMaskViewManager : ViewGroupManager<UnilitixMaskView>() {
  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): UnilitixMaskView =
    UnilitixMaskView(context)

  companion object {
    const val NAME = "UnilitixMaskView"
  }
}

/** Paper view manager and Fabric host for `UnilitixUnmaskView`. */
@ReactModule(name = UnilitixUnmaskViewManager.NAME)
class UnilitixUnmaskViewManager : ViewGroupManager<UnilitixUnmaskView>() {
  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): UnilitixUnmaskView =
    UnilitixUnmaskView(context)

  companion object {
    const val NAME = "UnilitixUnmaskView"
  }
}
