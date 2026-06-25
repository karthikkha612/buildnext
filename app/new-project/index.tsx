import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_PHASES, DEFAULT_REQUIREMENTS, DEFAULT_DOCUMENTS,
  DOCUMENT_PHASE, Requirement, ProjectDocument,
} from '@/types';
import { ArrowLeft, Check, FileText, Upload, CheckCircle, XCircle, X } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';

const DateTimePicker = require('@react-native-community/datetimepicker').default;

type ProjectType = 'New Construction' | 'Renovation';
const STEP_LABELS = ['Documents', 'Project Info', 'Requirements', 'Estimate'];

const NAME_REGEX = /^[A-Za-z\s]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;

type Step1Errors = {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  projectName?: string;
  siteLocation?: string;
  plotArea?: string;
};
type Step3Errors = {
  startDate?: string;
  expectedCompletion?: string;
  constructionCost?: string;
};

export default function NewProjectScreen() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [documents, setDocuments] = useState<ProjectDocument[]>(
    DEFAULT_DOCUMENTS.map((d) => ({ ...d }))
  );

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [projectName, setProjectName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [plotArea, setPlotArea] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('New Construction');
  const [step1Errors, setStep1Errors] = useState<Step1Errors>({});

  const [requirements, setRequirements] = useState<Requirement[]>(
    DEFAULT_REQUIREMENTS.map((r) => ({ ...r }))
  );
  const [step2Error, setStep2Error] = useState('');

  const [startDate, setStartDate] = useState('');
  const [expectedCompletion, setExpectedCompletion] = useState('');
  const [constructionCost, setConstructionCost] = useState('');
  const [materialCost, setMaterialCost] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [otherExpenses, setOtherExpenses] = useState('');
  const [step3Errors, setStep3Errors] = useState<Step3Errors>({});

  const totalEstimate =
    (parseFloat(constructionCost) || 0) +
    (parseFloat(materialCost) || 0) +
    (parseFloat(laborCost) || 0) +
    (parseFloat(otherExpenses) || 0);

  const toggleRequirement = (id: string) => {
    setRequirements((prev) => prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
  };

  const handleDocumentToggle = async (id: string) => {
    const doc = documents.find((d) => d.id === id);
    if (!doc) return;

    if (!doc.available) {
      Alert.alert(
        'Upload Document',
        `Do you want to upload "${doc.name}" now?`,
        [
          { text: 'Upload Now', onPress: () => handleDocumentUpload(id) },
          {
            text: 'Mark as Available (No Upload)',
            onPress: () => {
              setDocuments((prev) =>
                prev.map((d) =>
                  d.id === id
                    ? { ...d, available: true, uploadedAt: new Date().toISOString() }
                    : d
                )
              );
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, available: false, fileUri: undefined, fileName: undefined, uploadedAt: undefined }
            : d
        )
      );
    }
  };

  const handleDocumentUpload = async (id: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  available: true,
                  fileUri: asset.uri,
                  fileName: asset.name,
                  uploadedAt: new Date().toISOString(),
                }
              : d
          )
        );
        Alert.alert('Uploaded!', `${asset.name} uploaded successfully.`);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not pick document. Please try again.');
    }
  };

  // --- Field-level validation, mirrors the rule table: required, format, length ---
  const validateStep1 = (): boolean => {
    const next: Step1Errors = {};

    const trimmedName = customerName.trim();
    if (!trimmedName) next.customerName = 'Full name is required.';
    else if (trimmedName.length < 2) next.customerName = 'Name must be at least 2 characters.';
    else if (!NAME_REGEX.test(trimmedName)) next.customerName = 'Name can only contain letters and spaces.';

    const trimmedPhone = customerPhone.trim();
    if (!trimmedPhone) next.customerPhone = 'Phone number is required.';
    else if (!PHONE_REGEX.test(trimmedPhone)) next.customerPhone = 'Enter a valid 10-digit phone number.';

    const trimmedEmail = customerEmail.trim();
    if (!trimmedEmail) next.customerEmail = 'Email is required.';
    else if (!EMAIL_REGEX.test(trimmedEmail)) next.customerEmail = 'Enter a valid email address.';

    const trimmedAddress = customerAddress.trim();
    if (!trimmedAddress) next.customerAddress = 'Address is required.';
    else if (trimmedAddress.length < 5) next.customerAddress = 'Address must be at least 5 characters.';

    const trimmedProjectName = projectName.trim();
    if (!trimmedProjectName) next.projectName = 'Project name is required.';
    else if (trimmedProjectName.length < 3) next.projectName = 'Project name must be at least 3 characters.';

    const trimmedSite = siteLocation.trim();
    if (!trimmedSite) next.siteLocation = 'Site location is required.';

    if (!plotArea.trim()) next.plotArea = 'Plot area is required.';
    else if (Number.isNaN(parseFloat(plotArea)) || parseFloat(plotArea) <= 0) {
      next.plotArea = 'Plot area must be a number greater than 0.';
    }

    setStep1Errors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = (): boolean => {
    if (!requirements.some((r) => r.checked)) {
      setStep2Error('Please select at least one requirement.');
      return false;
    }
    setStep2Error('');
    return true;
  };

  const validateStep3 = (): boolean => {
    const next: Step3Errors = {};

    if (!startDate.trim()) next.startDate = 'Start date is required.';

    if (!expectedCompletion.trim()) next.expectedCompletion = 'Expected completion date is required.';
    else if (startDate && new Date(expectedCompletion) <= new Date(startDate)) {
      next.expectedCompletion = 'Expected completion must be after the start date.';
    }

    if (!constructionCost.trim()) next.constructionCost = 'Construction cost is required.';
    else if (Number.isNaN(parseFloat(constructionCost)) || parseFloat(constructionCost) <= 0) {
      next.constructionCost = 'Construction cost must be a number greater than 0.';
    }

    setStep3Errors(next);
    return Object.keys(next).length === 0;
  };

  const handlePhoneChange = (value: string) => {
    setCustomerPhone(value.replace(/\D/g, '').slice(0, 10));
  };

  const handleNext = () => {
    setError('');
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else router.back();
    setError('');
  };

  const handleCreate = async () => {
    if (!validateStep3()) return;
    if (!user) return;
    setSaving(true);

    const missingDocs = documents.filter((d) => !d.available);
    const phases = missingDocs.length > 0
      ? [{ ...DOCUMENT_PHASE }, ...DEFAULT_PHASES]
      : [...DEFAULT_PHASES];

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
        documents,
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
        phases,
        overallProgress: 0,
        status: 'Planning',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      Alert.alert(
        'Project Created!',
        missingDocs.length > 0
          ? `${missingDocs.length} missing document(s) added as Phase 0 — Document Collection. Complete that phase first before construction begins.`
          : 'All documents ready. Construction can begin!',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (e: any) {
      setError('Failed to create project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const missingCount = documents.filter((d) => !d.available).length;
  const allDocumentsReady = missingCount === 0;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Project</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.stepIndicator}>
          {STEP_LABELS.map((label, i) => {
            const isActive = i === step;
            const isDone = i < step;
            return (
              <React.Fragment key={label}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepCircle, isActive && styles.stepCircleActive, isDone && styles.stepCircleDone]}>
                    {isDone ? <Check size={12} color="#fff" /> : (
                      <Text style={[styles.stepNum, (isActive || isDone) && styles.stepNumActive]}>{i + 1}</Text>
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

          {step === 0 && (
            <View>
              <Text style={styles.sectionTitle}>Pre-Construction Documents</Text>
              <Text style={styles.sectionSubtitle}>
                Toggle documents you have. Upload them directly or mark as available. Missing ones become Phase 0.
              </Text>

              <View style={[styles.docStatusBanner, allDocumentsReady ? styles.docStatusBannerGreen : styles.docStatusBannerAmber]}>
                {allDocumentsReady
                  ? <CheckCircle size={18} color="#059669" />
                  : <XCircle size={18} color="#D97706" />
                }
                <Text style={[styles.docStatusText, allDocumentsReady ? styles.docStatusTextGreen : styles.docStatusTextAmber]}>
                  {allDocumentsReady
                    ? 'All documents ready — construction can begin directly!'
                    : `${missingCount} document(s) missing — will be added as Phase 0`}
                </Text>
              </View>

              {documents.map((doc) => (
                <View key={doc.id} style={[styles.docCard, doc.available && styles.docCardAvailable]}>
                  <View style={styles.docCardTop}>
                    <View style={styles.docLeft}>
                      <View style={[styles.docIconBox, doc.available ? styles.docIconBoxGreen : styles.docIconBoxGray]}>
                        <FileText size={18} color={doc.available ? '#059669' : '#9CA3AF'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.docName, doc.available && styles.docNameAvailable]}>
                          {doc.name}
                        </Text>
                        <Text style={styles.docStatusText2}>
                          {doc.fileName
                            ? `📎 ${doc.fileName}`
                            : doc.available
                            ? '✓ Marked as available'
                            : 'Not available'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.docToggle, doc.available && styles.docToggleActive]}
                      onPress={() => handleDocumentToggle(doc.id)}
                    >
                      <View style={[styles.docToggleDot, doc.available && styles.docToggleDotActive]} />
                    </TouchableOpacity>
                  </View>

                  {doc.available && !doc.fileName && (
                    <TouchableOpacity
                      style={styles.uploadBtn}
                      onPress={() => handleDocumentUpload(doc.id)}
                    >
                      <Upload size={14} color="#1A56DB" />
                      <Text style={styles.uploadBtnText}>Upload Document</Text>
                    </TouchableOpacity>
                  )}

                  {doc.fileName && (
                    <View style={styles.uploadedBadge}>
                      <Check size={12} color="#059669" />
                      <Text style={styles.uploadedBadgeText}>Uploaded: {doc.fileName}</Text>
                      <TouchableOpacity
                        onPress={() => setDocuments((prev) =>
                          prev.map((d) => d.id === doc.id
                            ? { ...d, fileUri: undefined, fileName: undefined }
                            : d
                          )
                        )}
                      >
                        <X size={12} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}

              {!allDocumentsReady && (
                <View style={styles.missingInfoCard}>
                  <Text style={styles.missingInfoTitle}>📋 Will be added as Phase 0</Text>
                  {documents.filter(d => !d.available).map(d => (
                    <Text key={d.id} style={styles.missingInfoItem}>• {d.name}</Text>
                  ))}
                  <Text style={styles.missingInfoNote}>
                    Construction phases will begin only after all Phase 0 documents are collected.
                  </Text>
                </View>
              )}
            </View>
          )}

          {step === 1 && (
            <Step1
              customerName={customerName} setCustomerName={setCustomerName}
              customerPhone={customerPhone} setCustomerPhone={handlePhoneChange}
              customerEmail={customerEmail} setCustomerEmail={setCustomerEmail}
              customerAddress={customerAddress} setCustomerAddress={setCustomerAddress}
              projectName={projectName} setProjectName={setProjectName}
              siteLocation={siteLocation} setSiteLocation={setSiteLocation}
              plotArea={plotArea} setPlotArea={setPlotArea}
              projectType={projectType} setProjectType={setProjectType}
              errors={step1Errors}
            />
          )}

          {step === 2 && (
            <Step2 requirements={requirements} toggleRequirement={toggleRequirement} error={step2Error} />
          )}

          {step === 3 && (
            <Step3
              startDate={startDate} setStartDate={setStartDate}
              expectedCompletion={expectedCompletion} setExpectedCompletion={setExpectedCompletion}
              constructionCost={constructionCost} setConstructionCost={setConstructionCost}
              materialCost={materialCost} setMaterialCost={setMaterialCost}
              laborCost={laborCost} setLaborCost={setLaborCost}
              otherExpenses={otherExpenses} setOtherExpenses={setOtherExpenses}
              totalEstimate={totalEstimate}
              errors={step3Errors}
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
            {saving ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.nextBtnText}>
                {step === 3 ? 'Create Project' : `Next: ${STEP_LABELS[step + 1]}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboard = 'default', multiline = false, error, maxLength }: any) {
  return (
    <View style={fieldStyles.field}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.multiline, error && fieldStyles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboard}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        maxLength={maxLength}
      />
      {error ? <Text style={fieldStyles.errorText}>{error}</Text> : null}
    </View>
  );
}

function Step1({ customerName, setCustomerName, customerPhone, setCustomerPhone, customerEmail, setCustomerEmail, customerAddress, setCustomerAddress, projectName, setProjectName, siteLocation, setSiteLocation, plotArea, setPlotArea, projectType, setProjectType, errors }: any) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Customer Details</Text>
      <FormField label="Full Name *" value={customerName} onChangeText={setCustomerName} error={errors.customerName} />
      <FormField label="Phone Number *" value={customerPhone} onChangeText={setCustomerPhone} keyboard="phone-pad" maxLength={10} error={errors.customerPhone} />
      <FormField label="Email *" value={customerEmail} onChangeText={setCustomerEmail} keyboard="email-address" error={errors.customerEmail} />
      <FormField label="Address *" value={customerAddress} onChangeText={setCustomerAddress} multiline error={errors.customerAddress} />
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Project Details</Text>
      <FormField label="Project Name *" value={projectName} onChangeText={setProjectName} error={errors.projectName} />
      <FormField label="Site Location *" value={siteLocation} onChangeText={setSiteLocation} error={errors.siteLocation} />
      <FormField label="Plot Area (Sq.Ft.) *" value={plotArea} onChangeText={setPlotArea} keyboard="numeric" error={errors.plotArea} />
      <Text style={fieldStyles.label}>Project Type *</Text>
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

function Step2({ requirements, toggleRequirement, error }: any) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Customer Requirements</Text>
      <Text style={styles.sectionSubtitle}>Select at least one requirement</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {requirements.map((req: Requirement) => (
        <TouchableOpacity
          key={req.id}
          style={[styles.requirementRow, req.checked && styles.requirementRowChecked]}
          onPress={() => toggleRequirement(req.id)}
        >
          <View style={[styles.checkbox, req.checked && styles.checkboxChecked]}>
            {req.checked && <Check size={14} color="#fff" />}
          </View>
          <Text style={[styles.requirementText, req.checked && styles.requirementTextChecked]}>{req.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Step3({ startDate, setStartDate, expectedCompletion, setExpectedCompletion, constructionCost, setConstructionCost, materialCost, setMaterialCost, laborCost, setLaborCost, otherExpenses, setOtherExpenses, totalEstimate, errors }: any) {
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [startDateObj, setStartDateObj] = useState(new Date());
  const [endDateObj, setEndDateObj] = useState(new Date());

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>Timeline</Text>

      {/* Start Date */}
      <View style={fieldStyles.field}>
        <Text style={fieldStyles.label}>Start Date *</Text>
        <TouchableOpacity
          style={[dateStyles.dateBtn, errors.startDate && fieldStyles.inputError]}
          onPress={() => setShowStartPicker(true)}
        >
          <Text style={dateStyles.dateBtnIcon}>📅</Text>
          <Text style={[dateStyles.dateBtnText, !startDate && dateStyles.dateBtnPlaceholder]}>
            {startDate ? formatDisplayDate(startDate) : 'Select start date'}
          </Text>
        </TouchableOpacity>
        {errors.startDate ? <Text style={fieldStyles.errorText}>{errors.startDate}</Text> : null}
        {showStartPicker && (
          <View style={dateStyles.pickerContainer}>
            {Platform.OS === 'ios' ? (
              <>
                <DateTimePicker
                  value={startDateObj}
                  mode="date"
                  display="spinner"
                  onChange={(_: any, date: Date | undefined) => {
                    if (date) {
                      setStartDateObj(date);
                      setStartDate(date.toISOString().split('T')[0]);
                    }
                  }}
                  minimumDate={new Date()}
                />
                <TouchableOpacity style={dateStyles.doneBtn} onPress={() => setShowStartPicker(false)}>
                  <Text style={dateStyles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <DateTimePicker
                value={startDateObj}
                mode="date"
                display="default"
                onChange={(_: any, date: Date | undefined) => {
                  setShowStartPicker(false);
                  if (date) {
                    setStartDateObj(date);
                    setStartDate(date.toISOString().split('T')[0]);
                  }
                }}
                minimumDate={new Date()}
              />
            )}
          </View>
        )}
      </View>

      {/* Expected Completion Date */}
      <View style={fieldStyles.field}>
        <Text style={fieldStyles.label}>Expected Completion *</Text>
        <TouchableOpacity
          style={[dateStyles.dateBtn, errors.expectedCompletion && fieldStyles.inputError]}
          onPress={() => setShowEndPicker(true)}
        >
          <Text style={dateStyles.dateBtnIcon}>📅</Text>
          <Text style={[dateStyles.dateBtnText, !expectedCompletion && dateStyles.dateBtnPlaceholder]}>
            {expectedCompletion ? formatDisplayDate(expectedCompletion) : 'Select completion date'}
          </Text>
        </TouchableOpacity>
        {errors.expectedCompletion ? <Text style={fieldStyles.errorText}>{errors.expectedCompletion}</Text> : null}
        {showEndPicker && (
          <View style={dateStyles.pickerContainer}>
            {Platform.OS === 'ios' ? (
              <>
                <DateTimePicker
                  value={endDateObj}
                  mode="date"
                  display="spinner"
                  onChange={(_: any, date: Date | undefined) => {
                    if (date) {
                      setEndDateObj(date);
                      setExpectedCompletion(date.toISOString().split('T')[0]);
                    }
                  }}
                  minimumDate={startDateObj}
                />
                <TouchableOpacity style={dateStyles.doneBtn} onPress={() => setShowEndPicker(false)}>
                  <Text style={dateStyles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <DateTimePicker
                value={endDateObj}
                mode="date"
                display="default"
                onChange={(_: any, date: Date | undefined) => {
                  setShowEndPicker(false);
                  if (date) {
                    setEndDateObj(date);
                    setExpectedCompletion(date.toISOString().split('T')[0]);
                  }
                }}
                minimumDate={startDateObj}
              />
            )}
          </View>
        )}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Rough Estimate (₹)</Text>
      <View>
        <View style={styles.estimateRow}>
          <Text style={styles.estimateLabel}>Construction Cost *</Text>
          <TextInput
            style={[styles.estimateInput, errors.constructionCost && fieldStyles.inputError]}
            value={constructionCost}
            onChangeText={setConstructionCost}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#9CA3AF"
          />
        </View>
        {errors.constructionCost ? <Text style={[fieldStyles.errorText, { marginTop: -8, marginBottom: 8 }]}>{errors.constructionCost}</Text> : null}

        {[
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
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Estimate</Text>
        <Text style={styles.totalValue}>₹ {totalEstimate.toLocaleString('en-IN')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  stepIndicator: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E5E7EB',
  },
  stepCircleActive: { backgroundColor: '#1A56DB', borderColor: '#1A56DB' },
  stepCircleDone: { backgroundColor: '#059669', borderColor: '#059669' },
  stepNum: { fontSize: 10, fontWeight: '700', color: '#9CA3AF' },
  stepNumActive: { color: '#fff' },
  stepLabel: { fontSize: 8, color: '#9CA3AF', fontWeight: '500', textAlign: 'center' },
  stepLabelActive: { color: '#1A56DB', fontWeight: '600' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginBottom: 12 },
  stepLineDone: { backgroundColor: '#059669' },
  content: { padding: 20 },
  errorText: {
    backgroundColor: '#FEF2F2', color: '#DC2626', padding: 12,
    borderRadius: 8, marginBottom: 16, fontSize: 13,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  docStatusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, marginBottom: 16, marginTop: 8,
  },
  docStatusBannerGreen: { backgroundColor: '#ECFDF5' },
  docStatusBannerAmber: { backgroundColor: '#FEF3C7' },
  docStatusText: { flex: 1, fontSize: 13, fontWeight: '500' },
  docStatusTextGreen: { color: '#059669' },
  docStatusTextAmber: { color: '#D97706' },
  docCard: {
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    marginBottom: 10, backgroundColor: '#fff', overflow: 'hidden',
  },
  docCardAvailable: { borderColor: '#059669', backgroundColor: '#F0FDF4' },
  docCardTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
  },
  docLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  docIconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  docIconBoxGreen: { backgroundColor: '#DCFCE7' },
  docIconBoxGray: { backgroundColor: '#F3F4F6' },
  docName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  docNameAvailable: { color: '#059669' },
  docStatusText2: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  docToggle: {
    width: 44, height: 24, borderRadius: 12, backgroundColor: '#E5E7EB',
    justifyContent: 'center', padding: 2,
  },
  docToggleActive: { backgroundColor: '#059669' },
  docToggleDot: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
  docToggleDotActive: { alignSelf: 'flex-end' },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EFF6FF', paddingVertical: 8, paddingHorizontal: 14,
    borderTopWidth: 1, borderTopColor: '#DBEAFE',
  },
  uploadBtnText: { fontSize: 13, color: '#1A56DB', fontWeight: '600' },
  uploadedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ECFDF5', paddingVertical: 8, paddingHorizontal: 14,
    borderTopWidth: 1, borderTopColor: '#BBF7D0',
  },
  uploadedBadgeText: { flex: 1, fontSize: 12, color: '#059669', fontWeight: '500' },
  missingInfoCard: { backgroundColor: '#FEF3C7', borderRadius: 10, padding: 14, marginTop: 8 },
  missingInfoTitle: { fontSize: 13, fontWeight: '700', color: '#D97706', marginBottom: 8 },
  missingInfoItem: { fontSize: 13, color: '#92400E', marginBottom: 4 },
  missingInfoNote: { fontSize: 12, color: '#92400E', marginTop: 8, fontStyle: 'italic' },
  typeRow: { flexDirection: 'row', gap: 12, marginTop: 6, marginBottom: 8 },
  typeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', gap: 8,
  },
  typeChipActive: { borderColor: '#1A56DB', backgroundColor: '#EFF6FF' },
  typeRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  typeRadioActive: { borderColor: '#1A56DB' },
  typeRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1A56DB' },
  typeChipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  typeChipTextActive: { color: '#1A56DB', fontWeight: '600' },
  requirementRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, gap: 12,
  },
  requirementRowChecked: { borderColor: '#1A56DB', backgroundColor: '#EFF6FF' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#1A56DB', borderColor: '#1A56DB' },
  requirementText: { fontSize: 14, color: '#374151' },
  requirementTextChecked: { color: '#1A56DB', fontWeight: '600' },
  estimateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  estimateLabel: { fontSize: 14, color: '#374151' },
  estimateInput: {
    width: 120, textAlign: 'right', fontSize: 14, color: '#111827', fontWeight: '500',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 6, paddingHorizontal: 10,
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderTopWidth: 2, borderTopColor: '#E5E7EB', marginTop: 4,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: '700', color: '#1A56DB' },
  bottomBar: {
    padding: 20, paddingBottom: 32, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  nextBtn: {
    backgroundColor: '#1A56DB', borderRadius: 12, height: 52,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

const fieldStyles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, height: 48,
    paddingHorizontal: 14, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB',
  },
  inputError: { borderColor: '#DC2626' },
  errorText: { fontSize: 11, color: '#DC2626', marginTop: 4 },
  multiline: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
});

const dateStyles = StyleSheet.create({
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    height: 48, paddingHorizontal: 14, backgroundColor: '#F9FAFB',
  },
  dateBtnIcon: { fontSize: 18 },
  dateBtnText: { fontSize: 14, color: '#111827', fontWeight: '500' },
  dateBtnPlaceholder: { color: '#9CA3AF', fontWeight: '400' },
  pickerContainer: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1,
    borderColor: '#E5E7EB', marginTop: 8, overflow: 'hidden',
  },
  doneBtn: {
    backgroundColor: '#1A56DB', padding: 12, alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});