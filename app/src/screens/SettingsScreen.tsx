import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/nav';
import { loadState, setMyName } from '../storage/store';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const [myName, setName] = React.useState('Me');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      const state = await loadState();
      setName(state.myName || 'Me');
    })();
  }, []);

  async function onSave() {
    setSaving(true);
    try {
      await setMyName(myName);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.label}>My name</Text>
      <TextInput
        style={styles.input}
        value={myName}
        onChangeText={setName}
        placeholder="e.g., Jason"
        placeholderTextColor="rgba(255,255,255,0.35)"
      />

      <Pressable style={[styles.btn, saving && styles.btnDisabled]} onPress={onSave} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save'}</Text>
      </Pressable>

      <Text style={styles.note}>
        Handback is local-first. This name is stored only on this device.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d12', paddingTop: 64, paddingHorizontal: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  label: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 8 },
  input: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: 16,
  },
  btn: {
    marginTop: 16,
    backgroundColor: '#6ee7b7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#05140d', fontSize: 15, fontWeight: '800' },
  note: { marginTop: 14, color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 18 },
});
