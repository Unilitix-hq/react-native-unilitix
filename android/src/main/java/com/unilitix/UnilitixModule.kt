package com.unilitix

import com.facebook.react.bridge.ReactApplicationContext

class UnilitixModule(reactContext: ReactApplicationContext) :
  NativeUnilitixSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeUnilitixSpec.NAME
  }
}
