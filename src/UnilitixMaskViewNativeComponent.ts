/**
 * Codegen spec of the native view behind `<UnilitixMask>` (Fabric component;
 * a Paper view manager of the same name serves the legacy architecture).
 * Its subtree is always blacked out in session replay.
 */
import { codegenNativeComponent, type ViewProps } from 'react-native';

export interface NativeProps extends ViewProps {}

export default codegenNativeComponent<NativeProps>('UnilitixMaskView');
