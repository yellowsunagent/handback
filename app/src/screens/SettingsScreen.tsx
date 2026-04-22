import React from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/nav';
import { addTool, loadState, resetState, setMyName } from '../storage/store';
import { newId } from '../lib/id';

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

  async function onSeedDemo() {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert('Seed demo tools?', 'Adds a handful of tools to make demos fast.', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Add demo tools', style: 'default', onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;

    const state = await loadState();
    const ownerName = state.myName || 'Me';

    const names = ['Drill', 'Socket set', 'Hammer', 'Ladder', 'Leaf blower'];
    for (const n of names) {
      await addTool({
        id: await newId('tool'),
        name: n,
        ownerName,
        createdAt: new Date().toISOString(),
      });
    }

    Alert.alert('Done', 'Demo tools added.');
  }

  async function onReset() {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert('Reset local data?', 'This clears all tools and loans on this device.', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Reset', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;

    await resetState();
    Alert.alert('Reset complete', 'Local data cleared.');
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

      <Pressable style={[styles.btn, styles.secondary]} onPress={() => void onSeedDemo()}>
        <Text style={styles.secondaryText}>Seed demo tools</Text>
      </Pressable>

      <Pressable style={[styles.btn, styles.danger]} onPress={() => void onReset()}>
        <Text style={styles.dangerText}>Reset local data</Text>
      </Pressable>

      <Text style={styles.note}>Handback is local-first. This name is stored only on this device.</Text>
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
  secondary: { backgroundColor: 'rgba(255,255,255,0.08)' },
  secondaryText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '800' },
  danger: { backgroundColor: '#ef4444' },
  dangerText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  note: { marginTop: 14, color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 18 },
});
