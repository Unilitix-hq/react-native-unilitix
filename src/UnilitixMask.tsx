import { View, type ViewProps } from 'react-native';

/**
 * Blacks out its children in session replay (screenshots and view-tree
 * snapshots), whatever the masking options say: balances, card numbers,
 * documents, QR codes. Renders a plain `View` where there is no native
 * module (web, tests); the native implementation is `UnilitixMask.native`.
 *
 * ```tsx
 * <UnilitixMask><Text>{balance}</Text></UnilitixMask>
 * ```
 */
export function UnilitixMask(props: ViewProps) {
  return <View {...props} />;
}

/**
 * Shows its children in session replay even when `maskAllText` or
 * `maskImages` is on. Use it for content with no personal data that is
 * needed to understand the screen (headings, button labels). Never
 * unmasks text inputs, and never overrides an enclosing `<UnilitixMask>`.
 */
export function UnilitixUnmask(props: ViewProps) {
  return <View {...props} />;
}
