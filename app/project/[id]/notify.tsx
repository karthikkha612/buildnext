import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  doc, onSnapshot, addDoc, collection,
  query, orderBy, limit, getDocs, updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project } from '@/types';
import {
  ArrowLeft, CheckCircle2, Clock, AlertCircle,
  MessageSquare, Zap, Send, Circle, CheckCheck, ChevronDown,
} from 'lucide-react-native';

// ─── Constants ────────────────────────────────────────────────────
const BLUE       = '#1A56DB';
const BLUE_LIGHT = '#EEF2FF';

const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string; border: string; icon: any;
}> = {
  completed:   { label: 'Completed',   color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: CheckCircle2 },
  in_progress: { label: 'In Progress', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: Clock        },
  upcoming:    { label: 'Upcoming',    color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', icon: Circle       },
};

const STATUS_OPTIONS = [
  { key: 'upcoming',    label: 'Upcoming',    color: '#6B7280', bg: '#F3F4F6', icon: '⏳' },
  { key: 'in_progress', label: 'In Progress', color: '#D97706', bg: '#FFFBEB', icon: '🔧' },
  { key: 'completed',   label: 'Completed',   color: '#16A34A', bg: '#F0FDF4', icon: '✅' },
];

const QUICK_TEMPLATES = [
  { id: '1', icon: '📅', label: 'On Schedule',     text: 'Work is progressing smoothly and is on schedule. No delays expected.' },
  { id: '2', icon: '🚚', label: 'Material Ready',  text: 'All materials have been delivered to the site. Work will begin tomorrow.' },
  { id: '3', icon: '🔍', label: 'Inspection Done', text: 'Site inspection has been completed successfully. All clear to proceed.' },
  { id: '4', icon: '💰', label: 'Payment Due',     text: 'The payment for the next phase is now due. Please arrange at your earliest convenience.' },
  { id: '5', icon: '⛈️', label: 'Weather Delay',  text: 'Due to heavy rainfall, work has been temporarily paused. We will resume soon.' },
  { id: '6', icon: '🎉', label: 'Phase Done',      text: 'We are pleased to inform you that the current phase has been completed successfully!' },
];

// ─── Types ────────────────────────────────────────────────────────
interface RecentUpdate {
  id: string; message: string;
  phases: string[]; sentAt: any;
}

// ─── Helpers ──────────────────────────────────────────────────────
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ─── Build WhatsApp Message ───────────────────────────────────────
function buildWAMessage(
  projectName: string,
  customerName: string,
  phases: { name: string; status: string }[],
  selectedPhases: string[],
  customMessage: string
): string {
  const now  = new Date();
  const date = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const statusIcon:  Record<string, string> = {
    completed: '✅', in_progress: '🔧', upcoming: '⏳',
  };
  const statusLabel: Record<string, string> = {
    completed: 'Completed', in_progress: 'In Progress', upcoming: 'Upcoming',
  };

  let msg = '';
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🏗️ *PROJECT UPDATE*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `👤 *${customerName}*\n`;
  msg += `📁 ${projectName}\n`;
  msg += `🗓️ ${date}  🕐 ${time}\n\n`;
  msg += `─────────────────────\n`;

  if (selectedPhases.length > 0) {
    msg += `\n📋 *PHASE STATUS*\n\n`;
    selectedPhases.forEach((phaseName) => {
      const phase = phases.find((p) => p.name === phaseName);
      const icon  = phase ? (statusIcon[phase.status]  || '📌') : '📌';
      const lbl   = phase ? (statusLabel[phase.status] || '')   : '';
      msg += `${icon} *${phaseName}*\n`;
      msg += `    ↳ Status: _${lbl}_\n\n`;
    });
    msg += `─────────────────────\n`;
  }

  if (customMessage.trim()) {
    msg += `\n📝 *NOTE FROM CONTRACTOR*\n\n`;
    msg += `_${customMessage.trim()}_\n\n`;
    msg += `─────────────────────\n`;
  }

  msg += `\n_Thank you for choosing us!_\n`;
  msg += `_For queries, please reply to this message._\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━`;
  return msg;
}

// ─── Progress Steps Component ─────────────────────────────────────
function ProgressSteps({ phases }: { phases: { name: string; status: string }[] }) {
  const completed  = phases.filter((p) => p.status === 'completed').length;
  const inProgress = phases.filter((p) => p.status === 'in_progress').length;
  const total      = phases.length;
  const percent    = total > 0 ? Math.round((completed / total) * 100) : 0;

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: percent / 100,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent]);

  return (
    <View style={pStyles.card}>
      <View style={pStyles.header}>
        <Text style={pStyles.title}>Project Progress</Text>
        <Text style={pStyles.pct}>{percent}%</Text>
      </View>
      <View style={pStyles.track}>
        <Animated.View
          style={[pStyles.fill, {
            width: anim.interpolate({
              inputRange: [0, 1], outputRange: ['0%', '100%'],
            }),
          }]}
        />
      </View>
      <View style={pStyles.stats}>
        <View style={pStyles.stat}>
          <View style={[pStyles.statDot, { backgroundColor: '#16A34A' }]} />
          <Text style={pStyles.statTxt}>{completed} Done</Text>
        </View>
        <View style={pStyles.stat}>
          <View style={[pStyles.statDot, { backgroundColor: '#D97706' }]} />
          <Text style={pStyles.statTxt}>{inProgress} Active</Text>
        </View>
        <View style={pStyles.stat}>
          <View style={[pStyles.statDot, { backgroundColor: '#D1D5DB' }]} />
          <Text style={pStyles.statTxt}>{total - completed - inProgress} Pending</Text>
        </View>
        <Text style={pStyles.totalTxt}>{total} total phases</Text>
      </View>
    </View>
  );
}

// ─── Phase Row (inside the parent dropdown) ───────────────────────
function PhaseRow({
  phase,
  isOpen,
  isSelected,
  onToggleOpen,
  onToggleSelect,
  onStatusChange,
}: {
  phase: { name: string; status: string };
  isOpen: boolean;
  isSelected: boolean;
  onToggleOpen: () => void;
  onToggleSelect: () => void;
  onStatusChange: (newStatus: string) => void;
}) {
  const animHeight = useRef(new Animated.Value(0)).current;
  const animRotate = useRef(new Animated.Value(0)).current;

  const cfg = STATUS_CONFIG[phase.status] || STATUS_CONFIG.upcoming;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animHeight, {
        toValue: isOpen ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(animRotate, {
        toValue: isOpen ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen]);

  const dropdownHeight = animHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, STATUS_OPTIONS.length * 50],
  });

  const chevronRotation = animRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={pr.wrapper}>

      {/* ── Phase Name Row ───────────────────────────── */}
      <TouchableOpacity
        style={[pr.row, isSelected && pr.rowSelected]}
        onPress={onToggleOpen}
        activeOpacity={0.7}
      >
        {/* Checkbox */}
        <TouchableOpacity
          style={[pr.checkbox, isSelected && pr.checkboxActive]}
          onPress={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isSelected && <CheckCircle2 size={14} color="#fff" fill={BLUE} />}
        </TouchableOpacity>

        {/* Name + status pill */}
        <View style={pr.info}>
          <Text style={[pr.name, isSelected && pr.nameActive]} numberOfLines={1}>
            {phase.name}
          </Text>
          <View style={[pr.pill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <View style={[pr.pillDot, { backgroundColor: cfg.color }]} />
            <Text style={[pr.pillTxt, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Chevron */}
        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <ChevronDown size={15} color="#9CA3AF" />
        </Animated.View>
      </TouchableOpacity>

      {/* ── Status Options (animated) ────────────────── */}
      <Animated.View style={{ height: dropdownHeight, overflow: 'hidden' }}>
        <View style={pr.statusList}>
          {STATUS_OPTIONS.map((opt, idx) => {
            const isCurrent = phase.status === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  pr.statusRow,
                  isCurrent && pr.statusRowActive,
                  idx === STATUS_OPTIONS.length - 1 && pr.statusRowLast,
                ]}
                onPress={() => onStatusChange(opt.key)}
                activeOpacity={0.7}
              >
                {/* Left bar */}
                <View style={[pr.bar, { backgroundColor: opt.color }]} />

                {/* Icon + Label */}
                <Text style={pr.statusEmoji}>{opt.icon}</Text>
                <Text style={[
                  pr.statusLabel,
                  isCurrent && { color: opt.color, fontWeight: '700' },
                ]}>
                  {opt.label}
                </Text>

                {/* Current badge */}
                {isCurrent && (
                  <View style={[pr.badge, { backgroundColor: opt.bg }]}>
                    <CheckCircle2 size={10} color={opt.color} />
                    <Text style={[pr.badgeTxt, { color: opt.color }]}>Current</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

    </View>
  );
}

// ─── Parent Phase Dropdown ────────────────────────────────────────
function PhaseDropdown({
  phases,
  selectedPhases,
  openPhase,
  onToggleParent,
  onTogglePhase,
  onToggleOpenPhase,
  onStatusChange,
  isParentOpen,
}: {
  phases: { name: string; status: string }[];
  selectedPhases: string[];
  openPhase: string | null;
  onToggleParent: () => void;
  onTogglePhase: (name: string) => void;
  onToggleOpenPhase: (name: string) => void;
  onStatusChange: (name: string, status: string) => void;
  isParentOpen: boolean;
}) {
  const animHeight = useRef(new Animated.Value(0)).current;
  const animRotate = useRef(new Animated.Value(0)).current;

  // Each phase row height + its status options when open
  const closedHeight = phases.length * 64;
  const openHeight   = phases.reduce((acc, phase) => {
    const isOpen = openPhase === phase.name;
    return acc + 64 + (isOpen ? STATUS_OPTIONS.length * 50 : 0);
  }, 0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animHeight, {
        toValue: isParentOpen ? 1 : 0,
        duration: 260,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(animRotate, {
        toValue: isParentOpen ? 1 : 0,
        duration: 260,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isParentOpen]);

  // Recalculate height whenever openPhase changes too
  const listHeight = animHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, openHeight > 0 ? openHeight : closedHeight],
  });

  const chevronRotation = animRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const completedCount  = phases.filter((p) => p.status === 'completed').length;
  const inProgressCount = phases.filter((p) => p.status === 'in_progress').length;

  return (
    <View style={pd.container}>

      {/* ── Parent Trigger Button ────────────────────── */}
      <TouchableOpacity
        style={[pd.trigger, isParentOpen && pd.triggerOpen]}
        onPress={onToggleParent}
        activeOpacity={0.8}
      >
        {/* Left icon */}
        <View style={pd.triggerIcon}>
          <CheckCheck size={16} color={BLUE} />
        </View>

        {/* Label + summary */}
        <View style={pd.triggerInfo}>
          <Text style={pd.triggerLabel}>Select Phase</Text>
          <Text style={pd.triggerSub}>
            {selectedPhases.length > 0
              ? `${selectedPhases.length} selected`
              : `${completedCount} done · ${inProgressCount} active`}
          </Text>
        </View>

        {/* Selected count badge */}
        {selectedPhases.length > 0 && (
          <View style={pd.countBadge}>
            <Text style={pd.countBadgeTxt}>{selectedPhases.length}</Text>
          </View>
        )}

        {/* Chevron */}
        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <ChevronDown size={18} color={isParentOpen ? BLUE : '#6B7280'} />
        </Animated.View>
      </TouchableOpacity>

      {/* ── Animated Phase List ──────────────────────── */}
      <Animated.View style={[pd.list, { height: listHeight }]}>
        <View style={pd.listInner}>
          {phases.map((phase, idx) => (
            <View key={phase.name}>
              <PhaseRow
                phase={phase}
                isOpen={openPhase === phase.name}
                isSelected={selectedPhases.includes(phase.name)}
                onToggleOpen={() => onToggleOpenPhase(phase.name)}
                onToggleSelect={() => onTogglePhase(phase.name)}
                onStatusChange={(status) => onStatusChange(phase.name, status)}
              />
              {idx < phases.length - 1 && (
                <View style={pd.divider} />
              )}
            </View>
          ))}
        </View>
      </Animated.View>

    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────
export default function NotifyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [project, setProject]               = useState<Project | null>(null);
  const [loading, setLoading]               = useState(true);
  const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
  const [message, setMessage]               = useState('');
  const [saving, setSaving]                 = useState(false);
  const [sendError, setSendError]           = useState('');
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [recentUpdates, setRecentUpdates]   = useState<RecentUpdate[]>([]);
  const [showSuccess, setShowSuccess]       = useState(false);
  const [localPhases, setLocalPhases]       = useState<{ name: string; status: string }[]>([]);
  const [isParentOpen, setIsParentOpen]     = useState(false);
  const [openPhase, setOpenPhase]           = useState<string | null>(null);

  const successAnim = useRef(new Animated.Value(0)).current;
  const btnScale    = useRef(new Animated.Value(1)).current;

  // ── Load project ──
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'projects', id), (snap) => {
      if (snap.exists()) {
        const p = { id: snap.id, ...snap.data() } as Project;
        setProject(p);
        setLocalPhases(p.phases || []);
      }
      setLoading(false);
    });
    return unsub;
  }, [id]);

  // ── Load recent updates ──
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const q    = query(
          collection(db, 'projects', id, 'updates'),
          orderBy('sentAt', 'desc'), limit(3)
        );
        const snap = await getDocs(q);
        setRecentUpdates(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecentUpdate))
        );
      } catch {}
    })();
  }, [id]);

  // ── Toggle parent dropdown ──
  const toggleParent = () => {
    setIsParentOpen((prev) => {
      if (prev) setOpenPhase(null); // close all phase rows when parent closes
      return !prev;
    });
  };

  // ── Toggle which phase row is open (only one at a time) ──
  const toggleOpenPhase = (name: string) => {
    setOpenPhase((prev) => (prev === name ? null : name));
  };

  // ── Toggle phase selection for WA message ──
  const togglePhase = (name: string) => {
    setSelectedPhases((p) =>
      p.includes(name) ? p.filter((x) => x !== name) : [...p, name]
    );
    setSendError('');
  };

  // ── Update phase status locally + Firestore ──
  const handleStatusChange = async (phaseName: string, newStatus: string) => {
    const updated = localPhases.map((p) =>
      p.name === phaseName ? { ...p, status: newStatus } : p
    );
    setLocalPhases(updated);
    setOpenPhase(null); // close inner dropdown after picking

    try {
      await updateDoc(doc(db, 'projects', id!), { phases: updated });
    } catch (e) {
      console.warn('Phase update failed', e);
    }
  };

  // ── Select template ──
  const selectTemplate = (tpl: typeof QUICK_TEMPLATES[0]) => {
    setMessage(tpl.text);
    setActiveTemplate(tpl.id);
    setSendError('');
  };

  // ── Success toast ──
  const triggerSuccess = () => {
    setShowSuccess(true);
    Animated.sequence([
      Animated.timing(successAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(successAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setShowSuccess(false));
  };

  // ── Send via WhatsApp ──
  const handleSend = async () => {
    if (selectedPhases.length === 0 && !message.trim()) {
      setSendError('Select at least one phase or add a message.');
      return;
    }
    if (!project?.customerPhone) {
      setSendError('No phone number found. Add it in project settings.');
      return;
    }

    setSendError('');

    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();

    const waMsg  = buildWAMessage(
      project.projectName, project.customerName,
      localPhases, selectedPhases, message
    );
    const phone  = formatPhone(project.customerPhone);
    const waURL  = `https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}`;

    const canOpen = await Linking.canOpenURL(waURL);
    if (!canOpen) {
      Alert.alert('WhatsApp Not Found', 'Please install WhatsApp and try again.');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'projects', id!, 'updates'), {
        projectId: id,
        message: message.trim(),
        phases: selectedPhases,
        photos: [],
        channel: 'whatsapp',
        sentAt: new Date(),
        waMsg,
      });
      triggerSuccess();
    } catch {}
    finally { setSaving(false); }

    Linking.openURL(waURL);
  };

  // ── Loading ──
  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator color={BLUE} size="large" />
      </View>
    );
  }

  const canSend    = selectedPhases.length > 0 || message.trim().length > 0;
  const previewMsg = buildWAMessage(
    project?.projectName || '',
    project?.customerName || '',
    localPhases, selectedPhases, message
  );

  return (
    <View style={s.root}>

      {/* ── Header ──────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Notify Customer</Text>
          <Text style={s.headerSub}>{project?.customerName}</Text>
        </View>
        <View style={s.waChip}>
          <MessageSquare size={12} color={BLUE} />
          <Text style={s.waChipText}>WhatsApp</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >

        {/* ── Progress ──────────────────────────────── */}
        {localPhases.length > 0 && <ProgressSteps phases={localPhases} />}

        {/* ── No phone warning ──────────────────────── */}
        {!project?.customerPhone && (
          <View style={s.warnBox}>
            <AlertCircle size={15} color="#D97706" />
            <Text style={s.warnText}>
              No phone number found. Add it in project settings.
            </Text>
          </View>
        )}

        {/* ── Quick Templates ───────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Zap size={15} color={BLUE} />
            <Text style={s.sectionTitle}>Quick Templates</Text>
          </View>
          <Text style={s.sectionSub}>Tap to instantly fill message</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipsRow}
          >
            {QUICK_TEMPLATES.map((tpl) => {
              const active = activeTemplate === tpl.id;
              return (
                <TouchableOpacity
                  key={tpl.id}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => selectTemplate(tpl)}
                >
                  <Text style={s.chipEmoji}>{tpl.icon}</Text>
                  <Text style={[s.chipLabel, active && s.chipLabelActive]}>
                    {tpl.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Phase Dropdown Section ────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <CheckCheck size={15} color={BLUE} />
            <Text style={s.sectionTitle}>Select Phases to Update</Text>
          </View>
          <Text style={s.sectionSub}>
            Open dropdown · tap a phase · pick its status
          </Text>

          <PhaseDropdown
            phases={localPhases}
            selectedPhases={selectedPhases}
            openPhase={openPhase}
            isParentOpen={isParentOpen}
            onToggleParent={toggleParent}
            onTogglePhase={togglePhase}
            onToggleOpenPhase={toggleOpenPhase}
            onStatusChange={handleStatusChange}
          />
        </View>

        {/* ── Message Input ─────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <MessageSquare size={15} color={BLUE} />
            <Text style={s.sectionTitle}>Add a Note</Text>
            <Text style={s.optionalTag}>Optional</Text>
          </View>
          <View style={[s.inputBox, message.length > 0 && s.inputBoxActive]}>
            <TextInput
              style={s.input}
              value={message}
              onChangeText={(v) => {
                setMessage(v);
                setActiveTemplate(null);
                setSendError('');
              }}
              placeholder="Add a personal note for the customer..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {message.length > 0 && (
              <TouchableOpacity
                style={s.clearBtn}
                onPress={() => { setMessage(''); setActiveTemplate(null); }}
              >
                <Text style={s.clearTxt}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Message Preview ───────────────────────── */}
        {canSend && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Send size={15} color={BLUE} />
              <Text style={s.sectionTitle}>Message Preview</Text>
            </View>
            <Text style={s.sectionSub}>This is what the customer will receive</Text>
            <View style={s.previewWrap}>
              <View style={s.previewTopBar}>
                <View style={s.previewAvatar}>
                  <Text style={{ fontSize: 14 }}>👤</Text>
                </View>
                <View>
                  <Text style={s.previewName}>{project?.customerName}</Text>
                  <Text style={s.previewSub}>WhatsApp Message</Text>
                </View>
              </View>
              <View style={s.previewChat}>
                <View style={s.msgBubble}>
                  <Text style={s.msgText}>{previewMsg}</Text>
                  <View style={s.msgMeta}>
                    <Text style={s.msgTime}>
                      {new Date().toLocaleTimeString('en-IN', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                    <Text style={s.msgTicks}>✓✓</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Recent Updates ────────────────────────── */}
        {recentUpdates.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Clock size={15} color={BLUE} />
              <Text style={s.sectionTitle}>Recently Sent</Text>
            </View>
            {recentUpdates.map((u) => (
              <View key={u.id} style={s.recentRow}>
                <View style={s.recentDot} />
                <View style={{ flex: 1 }}>
                  <Text style={s.recentPhase} numberOfLines={1}>
                    {u.phases.length > 0 ? u.phases.join(', ') : 'Custom message'}
                  </Text>
                  {u.message ? (
                    <Text style={s.recentMsg} numberOfLines={1}>{u.message}</Text>
                  ) : null}
                </View>
                <Text style={s.recentTime}>
                  {u.sentAt?.toDate ? timeAgo(u.sentAt.toDate()) : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Success Toast ─────────────────────────── */}
      {showSuccess && (
        <Animated.View style={[s.toast, { opacity: successAnim }]}>
          <CheckCircle2 size={16} color="#fff" />
          <Text style={s.toastTxt}>Saved! Opening WhatsApp...</Text>
        </Animated.View>
      )}

      {/* ── Bottom Send Bar ───────────────────────── */}
      <View style={s.bottomBar}>
        {sendError ? (
          <View style={s.errorBox}>
            <AlertCircle size={13} color="#DC2626" />
            <Text style={s.errorTxt}>{sendError}</Text>
          </View>
        ) : null}

        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.sendBtn, (!canSend || saving) && s.sendBtnOff]}
            onPress={handleSend}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={s.sendTxt}>Opening WhatsApp...</Text>
              </>
            ) : (
              <>
                <Send size={18} color="#fff" />
                <Text style={s.sendTxt}>Send via WhatsApp</Text>
                {canSend && (
                  <View style={s.sendBadge}>
                    <Text style={s.sendBadgeTxt}>
                      {selectedPhases.length + (message.trim() ? 1 : 0)}
                    </Text>
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        <Text style={s.hint}>WhatsApp opens with your message pre-filled</Text>
      </View>

    </View>
  );
}

// ─── Progress Styles ──────────────────────────────────────────────
const pStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 14,
    padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title:    { fontSize: 13, fontWeight: '600', color: '#374151' },
  pct:      { fontSize: 13, fontWeight: '700', color: BLUE },
  track:    { height: 6, backgroundColor: '#F3F4F6', borderRadius: 99, overflow: 'hidden', marginBottom: 14 },
  fill:     { height: '100%', backgroundColor: BLUE, borderRadius: 99 },
  stats:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stat:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statDot:  { width: 7, height: 7, borderRadius: 4 },
  statTxt:  { fontSize: 11, color: '#6B7280' },
  totalTxt: { fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' },
});

// ─── Phase Row Styles ─────────────────────────────────────────────
const pr = StyleSheet.create({
  wrapper: { backgroundColor: '#fff', overflow: 'hidden' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingHorizontal: 14, paddingVertical: 13,
  },
  rowSelected: { backgroundColor: BLUE_LIGHT },

  checkbox: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F9FAFB', flexShrink: 0,
  },
  checkboxActive: { borderColor: BLUE, backgroundColor: BLUE },

  info:       { flex: 1 },
  name:       { fontSize: 13, fontWeight: '600', color: '#111827' },
  nameActive: { color: BLUE },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 99,
    paddingHorizontal: 7, paddingVertical: 2,
    alignSelf: 'flex-start', marginTop: 4,
  },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  pillTxt: { fontSize: 10, fontWeight: '600' },

  statusList: {
    backgroundColor: '#F8FAFF',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingHorizontal: 20, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  statusRowActive: { backgroundColor: '#F0F9FF' },
  statusRowLast:   { borderBottomWidth: 0 },

  bar:         { width: 3, height: 20, borderRadius: 99, flexShrink: 0 },
  statusEmoji: { fontSize: 16 },
  statusLabel: { flex: 1, fontSize: 13, fontWeight: '500', color: '#374151' },

  badge: {
    flexDirection: 'row', alignItems: 'center',
    gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99,
  },
  badgeTxt: { fontSize: 10, fontWeight: '700' },
});

// ─── Parent Dropdown Styles ───────────────────────────────────────
const pd = StyleSheet.create({
  container: {
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },

  trigger: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: '#fff',
  },
  triggerOpen: { backgroundColor: BLUE_LIGHT },

  triggerIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: BLUE_LIGHT,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },

  triggerInfo: { flex: 1 },
  triggerLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  triggerSub:   { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  countBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: BLUE,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  countBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },

  list: { overflow: 'hidden' },
  listInner: {
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 14 },
});

// ─── Main Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F9FAFB' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  backBtn:      { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerSub:    { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  waChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#DBEAFE',
    backgroundColor: BLUE_LIGHT,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
  },
  waChipText: { fontSize: 11, fontWeight: '600', color: BLUE },

  scroll: { padding: 16 },

  warnBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A',
  },
  warnText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },

  section:       { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  sectionTitle:  { fontSize: 13, fontWeight: '700', color: '#111827' },
  sectionSub:    { fontSize: 12, color: '#9CA3AF', marginBottom: 10 },
  optionalTag: {
    fontSize: 10, color: '#9CA3AF', backgroundColor: '#F3F4F6',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 99, marginLeft: 4,
  },

  chipsRow: { gap: 8, paddingBottom: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#fff', borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chipActive:      { borderColor: BLUE, backgroundColor: BLUE_LIGHT },
  chipEmoji:       { fontSize: 13 },
  chipLabel:       { fontSize: 12, fontWeight: '600', color: '#374151' },
  chipLabelActive: { color: BLUE },

  inputBox: {
    backgroundColor: '#fff', borderWidth: 1.5,
    borderColor: '#E5E7EB', borderRadius: 12, overflow: 'hidden',
  },
  inputBoxActive: { borderColor: BLUE },
  input: {
    padding: 13, fontSize: 13, color: '#111827',
    minHeight: 95, lineHeight: 20,
  },
  clearBtn: {
    alignSelf: 'flex-end', marginBottom: 8, marginRight: 10,
    paddingHorizontal: 10, paddingVertical: 3,
    backgroundColor: '#F3F4F6', borderRadius: 99,
  },
  clearTxt: { fontSize: 11, color: '#6B7280', fontWeight: '600' },

  previewWrap:   { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  previewTopBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#075E54', padding: 12,
  },
  previewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#128C7E', justifyContent: 'center', alignItems: 'center',
  },
  previewName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  previewSub:  { fontSize: 10, color: '#A7F3D0', marginTop: 1 },
  previewChat: { backgroundColor: '#ECE5DD', padding: 12 },
  msgBubble: {
    backgroundColor: '#DCF8C6', borderRadius: 10,
    borderTopRightRadius: 2, padding: 11,
    alignSelf: 'flex-end', maxWidth: '92%',
  },
  msgText:  { fontSize: 12, color: '#111827', lineHeight: 18 },
  msgMeta:  { flexDirection: 'row', justifyContent: 'flex-end', gap: 4, marginTop: 5 },
  msgTime:  { fontSize: 10, color: '#667781' },
  msgTicks: { fontSize: 11, color: '#53BDEB' },

  recentRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  recentDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: BLUE, marginTop: 4, flexShrink: 0,
  },
  recentPhase: { fontSize: 13, fontWeight: '600', color: '#111827' },
  recentMsg:   { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  recentTime:  { fontSize: 11, color: '#9CA3AF', flexShrink: 0 },

  toast: {
    position: 'absolute', top: 96,
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#111827', borderRadius: 99,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  toastTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },

  bottomBar: {
    padding: 16, paddingBottom: 30,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: '#FEF2F2', borderRadius: 8,
    padding: 10, marginBottom: 10,
  },
  errorTxt: { flex: 1, color: '#DC2626', fontSize: 12 },
  sendBtn: {
    backgroundColor: BLUE, borderRadius: 12, height: 50,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: BLUE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  sendBtnOff:   { backgroundColor: '#9CA3AF', shadowColor: '#9CA3AF' },
  sendTxt:      { color: '#fff', fontSize: 14, fontWeight: '700' },
  sendBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  hint: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
});
