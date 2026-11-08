import { useEffect, useState } from 'react';
import { Button, View, Text, StyleSheet } from 'react-native';
import Unilitix, { UnilitixMask, UnilitixUnmask } from 'react-native-unilitix';
import e2e from './e2e.json';

// CI's e2e job points the app at a local fake ingest server
// (example/e2e/fake-server.mjs) by rewriting e2e.json before bundling.
const apiUrl = (e2e as { apiUrl: string | null }).apiUrl ?? undefined;

export default function App() {
  const [status, setStatus] = useState('Starting');

  useEffect(() => {
    Unilitix.init(apiUrl ? 'ul_test_e2e' : 'YOUR_API_KEY', {
      debug: __DEV__,
      apiUrl,
      // The e2e job only needs events, not replay uploads.
      captureScreenshots: !apiUrl,
      captureSnapshots: !apiUrl,
    }).then(() => {
      Unilitix.screen('Home');
      setStatus('Ready');
    });
  }, []);

  const sendTestEvent = async () => {
    await Unilitix.track('e2e_ping', { source: 'example' });
    await Unilitix.flush();
    setStatus('Event sent');
  };

  return (
    <View style={styles.container}>
      <UnilitixUnmask>
        <Text>Unilitix React Native SDK</Text>
      </UnilitixUnmask>
      <UnilitixMask>
        <Text>Balance: ₦12,500 (masked in replay)</Text>
      </UnilitixMask>
      <Button testID="send" title="Send test event" onPress={sendTestEvent} />
      <Text testID="status">{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});
