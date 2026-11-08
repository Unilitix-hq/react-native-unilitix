package com.unilitix

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReadableMap

/**
 * Legacy bridge: the same methods as the codegen'd NativeUnilitixSpec
 * (src/NativeUnilitix.ts), so UnilitixModule compiles unchanged on both
 * architectures. The overrides carry @ReactMethod.
 */
abstract class UnilitixSpec(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName(): String = NAME

  abstract fun init(options: ReadableMap, promise: Promise)
  abstract fun track(options: ReadableMap, promise: Promise)
  abstract fun identify(options: ReadableMap, promise: Promise)
  abstract fun screen(options: ReadableMap, promise: Promise)
  abstract fun recordException(options: ReadableMap, promise: Promise)
  abstract fun addBreadcrumb(options: ReadableMap, promise: Promise)
  abstract fun setConsent(options: ReadableMap, promise: Promise)
  abstract fun startSession(options: ReadableMap, promise: Promise)
  abstract fun endSession(options: ReadableMap, promise: Promise)
  abstract fun flush(options: ReadableMap, promise: Promise)
  abstract fun optOut(options: ReadableMap, promise: Promise)
  abstract fun optIn(options: ReadableMap, promise: Promise)
  abstract fun reset(options: ReadableMap, promise: Promise)
  abstract fun currentSessionId(options: ReadableMap, promise: Promise)
  abstract fun getBuildInfo(options: ReadableMap, promise: Promise)

  companion object {
    const val NAME = "Unilitix"
  }
}
