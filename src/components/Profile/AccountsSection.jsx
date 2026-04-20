import { useState, useRef } from 'react';
import {
  Plus, Pause, Play, Trash2, Search, ArrowUpDown, Store,
  Upload, FileText, CheckCircle, XCircle, AlertCircle, X, ChevronRight, Sparkles, Loader
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as pdfjsLib from 'pdfjs-dist';
import Card from '../UI/Card';
import Button from '../UI/Button';
import AccountDetail from './AccountDetail';
import './AccountsSection.css';
import { generateFingerprint } from '../../utils/merchantUtils';

// Configure PDF.js worker to use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

const POPULAR_BANKS = [
  'HDFC Bank', 'ICICI Bank', 'State Bank of India (SBI)', 'Axis Bank', 'Kotak Mahindra Bank',
  'Punjab National Bank (PNB)', 'Bank of Baroda', 'Canara Bank',
  'JP Morgan Chase', 'HSBC', 'Citibank', 'Bank of America', 'Wells Fargo', 'Barclays', 'Standard Chartered'
];

// ─── CSV PARSER ──────────────────────────────────────────────
// Tries to detect common bank CSV formats and parse them into rows
const parseCSV = (text) => {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [], error: 'File appears empty.' };

  // Detect delimiter
  const delimiters = [',', '\t', ';', '|'];
  const firstLine = lines[0];
  const delimiter = delimiters.find(d => firstLine.split(d).length > 2) || ',';

  const parseRow = (line) => line.split(delimiter).map(cell =>
    cell.trim().replace(/^"|"$/g, '').trim()
  );

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).filter(l => l.trim() && !l.startsWith(',,'))
    .map(line => {
      const cells = parseRow(line);
      const row = {};
      headers.forEach((h, i) => { row[h] = cells[i] || ''; });
      return row;
    });

  return { headers, rows, delimiter };
};

// Try to map CSV columns to our standard fields
// Handles: HDFC, ICICI, SBI, Axis, Kotak, PNB, Paytm, standard formats
const detectColumnMap = (rawHeaders) => {
  // Normalize: lowercase, collapse spaces, remove dots/parens/slashes
  const norm = h => h.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[().\/#]/g, '').trim();
  const nHeaders = rawHeaders.map(norm);

  const find = (exactList, containsList = []) => {
    // 1. Exact normalized match (highest confidence)
    for (const p of exactList) {
      const i = nHeaders.indexOf(norm(p));
      if (i !== -1) return rawHeaders[i];
    }
    // 2. Contains match (lower confidence, avoids false positives on short codes)
    for (const p of containsList) {
      const np = norm(p);
      const i = nHeaders.findIndex(h => h.includes(np));
      if (i !== -1) return rawHeaders[i];
    }
    return null;
  };

  return {
    // ── DATE ──────────────────────────────────────────────────────
    // SBI: 'Txn Date' | HDFC: 'Date' | ICICI: 'Transaction Date'
    // Axis: 'Tran Date' | Kotak: 'Dt' | Generic: 'Value Date'
    date: find(
      ['date', 'txn date', 'tran date', 'transaction date', 'value date',
       'dt', 'value dat', 'posting date', 'book date', 'trans date'],
      ['date', 'txn_date']
    ),

    // ── DESCRIPTION ───────────────────────────────────────────────
    // HDFC: 'Narration' | SBI: 'Description' | Axis: 'PARTICULARS'
    // ICICI: 'Transaction Remarks' | Kotak: 'Txn Description'
    desc: find(
      ['narration', 'description', 'particulars', 'particular', 'details',
       'remarks', 'txn description', 'transaction remarks', 'transaction description',
       'chq remarks', 'transaction details', 'beneficiary', 'details narration'],
      ['narration', 'description', 'particular', 'detail', 'remark', 'merchant']
    ),

    // ── DEBIT (money out) ─────────────────────────────────────────
    // HDFC: 'Debit Amount' | SBI: 'Debit' | Axis: 'DR'
    // ICICI: 'Withdrawal Amount (INR )' | Kotak: 'Withdrawal Dr'
    debit: find(
      ['debit', 'dr', 'debit amount', 'withdrawal', 'withdrawal amount',
       'withdrawal dr', 'debit amt', 'debit amount inr', 'withdrawl amount',
       'withdrawal amount inr', 'debit amount inr', 'money out'],
      ['debit', 'withdrawal', 'withdrawl']
    ),

    // ── CREDIT (money in) ─────────────────────────────────────────
    // HDFC: 'Credit Amount' | SBI: 'Credit' | Axis: 'CR'
    // ICICI: 'Deposit Amount (INR )' | Kotak: 'Deposit Cr'
    credit: find(
      ['credit', 'cr', 'credit amount', 'deposit', 'deposit amount',
       'deposit cr', 'credit amt', 'credit amount inr',
       'deposit amount inr', 'money in'],
      ['credit', 'deposit']
    ),

    // ── BALANCE ───────────────────────────────────────────────────
    // Kotak: 'Bal' | HDFC: 'Closing Balance' | Generic: 'Balance'
    balance: find(
      ['balance', 'bal', 'closing balance', 'running balance',
       'closing bal', 'available balance', 'balance inr', 'runbal', 'closing balance inr'],
      ['balance']
    ),

    // ── REFERENCE ─────────────────────────────────────────────────
    // HDFC: 'Chq./Ref.No.' | ICICI: 'Ref No./Cheque No.'
    // SBI: 'Ref No./Cheque No.' | Axis: 'CHQNO' | Generic: 'UTR'
    ref: find(
      ['ref no', 'chq no', 'chqno', 'reference', 'chq ref number',
       'ref no cheque no', 'reference number', 'transaction id', 'txnid',
       'utr', 'utr no', 'rrn', 'cheque number', 'chq ref no'],
      ['reference', 'ref_no', 'cheque', 'txnid', 'utr']
    ),

    // ── AMOUNT (single-column fallback) ───────────────────────────
    // Used when bank exports only one amount column (signed or with Dr/Cr suffix)
    amount: find(
      ['amount', 'amt', 'transaction amount', 'txn amount'],
      ['amount']
    ),
  };
};

// Validate detected column mapping — returns errors (blocking) + warnings (advisory)
const validateColumnMap = (colMap, rows) => {
  const errors = [];
  const warnings = [];

  // CRITICAL: no date column
  if (!colMap.date) {
    errors.push('No date column detected. Without dates, transactions cannot be sorted or filtered by time.');
  }

  // CRITICAL: no amount information at all
  if (!colMap.debit && !colMap.credit && !colMap.amount) {
    errors.push('No amount column detected. Cannot determine transaction values.');
  }

  // WARNING: no description
  if (!colMap.desc) {
    warnings.push('No description column found. All transactions will be labelled "Unnamed".');
  }

  // WARNING: amounts all appear to be zero (likely wrong column mapped)
  if (rows.length > 0 && (colMap.debit || colMap.credit || colMap.amount)) {
    const samples = rows.slice(0, 10);
    const allZero = samples.every(r => {
      const d = parseAmount(r[colMap.debit] || '');
      const c = parseAmount(r[colMap.credit] || '');
      const a = parseAmount(r[colMap.amount] || '');
      return (d + c + Math.abs(a)) === 0;
    });
    if (allZero) warnings.push('All sampled amounts are zero — the column mapping may be incorrect.');
  }

  // WARNING: dates could not be parsed
  if (colMap.date && rows.length > 0) {
    const failCount = rows.slice(0, 5).filter(r => !parseDate(r[colMap.date])).length;
    if (failCount >= 3) {
      warnings.push(`Date format could not be parsed for ${failCount}/5 sample rows. Dates will be saved as null.`);
    }
  }

  return { errors, warnings, isValid: errors.length === 0 };
};

// Parse a date string into ISO format
const parseDate = (str) => {
  if (!str) return null;
  // Try DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY
  const formats = [
    /^(\d{2})[-\/](\d{2})[-\/](\d{4})$/,  // DD/MM/YYYY
    /^(\d{4})[-\/](\d{2})[-\/](\d{2})$/,  // YYYY-MM-DD
    /^(\d{2})[-\/](\d{2})[-\/](\d{2})$/,  // DD/MM/YY
  ];
  for (const fmt of formats) {
    const m = str.match(fmt);
    if (m) {
      if (m[3].length === 4) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
      if (m[1].length === 4) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
      const year = parseInt(m[3]) + 2000;
      return `${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    }
  }
  // Fallback: try native Date parse
  const d = new Date(str);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
};

const parseAmount = (str) => {
  if (!str || str === '') return 0;
  const cleaned = str.replace(/[₹,$,\s,]/g, '').replace(/,/g, '');
  return parseFloat(cleaned) || 0;
};

// ─── UPLOAD MODAL ─────────────────────────────────────────────
const UploadStatementModal = ({ account, user, onClose, onImported }) => {
  const fileRef = useRef();
  const [step, setStep] = useState('upload');
  const [parsedRows, setParsedRows] = useState([]);
  const [colMap, setColMap] = useState({});
  const [headers, setHeaders] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState({ errors: [], warnings: [], isValid: true });
  // PDF / Gemini state
  const [isPdfMode, setIsPdfMode] = useState(false);
  const [geminiStep, setGeminiStep] = useState('idle'); // idle | rendering | analyzing | done
  const [geminiProgress, setGeminiProgress] = useState('');

  // ── Gemini Vision PDF analyzer ──────────────────────────────
  const analyzePdfWithGemini = async (file) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setError('Gemini API key not found. Add VITE_GEMINI_API_KEY to your .env file.');
      return;
    }

    try {
      setIsPdfMode(true);
      setGeminiStep('rendering');
      setGeminiProgress('Loading PDF...');

      // 1. Load the PDF document using PDF.js
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const GEMINI_PROMPT = `You are a bank statement transaction extractor.
Analyze this bank statement image and extract ALL transactions visible on this page.

Return ONLY a valid JSON array. Each item must have exactly these fields:
- "date": "YYYY-MM-DD" (convert any date format to ISO standard)
- "description": "string" (merchant name or narration, cleaned up)
- "debit_amount": number (amount going out, use 0 if not applicable)
- "credit_amount": number (amount coming in, use 0 if not applicable)
- "balance": number (running balance after transaction, use 0 if not shown)
- "reference_no": "string" (UTR/Ref number if visible, empty string if absent)

If no transactions are on this page (e.g. summary, header, or footer page), return [].
Return ONLY the raw JSON array — no markdown, no code blocks, no explanation.`;

      let allRows = [];
      const seenRefs = new Set();

      // 2. Process each page
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setGeminiStep('analyzing');
        setGeminiProgress(`Analyzing page ${pageNum} of ${totalPages} with Gemini AI...`);

        // Render page to canvas
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for clarity
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        // Convert to base64 PNG
        const base64 = canvas.toDataURL('image/png').split(',')[1];

        // Send to Gemini Vision
        let pageRows = [];
        try {
          const result = await model.generateContent([
            GEMINI_PROMPT,
            { inlineData: { data: base64, mimeType: 'image/png' } }
          ]);
          const text = result.response.text().trim();
          // Strip possible markdown code fences Gemini sometimes adds
          const clean = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
          pageRows = JSON.parse(clean);
        } catch (parseErr) {
          console.warn(`Page ${pageNum} parse error:`, parseErr);
          // Non-fatal — skip this page, continue with others
        }

        // Merge into allRows, deduplicating within the PDF by reference_no
        pageRows.forEach(row => {
          const key = row.reference_no || `${row.date}|${row.description}|${row.debit_amount}|${row.credit_amount}`;
          if (!seenRefs.has(key)) {
            seenRefs.add(key);
            allRows.push(row);
          }
        });
      }

      if (allRows.length === 0) {
        setError('Gemini could not find any transactions in this PDF. Try a clearer scan or use CSV export instead.');
        setIsPdfMode(false);
        setGeminiStep('idle');
        return;
      }

      // 3. Convert Gemini rows into the parsedRows shape the existing pipeline expects
      const structuredRows = allRows.map(r => ({
        date:         r.date || '',
        description:  r.description || 'Unnamed',
        debit_amount: Number(r.debit_amount) || 0,
        credit_amount: Number(r.credit_amount) || 0,
        balance:      Number(r.balance) || 0,
        reference_no: r.reference_no || '',
      }));

      setGeminiStep('done');
      setParsedRows(structuredRows);
      setStep('preview');

    } catch (err) {
      console.error('Gemini PDF analysis failed:', err);
      setError(`AI analysis failed: ${err.message}. Try uploading a clearer PDF or use CSV instead.`);
      setIsPdfMode(false);
      setGeminiStep('idle');
    }
  };

  // ── File handler — routes CSV vs PDF ────────────────────────
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    setIsPdfMode(false);

    if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
      analyzePdfWithGemini(file);
      return;
    }

    // Existing CSV/TXT path
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows, error: parseError } = parseCSV(ev.target.result);
      if (parseError) { setError(parseError); return; }
      if (rows.length === 0) { setError('No data rows found in this file.'); return; }

      const detectedMap = detectColumnMap(headers);
      const validationResult = validateColumnMap(detectedMap, rows);

      setHeaders(headers);
      setColMap(detectedMap);
      setParsedRows(rows);
      setValidation(validationResult);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');

    try {
      // Pre-build candidate rows — PDF mode uses pre-structured Gemini data,
      // CSV mode maps through colMap as before.
      const candidateRows = parsedRows.map(r => {
        if (isPdfMode) {
          // PDF rows: already structured by Gemini with clean field names
          const txnDate = r.date || null;   // Gemini already returns ISO YYYY-MM-DD
          const description = r.description || 'Unnamed';
          const debit  = Number(r.debit_amount)  || 0;
          const credit = Number(r.credit_amount) || 0;
          return {
            user_id:       user.id,
            account_id:    account.id,
            raw_date:      txnDate || '',
            txn_date:      txnDate,
            description,
            debit_amount:  debit,
            credit_amount: credit,
            balance:       Number(r.balance) || 0,
            reference_no:  r.reference_no || '',
            status:        'pending',
            _fingerprint:  generateFingerprint(user.id, txnDate, description, debit, credit),
          };
        }
        // CSV rows: map through colMap
        const debit  = parseAmount(r[colMap.debit]  || (colMap.amount && parseAmount(r[colMap.amount]) < 0 ? r[colMap.amount] : ''));
        const credit = parseAmount(r[colMap.credit] || (colMap.amount && parseAmount(r[colMap.amount]) > 0 ? r[colMap.amount] : ''));
        const txnDate = parseDate(r[colMap.date]);
        const description = r[colMap.desc] || 'Unnamed';
        return {
          user_id:       user.id,
          account_id:    account.id,
          raw_date:      r[colMap.date] || '',
          txn_date:      txnDate,
          description,
          debit_amount:  debit,
          credit_amount: credit,
          balance:       parseAmount(r[colMap.balance]),
          reference_no:  r[colMap.ref] || '',
          status:        'pending',
          _fingerprint:  generateFingerprint(user.id, txnDate, description, debit, credit),
        };
      });

      // ── Two-Tier Duplicate Detection ───────────────────────────────────────
      // 
      // TIER 1 (Reference Number): If the bank provided a reference/UTR number,
      // use it as the primary key. Bank ref numbers are globally unique — two
      // transactions can never share one, even if all other fields are identical.
      //
      // TIER 2 (Fingerprint vs Confirmed only): For rows without a reference
      // number, check if the same fingerprint already exists in the *confirmed*
      // transactions table. If so, it was already reviewed and added to the
      // live ledger → definitive duplicate → skip.
      //
      // NEVER deduplicate against pending staging rows alone — that would
      // incorrectly swallow legitimate repeat transactions (e.g. Zomato twice
      // on the same day for the same amount).
      //
      const [existingRefRes, confirmedTxnRes] = await Promise.all([
        // Tier 1: Fetch all known reference numbers for this user
        supabase
          .from('statement_rows')
          .select('reference_no')
          .eq('user_id', user.id)
          .not('reference_no', 'is', null)
          .neq('reference_no', ''),

        // Tier 2: Fetch confirmed transactions (already in the live ledger)
        supabase
          .from('transactions')
          .select('txn_date, description, amount, type')
          .eq('user_id', user.id),
      ]);

      // Build Tier 1 lookup: set of existing reference numbers
      const existingRefs = new Set(
        (existingRefRes.data || []).map(r => r.reference_no)
      );

      // Build Tier 2 lookup: fingerprints of confirmed ledger rows only
      const confirmedFingerprints = new Set(
        (confirmedTxnRes.data || []).map(t =>
          generateFingerprint(user.id, t.txn_date, t.description, t.amount, t.type)
        )
      );

      let skippedCount = 0;
      const genuinelyNewRows = candidateRows.filter(r => {
        // Tier 1: definitive dedup by reference number
        if (r.reference_no && existingRefs.has(r.reference_no)) {
          skippedCount++;
          return false;
        }
        // Tier 2: definitive dedup only against confirmed ledger entries
        // (NOT against pending staging rows — repeat transactions must survive)
        if (!r.reference_no && confirmedFingerprints.has(r._fingerprint)) {
          skippedCount++;
          return false;
        }
        return true;
      });

      // Strip internal _fingerprint field before inserting
      const rows = genuinelyNewRows.map(({ _fingerprint, ...rest }) => rest);
      // ──────────────────────────────────────────────────────────────────────

      // 1. Create a bank_statement record
      const dates = rows.map(r => r.txn_date).filter(Boolean).sort();

      const { data: stmtData, error: stmtErr } = await supabase
        .from('bank_statements')
        .insert({
          user_id: user.id,
          account_id: account.id,
          filename: fileName,
          row_count: rows.length,
          status: 'processing',
          date_from: dates[0] || null,
          date_to: dates[dates.length - 1] || null,
        })
        .select().single();

      if (stmtErr) throw new Error(`Statement record failed: ${stmtErr.message}`);

      // 2. Bulk insert only genuinely new rows (or skip if all are duplicates)
      if (rows.length > 0) {
        const rowsWithStmt = rows.map(r => ({ ...r, statement_id: stmtData.id }));
        const { error: rowsErr } = await supabase.from('statement_rows').insert(rowsWithStmt);
        if (rowsErr) throw new Error(`Row insert failed: ${rowsErr.message}`);
      }

      // 3. Mark statement complete
      await supabase.from('bank_statements')
        .update({ status: 'complete' })
        .eq('id', stmtData.id);

      setImportResult({ total: rows.length, skipped: skippedCount, statementId: stmtData.id });
      setStep('done');
    } catch (err) {
      setError(err.message);
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content upload-modal animate-fade-in">
        <div className="modal-header">
          <h3>Upload Bank Statement</h3>
          <p className="modal-subhead">Account: <strong>{account.name}</strong> ({account.bank_name})</p>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="upload-step">
            {/* Gemini analyzing overlay */}
            {geminiStep !== 'idle' ? (
              <div className="upload-dropzone gemini-analyzing">
                <Loader size={40} className="spin" style={{ color: '#a855f7' }} />
                <p className="drop-title" style={{ color: '#a855f7' }}>{geminiProgress}</p>
                <p className="drop-hint">Gemini AI is reading your bank statement...</p>
              </div>
            ) : (
              <div className="upload-dropzone" onClick={() => fileRef.current.click()}>
                <Upload size={40} style={{ opacity: 0.5 }} />
                <p className="drop-title">Click to select a CSV, TXT, or PDF file</p>
                <p className="drop-hint">
                  CSV/TXT: auto-detects columns · <span style={{ color: '#a855f7', fontWeight: 600 }}>✨ PDF: Gemini AI reads it automatically</span>
                </p>
                <input ref={fileRef} type="file" accept=".csv,.txt,.pdf" style={{ display: 'none' }} onChange={handleFile} />
              </div>
            )}
            {error && <p className="upload-error"><XCircle size={14} /> {error}</p>}

            {/* Bank compatibility table */}
            {geminiStep === 'idle' && (
              <div className="format-guide">
                <p className="format-guide-title">Supported formats:</p>
                <div className="bank-compat-table">
                  {[
                    { bank: 'HDFC',  date: 'Date',             desc: 'Narration',            debit: 'Debit Amount',           credit: 'Credit Amount' },
                    { bank: 'ICICI', date: 'Transaction Date', desc: 'Transaction Remarks',  debit: 'Withdrawal Amount (INR)', credit: 'Deposit Amount (INR)' },
                    { bank: 'SBI',   date: 'Txn Date',         desc: 'Description',          debit: 'Debit',                  credit: 'Credit' },
                    { bank: 'Axis',  date: 'Tran Date',        desc: 'PARTICULARS',          debit: 'DR',                     credit: 'CR' },
                    { bank: 'Kotak', date: 'Dt',               desc: 'Txn Description',      debit: 'Withdrawal Dr',          credit: 'Deposit Cr' },
                    { bank: 'PNB',   date: 'Date',             desc: 'Particular',           debit: 'Debit',                  credit: 'Credit' },
                  ].map(r => (
                    <div key={r.bank} className="bank-compat-row">
                      <span className="bank-compat-name">{r.bank}</span>
                      <span className="bank-compat-col">{r.date}</span>
                      <span className="bank-compat-col">{r.desc}</span>
                      <span className="bank-compat-col red">{r.debit}</span>
                      <span className="bank-compat-col green">{r.credit}</span>
                    </div>
                  ))}
                </div>
                <p className="format-guide-note">
                  💡 PDF bank statements are parsed automatically by Gemini AI — no template needed.
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Preview */}
        {step === 'preview' && (
          <div className="preview-step">
            <div className="import-summary">
              {isPdfMode
                ? <><Sparkles size={16} style={{ color: '#a855f7' }} /><span><strong>{fileName}</strong> — <span style={{ color: '#a855f7', fontWeight: 600 }}>✨ {parsedRows.length} transactions extracted by Gemini AI</span></span></>
                : <><FileText size={16} /><span><strong>{fileName}</strong> — {parsedRows.length} rows detected</span></>
              }
            </div>

            {/* ── Validation Panel ── */}
            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
              <div className="validation-panel">
                {validation.errors.map((msg, i) => (
                  <div key={i} className="validation-item error">
                    <XCircle size={14} />
                    <span><strong>Error:</strong> {msg}</span>
                  </div>
                ))}
                {validation.warnings.map((msg, i) => (
                  <div key={i} className="validation-item warning">
                    <AlertCircle size={14} />
                    <span><strong>Warning:</strong> {msg}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Column detection summary ── */}
            <div className="detection-summary">
              {[
                { key: 'date',   label: 'Date',        required: true },
                { key: 'desc',   label: 'Description', required: false },
                { key: 'debit',  label: 'Debit',       required: false },
                { key: 'credit', label: 'Credit',      required: false },
                { key: 'amount', label: 'Amount',      required: false },
                { key: 'balance',label: 'Balance',     required: false },
                { key: 'ref',    label: 'Reference',   required: false },
              ].map(({ key, label, required }) => (
                <div key={key} className={`detection-badge ${colMap[key] ? 'detected' : required ? 'missing-required' : 'missing'}`}>
                  {colMap[key] ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  <span>{label}</span>
                  {colMap[key] && <span className="detected-col-name">{colMap[key]}</span>}
                </div>
              ))}
            </div>

            <div className="column-map">
              <p className="col-map-title">Column mapping — adjust if anything was misdetected:</p>
              <div className="col-map-grid">
                {Object.entries(colMap).map(([field, col]) => (
                  <div key={field} className="col-map-row">
                    <span className="col-map-field">{field}</span>
                    <span className="col-map-arrow">→</span>
                    <select
                      value={col || ''}
                      onChange={e => {
                        const newMap = { ...colMap, [field]: e.target.value || null };
                        setColMap(newMap);
                        setValidation(validateColumnMap(newMap, parsedRows));
                      }}
                      className="col-map-select"
                    >
                      <option value="">— skip —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
                {/* Let user add unmapped fields */}
                {headers.filter(h => !Object.values(colMap).includes(h)).length > 0 && (
                  <div className="col-map-row">
                    <span className="col-map-field" style={{ opacity: 0.5 }}>undetected columns</span>
                    <span className="col-map-arrow">→</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {headers.filter(h => !Object.values(colMap).includes(h)).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      <td>{r[colMap.date] || '—'}</td>
                      <td>{r[colMap.desc] || '—'}</td>
                      <td style={{ color: '#FF6B6B' }}>{r[colMap.debit] || (colMap.amount && parseAmount(r[colMap.amount]) < 0 ? r[colMap.amount] : '—')}</td>
                      <td style={{ color: '#00C853' }}>{r[colMap.credit] || (colMap.amount && parseAmount(r[colMap.amount]) > 0 ? r[colMap.amount] : '—')}</td>
                      <td>{r[colMap.balance] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 5 && (
                <p className="preview-more">+ {parsedRows.length - 5} more rows</p>
              )}
            </div>

            {error && <p className="upload-error"><XCircle size={14} /> {error}</p>}
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setStep('upload')}>← Back</Button>
              <Button
                onClick={handleImport}
                disabled={importing || !validation.isValid}
                title={!validation.isValid ? 'Fix the errors above before importing' : ''}
              >
                {importing ? 'Importing...' : `Import ${parsedRows.length} Rows`}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Done */}
        {step === 'done' && importResult && (
          <div className="done-step">
            <CheckCircle size={48} color="#00C853" />
            <h4>{importResult.total} rows imported successfully</h4>
            {importResult.skipped > 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '8px 0 0' }}>
                ⚡ {importResult.skipped} duplicate row{importResult.skipped !== 1 ? 's' : ''} silently skipped (already in your ledger).
              </p>
            )}
            <p style={{marginBottom: '20px', marginTop: '12px'}}>These transactions are now in your <strong>Review Staging Area</strong>. Verified rows will appear in your live ledger.</p>
            <div style={{display: 'flex', gap: '12px', width: '100%'}}>
              <Button variant="secondary" fullWidth onClick={() => { onImported?.(); onClose(); }}>Close</Button>
              <Button fullWidth onClick={() => { onImported?.(); onClose(); onNavigate('review'); }}>Review Now</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────
const AccountsSection = ({ accounts, setAccounts, transactions, setTransactions, onManageMerchants, onNavigate }) => {
  const { user } = useAuth();
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadAccount, setUploadAccount] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyRefreshId, setHistoryRefreshId] = useState(0);

  const [newAcc, setNewAcc] = useState({
    name: '', bank_name: POPULAR_BANKS[0], type: 'Savings', masked_info: ''
  });

  const filteredAccounts = accounts.filter(a =>
    a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.bank_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    const av = a[sortConfig.key] || '', bv = b[sortConfig.key] || '';
    if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
    if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleStatus = async (id, currentStatus) => {
    const next = currentStatus === 'active' ? 'paused' : 'active';
    const { error } = await supabase.from('accounts').update({ status: next }).eq('id', id);
    if (!error) setAccounts(accounts.map(a => a.id === id ? { ...a, status: next } : a));
    else console.error('Toggle error:', error);
  };

  const deleteAccount = async (id, name) => {
    if (prompt(`Type "${name}" to confirm deletion.`) !== name) return;
    await supabase.from('transactions').delete().eq('account_id', id);
    await supabase.from('statement_rows').delete().eq('account_id', id);
    await supabase.from('bank_statements').delete().eq('account_id', id);
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (!error) {
      setAccounts(p => p.filter(a => a.id !== id));
      setTransactions(p => p.filter(t => t.account_id !== id));
    } else {
      alert('Delete failed: ' + error.message);
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!user?.id) { setAddError('Not logged in.'); return; }
    setAddError(''); setIsSubmitting(true);

    const { data, error } = await supabase.from('accounts')
      .insert({ user_id: user.id, name: newAcc.name, bank_name: newAcc.bank_name, type: newAcc.type, masked_info: newAcc.masked_info, status: 'active' })
      .select().single();

    setIsSubmitting(false);
    if (error) {
      console.error('Insert error:', error);
      setAddError(`Failed: ${error.message}`);
    } else {
      setAccounts(p => [...p, data]);
      setShowAddModal(false);
      setNewAcc({ name: '', bank_name: POPULAR_BANKS[0], type: 'Savings', masked_info: '' });
    }
  };
  if (selectedAccount) {
    return (
      <div className="accounts-section">
        {uploadAccount && (
          <UploadStatementModal
            account={uploadAccount}
            user={user}
            onClose={() => setUploadAccount(null)}
            onImported={() => {
              setUploadAccount(null);
              setHistoryRefreshId(p => p + 1);
            }}
            onNavigate={onNavigate}
          />
        )}
        <AccountDetail
          account={selectedAccount}
          onBack={() => setSelectedAccount(null)}
          setAccounts={setAccounts}
          setSelectedAccount={setSelectedAccount}
          accounts={accounts}
          transactions={transactions}
          setTransactions={setTransactions}
          onUpload={() => setUploadAccount(selectedAccount)}
          historyRefreshId={historyRefreshId}
        />
      </div>
    );
  }

  return (
    <div className="accounts-section">

      {/* Upload modal */}
      {uploadAccount && (
        <UploadStatementModal
          account={uploadAccount}
          user={user}
          onClose={() => setUploadAccount(null)}
          onImported={() => {
            setUploadAccount(null);
            setHistoryRefreshId(p => p + 1);
          }}
        />
      )}

      <div className="section-actions">
        <div className="search-box">
          <Search size={16} />
          <input type="text" placeholder="Search accounts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="action-btns">
          <Button variant="secondary" size="sm" onClick={onManageMerchants} className="merchant-btn">
            <Store size={16} /> Manage Merchants
          </Button>
          <div className="sort-menu">
            <button className="sort-btn" onClick={() => setSortConfig(p => ({ ...p, direction: p.direction === 'asc' ? 'desc' : 'asc' }))}>
              <ArrowUpDown size={16} /><span>Sort</span>
            </button>
            <select value={sortConfig.key} onChange={e => setSortConfig(p => ({ ...p, key: e.target.value }))} className="sort-select">
              <option value="created_at">Date Added</option>
              <option value="name">Account Name</option>
            </select>
          </div>
        </div>
      </div>

      <div className="accounts-grid">
        {sortedAccounts.map(account => {
          const txnCount = transactions.filter(t => t.account_id === account.id).length;
          const initial = (account.bank_name || account.name || '?').charAt(0).toUpperCase();
          return (
            <Card key={account.id} className={`account-card ${account.status}`}>
              <div className="account-card-header">
                <div className="bank-info">
                  <div className="bank-logo-placeholder">{initial}</div>
                  <div className="account-names">
                    <span className="acc-name">{account.name}</span>
                    <span className="bank-name">{account.bank_name || 'Bank'} • {account.type}</span>
                  </div>
                </div>
                <div className="acc-status-badge">{account.status === 'active' ? 'Active' : 'Paused'}</div>
              </div>

              <div className="account-card-body">
                <div className="acc-meta-row">
                  <span className="meta-label">Identifier</span>
                  <span className="meta-val">{account.masked_info || '—'}</span>
                </div>
                <div className="acc-stats-row">
                  <div className="acc-stat"><span className="stat-num">{txnCount}</span><span className="stat-label">Transactions</span></div>
                  <div className="acc-stat"><span className="stat-num">{account.type}</span><span className="stat-label">Type</span></div>
                </div>
              </div>

              <div className="account-card-footer">
                <Button variant="secondary" size="sm" onClick={() => setSelectedAccount(account)}>Manage</Button>
                <div className="quick-actions">
                  <button onClick={() => setUploadAccount(account)} title="Upload Statement" className="upload-btn-icon">
                    <Upload size={16} />
                  </button>
                  <button onClick={() => toggleStatus(account.id, account.status)} title={account.status === 'active' ? 'Pause' : 'Resume'}>
                    {account.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button onClick={() => deleteAccount(account.id, account.name)} className="delete-icon" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}

        <button className="add-account-card" onClick={() => setShowAddModal(true)}>
          <div className="add-icon-circle"><Plus size={24} /></div>
          <span>Link New Account</span>
        </button>
      </div>

      {/* Add account modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="modal-content animate-fade-in">
            <h3>Link New Account</h3>
            {addError && <p className="error-text">{addError}</p>}
            <form onSubmit={handleAddAccount} className="add-account-form">
              <div className="form-group">
                <label>Account Display Name *</label>
                <input type="text" placeholder="e.g. My HDFC Savings" value={newAcc.name} onChange={e => setNewAcc({ ...newAcc, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Bank Name</label>
                <select value={newAcc.bank_name} onChange={e => setNewAcc({ ...newAcc, bank_name: e.target.value })}>
                  {POPULAR_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Account Type</label>
                <select value={newAcc.type} onChange={e => setNewAcc({ ...newAcc, type: e.target.value })}>
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Loan">Loan</option>
                </select>
              </div>
              <div className="form-group">
                <label>Identifier (last 4 digits or label)</label>
                <input type="text" placeholder="e.g. ×××× 4521" value={newAcc.masked_info} onChange={e => setNewAcc({ ...newAcc, masked_info: e.target.value })} />
              </div>
              <div className="modal-actions">
                <Button variant="secondary" type="button" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Linking...' : 'Link Account'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsSection;
