import { View, type ViewProps } from 'react-native';
import { isNativeModuleLinked } from './nativeModule';
import UnilitixMaskView from './UnilitixMaskViewNativeComponent';
import UnilitixUnmaskView from './UnilitixUnmaskViewNativeComponent';

/**
 * Blacks out its children in session replay (screenshots and view-tree
 * snapshots), whatever the masking options say: balances, card numbers,
 * documents, QR codes.
 *
 * Backed by a native view (Fabric component or Paper view manager) that
 * the cores treat as private: iOS `UIView.unilitixPrivate`, Android
 * `@UnilitixPrivate`. Without the native module (Expo Go) it is a `View`.
 *
 * ```tsx
 * <UnilitixMask><Text>{balance}</Text></UnilitixMask>
 * ```
 */
export function UnilitixMask(props: ViewProps) {
  if (!isNativeModuleLinked()) return <View {...props} />;
  return <UnilitixMaskView {...props} />;
}

/**
 * Shows its children in session replay even when `maskAllText` or
 * `maskImages` is on (iOS `UIView.unilitixUnmasked`, Android
 * `Unilitix.unmask(view)`). Use it for content with no personal data that
 * is needed to understand the screen (headings, button labels). Never
 * unmasks text inputs, and never overrides an enclosing `<UnilitixMask>`.
 */
export function UnilitixUnmask(props: ViewProps) {
  if (!isNativeModuleLinked()) return <View {...props} />;
  return <UnilitixUnmaskView {...props} />;
}
