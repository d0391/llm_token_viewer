import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Copy, Search, Sigma, XCircle } from 'lucide-react';
import { Tiktoken } from 'js-tiktoken/lite';
import cl100k_base from 'js-tiktoken/ranks/cl100k_base';
import o200k_base from 'js-tiktoken/ranks/o200k_base';

type TokenRecord = {
  id: number;
  text: string;
  bytesHex: string;
  start: number;
  end: number;
};

type EncodingName = 'cl100k_base' | 'o200k_base';

type TestResult = {
  name: string;
  passed: boolean;
  details: string;
};

const ENCODINGS: Record<EncodingName, unknown> = {
  cl100k_base,
  o200k_base,
};

function hexOfBytes(text: string): string {
  return Array.from(new TextEncoder().encode(text))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

function printable(text: string): string {
  return text.replace(/ /g, '·').replace(/\n/g, '↵\n').replace(/\t/g, '⇥');
}

function getEncoder(encodingName: EncodingName): Tiktoken {
  return new Tiktoken(ENCODINGS[encodingName] as ConstructorParameters<typeof Tiktoken>[0]);
}

function tokenizeText(input: string, encodingName: EncodingName): TokenRecord[] {
  const enc = getEncoder(encodingName);
  const ids = enc.encode(input);
  let cursor = 0;

  return ids.map((id) => {
    const piece = enc.decode([id]);
    const start = cursor;
    const end = cursor + piece.length;
    cursor = end;

    return {
      id,
      text: piece,
      bytesHex: hexOfBytes(piece),
      start,
      end,
    };
  });
}

function escapeForCopy(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r');
}

function tokenTint(index: number, total: number): string {
  const hue = Math.round((index / Math.max(total, 1)) * 360);
  return `hsl(${hue} 85% 92%)`;
}

function reconstructText(tokens: TokenRecord[]): string {
  return tokens.map((token) => token.text).join('');
}

function runSanityTests(): TestResult[] {
  const cases: Array<{ name: string; fn: () => void }> = [
    {
      name: 'Empty input returns zero tokens',
      fn: () => {
        const tokens = tokenizeText('', 'o200k_base');
        if (tokens.length !== 0) throw new Error(`expected 0, got ${tokens.length}`);
      },
    },
    {
      name: 'Reconstruction matches original ASCII text',
      fn: () => {
        const input = 'the quick brown fox';
        const tokens = tokenizeText(input, 'o200k_base');
        const rebuilt = reconstructText(tokens);
        if (rebuilt !== input) throw new Error(`rebuilt text mismatch: ${JSON.stringify(rebuilt)}`);
      },
    },
    {
      name: 'Whitespace markers remain representable',
      fn: () => {
        const input = 'a b\n\t';
        const tokens = tokenizeText(input, 'cl100k_base');
        const rendered = tokens.map((t) => printable(t.text)).join('');
        if (!rendered.includes('·') || !rendered.includes('↵\n') || !rendered.includes('⇥')) {
          throw new Error(`missing whitespace markers in ${JSON.stringify(rendered)}`);
        }
      },
    },
    {
      name: 'Character ranges are contiguous',
      fn: () => {
        const input = 'token ranges';
        const tokens = tokenizeText(input, 'cl100k_base');
        for (let i = 1; i < tokens.length; i += 1) {
          if (tokens[i - 1].end !== tokens[i].start) {
            throw new Error(`gap between token ${i - 1} and ${i}`);
          }
        }
      },
    },
  ];

  return cases.map((test) => {
    try {
      test.fn();
      return { name: test.name, passed: true, details: 'Passed' };
    } catch (error) {
      return {
        name: test.name,
        passed: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export default function App() {
  const [encoding, setEncoding] = useState<EncodingName>('o200k_base');
  const [query, setQuery] = useState('');
  const [text, setText] = useState("The tokenizer breaks text into pieces like ' the', 'ing', punctuation, and whitespace.");

  const tokens = useMemo(() => tokenizeText(text, encoding), [text, encoding]);
  const tests = useMemo(() => runSanityTests(), []);

  const filteredTokens = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tokens;

    return tokens.filter((t) => {
      const rendered = printable(t.text).toLowerCase();
      return rendered.includes(q) || String(t.id).includes(q) || t.bytesHex.toLowerCase().includes(q);
    });
  }, [tokens, query]);

  const joinedIds = useMemo(() => filteredTokens.map((t) => t.id).join(', '), [filteredTokens]);
  const passedCount = tests.filter((test) => test.passed).length;

  const copyIds = async () => {
    await navigator.clipboard.writeText(joinedIds);
  };

  const copyPieces = async () => {
    await navigator.clipboard.writeText(filteredTokens.map((t) => escapeForCopy(t.text)).join('\n'));
  };

  return (
    <div className="page-shell">
      <div className="page-grid">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel">
          <div className="panel-header">
            <h1>LLM Token Visualizer</h1>
            <p>Paste text, choose an encoding, and inspect token IDs, rendered pieces, and byte values.</p>
          </div>

          <div className="field-group">
            <label htmlFor="encoding">Encoding</label>
            <select id="encoding" value={encoding} onChange={(e) => setEncoding(e.target.value as EncodingName)}>
              <option value="o200k_base">o200k_base</option>
              <option value="cl100k_base">cl100k_base</option>
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="text">Input text</label>
            <textarea id="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text here" />
          </div>

          <div className="stats-grid">
            <StatCard label="Characters" value={text.length} />
            <StatCard label="Tokens" value={tokens.length} />
            <StatCard label="Avg chars/token" value={tokens.length ? (text.length / tokens.length).toFixed(2) : '0.00'} />
          </div>

          <div className="subpanel">
            <div className="subpanel-title">
              <Sigma size={16} />
              <span>Visual segmentation</span>
            </div>
            <div className="token-chip-wrap">
              {tokens.length === 0 ? <span className="empty-state">No tokens yet.</span> : tokens.map((token, idx) => (
                <span
                  key={`${token.id}-${idx}`}
                  className="token-chip"
                  style={{ backgroundColor: tokenTint(idx, tokens.length) }}
                >
                  {printable(token.text)}
                </span>
              ))}
            </div>
          </div>

          <div className="subpanel">
            <div className="health-row">
              <div>
                <div className="subpanel-heading">Built-in sanity checks</div>
                <div className="muted-text">{passedCount}/{tests.length} passing</div>
              </div>
              <span className="status-badge">{tests.every((test) => test.passed) ? 'Healthy' : 'Needs attention'}</span>
            </div>
            <div className="test-list">
              {tests.map((test) => (
                <div key={test.name} className="test-item">
                  {test.passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <div>
                    <div className="test-name">{test.name}</div>
                    <div className="muted-text">{test.details}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="panel">
          <div className="panel-header panel-header-row">
            <div>
              <h2>Token table</h2>
              <p>Filter by token text, ID, or byte hex.</p>
            </div>
            <div className="button-row">
              <button onClick={copyIds} disabled={!filteredTokens.length}><Copy size={16} /> Copy IDs</button>
              <button onClick={copyPieces} disabled={!filteredTokens.length}><Copy size={16} /> Copy pieces</button>
            </div>
          </div>

          <div className="search-wrap">
            <Search size={16} className="search-icon" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search token text, ID, or bytes"
            />
          </div>

          <div className="table-wrap">
            <div className="token-grid token-grid-header">
              <div>Token ID</div>
              <div>Rendered piece</div>
              <div>UTF-8 bytes</div>
              <div>Chars</div>
            </div>

            {filteredTokens.length === 0 ? (
              <div className="empty-table">No matching tokens.</div>
            ) : (
              filteredTokens.map((token, idx) => (
                <div
                  className="token-grid token-grid-row"
                  key={`${token.id}-${token.start}-${idx}`}
                  style={{ backgroundColor: tokenTint(idx, filteredTokens.length) }}
                >
                  <div className="cell mono">{token.id}</div>
                  <div className="cell mono">{printable(token.text)}</div>
                  <div className="cell mono">{token.bytesHex || '∅'}</div>
                  <div className="cell mono">{token.start}-{token.end}</div>
                </div>
              ))
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
