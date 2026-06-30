import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Project } from '@/types';
import {
  MapPin, Plus, CheckCircle2,
  Clock, ChevronRight, FolderOpen, Images,
} from 'lucide-react-native';

// ─── Constants ────────────────────────────────────────────────────
const BLUE       = '#1A56DB';
const BLUE_LIGHT = '#EEF2FF';

const TABS = [
  { label: 'All',         key: 'All' },
  { label: 'In Progress', key: 'In Progress' },
  { label: 'Completed',   key: 'Completed' },
];

const FALLBACK_IMAGES = [
  'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?w=600&auto=compress',
  'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?w=600&auto=compress',
  'https://images.pexels.com/photos/1115804/pexels-photo-1115804.jpeg?w=600&auto=compress',
  'https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg?w=600&auto=compress',
  'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?w=600&auto=compress',
  'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg?w=600&auto=compress',
];

// ─── Helpers ──────────────────────────────────────────────────────
function getImage(project: Project, idx: number): string {
  return project.coverPhoto || FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length];
}

function getProgress(project: Project): number {
  const phases = project.phases || [];
  if (phases.length === 0) return 0;
  const done = phases.filter((p: any) => p.status === 'completed').length;
  return Math.round((done / phases.length) * 100);
}

// ─── Empty State ──────────────────────────────────────────────────
function EmptyState({ tab }: { tab: string }) {
  return (
    <View style={em.wrap}>
      <View style={em.iconWrap}>
        <FolderOpen size={40} color="#D1D5DB" />
      </View>
      <Text style={em.title}>
        {tab === 'All' ? 'No projects yet' : `No ${tab} projects`}
      </Text>
      <Text style={em.sub}>
        {tab === 'All'
          ? 'Add your first project to start building your portfolio.'
          : `You have no ${tab.toLowerCase()} projects right now.`}
      </Text>
      {tab === 'All' && (
        <TouchableOpacity
          style={em.btn}
          onPress={() => router.push('/new-project')}
        >
          <Plus size={15} color="#fff" />
          <Text style={em.btnTxt}>Add First Project</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Project Card ─────────────────────────────────────────────────
function ProjectCard({ project, index }: { project: Project; index: number }) {
  const progress   = getProgress(project);
  const imgUrl     = getImage(project, index);
  const phaseCount = (project.phases || []).length;
  const donePh     = (project.phases || []).filter((p: any) => p.status === 'completed').length;
  const isComplete = project.status === 'Completed';

  return (
    <TouchableOpacity
      style={c.card}
      onPress={() => router.push(`/project/${project.id}` as any)}
      activeOpacity={0.88}
    >
      {/* ── Cover Image ─────────────────────────────── */}
      <View style={c.imageWrap}>
        <Image source={{ uri: imgUrl }} style={c.image} resizeMode="cover" />
        <View style={c.imageOverlay} />

        {/* Status Badge */}
        <View style={[c.badge, isComplete ? c.badgeDone : c.badgeActive]}>
          {isComplete
            ? <CheckCircle2 size={10} color="#fff" />
            : <Clock size={10} color="#fff" />
          }
          <Text style={c.badgeTxt}>{project.status}</Text>
        </View>

        {/* Location */}
        {project.siteLocation ? (
          <View style={c.locationRow}>
            <MapPin size={10} color="rgba(255,255,255,0.85)" />
            <Text style={c.locationTxt} numberOfLines={1}>
              {project.siteLocation}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Card Body ───────────────────────────────── */}
      <View style={c.body}>

        <View style={c.nameRow}>
          <Text style={c.name} numberOfLines={1}>{project.projectName}</Text>
          <ChevronRight size={16} color="#9CA3AF" />
        </View>

        {project.customerName ? (
          <Text style={c.customer} numberOfLines={1}>
            👤 {project.customerName}
          </Text>
        ) : null}

        <View style={c.divider} />

        <View style={c.progressHeader}>
          <Text style={c.progressLabel}>
            {donePh}/{phaseCount} Phases
          </Text>
          <Text style={[c.progressPct, { color: isComplete ? '#059669' : BLUE }]}>
            {progress}%
          </Text>
        </View>

        <View style={c.track}>
          <View
            style={[
              c.fill,
              { width: `${progress}%` },
              isComplete && c.fillDone,
            ]}
          />
        </View>

        {/* Gallery Button */}
        <View style={c.galleryRow}>
          <TouchableOpacity
            style={c.galleryBtn}
            activeOpacity={0.75}
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/project-gallery/${project.id}` as any);
            }}
          >
            <Images size={13} color={BLUE} />
            <Text style={c.galleryBtnTxt}>View Gallery</Text>
            <ChevronRight size={12} color={BLUE} />
          </TouchableOpacity>
        </View>

      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────
export default function PortfolioScreen() {
  const { user }                  = useAuth();
  const [projects, setProjects]   = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState('All');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'projects'),
      where('ownerId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
      setProjects(data);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const filtered =
    activeTab === 'All'
      ? projects
      : projects.filter((p) => p.status === activeTab);

  const countFor = (key: string) =>
    key === 'All'
      ? projects.length
      : projects.filter((p) => p.status === key).length;

  return (
    <View style={s.root}>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Blue Curved Header (same as Dashboard) ── */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>My Portfolio</Text>
            <Text style={s.headerSub}>
              {projects.length} project{projects.length !== 1 ? 's' : ''} in your portfolio
            </Text>
          </View>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => router.push('/new-project')}
          >
            <Plus size={16} color="#fff" />
            <Text style={s.addBtnTxt}>New</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            color={BLUE}
            size="large"
            style={{ marginTop: 60 }}
          />
        ) : (
          <>
            {/* ── Tab Bar ─────────────────────────────── */}
            <View style={s.tabBar}>
              {TABS.map((tab) => {
                const active = activeTab === tab.key;
                const count  = countFor(tab.key);
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[s.tab, active && s.tabActive]}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <Text style={[s.tabTxt, active && s.tabTxtActive]}>
                      {tab.label}
                    </Text>
                    {count > 0 && (
                      <View style={[s.tabBadge, active && s.tabBadgeActive]}>
                        <Text style={[s.tabBadgeTxt, active && s.tabBadgeTxtActive]}>
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Project Cards ───────────────────────── */}
            {filtered.length === 0 ? (
              <EmptyState tab={activeTab} />
            ) : (
              <View style={s.cardList}>
                {filtered.map((project, idx) => (
                  <ProjectCard key={project.id} project={project} index={idx} />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

// ─── Empty Styles ─────────────────────────────────────────────────
const em = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  sub: {
    fontSize: 13, color: '#9CA3AF', textAlign: 'center',
    lineHeight: 20, marginBottom: 24,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: BLUE, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 11,
  },
  btnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ─── Card Styles ──────────────────────────────────────────────────
const c = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  imageWrap:    { width: '100%', height: 160, position: 'relative' },
  image:        { width: '100%', height: '100%' },
  imageOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  badge: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 99,
  },
  badgeDone:   { backgroundColor: '#059669' },
  badgeActive: { backgroundColor: '#D97706' },
  badgeTxt:    { fontSize: 10, fontWeight: '700', color: '#fff' },
  locationRow: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  locationTxt: {
    fontSize: 11, color: 'rgba(255,255,255,0.9)',
    fontWeight: '500', maxWidth: 160,
  },
  body:     { padding: 14 },
  nameRow:  {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  name:     { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  customer: { fontSize: 12, color: '#6B7280', marginBottom: 10 },
  divider:  { height: 1, backgroundColor: '#F3F4F6', marginBottom: 10 },
  progressHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  progressLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  progressPct:   { fontSize: 12, fontWeight: '700' },
  track: {
    height: 5, backgroundColor: '#F3F4F6',
    borderRadius: 99, overflow: 'hidden',
  },
  fill:     { height: '100%', backgroundColor: BLUE, borderRadius: 99 },
  fillDone: { backgroundColor: '#059669' },
  galleryRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  galleryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: BLUE_LIGHT,
    borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  galleryBtnTxt: { fontSize: 12, fontWeight: '600', color: BLUE },
});

// ─── Main Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { paddingBottom: 20 },

  // ── Blue Curved Header ──────────────────────────
  header: {
    backgroundColor: BLUE,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ── Tab Bar ─────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 99, backgroundColor: '#F3F4F6',
  },
  tabActive:    { backgroundColor: BLUE },
  tabTxt:       { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  tabTxtActive: { color: '#fff' },
  tabBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeActive:    { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeTxt:       { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  tabBadgeTxtActive: { color: '#fff' },

  // ── Card List ───────────────────────────────────
  cardList: {
    paddingHorizontal: 16,
    gap: 14,
  },
});
