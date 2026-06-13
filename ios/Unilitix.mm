#import "Unilitix.h"
#import <React/RCTBridgeModule.h>

@implementation Unilitix

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(init:(NSString *)apiKey
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(@"IOS_NOT_SUPPORTED", @"Unilitix iOS SDK is not yet available. Android only in this version.", nil);
}

RCT_EXPORT_METHOD(track:(NSString *)event
                  properties:(NSDictionary *)properties
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(@"IOS_NOT_SUPPORTED", @"Unilitix iOS SDK is not yet available.", nil);
}

RCT_EXPORT_METHOD(identify:(NSString *)userId
                  traits:(NSDictionary *)traits
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(@"IOS_NOT_SUPPORTED", @"Unilitix iOS SDK is not yet available.", nil);
}

RCT_EXPORT_METHOD(screen:(NSString *)name
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(@"IOS_NOT_SUPPORTED", @"Unilitix iOS SDK is not yet available.", nil);
}

RCT_EXPORT_METHOD(flush:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(@"IOS_NOT_SUPPORTED", @"Unilitix iOS SDK is not yet available.", nil);
}

RCT_EXPORT_METHOD(optOut:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(@"IOS_NOT_SUPPORTED", @"Unilitix iOS SDK is not yet available.", nil);
}

RCT_EXPORT_METHOD(optIn:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(@"IOS_NOT_SUPPORTED", @"Unilitix iOS SDK is not yet available.", nil);
}

RCT_EXPORT_METHOD(reset:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(@"IOS_NOT_SUPPORTED", @"Unilitix iOS SDK is not yet available.", nil);
}

RCT_EXPORT_METHOD(startSession:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(@"IOS_NOT_SUPPORTED", @"Unilitix iOS SDK is not yet available.", nil);
}

RCT_EXPORT_METHOD(endSession:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  reject(@"IOS_NOT_SUPPORTED", @"Unilitix iOS SDK is not yet available.", nil);
}

@end
