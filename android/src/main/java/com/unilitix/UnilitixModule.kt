package com.unilitix

import android.app.Application
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import io.unilitix.sdk.Unilitix

class UnilitixModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "Unilitix"

  @ReactMethod
  fun init(options: ReadableMap, promise: Promise) {
    try {
      val apiKey = options.getString("apiKey")
        ?: return promise.reject("MISSING_API_KEY",
            "apiKey is required")
      val app = reactContext.applicationContext as Application

      Unilitix.init(app, apiKey) {
        options.getString("endpoint")
          ?.let { apiUrl = it }
        if (options.hasKey("debug"))
          debugLogging = options.getBoolean("debug")
        if (options.hasKey("autoTrackScreens"))
          autoTrackScreens =
            options.getBoolean("autoTrackScreens")
        if (options.hasKey("autoTrackTaps"))
          autoTrackTaps =
            options.getBoolean("autoTrackTaps")
        if (options.hasKey("autoTrackCrashes"))
          autoTrackCrashes =
            options.getBoolean("autoTrackCrashes")
        if (options.hasKey("autoTrackRageTaps"))
          autoTrackRageTaps =
            options.getBoolean("autoTrackRageTaps")
        if (options.hasKey("flushIntervalSeconds"))
          flushIntervalSeconds =
            options.getInt("flushIntervalSeconds")
        if (options.hasKey("sessionTimeoutSeconds"))
          sessionTimeoutSeconds =
            options.getInt("sessionTimeoutSeconds")
        if (options.hasKey("maskInputs"))
          maskInputs = options.getBoolean("maskInputs")
        if (options.hasKey("sampleRate"))
          sampleRate =
            options.getDouble("sampleRate").toFloat()
      }
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("INIT_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun track(options: ReadableMap, promise: Promise) {
    try {
      val event = options.getString("event")
        ?: return promise.reject("MISSING_EVENT",
            "event is required")
      val props = options.getMap("properties")
        ?.toHashMap() ?: emptyMap<String, Any>()
      Unilitix.trackEvent(event, props)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("TRACK_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun identify(options: ReadableMap, promise: Promise) {
    try {
      val userId = options.getString("userId")
        ?: return promise.reject("MISSING_USER_ID",
            "userId is required")
      val traits = options.getMap("traits")
        ?.toHashMap() ?: emptyMap<String, Any>()
      Unilitix.identify(userId, traits)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("IDENTIFY_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun screen(options: ReadableMap, promise: Promise) {
    try {
      val name = options.getString("screenName")
        ?: return promise.reject("MISSING_SCREEN",
            "screenName is required")
      Unilitix.trackScreen(name)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("SCREEN_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun startSession(promise: Promise) {
    try { Unilitix.startSession(); promise.resolve(null) }
    catch (e: Exception) {
      promise.reject("SESSION_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun endSession(promise: Promise) {
    try { Unilitix.endSession(); promise.resolve(null) }
    catch (e: Exception) {
      promise.reject("SESSION_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun flush(promise: Promise) {
    try { Unilitix.flush(); promise.resolve(null) }
    catch (e: Exception) {
      promise.reject("FLUSH_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun optOut(promise: Promise) {
    try { Unilitix.optOut(); promise.resolve(null) }
    catch (e: Exception) {
      promise.reject("OPT_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun optIn(promise: Promise) {
    try { Unilitix.optIn(); promise.resolve(null) }
    catch (e: Exception) {
      promise.reject("OPT_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun reset(promise: Promise) {
    try { Unilitix.reset(); promise.resolve(null) }
    catch (e: Exception) {
      promise.reject("RESET_ERROR", e.message, e)
    }
  }
}
