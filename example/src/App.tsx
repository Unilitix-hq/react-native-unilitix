import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Unilitix from 'react-native-unilitix';

export default function App() {
  useEffect(() => {
    Unilitix.init('YOUR_API_KEY', { debug: true }).then(() => {
      Unilitix.screen('Home');
    });
  }, []);

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
