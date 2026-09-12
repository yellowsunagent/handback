import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Person } from '../types/models';
import { newId } from '../lib/id';
import { resolvePhotoUri } from '../services/native';
import { useApp } from './AppContext';
import { colors, common } from './theme';

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  if (!scroll) {
    return <SafeAreaView style={[common.screen, style]} edges={['top', 'bottom']}>{children}</SafeAreaView>;
  }
  return (
    <SafeAreaView style={[common.screen, style]} edges={['top', 'bottom']}>
      <ScrollView style={common.flex} contentContainerStyle={common.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function KeyboardScreen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={common.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={common.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        <ScrollView contentContainerStyle={common.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Header({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.headerTitleWrap}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          ) : null}
          <Text style={common.title}>{title}</Text>
        </View>
        {action}
      </View>
      {subtitle ? <Text style={common.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
  busy = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const buttonStyle =
    variant === 'primary'
      ? styles.primaryButton
      : variant === 'danger'
        ? styles.dangerButton
        : variant === 'quiet'
          ? styles.quietButton
          : styles.secondaryButton;
  const textStyle = variant === 'primary' ? styles.primaryButtonText : variant === 'danger' ? styles.dangerButtonText : styles.secondaryButtonText;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [common.button, buttonStyle, (disabled || busy) && styles.disabled, pressed && styles.pressed, style]}
    >
      {busy ? <ActivityIndicator color={variant === 'primary' ? colors.primaryInk : colors.ink} /> : <Text style={[common.buttonText, textStyle]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={common.label}>{label}</Text>
      <TextInput
        {...props}
        style={[common.input, props.multiline && styles.multiline, props.style]}
        placeholderTextColor={colors.dim}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[common.card, style]}>{children}</View>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Card style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={common.note}>{body}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </Card>
  );
}

export function StatusPill({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'good' | 'warning' | 'danger' }) {
  const color = tone === 'good' ? colors.primary : tone === 'warning' ? colors.warning : tone === 'danger' ? colors.danger : colors.muted;
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={[styles.toggleText, disabled && styles.disabled]}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.line, true: '#4c967b' }}
        thumbColor={value ? colors.primary : '#d9e2ec'}
      />
    </View>
  );
}

export function PhotoThumbnail({ uri, size = 68 }: { uri?: string; size?: number }) {
  const [resolvedUri, setResolvedUri] = React.useState<string | undefined>();
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let current = true;
    if (!uri) {
      setResolvedUri(undefined);
      setFailed(false);
    } else {
      setFailed(false);
      void Promise.resolve().then(() => resolvePhotoUri(uri)).then((next) => {
        if (current) {
          setResolvedUri(next);
          setFailed(!next);
        }
      }).catch(() => {
        if (current) setResolvedUri(undefined);
      });
    }
    return () => {
      current = false;
    };
  }, [uri]);

  if (!resolvedUri || failed) {
    return (
      <View style={[styles.photoPlaceholder, { width: size, height: size }]}>
        <Text style={styles.photoPlaceholderText}>{failed ? '?' : '⌁'}</Text>
      </View>
    );
  }
  return <Image onError={() => setFailed(true)} source={{ uri: resolvedUri }} style={{ width: size, height: size, borderRadius: 12, backgroundColor: colors.surfaceRaised }} />;
}

type PersonPickerProps = {
  label: string;
  people: Person[];
  value?: string;
  onChange: (personId: string) => void;
  excludeIds?: string[];
  allowCreate?: boolean;
  placeholder?: string;
};

export function PersonPicker({
  label,
  people,
  value,
  onChange,
  excludeIds = [],
  allowCreate = true,
  placeholder = 'Choose a person',
}: PersonPickerProps) {
  const { commit } = useApp();
  const [open, setOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const lock = React.useRef(false);
  const selected = people.find((person) => person.id === value);
  const visiblePeople = people.filter((person) => {
    if (excludeIds.includes(person.id)) return false;
    return !person.archived || person.id === value;
  });

  async function createPerson() {
    if (lock.current) return;
    const cleaned = name.trim();
    if (!cleaned) return;
    lock.current = true;
    setSaving(true);
    try {
      const person: Person = {
        id: await newId('person'),
        name: cleaned,
        note: note.trim() || undefined,
      };
      await commit({ type: 'person', person });
      onChange(person.id);
      setName('');
      setNote('');
      setCreateOpen(false);
      setOpen(false);
    } catch (error) {
      // The form's parent owns the app-level error surface. Keep the picker open so
      // the user's entered values remain available for a retry.
      Alert.alert('Could not add person', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={styles.field}>
      <Text style={common.label}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.select}>
        <Text style={selected ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
          {selected ? selected.name : placeholder}
        </Text>
        <Text style={styles.selectChevron}>⌄</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button">
                <Text style={styles.modalClose}>Close</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.modalList}>
              {visiblePeople.length === 0 ? <Text style={common.note}>No people yet.</Text> : null}
              {visiblePeople.map((person) => (
                <Pressable
                  key={person.id}
                  onPress={() => {
                    onChange(person.id);
                    setOpen(false);
                  }}
                  style={[styles.personOption, person.id === value && styles.personOptionSelected]}
                >
                  <View style={styles.personOptionMain}>
                    <Text style={styles.personOptionName}>{person.name}</Text>
                    {person.note ? <Text style={common.note}>{person.note}</Text> : null}
                  </View>
                  {person.id === value ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
            {allowCreate ? <Button label="Add a new person" onPress={() => { setOpen(false); setCreateOpen(true); }} variant="secondary" /> : null}
          </View>
        </View>
      </Modal>

      <Modal visible={createOpen} animationType="fade" transparent onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a person</Text>
            <Text style={[common.note, styles.modalIntro]}>A name is required. The optional note helps distinguish people with the same name.</Text>
            <Field label="Name" value={name} onChangeText={setName} autoFocus placeholder="e.g. Chris" returnKeyType="next" />
            <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. next-door neighbor" />
            <Button label="Save person" onPress={() => void createPerson()} variant="primary" busy={saving} disabled={!name.trim()} />
            <Button label="Cancel" onPress={() => setCreateOpen(false)} variant="quiet" disabled={saving} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

export const styles = StyleSheet.create({
  header: { marginBottom: 24, paddingTop: Platform.OS === 'ios' ? 8 : 20 },
  headerTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerTitleWrap: { alignItems: 'center', flexDirection: 'row', flexShrink: 1 },
  back: { height: 38, justifyContent: 'center', marginRight: 4, width: 28 },
  backText: { color: colors.ink, fontSize: 36, fontWeight: '300', lineHeight: 38 },
  field: { marginBottom: 17 },
  multiline: { minHeight: 92, textAlignVertical: 'top' },
  hint: { color: colors.dim, fontSize: 12, lineHeight: 17, marginTop: 6 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: 6 },
  select: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  selectText: { color: colors.ink, flex: 1, fontSize: 16 },
  selectPlaceholder: { color: colors.dim, flex: 1, fontSize: 16 },
  selectChevron: { color: colors.muted, fontSize: 21, marginLeft: 10 },
  primaryButton: { backgroundColor: colors.primary },
  primaryButtonText: { color: colors.primaryInk },
  secondaryButton: { backgroundColor: colors.surfaceRaised, borderColor: colors.line, borderWidth: 1 },
  secondaryButtonText: { color: colors.ink },
  dangerButton: { backgroundColor: colors.dangerSurface, borderColor: '#74373a', borderWidth: 1 },
  dangerButtonText: { color: colors.danger },
  quietButton: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
  empty: { marginTop: 4 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 5 },
  emptyAction: { marginTop: 15 },
  pill: { alignSelf: 'flex-start', borderRadius: 99, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '800' },
  toggleRow: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13 },
  toggleText: { flex: 1, paddingRight: 16 },
  toggleLabel: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  photoPlaceholder: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: 12, justifyContent: 'center' },
  photoPlaceholderText: { color: colors.dim, fontSize: 27 },
  modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.62)', flex: 1, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.canvas, borderColor: colors.line, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', padding: 18 },
  modalHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  modalClose: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  modalIntro: { marginBottom: 15 },
  modalList: { marginBottom: 13 },
  personOption: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 58, paddingVertical: 10 },
  personOptionSelected: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 10 },
  personOptionMain: { flex: 1 },
  personOptionName: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  check: { color: colors.primary, fontSize: 19, fontWeight: '800', marginLeft: 10 },
});
