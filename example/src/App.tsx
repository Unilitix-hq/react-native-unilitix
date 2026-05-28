import { View, Text, StyleSheet } from 'react-native';
import Unilitix from 'react-native-unilitix';

Unilitix.init('YOUR_API_KEY', { debug: true });

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Unilitix React Native SDK</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
