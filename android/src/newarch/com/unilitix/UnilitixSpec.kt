package com.unilitix

import com.facebook.react.bridge.ReactApplicationContext

/**
 * New Architecture: the module implements the codegen'd TurboModule spec
 * (generated from src/NativeUnilitix.ts into
 * build/generated/source/codegen/java).
 */
abstract class UnilitixSpec(context: ReactApplicationContext) :
  NativeUnilitixSpec(context)
