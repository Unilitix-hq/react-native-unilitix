package com.unilitix

import android.app.Application
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import io.unilitix.sdk.Unilitix
import io.unilitix.sdk.UnilitixConsent

/**
 * `ReadableMap.toHashMap()` returns `HashMap<String, Any?>` since React Native
 * 0.79; the Android SDK takes `Map<String, Any>`. JS `null`/`undefined`
 * properties carry no information on the wire, so they are dropped here.
 */
internal fun ReadableMap?.toNonNullMap(): Map<String, Any> {
  val source = this?.toHashMap() ?: return emptyMap()
  val out = LinkedHashMap<String, Any>(source.size)
  for ((key, value) in source) {
    if (value != null) out[key] = value
  }
  return out
}

class UnilitixModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "Unilitix"

  /**
   * React Native calls @ReactMethods on its native-modules thread, but the SDK
   * registers lifecycle observers and Activity callbacks, which Android only
   * allows on the main thread. Init therefore runs there, then attaches to the
   * Activity that already exists (JS starts after MainActivity is created).
   */
  @ReactMethod
  fun init(options: ReadableMap, promise: Promise) {
    UiThreadUtil.runOnUiThread { initOnMainThread(options, promise) }
  }

  private fun initOnMainThread(options: ReadableMap, promise: Promise) {
    try {
      val apiKey = options.getString("apiKey")
        ?: return promise.reject("MISSING_API_KEY",
            "apiKey is required")
      val app = reactContext.applicationContext as Application
      // granted | pending | denied; a decision persisted on an earlier launch
      // wins inside the library.
      val consent = UnilitixConsent.fromValue(options.getString("consent"))
        ?: UnilitixConsent.GRANTED

      Unilitix.init(app, apiKey, consent) {
        options.getString("apiUrl")
          ?.let { apiUrl = it }
        if (options.hasKey("debug"))
          debugLogging = options.getBoolean("debug")
        // Screens come from JS navigation (Unilitix.screen); the native
        // tracker would report the host Activity ("MainActivity") as a
        // screen on every resume. Same as the iOS bridge.
        autoTrackScreens = false
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
        if (options.hasKey("flushBatchSize"))
          flushBatchSize =
            options.getInt("flushBatchSize")
        if (options.hasKey("maxOfflineEvents"))
          maxOfflineEvents =
            options.getInt("maxOfflineEvents")
        if (options.hasKey("sessionTimeoutSeconds"))
          sessionTimeoutSeconds =
            options.getInt("sessionTimeoutSeconds")
        if (options.hasKey("maskInputs")) {
          maskInputs = options.getBoolean("maskInputs")
          maskInputsInScreenshots = options.getBoolean("maskInputs")
        }
        if (options.hasKey("maskInputsInScreenshots"))
          maskInputsInScreenshots =
            options.getBoolean("maskInputsInScreenshots")
        if (options.hasKey("maskAllText"))
          maskAllText = options.getBoolean("maskAllText")
        if (options.hasKey("maskImages"))
          maskImages = options.getBoolean("maskImages")
        if (options.hasKey("maxScreenshotsPerMinute"))
          maxScreenshotsPerMinute =
            options.getInt("maxScreenshotsPerMinute")
        if (options.hasKey("screenshotHeartbeatMs"))
          screenshotHeartbeatMs =
            options.getDouble("screenshotHeartbeatMs").toLong()
        if (options.hasKey("captureSnapshots"))
          captureSnapshots =
            options.getBoolean("captureSnapshots")
        if (options.hasKey("captureScreenshots"))
          captureScreenshots =
            options.getBoolean("captureScreenshots")
        if (options.hasKey("uploadScreenshotsOnWifiOnly"))
          uploadScreenshotsOnWifiOnly =
            options.getBoolean("uploadScreenshotsOnWifiOnly")
        if (options.hasKey("snapshotIntervalMs"))
          snapshotIntervalMs =
            options.getInt("snapshotIntervalMs").toLong()
        if (options.hasKey("maxSnapshotsPerSession"))
          maxSnapshotsPerSession =
            options.getInt("maxSnapshotsPerSession")
        if (options.hasKey("screenshotIntervalMs"))
          screenshotIntervalMs =
            options.getInt("screenshotIntervalMs").toLong()
        if (options.hasKey("screenshotQuality"))
          screenshotQuality =
            options.getInt("screenshotQuality")
        if (options.hasKey("screenshotMaxWidth"))
          screenshotMaxWidth =
            options.getInt("screenshotMaxWidth")
        if (options.hasKey("maxScreenshotsPerSession"))
          maxScreenshotsPerSession =
            options.getInt("maxScreenshotsPerSession")
        // `sampleRate` from JS is the replay sample rate. The Android SDK's
        // own sampleRate drops individual events instead, so it is not
        // passed on: replay sampling on Android needs SDK support first.
      }
      // Fatal JS errors are reported from JS (recordException with fatal);
      // React Native then re-throws them as JavascriptException. Let the SDK
      // pass that one on unrecorded so the crash is not counted twice.
      Unilitix.setCrashFilter { t ->
        !(t.javaClass.name == JS_EXCEPTION_CLASS &&
          System.currentTimeMillis() - lastJsFatalAt < JS_FATAL_WINDOW_MS)
      }
      reactContext.currentActivity?.let { Unilitix.attachToActivity(it) }
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject("INIT_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun track(options: ReadableMap, promise: Promise) {
    try {
      val event = options.getString("event")
        ?: return promise.reject("MISSING_EVENT",
            "event is required")
      val props = options.getMap("properties").toNonNullMap()
      Unilitix.trackEvent(event, props)
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject("TRACK_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun identify(options: ReadableMap, promise: Promise) {
    try {
      val userId = options.getString("userId")
        ?: return promise.reject("MISSING_USER_ID",
            "userId is required")
      val traits = options.getMap("traits").toNonNullMap()
      Unilitix.identify(userId, traits)
      promise.resolve(null)
    } catch (e: Throwable) {
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
    } catch (e: Throwable) {
      promise.reject("SCREEN_ERROR", e.message, e)
    }
  }

  /**
   * Reports an error the JS side caught (uncaught JS error, unhandled
   * promise rejection, or `Unilitix.captureException`). `fatal` reports a
   * CRASH that the library persists before this method resolves, so the JS
   * handler can safely chain to React Native's default (process-ending)
   * handler afterwards.
   */
  @ReactMethod
  fun recordException(options: ReadableMap, promise: Promise) {
    try {
      val type = options.getString("type") ?: "Error"
      val message = options.getString("message") ?: ""
      val stack = options.getString("stack") ?: ""
      val fatal = options.hasKey("fatal") && options.getBoolean("fatal")
      if (fatal) lastJsFatalAt = System.currentTimeMillis()
      Unilitix.recordException(type, message, stack, fatal, "js")
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject("EXCEPTION_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun addBreadcrumb(options: ReadableMap, promise: Promise) {
    try {
      val message = options.getString("message")
        ?: return promise.reject("MISSING_MESSAGE", "message is required")
      val category = options.getString("category") ?: "custom"
      Unilitix.addBreadcrumb(message, category)
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject("BREADCRUMB_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun startSession(options: ReadableMap?, promise: Promise) {
    try { Unilitix.startSession(); promise.resolve(null) }
    catch (e: Throwable) {
      promise.reject("SESSION_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun endSession(options: ReadableMap?, promise: Promise) {
    try { Unilitix.endSession(); promise.resolve(null) }
    catch (e: Throwable) {
      promise.reject("SESSION_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun flush(options: ReadableMap?, promise: Promise) {
    try { Unilitix.flush(); promise.resolve(null) }
    catch (e: Throwable) {
      promise.reject("FLUSH_ERROR", e.message, e)
    }
  }

  /** `{ value: 'granted' | 'pending' | 'denied' }`, persisted by the library. */
  @ReactMethod
  fun setConsent(options: ReadableMap, promise: Promise) {
    try {
      val consent = UnilitixConsent.fromValue(options.getString("value"))
        ?: return promise.reject("INVALID_CONSENT",
            "value must be granted, pending or denied")
      Unilitix.setConsent(consent)
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject("CONSENT_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun optOut(options: ReadableMap?, promise: Promise) {
    try { Unilitix.optOut(); promise.resolve(null) }
    catch (e: Throwable) {
      promise.reject("OPT_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun optIn(options: ReadableMap?, promise: Promise) {
    try { Unilitix.optIn(); promise.resolve(null) }
    catch (e: Throwable) {
      promise.reject("OPT_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun reset(options: ReadableMap?, promise: Promise) {
    try { Unilitix.reset(); promise.resolve(null) }
    catch (e: Throwable) {
      promise.reject("RESET_ERROR", e.message, e)
    }
  }

  companion object {
    private const val JS_EXCEPTION_CLASS = "com.facebook.react.common.JavascriptException"
    private const val JS_FATAL_WINDOW_MS = 15_000L

    @Volatile
    private var lastJsFatalAt = 0L
  }
}
