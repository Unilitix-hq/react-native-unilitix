/**
 * Codegen spec of the native view behind `<UnilitixUnmask>` (Fabric
 * component; a Paper view manager of the same name serves the legacy
 * architecture). Its subtree is shown in replay even with `maskAllText` /
 * `maskImages`; text inputs stay masked.
 */
import { codegenNativeComponent, type ViewProps } from 'react-native';

export interface NativeProps extends ViewProps {}

export default codegenNativeComponent<NativeProps>('UnilitixUnmaskView');
