const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { marked } = require('marked');

const mdPath = path.join(__dirname, 'COMPLETE_USER_GUIDE.md');
const htmlPath = path.join(__dirname, 'guide_styled.html');
const pdfPath = path.join(__dirname, 'DevQR_Complete_User_Guide.pdf');

console.log('Reading Markdown content...');
const markdown = fs.readFileSync(mdPath, 'utf8');

console.log('Converting Markdown to HTML...');
const bodyHtml = marked.parse(markdown);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DevQR — Complete User Guide & Technical Manual</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 20mm 16mm;
      @bottom-right {
        content: counter(page);
      }
    }
    
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.6;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }

    h1 {
      font-size: 22pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2.5px solid #0284c7;
      padding-bottom: 8px;
      margin-top: 0;
      margin-bottom: 16px;
      page-break-after: avoid;
    }

    h2 {
      font-size: 15pt;
      font-weight: 700;
      color: #0369a1;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 28px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }

    h3 {
      font-size: 12.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 20px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }

    h4 {
      font-size: 11pt;
      font-weight: 700;
      color: #334155;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    p, li {
      color: #334155;
    }

    blockquote {
      margin: 12px 0;
      padding: 10px 16px;
      background-color: #f0f9ff;
      border-left: 4px solid #0284c7;
      border-radius: 4px;
      color: #0369a1;
      font-style: italic;
    }

    blockquote p {
      margin: 0;
      color: #0369a1;
    }

    code {
      font-family: "Cascadia Code", "Fira Code", "Courier New", monospace;
      font-size: 9pt;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    pre {
      background-color: #090d16;
      color: #f8fafc;
      padding: 14px 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: "Cascadia Code", "Fira Code", "Courier New", monospace;
      font-size: 8.8pt;
      line-height: 1.45;
      margin: 14px 0;
      page-break-inside: avoid;
      border: 1px solid #1e293b;
    }

    pre code {
      background-color: transparent;
      color: #f8fafc;
      padding: 0;
      border: none;
      font-size: 8.8pt;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background-color: #f8fafc;
      color: #0f172a;
      font-weight: 700;
    }

    tr:nth-child(even) {
      background-color: #f8fafc;
    }

    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 24px 0;
    }

    ul, ol {
      padding-left: 22px;
      margin: 8px 0 14px 0;
    }

    li {
      margin-bottom: 4px;
    }

    a {
      color: #0284c7;
      text-decoration: none;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 8pt;
      font-weight: bold;
      border-radius: 6px;
      background-color: #e0f2fe;
      color: #0369a1;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;

fs.writeFileSync(htmlPath, fullHtml, 'utf8');
console.log('HTML styled template saved to:', htmlPath);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

console.log('Generating PDF via Headless Edge Engine...');
const cmd = `"${edgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${pdfPath}" --no-pdf-header-footer "file:///${htmlPath.replace(/\\\\/g, '/')}"`;

execSync(cmd, { stdio: 'inherit' });

if (fs.existsSync(pdfPath)) {
  const stats = fs.statSync(pdfPath);
  console.log(`\nSUCCESS: PDF Generated Successfully!`);
  console.log(`Path: ${pdfPath}`);
  console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
} else {
  console.error('PDF generation failed.');
  process.exit(1);
}
