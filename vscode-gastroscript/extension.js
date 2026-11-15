// GastroScript — VS Code extension.
// Plain CommonJS (no build step). All the food logic lives in gastric.py; this file only
// asks it `--check --stdin` for a JSON report and turns that into editor UI.
'use strict';

const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');
const fs = require('fs');

const LANG = 'gastroscript';
const DEBOUNCE_MS = 250;

const CATEGORY_STYLE = {
  fat: { color: '#ff8f80', fontWeight: 'bold' },
  dairy: { color: '#ffd866' },
  spice: { color: '#ffa24d', textDecoration: 'none; text-shadow: 0 0 6px rgba(255,90,30,.85)' },
  bulk: { color: '#e6c79c' },
  fiber: { color: '#8ed46b' },
  remedy: { color: '#6fd3e8', fontStyle: 'italic' },
};
const EMOJI = { fat: '🥓', dairy: '🧀', spice: '🌶️', bulk: '🍞', fiber: '🥬', remedy: '💊' };
const BLURB = {
  fat: 'Fat fills the stomach and thickens the code.',
  dairy: 'Dairy builds gas pressure: bubbles.',
  spice: 'Spice builds heat: the stomach shakes.',
  bulk: 'Neutral filling. Too much causes Carbohydrate Gridlock.',
  fiber: 'Fiber drains the stomach.',
  remedy: 'Neutralizes gas and heat, and drains a little.',
};

let ctx, diagnostics, statusItem, output, panel;
const reports = new Map();   // uri -> last report that parsed
const timers = new Map();
const seq = new Map();
let lastKey = null;          // most recent GastroScript document (survives focusing the panel)
let warnedSpawn = false, warnedGastric = false;
let categoryDecos = {};
let bodyDecos = [];          // [level][bold]

// ------------------------------------------------------------------ config helpers
function cfg() { return vscode.workspace.getConfiguration('gastroscript'); }

function pythonPath() {
  return cfg().get('pythonPath') || (process.platform === 'win32' ? 'py' : 'python3');
}

function gastricPath() {
  const candidates = [];
  const configured = cfg().get('gastricPath');
  if (configured) candidates.push(configured);
  candidates.push(path.join(ctx.extensionPath, 'gastric.py'));
  for (const f of vscode.workspace.workspaceFolders || []) candidates.push(path.join(f.uri.fsPath, 'gastric.py'));
  candidates.push(path.join(ctx.extensionPath, '..', 'gastric.py')); // running from the repo
  return candidates.find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } });
}

// ------------------------------------------------------------------ checking
function scheduleCheck(doc) {
  if (doc.languageId !== LANG) return;
  const key = doc.uri.toString();
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => runCheck(doc), DEBOUNCE_MS));
}

function runCheck(doc) {
  const key = doc.uri.toString();
  const id = (seq.get(key) || 0) + 1;
  seq.set(key, id);

  const gastric = gastricPath();
  if (!gastric) {
    if (!warnedGastric) {
      warnedGastric = true;
      vscode.window.showErrorMessage('GastroScript: gastric.py not found. Set "gastroscript.gastricPath".');
    }
    return;
  }

  let out = '', err = '';
  let child;
  try {
    child = cp.spawn(pythonPath(), [gastric, '--check', '--stdin', doc.fileName], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      windowsHide: true,
    });
  } catch (e) {
    return spawnFailed(e);
  }
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { err += d; });
  child.on('error', spawnFailed);
  child.on('close', () => {
    if (seq.get(key) !== id) return; // a newer check is already on its way
    let report;
    try { report = JSON.parse(out); } catch {
      output.appendLine(`[check failed] ${err || out}`);
      return;
    }
    applyReport(doc, report);
  });
  child.stdin.on('error', () => {});
  child.stdin.end(doc.getText(), 'utf8');
}

function spawnFailed(e) {
  if (warnedSpawn) return;
  warnedSpawn = true;
  vscode.window.showErrorMessage(
    `GastroScript: could not start Python (“${pythonPath()}”): ${e.message}. Set "gastroscript.pythonPath".`);
}

function applyReport(doc, report) {
  const key = doc.uri.toString();
  diagnostics.set(doc.uri, (report.problems || []).map(p => {
    const line = Math.max(0, p.line - 1);
    const range = new vscode.Range(line, p.col, line, p.col + Math.max(1, p.width));
    const sev = p.severity === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error;
    const d = new vscode.Diagnostic(range, `${p.kind}: ${p.message}`, sev);
    d.source = 'gastric';
    d.code = p.kind;
    return d;
  }));

  // On a syntax error keep the last good stomach: you're mid-bite, not poisoned.
  if (!report.syntax_error) reports.set(key, report);

  for (const ed of vscode.window.visibleTextEditors) if (ed.document === doc) decorate(ed);
  if (lastKey === key || isActive(doc)) {
    lastKey = key;
    updateStatus();
    postToPanel();
  }
}

function isActive(doc) {
  const ed = vscode.window.activeTextEditor;
  return ed && ed.document === doc;
}

// ------------------------------------------------------------------ decorations
function createDecorations() {
  for (const [cat, style] of Object.entries(CATEGORY_STYLE)) {
    categoryDecos[cat] = vscode.window.createTextEditorDecorationType(style);
  }
  for (let lvl = 0; lvl < 5; lvl++) {
    bodyDecos.push([false, true].map(bold => vscode.window.createTextEditorDecorationType({
      letterSpacing: `${(lvl * 0.6).toFixed(1)}px`,
      fontWeight: bold ? 'bold' : undefined,
    })));
  }
}

function decorate(editor) {
  const doc = editor.document;
  if (doc.languageId !== LANG) return;
  const r = reports.get(doc.uri.toString());
  const byCat = Object.fromEntries(Object.keys(CATEGORY_STYLE).map(c => [c, []]));
  if (r) {
    for (const t of r.tokens || []) {
      const range = new vscode.Range(t.line - 1, t.col, t.line - 1, t.col + t.len);
      // tokens may be stale while the buffer has a syntax error; only paint ones that still match
      if (t.line - 1 < doc.lineCount && doc.getText(range) === t.name) byCat[t.category].push(range);
    }
  }
  for (const [cat, deco] of Object.entries(categoryDecos)) editor.setDecorations(deco, byCat[cat]);

  // the whole program gets chubby (and bold when it's fat) as the stomach fills
  let level = 0, bold = false;
  if (r && cfg().get('bodyEffects')) {
    const s = r.severity;
    level = s < 45 ? 0 : s < 60 ? 1 : s < 75 ? 2 : s < 100 ? 3 : 4;
    bold = r.fat_eff >= 50;
  }
  const whole = [new vscode.Range(0, 0, doc.lineCount, 0)];
  bodyDecos.forEach((pair, lvl) => pair.forEach((deco, b) => {
    editor.setDecorations(deco, lvl === level && b === Number(bold) && (level || bold) ? whole : []);
  }));
}

// ------------------------------------------------------------------ status bar
function currentReport() {
  const ed = vscode.window.activeTextEditor;
  if (ed && ed.document.languageId === LANG) lastKey = ed.document.uri.toString();
  else if (ed) return null; // some other kind of file is focused
  return lastKey ? reports.get(lastKey) : null;
}

function updateStatus() {
  const ed = vscode.window.activeTextEditor;
  const showing = (ed && ed.document.languageId === LANG) || (!ed && lastKey);
  if (!showing) { statusItem.hide(); return; }
  const r = currentReport();
  if (!r) {
    statusItem.text = '🫃 digesting…';
    statusItem.backgroundColor = undefined;
    statusItem.show();
    return;
  }
  const label = r.blocked ? 'REFUSED' : r.stage.toUpperCase();
  statusItem.text = `🫃 ${Math.round(r.severity)}% ${label}`;
  statusItem.backgroundColor = r.blocked || r.stage === 'diarrhea'
    ? new vscode.ThemeColor('statusBarItem.errorBackground')
    : r.stage === 'bloated' ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
  const md = new vscode.MarkdownString(
    `**Stomach: ${label}** (${Math.round(r.severity)}%)\n\n` +
    `fill ${Math.round(r.fill)}% · gas ${Math.round(r.gas)}% · heat ${Math.round(r.heat)}%\n\n` +
    `${r.servings} serving(s)` + (r.diets.length ? ` · diet: ${r.diets.join(', ')}` : '') +
    `\n\n_Click to show the stomach._`);
  statusItem.tooltip = md;
  statusItem.show();
}

// ------------------------------------------------------------------ hover
function provideHover(doc, pos) {
  const r = reports.get(doc.uri.toString());
  if (!r) return;
  const t = (r.tokens || []).find(t => t.line - 1 === pos.line && pos.character >= t.col && pos.character <= t.col + t.len);
  if (!t) return;
  const nutrients = Object.entries(t.nutrients).map(([k, v]) => `${k} ${v}`).join(' · ');
  const md = new vscode.MarkdownString(
    `**${EMOJI[t.category]} ${t.name}**` + (t.name !== t.food ? ` _(${t.food})_` : '') +
    `\n\n${nutrients} _per portion_\n\n${BLURB[t.category]}`);
  return new vscode.Hover(md, new vscode.Range(t.line - 1, t.col, t.line - 1, t.col + t.len));
}

// ------------------------------------------------------------------ run
async function run() {
  const ed = vscode.window.activeTextEditor;
  if (!ed || ed.document.languageId !== LANG) {
    vscode.window.showWarningMessage('GastroScript: open a .gs file to run it.');
    return;
  }
  const doc = ed.document;
  if (doc.isUntitled) {
    vscode.window.showWarningMessage('GastroScript: save the file first.');
    return;
  }
  await doc.save();
  const gastric = gastricPath();
  if (!gastric) {
    vscode.window.showErrorMessage('GastroScript: gastric.py not found. Set "gastroscript.gastricPath".');
    return;
  }
  const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
  const task = new vscode.Task(
    { type: 'gastroscript', file: doc.fileName },
    folder || vscode.TaskScope.Workspace,
    path.basename(doc.fileName),
    'gastroscript',
    new vscode.ProcessExecution(pythonPath(), [gastric, doc.fileName], {
      cwd: path.dirname(doc.fileName),
      env: { PYTHONIOENCODING: 'utf-8' },
    }));
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Dedicated,
    clear: true,
    focus: false,
    showReuseMessage: false,
  };
  try {
    await vscode.tasks.executeTask(task);
  } catch (e) {
    // no workspace open: fall back to a plain terminal
    const term = vscode.window.createTerminal('GastroScript');
    const q = s => `"${s}"`;
    const call = process.platform === 'win32' ? '& ' : '';
    term.sendText(`${call}${q(pythonPath())} ${q(gastric)} ${q(doc.fileName)}`);
    term.show(true);
  }
}

// ------------------------------------------------------------------ stomach panel
function showStomach() {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside, true);
    postToPanel();
    return;
  }
  const media = vscode.Uri.joinPath(ctx.extensionUri, 'media');
  panel = vscode.window.createWebviewPanel('gastroscript.stomach', '🫃 Stomach',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [media] });
  panel.iconPath = vscode.Uri.joinPath(ctx.extensionUri, 'icons', 'gs.svg');
  panel.webview.html = panelHtml(panel.webview, media);
  panel.webview.onDidReceiveMessage(m => { if (m.type === 'ready') postToPanel(); });
  panel.onDidDispose(() => { panel = undefined; });
}

function postToPanel() {
  if (!panel) return;
  const r = lastKey ? reports.get(lastKey) : null;
  if (!r) return;
  panel.webview.postMessage({
    type: 'state',
    file: path.basename(vscode.Uri.parse(lastKey).fsPath),
    report: { ...r, tokens: undefined },
  });
}

function panelHtml(webview, media) {
  const nonce = [...Array(24)].map(() => Math.random().toString(36)[2]).join('');
  const script = webview.asWebviewUri(vscode.Uri.joinPath(media, 'stomach.js'));
  const css = webview.asWebviewUri(vscode.Uri.joinPath(media, 'stomach.css'));
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${css}">
</head><body data-stage="healthy">
  <div class="top"><span id="pill" class="pill">Healthy</span><span id="file" class="file"></span></div>
  <div class="box">
    <svg id="stomach" viewBox="0 0 300 340">
      <defs>
        <clipPath id="clip"><path id="clipShape"/></clipPath>
        <radialGradient id="shine" cx="0.35" cy="0.3" r="0.6">
          <stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <g id="sg">
        <path id="wall" stroke-width="7" stroke-linejoin="round"/>
        <g clip-path="url(#clip)"><path id="liquid"/><g id="bubbles"></g></g>
        <path id="gloss" fill="url(#shine)"/>
        <ellipse id="eyeL" cx="208" cy="160" rx="6" ry="7" fill="#2a1a22"/>
        <ellipse id="eyeR" cx="243" cy="160" rx="6" ry="7" fill="#2a1a22"/>
        <circle id="cheekL" cx="198" cy="180" r="7" fill="#ff7f9f" opacity="0"/>
        <circle id="cheekR" cx="254" cy="180" r="7" fill="#ff7f9f" opacity="0"/>
        <path id="mouth" fill="none" stroke="#2a1a22" stroke-width="4" stroke-linecap="round"/>
      </g>
    </svg>
    <div id="rain"></div>
  </div>
  <div id="caption" class="caption"></div>
  <div class="meters">
    <span>fill <b id="mFill">0</b>%</span><span>gas <b id="mGas">0</b>%</span><span>heat <b id="mHeat">0</b>%</span>
  </div>
  <div class="legend">🥓 fat fills · 🧀 dairy bubbles · 🌶️ spice shakes · 🥬 fiber drains · 💊 antacid calms</div>
  <script nonce="${nonce}" src="${script}"></script>
</body></html>`;
}

// ------------------------------------------------------------------ lifecycle
function activate(context) {
  ctx = context;
  diagnostics = vscode.languages.createDiagnosticCollection('gastroscript');
  output = vscode.window.createOutputChannel('GastroScript');
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.command = 'gastroscript.showStomach';
  createDecorations();

  context.subscriptions.push(
    diagnostics, output, statusItem,
    ...Object.values(categoryDecos), ...bodyDecos.flat(),
    vscode.commands.registerCommand('gastroscript.run', run),
    vscode.commands.registerCommand('gastroscript.showStomach', showStomach),
    vscode.languages.registerHoverProvider(LANG, { provideHover }),
    vscode.workspace.onDidOpenTextDocument(scheduleCheck),
    vscode.workspace.onDidChangeTextDocument(e => scheduleCheck(e.document)),
    vscode.workspace.onDidCloseTextDocument(doc => {
      const key = doc.uri.toString();
      diagnostics.delete(doc.uri);
      reports.delete(key);
      if (lastKey === key) lastKey = null;
      updateStatus();
    }),
    vscode.window.onDidChangeActiveTextEditor(ed => {
      if (ed) decorate(ed);
      updateStatus();
      postToPanel();
    }),
    vscode.window.onDidChangeVisibleTextEditors(eds => eds.forEach(decorate)),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('gastroscript')) return;
      warnedSpawn = warnedGastric = false;
      vscode.workspace.textDocuments.forEach(scheduleCheck);
    }),
  );

  vscode.workspace.textDocuments.forEach(scheduleCheck);
  updateStatus();
}

function deactivate() {}

module.exports = { activate, deactivate };
