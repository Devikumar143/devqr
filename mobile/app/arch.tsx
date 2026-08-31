import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Clipboard,
  Platform,
  StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArchitectureBundle, ArchitectureReport } from '../src/types';
import { CloudAIEngine } from '../src/services/aiEngine';
import { MobileSecureStore } from '../src/services/secureStore';
import { QRDecoder } from '../src/services/qrDecoder';
import { PDFExporter } from '../src/services/pdfExporter';
import {
  SparklesIcon,
  ShieldCheckIcon,
  TerminalIcon,
  ChipIcon,
  CopyIcon,
  FlashIcon,
  BugIcon,
  ChevronRightIcon
} from '../src/components/SvgIcons';
import { BottomAlert } from '../src/components/BottomAlert';
import { QuantumLoader } from '../src/components/QuantumLoader';
import { CreateFileModal } from '../src/components/CreateFileModal';

type TabType = 'overview' | 'modules' | 'dataflow' | 'health';

export default function ArchitectureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const rawPayload = params.payload as string;

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [layerFilter, setLayerFilter] = useState<string>('All');
  const [archBundle, setArchBundle] = useState<ArchitectureBundle | null>(null);
  const [report, setReport] = useState<ArchitectureReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingPhase, setLoadingPhase] = useState<string>('Scanning repository AST...');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [createFileVisible, setCreateFileVisible] = useState<boolean>(false);
  const [createFilePath, setCreateFilePath] = useState<string>('src/modules/newService.ts');
  const [createFilePrompt, setCreateFilePrompt] = useState<string>('');

  // Alert State
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'info',
    title: '',
    message: ''
  });

  useEffect(() => {
    loadArchitectureData();
  }, [rawPayload]);

  const loadArchitectureData = async () => {
    setIsLoading(true);
    setLoadingPhase('Parsing codebase structure & dependency graph...');

    let parsedBundle: ArchitectureBundle | null = null;

    // 1. Try decoding payload from QR if provided
    if (rawPayload) {
      try {
        const decoded = QRDecoder.decode(rawPayload);
        if (decoded && (decoded.bundle as any)?.mode === 'architecture') {
          parsedBundle = decoded.bundle as unknown as ArchitectureBundle;
        }
      } catch {}
    }

    // 2. Fetch directly from laptop LAN bridge /api/arch
    if (!parsedBundle) {
      const endpoints = [
        'http://10.15.222.210:9222',
        'http://192.168.137.1:9222',
        'http://127.0.0.1:9222'
      ];

      for (const ep of endpoints) {
        try {
          const res = await fetch(`${ep}/api/arch`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.files) {
              parsedBundle = data as ArchitectureBundle;
              break;
            }
          }
        } catch {}
      }
    }

    if (!parsedBundle) {
      // Mock fallback structure for testing
      parsedBundle = {
        version: 1,
        sessionId: 'ARCH-LOCAL',
        createdAt: new Date().toISOString(),
        mode: 'architecture',
        project: { name: 'DevQR Workspace', language: 'TypeScript', framework: 'React Native / Node.js' },
        environment: { platform: 'Windows / Android', os: 'Windows' },
        dependencies: { 'expo': '54.0.0', 'react-native': '0.76.0', 'commander': '12.0.0' },
        files: [
          { path: 'mobile/app/index.tsx', name: 'index.tsx', lines: 340, sizeBytes: 12000, imports: ['react', 'expo-camera'], isEntry: true },
          { path: 'mobile/app/result.tsx', name: 'result.tsx', lines: 1400, sizeBytes: 52000, imports: ['react', 'aiEngine', 'bridge'], isEntry: false },
          { path: 'mobile/src/services/aiEngine.ts', name: 'aiEngine.ts', lines: 860, sizeBytes: 36000, imports: ['types', 'fetch'], isEntry: false },
          { path: 'cli/src/index.ts', name: 'index.ts', lines: 420, sizeBytes: 15000, imports: ['commander', 'bridge', 'detector'], isEntry: true },
          { path: 'cli/src/bridge.ts', name: 'bridge.ts', lines: 350, sizeBytes: 14000, imports: ['http', 'net', 'child_process'], isEntry: false }
        ],
        entryPoints: ['mobile/app/index.tsx', 'cli/src/index.ts'],
        totalFiles: 5,
        totalLines: 3370
      };
    }

    setArchBundle(parsedBundle);
    setLoadingPhase('Synthesizing architectural blueprint & health audit...');

    // Fetch API Settings
    const settings = await MobileSecureStore.getSettings();
    const apiKey = await MobileSecureStore.getApiKey(settings.aiProvider);

    try {
      const archReport = await CloudAIEngine.analyzeArchitecture(parsedBundle, apiKey || undefined, settings.aiProvider);
      setReport(archReport);
    } catch (e) {
      console.warn('Architecture analysis fallback:', e);
    }

    setIsLoading(false);
  };

  const handleJumpToLine = async (filePath: string, lineNum = 1) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const endpoints = [
      archBundle?.bridgeUrl,
      'http://10.15.222.210:9222',
      'http://192.168.137.1:9222',
      'http://127.0.0.1:9222'
    ].filter(Boolean) as string[];

    let success = false;
    for (const url of endpoints) {
      try {
        const res = await fetch(`${url}/api/goto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: filePath, line: lineNum, col: 1 })
        });
        if (res.ok) {
          success = true;
          break;
        }
      } catch {}
    }

    if (success) {
      setAlertState({
        visible: true,
        type: 'success',
        title: 'IDE Beacon Active',
        message: `Jumped editor cursor to ${filePath}:${lineNum}!`
      });
    } else {
      setAlertState({
        visible: true,
        type: 'info',
        title: 'Bridge Disconnected',
        message: 'Could not connect to laptop bridge to focus editor cursor.'
      });
    }
  };

  const handleCopyReport = async () => {
    if (!report || !archBundle) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const markdown = `# Architecture Blueprint & Code Health Audit: ${archBundle.project.name}

## 1. System Pattern
- **Architecture**: ${report.pattern}
- **Maintainability Grade**: ${report.techDebt.maintainabilityGrade} (${report.techDebt.score}/100)
- **Estimated Debt**: ${report.techDebt.estimatedDebtHours} hours

## 2. Executive Summary
${report.summary}

## 3. Top Refactoring Priority
${report.techDebt.topRefactoringPriority}

## 4. File Responsibilities
${report.fileResponsibilities.map(f => `- **${f.file}** (${f.layer}): ${f.summary}`).join('\n')}

## 5. End-to-End Data Flow
${report.dataFlow.map(d => `${d.step}. **${d.source}** -> **${d.destination}**: ${d.description}`).join('\n')}

## 6. Dead Code & Antipatterns
${report.deadCode.map(d => `- [${d.type}] **${d.target}**: ${d.reason}`).join('\n')}

---
*Generated by DevQR Code Architecture Studio (Zero Cloud Backend)*`;

    Clipboard.setString(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    setAlertState({
      visible: true,
      type: 'success',
      title: 'Report Copied',
      message: 'Architecture blueprint copied to clipboard in Markdown format.'
    });
  };

  const handleExportPDF = async () => {
    if (!report || !archBundle) return;
    setIsExportingPDF(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    try {
      await PDFExporter.exportArchitecturePDF(archBundle, report);
      setAlertState({
        visible: true,
        type: 'success',
        title: 'PDF Export Complete',
        message: 'Architecture technical audit PDF generated and ready to share.'
      });
    } catch (e: any) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'PDF Export Failed',
        message: e.message || 'Could not generate PDF report.'
      });
    }
    setIsExportingPDF(false);
  };

  const handleShareReport = async () => {
    if (!report || !archBundle) return;
    try {
      await Share.share({
        title: `Architecture Blueprint: ${archBundle.project.name}`,
        message: `Architecture Blueprint: ${archBundle.project.name}\n\nPattern: ${report.pattern}\nMaintainability Grade: ${report.techDebt.maintainabilityGrade} (${report.techDebt.score}/100)\n\nSummary:\n${report.summary}\n\nTop Priority: ${report.techDebt.topRefactoringPriority}`
      });
    } catch {}
  };

  const filteredResponsibilities = report?.fileResponsibilities.filter(f => {
    if (layerFilter === 'All') return true;
    return f.layer === layerFilter;
  }) || [];

  if (isLoading) {
    return (
      <QuantumLoader
        title="ANALYZING CODEBASE ARCHITECTURE"
        subtitle={loadingPhase}
        steps={[
          'Scanning Project Directory & AST Imports',
          'Building Dependency Hierarchy & Module Tree',
          'Synthesizing System Architecture Blueprint',
          'Auditing Dead Code & Technical Debt Score'
        ]}
        currentStepIndex={loadingPhase.includes('Parsing') ? 1 : 2}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Sleek Top App Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top || 0, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20) + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>&lt; Back</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <ChipIcon size={14} color="#0284c7" style={{ marginRight: 5 }} />
            <Text style={styles.headerTitle}>ARCHITECTURE STUDIO</Text>
          </View>
          <Text style={styles.headerSub}>
            {archBundle?.project?.name || 'Workspace'} • {archBundle?.totalFiles || 0} Files • {archBundle?.totalLines || 0} LOC
          </Text>
        </View>

        <TouchableOpacity onPress={handleExportPDF} style={styles.shareBtn} activeOpacity={0.8}>
          <Text style={styles.shareBtnText}>{isExportingPDF ? 'PDF...' : 'PDF'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Selector Bar */}
      <View style={styles.tabContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'overview' && styles.tabItemActive]}
            onPress={() => setActiveTab('overview')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabItemText, activeTab === 'overview' && styles.tabItemTextActive]}>Overview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'modules' && styles.tabItemActive]}
            onPress={() => setActiveTab('modules')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabItemText, activeTab === 'modules' && styles.tabItemTextActive]}>Modules</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'dataflow' && styles.tabItemActive]}
            onPress={() => setActiveTab('dataflow')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabItemText, activeTab === 'dataflow' && styles.tabItemTextActive]}>Data Flow</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'health' && styles.tabItemActive]}
            onPress={() => setActiveTab('health')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabItemText, activeTab === 'health' && styles.tabItemTextActive]}>Code Health</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Quick Scaffold Bar */}
        <TouchableOpacity
          style={styles.scaffoldBanner}
          onPress={() => {
            setCreateFilePath('src/services/newModule.ts');
            setCreateFilePrompt('Create a service module that integrates with this architecture');
            setCreateFileVisible(true);
          }}
          activeOpacity={0.85}
        >
          <View style={styles.scaffoldIconWrap}>
            <TerminalIcon size={16} color="#0284c7" />
          </View>
          <View style={styles.scaffoldContent}>
            <Text style={styles.scaffoldTitle}>Scaffold & Push New File to IDE</Text>
            <Text style={styles.scaffoldSub}>Write module on phone & auto-open in VS Code</Text>
          </View>
          <SparklesIcon size={14} color="#0284c7" />
        </TouchableOpacity>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && report && (
            <View>
              {/* Architecture Blueprint Card */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <ChipIcon size={14} color="#0284c7" style={{ marginRight: 6 }} />
                  <Text style={styles.cardHeader}>SYSTEM ARCHITECTURE PATTERN</Text>
                </View>
                <Text style={styles.patternTitle}>{report.pattern}</Text>
                <Text style={styles.bodyText}>{report.summary}</Text>
              </View>

              {/* Maintainability & Tech Debt Score Grid */}
              <View style={styles.scoreGrid}>
                <View style={styles.scoreBox}>
                  <Text style={styles.scoreLabel}>MAINTAINABILITY</Text>
                  <Text style={styles.scoreValGrade}>{report.techDebt.maintainabilityGrade}</Text>
                  <Text style={styles.scoreSub}>{report.techDebt.score}/100 Score</Text>
                </View>

                <View style={styles.scoreBox}>
                  <Text style={styles.scoreLabel}>ESTIMATED DEBT</Text>
                  <Text style={styles.scoreValHours}>{report.techDebt.estimatedDebtHours}h</Text>
                  <Text style={styles.scoreSub}>Refactoring Work</Text>
                </View>

                <View style={styles.scoreBox}>
                  <Text style={styles.scoreLabel}>TOTAL CODEBASE</Text>
                  <Text style={styles.scoreValFiles}>{archBundle?.totalFiles || 0}</Text>
                  <Text style={styles.scoreSub}>{archBundle?.totalLines || 0} Lines</Text>
                </View>
              </View>

              {/* Top Refactoring Priority */}
              <View style={styles.priorityCard}>
                <View style={styles.cardHeaderRow}>
                  <FlashIcon size={14} color="#ea580c" style={{ marginRight: 6 }} />
                  <Text style={styles.priorityHeader}>TOP REFACTORING PRIORITY</Text>
                </View>
                <Text style={styles.priorityText}>{report.techDebt.topRefactoringPriority}</Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionBtnGroup}>
                <TouchableOpacity
                  style={[styles.actionBtn, isExportingPDF && styles.actionBtnDisabled]}
                  onPress={handleExportPDF}
                  disabled={isExportingPDF}
                  activeOpacity={0.85}
                >
                  {isExportingPDF ? (
                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                  ) : (
                    <TerminalIcon size={15} color="#ffffff" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.actionBtnText}>
                    {isExportingPDF ? 'Generating PDF...' : 'Export Architecture PDF'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleCopyReport} activeOpacity={0.85}>
                  <CopyIcon size={15} color="#0284c7" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnSecondaryText}>
                    {copied ? 'Copied Markdown Blueprint' : 'Copy Markdown Report'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* TAB 2: MODULE MAP */}
          {activeTab === 'modules' && report && (
            <View>
              {/* Layer Filter Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
                {['All', 'Presentation', 'Business Logic', 'Data / Storage', 'Utility', 'Configuration', 'Core'].map((l) => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.filterPill, layerFilter === l && styles.filterPillActive]}
                    onPress={() => setLayerFilter(l)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterPillText, layerFilter === l && styles.filterPillTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Module Cards */}
              {filteredResponsibilities.map((item, idx) => (
                <View key={idx} style={styles.moduleCard}>
                  <View style={styles.moduleHeaderRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.moduleFile}>{item.file}</Text>
                      <Text style={styles.moduleRole}>{item.role}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.beaconPill}
                      onPress={() => handleJumpToLine(item.file)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.beaconPillText}>Focus in IDE</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.moduleSummary}>{item.summary}</Text>
                  <View style={styles.layerBadge}>
                    <Text style={styles.layerBadgeText}>{item.layer.toUpperCase()}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 3: DATA FLOW */}
          {activeTab === 'dataflow' && report && (
            <View>
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <TerminalIcon size={14} color="#0284c7" style={{ marginRight: 6 }} />
                  <Text style={styles.cardHeader}>END-TO-END REQUEST & DATA PIPELINE</Text>
                </View>

                {report.dataFlow.map((step, idx) => (
                  <View key={idx} style={styles.flowStepRow}>
                    <View style={styles.stepNumCircle}>
                      <Text style={styles.stepNumText}>{step.step}</Text>
                    </View>
                    <View style={styles.flowStepContent}>
                      <View style={styles.flowEndpoints}>
                        <Text style={styles.flowSource}>{step.source}</Text>
                        <Text style={styles.flowArrow}>-&gt;</Text>
                        <Text style={styles.flowDest}>{step.destination}</Text>
                      </View>
                      <Text style={styles.flowDesc}>{step.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* TAB 4: CODE HEALTH */}
          {activeTab === 'health' && report && (
            <View>
              {/* Dead Code Section */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <ShieldCheckIcon size={14} color="#16a34a" style={{ marginRight: 6 }} />
                  <Text style={styles.cardHeader}>DEAD CODE & UNUSED MODULES</Text>
                </View>
                {report.deadCode.map((item, idx) => (
                  <View key={idx} style={styles.healthItem}>
                    <View style={styles.healthHeader}>
                      <Text style={styles.healthTag}>{item.type}</Text>
                      <Text style={styles.healthTarget}>{item.target}</Text>
                    </View>
                    <Text style={styles.healthReason}>{item.reason}</Text>
                  </View>
                ))}
              </View>

              {/* Duplicate Logic Section */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <BugIcon size={14} color="#ea580c" style={{ marginRight: 6 }} />
                  <Text style={styles.cardHeader}>DUPLICATE CODE & ANTIPATTERNS</Text>
                </View>
                {report.duplicateCode.map((item, idx) => (
                  <View key={idx} style={styles.healthItem}>
                    <Text style={styles.dupPattern}>{item.pattern}</Text>
                    <Text style={styles.dupFiles}>Files: {item.filesInvolved.join(', ')}</Text>
                    <Text style={styles.dupRec}>Recommendation: {item.refactorRecommendation}</Text>
                  </View>
                ))}
              </View>

              {/* Security Hotspots */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <ShieldCheckIcon size={14} color="#dc2626" style={{ marginRight: 6 }} />
                  <Text style={styles.cardHeader}>SECURITY & VULNERABILITY HOTSPOTS</Text>
                </View>
                {report.securityIssues.map((item, idx) => (
                  <View key={idx} style={styles.healthItem}>
                    <View style={styles.healthHeader}>
                      <View style={[styles.sevBadge, item.severity === 'High' ? styles.sevHigh : styles.sevLow]}>
                        <Text style={styles.sevBadgeText}>{item.severity} Severity</Text>
                      </View>
                      <Text style={styles.secLocation}>{item.location}</Text>
                    </View>
                    <Text style={styles.secIssue}>{item.issue}</Text>
                    <Text style={styles.secRec}>Fix: {item.recommendation}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

      {/* Bottom Alert Modal */}
      <BottomAlert
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState(prev => ({ ...prev, visible: false }))}
      />

      <CreateFileModal
        visible={createFileVisible}
        onClose={() => setCreateFileVisible(false)}
        initialPath={createFilePath}
        initialPrompt={createFilePrompt}
        bridgeUrl={archBundle?.bridgeUrl || 'http://127.0.0.1:9222'}
        projectContext={archBundle?.project ? `Project: ${archBundle.project.name} (${archBundle.project.framework}), Total Files: ${archBundle.totalFiles}` : ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scaffoldBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  scaffoldIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  scaffoldContent: {
    flex: 1,
  },
  scaffoldTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369a1',
  },
  scaffoldSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#f1f5f9'
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  backBtnText: { color: '#0284c7', fontSize: 12, fontWeight: '700' },
  headerCenter: { alignItems: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  headerTitle: { color: '#0f172a', fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  headerSub: { color: '#64748b', fontSize: 11, fontWeight: '500' },
  shareBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#e0f2fe', borderWidth: 1, borderColor: '#bae6fd' },
  shareBtnText: { color: '#0369a1', fontSize: 12, fontWeight: '700' },

  tabContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9'
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    gap: 3
  },
  tabItem: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabItemActive: {
    backgroundColor: '#0284c7',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2
  },
  tabItemText: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  tabItemTextActive: { color: '#ffffff', fontWeight: '800' },

  contentScroll: { flex: 1, backgroundColor: '#f8fafc' },
  contentContainer: { padding: 16, paddingBottom: 40 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8fafc' },
  loadingSpinnerWrap: { marginBottom: 16 },
  loadingTitle: { color: '#0f172a', fontSize: 15, fontWeight: '900', letterSpacing: 0.8, marginBottom: 6 },
  loadingSub: { color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardHeader: { color: '#0284c7', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  patternTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  bodyText: { color: '#334155', fontSize: 13, lineHeight: 19 },

  scoreGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  scoreBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  scoreLabel: { color: '#64748b', fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  scoreValGrade: { color: '#16a34a', fontSize: 24, fontWeight: '900' },
  scoreValHours: { color: '#0284c7', fontSize: 22, fontWeight: '900' },
  scoreValFiles: { color: '#0f172a', fontSize: 22, fontWeight: '900' },
  scoreSub: { color: '#94a3b8', fontSize: 10, fontWeight: '600' },

  priorityCard: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14
  },
  priorityHeader: { color: '#c2410c', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  priorityText: { color: '#9a3412', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  actionBtnGroup: {
    gap: 10,
    marginTop: 4,
    marginBottom: 10
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2
  },
  actionBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0
  },
  actionBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },

  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingVertical: 13,
    borderRadius: 12
  },
  actionBtnSecondaryText: { color: '#0284c7', fontSize: 13, fontWeight: '800' },

  filterScroll: { marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  filterPillActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  filterPillText: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  filterPillTextActive: { color: '#ffffff', fontWeight: '800' },

  moduleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  moduleHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  moduleFile: { color: '#0f172a', fontSize: 12, fontWeight: '800', fontFamily: 'monospace' },
  moduleRole: { color: '#0284c7', fontSize: 11, fontWeight: '700' },
  moduleSummary: { color: '#334155', fontSize: 11, lineHeight: 16, marginBottom: 8 },
  layerBadge: { alignSelf: 'flex-start', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  layerBadgeText: { color: '#475569', fontSize: 9, fontWeight: '800' },

  beaconPill: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  beaconPillText: { color: '#166534', fontSize: 10, fontWeight: '800' },

  flowStepRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-start' },
  stepNumCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2
  },
  stepNumText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  flowStepContent: { flex: 1 },
  flowEndpoints: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
  flowSource: { color: '#0f172a', fontSize: 12, fontWeight: '800' },
  flowArrow: { color: '#0284c7', fontSize: 12, fontWeight: 'bold', marginHorizontal: 6 },
  flowDest: { color: '#0284c7', fontSize: 12, fontWeight: '800' },
  flowDesc: { color: '#64748b', fontSize: 11, lineHeight: 16 },

  healthItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 8
  },
  healthHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  healthTag: { backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: 9, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  healthTarget: { color: '#0f172a', fontSize: 11, fontWeight: '800', fontFamily: 'monospace' },
  healthReason: { color: '#64748b', fontSize: 11, lineHeight: 16 },

  dupPattern: { color: '#0f172a', fontSize: 12, fontWeight: '800', marginBottom: 2 },
  dupFiles: { color: '#64748b', fontSize: 10, fontFamily: 'monospace', marginBottom: 4 },
  dupRec: { color: '#c2410c', fontSize: 11, fontWeight: '600' },

  sevBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  sevHigh: { backgroundColor: '#fee2e2' },
  sevLow: { backgroundColor: '#fef3c7' },
  sevBadgeText: { color: '#991b1b', fontSize: 9, fontWeight: '800' },
  secLocation: { color: '#0f172a', fontSize: 11, fontWeight: '800', fontFamily: 'monospace' },
  secIssue: { color: '#334155', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  secRec: { color: '#16a34a', fontSize: 11 }
});
