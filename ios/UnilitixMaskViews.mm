// Native views behind <UnilitixMask> and <UnilitixUnmask>.
//
// The vendored core decides masking from two UIView flags declared in
// ReplayPrivacy.swift: `unilitixPrivate` (always blacked out, subtree
// included) and `unilitixUnmasked` (shown despite maskAllText / maskImages;
// inputs stay masked). These views only set the flag.
//
// Legacy architecture (Paper): RCTViewManager subclasses vend RCTViews.
// New Architecture (Fabric): RCTViewComponentView subclasses, registered
// through package.json codegenConfig.ios.componentProvider (RN 0.77+) and
// the `<Name>Cls` functions (older Fabric component lookup).

#import <React/RCTViewManager.h>
#import <React/RCTView.h>

#if __has_include(<Unilitix/Unilitix-Swift.h>)
#import <Unilitix/Unilitix-Swift.h>
#else
#import "Unilitix-Swift.h"
#endif

// ── Paper ────────────────────────────────────────────────────────────────────

@interface UnilitixMaskViewManager : RCTViewManager
@end

@implementation UnilitixMaskViewManager

RCT_EXPORT_MODULE(UnilitixMaskView)

- (UIView *)view
{
  RCTView *view = [RCTView new];
  view.unilitixPrivate = YES;
  return view;
}

@end

@interface UnilitixUnmaskViewManager : RCTViewManager
@end

@implementation UnilitixUnmaskViewManager

RCT_EXPORT_MODULE(UnilitixUnmaskView)

- (UIView *)view
{
  RCTView *view = [RCTView new];
  view.unilitixUnmasked = YES;
  return view;
}

@end

// ── Fabric ───────────────────────────────────────────────────────────────────

#ifdef RCT_NEW_ARCH_ENABLED

#import <React/RCTViewComponentView.h>
#import <react/renderer/components/RNUnilitixSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNUnilitixSpec/Props.h>
#import <react/renderer/components/RNUnilitixSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface UnilitixMaskViewComponentView : RCTViewComponentView
@end

@implementation UnilitixMaskViewComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<UnilitixMaskViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const UnilitixMaskViewProps>();
    _props = defaultProps;
    self.unilitixPrivate = YES;
  }
  return self;
}

// Component views are recycled; the flag is part of what this view is.
- (void)prepareForRecycle
{
  [super prepareForRecycle];
  self.unilitixPrivate = YES;
}

@end

@interface UnilitixUnmaskViewComponentView : RCTViewComponentView
@end

@implementation UnilitixUnmaskViewComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<UnilitixUnmaskViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const UnilitixUnmaskViewProps>();
    _props = defaultProps;
    self.unilitixUnmasked = YES;
  }
  return self;
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];
  self.unilitixUnmasked = YES;
}

@end

// C linkage, as declared in the generated RCTThirdPartyFabricComponentsProvider.h.
extern "C" Class<RCTComponentViewProtocol> UnilitixMaskViewCls(void)
{
  return UnilitixMaskViewComponentView.class;
}

extern "C" Class<RCTComponentViewProtocol> UnilitixUnmaskViewCls(void)
{
  return UnilitixUnmaskViewComponentView.class;
}

#endif
