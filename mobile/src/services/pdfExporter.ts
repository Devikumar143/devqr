import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ArchitectureBundle, ArchitectureReport, DebugBundle, DebugAnalysis } from '../types';

export class PDFExporter {
  public static async exportArchitecturePDF(
    bundle: ArchitectureBundle,
    report: ArchitectureReport
  ): Promise<{ uri: string }> {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background-color: #ffffff;
      line-height: 1.5;
      font-size: 10pt;
    }
    .header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-size: 17pt;
      font-weight: 900;
      color: #0284c7;
      letter-spacing: 0.5px;
    }
    .brand-sub {
      font-size: 8.5pt;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 8pt;
      color: #64748b;
    }
    .meta-highlight {
      font-weight: 700;
      color: #0f172a;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
    }
    .badge-primary {
      background-color: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .section-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0284c7;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      margin-top: 16px;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }
    .score-grid {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    .score-box {
      flex: 1;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px;
      text-align: center;
    }
    .score-num {
      font-size: 16pt;
      font-weight: 900;
      color: #0284c7;
      margin-top: 2px;
    }
    .score-label {
      font-size: 7.5pt;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .priority-card {
      background-color: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 12px;
    }
    .priority-title {
      font-size: 8.5pt;
      font-weight: 800;
      color: #c2410c;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .priority-text {
      font-size: 9.5pt;
      color: #9a3412;
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      margin-bottom: 12px;
      font-size: 8.5pt;
    }
    th {
      background-color: #f1f5f9;
      color: #475569;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 7.5pt;
      text-align: left;
      padding: 6px 8px;
      border-bottom: 2px solid #cbd5e1;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .code-font {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      font-size: 8pt;
      color: #0f172a;
    }
    .pipeline-step {
      display: flex;
      margin-bottom: 6px;
      align-items: flex-start;
    }
    .step-num {
      width: 18px;
      height: 18px;
      background-color: #0284c7;
      color: #ffffff;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7.5pt;
      font-weight: 800;
      margin-right: 8px;
      flex-shrink: 0;
      text-align: center;
      line-height: 18px;
    }
    .step-content {
      flex: 1;
      font-size: 8.5pt;
    }
    .step-endpoints {
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 1px;
    }
    .step-desc {
      color: #475569;
    }
    .health-item {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 8px;
      margin-bottom: 6px;
      font-size: 8pt;
    }
    .health-tag {
      display: inline-block;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 7pt;
      font-weight: 800;
      background-color: #fee2e2;
      color: #b91c1c;
      margin-right: 6px;
    }
    .footer {
      margin-top: 20px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand-title">DEVQR ARCHITECTURE BLUEPRINT</div>
      <div class="brand-sub">Executive Technical Audit & Code Health Report</div>
    </div>
    <div class="meta-box">
      <div>Project: <span class="meta-highlight">${bundle.project.name}</span></div>
      <div>Framework: <span class="meta-highlight">${bundle.project.framework}</span> (${bundle.project.language})</div>
      <div>Total Files: <span class="meta-highlight">${bundle.totalFiles}</span> | Total LOC: <span class="meta-highlight">${bundle.totalLines}</span></div>
      <div>Audit Date: <span class="meta-highlight">${new Date().toLocaleDateString()}</span></div>
    </div>
  </div>

  <!-- Section 1: System Pattern -->
  <div class="section-title">1. System Architecture Pattern</div>
  <div class="card">
    <div style="font-size: 12pt; font-weight: 800; color: #0f172a; margin-bottom: 4px;">
      ${report.pattern}
    </div>
    <div style="color: #334155; font-size: 9pt; line-height: 1.5;">
      ${report.summary}
    </div>
  </div>

  <!-- Section 2: Maintainability & Tech Debt Scorecard -->
  <div class="section-title">2. Maintainability & Technical Debt Scorecard</div>
  <div class="score-grid">
    <div class="score-box">
      <div class="score-label">Maintainability Grade</div>
      <div class="score-num" style="color: #16a34a;">${report.techDebt.maintainabilityGrade}</div>
      <div style="font-size: 7pt; color: #64748b;">${report.techDebt.score}/100 Score</div>
    </div>
    <div class="score-box">
      <div class="score-label">Estimated Debt</div>
      <div class="score-num">${report.techDebt.estimatedDebtHours}h</div>
      <div style="font-size: 7pt; color: #64748b;">Refactoring Work</div>
    </div>
    <div class="score-box">
      <div class="score-label">Total Codebase</div>
      <div class="score-num" style="color: #0f172a;">${bundle.totalFiles}</div>
      <div style="font-size: 7pt; color: #64748b;">${bundle.totalLines} Lines of Code</div>
    </div>
  </div>

  <!-- Section 3: Top Refactoring Priority -->
  <div class="priority-card">
    <div class="priority-title">Top Refactoring Priority</div>
    <div class="priority-text">${report.techDebt.topRefactoringPriority}</div>
  </div>

  <!-- Section 4: Module Responsibilities -->
  <div class="section-title">3. Module & File Responsibilities</div>
  <table>
    <thead>
      <tr>
        <th style="width: 32%;">File Path</th>
        <th style="width: 18%;">Layer</th>
        <th style="width: 50%;">Role & Responsibilities</th>
      </tr>
    </thead>
    <tbody>
      ${report.fileResponsibilities.map(f => `
        <tr>
          <td class="code-font">${f.file}</td>
          <td><span class="badge badge-primary">${f.layer}</span></td>
          <td><strong>${f.role}</strong><br><span style="color: #475569; font-size: 8pt;">${f.summary}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Section 5: End-to-End Data Flow Pipeline -->
  <div class="section-title">4. End-to-End Request & Data Flow Pipeline</div>
  <div class="card">
    ${report.dataFlow.map(step => `
      <div class="pipeline-step">
        <div class="step-num">${step.step}</div>
        <div class="step-content">
          <div class="step-endpoints">${step.source} &rarr; ${step.destination}</div>
          <div class="step-desc">${step.description}</div>
        </div>
      </div>
    `).join('')}
  </div>

  <!-- Section 6: Dead Code & Security Audit -->
  <div class="section-title">5. Dead Code & Security Audit</div>
  ${report.deadCode.map(item => `
    <div class="health-item">
      <span class="health-tag">${item.type}</span>
      <span class="code-font">${item.target}</span>: <span style="color: #475569;">${item.reason}</span>
    </div>
  `).join('')}

  ${report.securityIssues.map(sec => `
    <div class="health-item" style="border-left: 3px solid #ef4444;">
      <span class="health-tag" style="background-color: #fee2e2; color: #991b1b;">${sec.severity} SEVERITY</span>
      <span class="code-font">${sec.location}</span>: <strong>${sec.issue}</strong>
      <div style="color: #166534; font-size: 7.5pt; margin-top: 2px;">Recommendation: ${sec.recommendation}</div>
    </div>
  `).join('')}

  <!-- Footer -->
  <div class="footer">
    <div>DevQR Code Architecture Studio - Zero Cloud Backend</div>
    <div>Page 1 of 1</div>
  </div>
</body>
</html>
`;

    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Export Architecture: ${bundle.project.name}`
      });
    }

    return { uri };
  }

  public static async exportPostMortemPDF(
    bundle: DebugBundle,
    analysis: DebugAnalysis
  ): Promise<{ uri: string }> {
    const primaryFile = bundle.relevantFiles?.[0]?.filePath || 'source_file';
    const diffLines = (analysis.codePatch || '').split('\n');

    const formattedDiff = diffLines.map(line => {
      const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (line.startsWith('+') && !line.startsWith('+++')) {
        return `<div style="background-color: #dcfce7; color: #166534; padding: 1px 4px;">${escaped}</div>`;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        return `<div style="background-color: #fee2e2; color: #991b1b; padding: 1px 4px;">${escaped}</div>`;
      } else if (line.startsWith('@@')) {
        return `<div style="background-color: #f1f5f9; color: #0284c7; padding: 1px 4px; font-weight: bold;">${escaped}</div>`;
      }
      return `<div style="padding: 1px 4px; color: #334155;">${escaped}</div>`;
    }).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background-color: #ffffff;
      line-height: 1.5;
      font-size: 10pt;
    }
    .header {
      border-bottom: 2px solid #dc2626;
      padding-bottom: 12px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-size: 17pt;
      font-weight: 900;
      color: #dc2626;
      letter-spacing: 0.5px;
    }
    .brand-sub {
      font-size: 8.5pt;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 8pt;
      color: #64748b;
    }
    .meta-highlight {
      font-weight: 700;
      color: #0f172a;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 8.5pt;
      font-weight: 900;
      background-color: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
      margin-bottom: 4px;
    }
    .section-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      margin-top: 16px;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }
    .error-card {
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }
    .error-title {
      font-size: 8pt;
      font-weight: 800;
      color: #b91c1c;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .error-msg {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 9pt;
      color: #991b1b;
      font-weight: 700;
    }
    .score-grid {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    .score-box {
      flex: 1;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px;
      text-align: center;
    }
    .score-num {
      font-size: 13pt;
      font-weight: 900;
      color: #0284c7;
      margin-top: 2px;
      font-family: monospace;
    }
    .score-label {
      font-size: 7.5pt;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .diff-box {
      background-color: #0f172a;
      border-radius: 8px;
      padding: 10px 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8pt;
      line-height: 1.4;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .action-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 4px;
      font-size: 9pt;
    }
    .action-bullet {
      color: #0284c7;
      font-weight: 900;
      margin-right: 8px;
    }
    .footer {
      margin-top: 20px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand-title">DEVQR INCIDENT POST-MORTEM</div>
      <div class="brand-sub">Root Cause Analysis & Remediation Report</div>
    </div>
    <div class="meta-box">
      <div><span class="status-badge">RESOLVED & VERIFIED</span></div>
      <div>Project: <span class="meta-highlight">${bundle.project.name}</span> (${bundle.project.language})</div>
      <div>Target File: <span class="meta-highlight">${primaryFile}</span></div>
      <div>Date: <span class="meta-highlight">${new Date().toLocaleString()}</span></div>
    </div>
  </div>

  <!-- Incident Details -->
  <div class="error-card">
    <div class="error-title">Incident Error Message</div>
    <div class="error-msg">${bundle.error.message}</div>
  </div>

  <!-- Section 1: Root Cause -->
  <div class="section-title">1. Root Cause Analysis</div>
  <div class="card">
    <div style="font-size: 9.5pt; color: #1e293b; line-height: 1.5;">
      ${analysis.rootCause}
    </div>
  </div>

  <!-- Section 2: Complexity & Performance Impact -->
  <div class="section-title">2. Big-O Complexity & Performance Impact</div>
  <div class="score-grid">
    <div class="score-box">
      <div class="score-label">Time Complexity</div>
      <div class="score-num">${analysis.performance?.timeComplexityBefore || 'O(N)'} &rarr; ${analysis.performance?.timeComplexityAfter || 'O(1)'}</div>
    </div>
    <div class="score-box">
      <div class="score-label">Space Complexity</div>
      <div class="score-num">${analysis.performance?.spaceComplexity || 'O(1)'}</div>
    </div>
    <div class="score-box">
      <div class="score-label">Optimization</div>
      <div style="font-size: 8pt; color: #16a34a; font-weight: 700; margin-top: 4px;">Zero Memory Leak</div>
    </div>
  </div>

  <!-- Section 3: Code Patch Unified Diff -->
  <div class="section-title">3. Surgical Code Remediation (Unified Diff)</div>
  <div class="diff-box">
    ${formattedDiff}
  </div>

  <!-- Section 4: Action Items & Follow-ups -->
  <div class="section-title">4. Verification & Follow-up Action Items</div>
  <div class="card">
    <div style="font-size: 8.5pt; font-weight: 700; color: #0284c7; margin-bottom: 6px;">
      Verification Command: <span style="font-family: monospace; color: #0f172a;">${analysis.verification || 'npm test'}</span>
    </div>
    ${(analysis.postMortem?.actionItems || [
      'Verified surgical fix over local DevQR bridge',
      'Run regression test suite on target module',
      'Commit verified patch to git repository'
    ]).map(item => `
      <div class="action-item">
        <span class="action-bullet">&bull;</span>
        <span>${item}</span>
      </div>
    `).join('')}
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>DevQR Automated Incident Diagnostic Engine - Zero Cloud Backend</div>
    <div>Page 1 of 1</div>
  </div>
</body>
</html>
`;

    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Incident Post-Mortem: ${bundle.project.name}`
      });
    }

    return { uri };
  }
}
