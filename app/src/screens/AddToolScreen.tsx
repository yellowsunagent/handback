import React from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/nav';
import { addTool, loadState } from '../storage/store';
import { newId } from '../lib/id';

type Props = NativeStackScreenProps<RootStackParamList, 'AddTool'>;

export function AddToolScreen({ navigation }: Props) {
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function onSave() {
    const cleaned = name.trim();
    if (!cleaned) {
      Alert.alert('Tool name required', 'Give it a short name like “Drill” or “Socket set”.');
      return;
    }

    setSaving(true);
    try {
      const state = await loadState();
      const toolId = await newId('tool');
      await addTool({
        id: toolId,
        name: cleaned,
        ownerName: state.myName || 'Me',
        createdAt: new Date().toISOString(),
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add tool</Text>
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g., Drill"
        placeholderTextColor="rgba(255,255,255,0.35)"
        autoFocus
      />

      <Pressable style={[styles.btn, saving && styles.btnDisabled]} onPress={onSave} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save tool'}</Text>
      </Pressable>
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
});
