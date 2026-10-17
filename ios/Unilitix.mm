#import "Unilitix.h"
#import <React/RCTBridgeModule.h>

// Every method takes one options dictionary and a promise — the same shape
// the JS side sends to Android — so wiring the iOS SDK later changes only
// the bodies, never the call shapes. Until then every call rejects; the JS
// layer never reaches these on iOS (it no-ops first and reports
// Unilitix.isAvailable = false), so the rejection is a guard, not a path.

static NSString *const kNotSupported = @"IOS_NOT_SUPPORTED";
static NSString *const kNotSupportedMessage =
    @"Unilitix iOS SDK is not yet available. Android only in this version.";

@implementation Unilitix

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(init:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(kNotSupported, kNotSupportedMessage, nil);
}

RCT_EXPORT_METHOD(track:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(kNotSupported, kNotSupportedMessage, nil);
}

RCT_EXPORT_METHOD(identify:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(kNotSupported, kNotSupportedMessage, nil);
}

RCT_EXPORT_METHOD(screen:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(kNotSupported, kNotSupportedMessage, nil);
}

RCT_EXPORT_METHOD(recordException:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(kNotSupported, kNotSupportedMessage, nil);
}

RCT_EXPORT_METHOD(addBreadcrumb:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(kNotSupported, kNotSupportedMessage, nil);
}

RCT_EXPORT_METHOD(startSession:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(kNotSupported, kNotSupportedMessage, nil);
}

RCT_EXPORT_METHOD(endSession:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(kNotSupported, kNotSupportedMessage, nil);
}

RCT_EXPORT_METHOD(flush:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(kNotSupported, kNotSupportedMessage, nil);
}

RCT_EXPORT_METHOD(optOut:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(kNotSupported, kNotSupportedMessage, nil);
}

RCT_EXPORT_METHOD(optIn:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(kNotSupported, kNotSupportedMessage, nil);
}

RCT_EXPORT_METHOD(reset:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(kNotSupported, kNotSupportedMessage, nil);
}

@end
