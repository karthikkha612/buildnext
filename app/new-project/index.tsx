import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_PHASES,
  DEFAULT_REQUIREMENTS,
  Requirement,
} from '@/types';
import { ArrowLeft, Check } from 'lucide-react-native';

type ProjectType = 'New Construction' | 'Renovation';

const STEP_LABELS = ['Project Info', 'Requirements', 'Estimate'];

export default function NewProjectScreen() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [projectName, setProjectName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [plotArea, setPlotArea] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('New Construction');

  // Step 2
  const [requirements, setRequirements] = useState<Requirement[]>(
    DEFAULT_REQUIREMENTS.map((r) => ({ ...r }))
  );

  // Step 3
  const [startDate, setStartDate] = useState('');
  const [expectedCompletion, setExpectedCompletion] = useState('');
  const [constructionCost, setConstructionCost] = useState('');
  const [materialCost, setMaterialCost] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [otherExpenses, setOtherExpenses] = useState('');

  const totalEstimate =
    (parseFloat(constructionCost) || 0) +
    (parseFloat(materialCost) || 0) +
    (parseFloat(laborCost) || 0) +
    (parseFloat(otherExpenses) || 0);

  const toggleRequirement = (id: string) => {
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r))
    );
  };

  const validateStep1 = () => {
    if (!customerName.trim() || !projectName.trim() || !siteLocation.trim()) {
      setError('Customer name, project name, and site location are required.');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep3 = () => {
    if (!startDate.trim() || !expectedCompletion.trim()) {
      setError('Please enter start and completion dates.');
      return false;
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step < 3) setStep(step + 1);
  };

  const handleCreate = async () => {
    if (!validateStep3()) return;
    if (!user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'projects'), {
        ownerId: user.uid,
        projectName: projectName.trim(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        customerAddress: customerAddress.trim(),
        siteLocation: siteLocation.trim(),
        plotArea: plotArea.trim(),
        projectType,
        requirements,
        startDate,
        expectedCompletion,
        estimate: {
          constructionCost: parseFloat(constructionCost) || 0,
          materialCost: parseFloat(materialCost) || 0,
          laborCost: parseFloat(laborCost) || 0,
          otherExpenses: parseFloat(otherExpenses) || 0,
          total: totalEstimate,
        },
        materials: [],
        subcontractors: [],
        phases: DEFAULT_PHASES,
        overallProgress: 0,
        status: 'Planning',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      setError('Failed to create project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (step > 1 ? setStep(step - 1) : router.back())} style={styles.backBtn}>
            <ArrowLeft size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Project</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          {STEP_LABELS.map((label, i) => {
            const num = i + 1;
            const isActive = num === step;
            const isDone = num < step;
            return (
              <React.Fragment key={label}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepCircle, isActive && styles.stepCircleActive, isDone && styles.stepCircleDone]}>
                    {isDone ? (
                      <Check size={12} color="#fff" />
                    ) : (
                      <Text style={[styles.stepNum, (isActive || isDone) && styles.stepNumActive]}>{num}</Text>
                    )}
                  </View>
                  <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{label}</Text>
                </View>
                {i < STEP_LABELS.length - 1 && (
                  <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
                )}
              </React.Fragment>
            );
          })}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {step === 1 && (
            <Step1
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerEmail={customerEmail}
              setCustomerEmail={setCustomerEmail}
              customerAddress={customerAddress}
              setCustomerAddress={setCustomerAddress}
              projectName={projectName}
              setProjectName={setProjectName}
              siteLocation={siteLocation}
              setSiteLocation={setSiteLocation}
              plotArea={plotArea}
              setPlotArea={setPlotArea}
              projectType={projectType}
              setProjectType={setProjectType}
            />
          )}

          {step === 2 && (
            <Step2 requirements={requirements} toggleRequirement={toggleRequirement} />
          )}

          {step === 3 && (
            <Step3
              startDate={startDate}
              setStartDate={setStartDate}
              expectedCompletion={expectedCompletion}
              setExpectedCompletion={setExpectedCompletion}
              constructionCost={constructionCost}
              setConstructionCost={setConstructionCost}
              materialCost={materialCost}
              setMaterialCost={setMaterialCost}
              laborCost={laborCost}
              setLaborCost={setLaborCost}
              otherExpenses={otherExpenses}
              setOtherExpenses={setOtherExpenses}
              totalEstimate={totalEstimate}
            />
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={step === 3 ? handleCreate : handleNext}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextBtnText}>
                {step === 3 ? 'Create Project' : `Next: ${STEP_LABELS[step]}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboard = 'default', multiline = false }: any) {
  return (
    <View style={fieldStyles.field}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboard}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

function Step1({ customerName, setCustomerName, customerPhone, setCustomerPhone, customerEmail, setCustomerEmail, customerAddress, setCustomerAddress, projectName, setProjectName, siteLocation, setSiteLocation, plotArea, setPlotArea, projectType, setProjectType }: any) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Customer Details</Text>
      <FormField label="Full Name" value={customerName} onChangeText={setCustomerName} />
      <FormField label="Phone Number" value={customerPhone} onChangeText={setCustomerPhone} keyboard="phone-pad" />
      <FormField label="Email" value={customerEmail} onChangeText={setCustomerEmail} keyboard="email-address" />
      <FormField label="Address" value={customerAddress} onChangeText={setCustomerAddress} multiline />

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Project Details</Text>
      <FormField label="Project Name" value={projectName} onChangeText={setProjectName} />
      <FormField label="Site Location" value={siteLocation} onChangeText={setSiteLocation} />
      <FormField label="Plot Area (Sq.Ft.)" value={plotArea} onChangeText={setPlotArea} keyboard="numeric" />

      <Text style={fieldStyles.label}>Project Type</Text>
      <View style={styles.typeRow}>
        {(['New Construction', 'Renovation'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.typeChip, projectType === type && styles.typeChipActive]}
            onPress={() => setProjectType(type)}
          >
            <View style={[styles.typeRadio, projectType === type && styles.typeRadioActive]}>
              {projectType === type && <View style={styles.typeRadioDot} />}
            </View>
            <Text style={[styles.typeChipText, projectType === type && styles.typeChipTextActive]}>{type}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Step2({ requirements, toggleRequirement }: any) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Customer Requirements</Text>
      <Text style={styles.sectionSubtitle}>Select all that apply to this project</Text>
      {requirements.map((req: Requirement) => (
        <TouchableOpacity
          key={req.id}
          style={[styles.requirementRow, req.checked && styles.requirementRowChecked]}
          onPress={() => toggleRequirement(req.id)}
        >
          <View style={[styles.checkbox, req.checked && styles.checkboxChecked]}>
            {req.checked && <Check size={14} color="#fff" />}
          </View>
          <Text style={[styles.requirementText, req.checked && styles.requirementTextChecked]}>
            {req.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Step3({ startDate, setStartDate, expectedCompletion, setExpectedCompletion, constructionCost, setConstructionCost, materialCost, setMaterialCost, laborCost, setLaborCost, otherExpenses, setOtherExpenses, totalEstimate }: any) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Timeline</Text>
      <FormField label="Start Date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
      <FormField label="Expected Completion (YYYY-MM-DD)" value={expectedCompletion} onChangeText={setExpectedCompletion} />

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Rough Estimate (₹)</Text>

      {[
        { label: 'Construction Cost', value: constructionCost, setter: setConstructionCost },
        { label: 'Material Cost', value: materialCost, setter: setMaterialCost },
        { label: 'Labor Cost', value: laborCost, setter: setLaborCost },
        { label: 'Other Expenses', value: otherExpenses, setter: setOtherExpenses },
      ].map((field) => (
        <View key={field.label} style={styles.estimateRow}>
          <Text style={styles.estimateLabel}>{field.label}</Text>
          <TextInput
            style={styles.estimateInput}
            value={field.value}
            onChangeText={field.setter}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Estimate</Text>
        <Text style={styles.totalValue}>
          ₹ {totalEstimate.toLocaleString('en-IN')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  stepCircleActive: { backgroundColor: '#1A56DB', borderColor: '#1A56DB' },
  stepCircleDone: { backgroundColor: '#059669', borderColor: '#059669' },
  stepNum: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  stepNumActive: { color: '#fff' },
  stepLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '500', textAlign: 'center' },
  stepLabelActive: { color: '#1A56DB', fontWeight: '600' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginBottom: 12 },
  stepLineDone: { backgroundColor: '#059669' },
  content: { padding: 20 },
  errorText: {
    backgroundColor: '#FEF2F2',
    color: '#DC2626',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  typeRow: { flexDirection: 'row', gap: 12, marginTop: 6, marginBottom: 8 },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  typeChipActive: { borderColor: '#1A56DB', backgroundColor: '#EFF6FF' },
  typeRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeRadioActive: { borderColor: '#1A56DB' },
  typeRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1A56DB' },
  typeChipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  typeChipTextActive: { color: '#1A56DB', fontWeight: '600' },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    gap: 12,
  },
  requirementRowChecked: { borderColor: '#1A56DB', backgroundColor: '#EFF6FF' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#1A56DB', borderColor: '#1A56DB' },
  requirementText: { fontSize: 14, color: '#374151' },
  requirementTextChecked: { color: '#1A56DB', fontWeight: '600' },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  estimateLabel: { fontSize: 14, color: '#374151' },
  estimateInput: {
    width: 120,
    textAlign: 'right',
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: 6,
    paddingHorizontal: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: '700', color: '#1A56DB' },
  bottomBar: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  nextBtn: {
    backgroundColor: '#1A56DB',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

const fieldStyles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  multiline: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
});
