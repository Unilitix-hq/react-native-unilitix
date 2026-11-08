#import "Unilitix.h"
#import <React/RCTBridgeModule.h>

// The Swift side (UnilitixBridge + the vendored UnilitixCore) is compiled
// into this pod; its generated header is named after the pod's module.
#if __has_include(<Unilitix/Unilitix-Swift.h>)
#import <Unilitix/Unilitix-Swift.h>
#else
#import "Unilitix-Swift.h"
#endif

// Every method takes one options dictionary and a promise — the same shape
// the JS side sends to Android (src/NativeUnilitix.ts). Calls never reject:
// analytics must not throw into the app, and the core queues work on its
// own serial queue.
//
// New Architecture: the class conforms to the codegen'd NativeUnilitixSpec
// and returns its JSI binding from getTurboModule:. Legacy architecture: the
// same methods are exported to the bridge with RCT_EXPORT_METHOD.

@implementation Unilitix

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(init:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge start:options];
  resolve(nil);
}

RCT_EXPORT_METHOD(track:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge track:options];
  resolve(nil);
}

RCT_EXPORT_METHOD(identify:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge identify:options];
  resolve(nil);
}

RCT_EXPORT_METHOD(screen:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge screen:options];
  resolve(nil);
}

RCT_EXPORT_METHOD(recordException:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge recordException:options];
  resolve(nil);
}

RCT_EXPORT_METHOD(addBreadcrumb:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge addBreadcrumb:options];
  resolve(nil);
}

RCT_EXPORT_METHOD(setConsent:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge setConsent:options];
  resolve(nil);
}

RCT_EXPORT_METHOD(startSession:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge startSession];
  resolve(nil);
}

RCT_EXPORT_METHOD(endSession:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge endSession];
  resolve(nil);
}

RCT_EXPORT_METHOD(flush:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge flush];
  resolve(nil);
}

RCT_EXPORT_METHOD(optOut:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge setConsent:@{ @"value" : @"denied" }];
  resolve(nil);
}

RCT_EXPORT_METHOD(optIn:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge setConsent:@{ @"value" : @"granted" }];
  resolve(nil);
}

RCT_EXPORT_METHOD(reset:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge reset];
  resolve(nil);
}

RCT_EXPORT_METHOD(currentSessionId:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [UnilitixBridge currentSessionId:^(NSString *sessionId) {
    resolve(sessionId);
  }];
}

RCT_EXPORT_METHOD(getBuildInfo:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  resolve([UnilitixBridge buildInfo]);
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeUnilitixSpecJSI>(params);
}
#endif

@end
