// Charts drawn in the site's own palette (CSS variables), so they follow the theme.
// Every mark carries a <title> with its exact value.

const fmtUsd = (v: number) => "$" + (v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2));

export function WindowBars({ values, mark, label }: { values: number[]; mark: { index: number; text: string }; label: string }) {
  const W = 1000, H = 340, padL = 64, padR = 12, padT = 34, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(...values) || 1;
  const bw = iw / values.length;
  const y = (v: number) => padT + ih * (1 - v / max);
  const ticks = [0, max / 2, max];
  const mx = padL + bw * (mark.index + 0.5);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {ticks.map(t => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="grid" />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="tick">{fmtUsd(t)}</text>
        </g>
      ))}
      {values.map((v, i) => (
        <rect key={i} x={padL + i * bw + 0.6} y={y(v)} width={Math.max(bw - 1.2, 0.8)} height={Math.max(padT + ih - y(v), v > 0 ? 1 : 0)} className={i === mark.index ? "bar hot" : "bar"}>
          <title>{`window ${i + 1}: ${fmtUsd(v)}`}</title>
        </rect>
      ))}
      <line x1={mx} x2={mx} y1={padT - 16} y2={y(values[mark.index])} className="callout" />
      <text x={Math.min(mx, W - padR)} y={padT - 20} textAnchor={mx > W * 0.6 ? "end" : "start"} className="note">{mark.text}</text>
      <text x={padL} y={H - 8} className="tick">window 1 (2026-11-07)</text>
      <text x={W - padR} y={H - 8} textAnchor="end" className="tick">window {values.length} (2026-11-14)</text>
    </svg>
  );
}

export function StackBars({ rows }: { rows: { label: string; app: number; solver: number; protocol: number }[] }) {
  const W = 1000, rowH = 34, gap = 12, padL = 170, padR = 110, padT = 46;
  const H = padT + rows.length * (rowH + gap);
  const tot = (r: (typeof rows)[number]) => Math.max(0, r.app) + Math.max(0, r.solver) + Math.max(0, r.protocol);
  const max = Math.max(...rows.map(tot)) || 1;
  const xs = (v: number) => ((W - padL - padR) * v) / max;
  const segs: [keyof (typeof rows)[number], string, string][] = [["app", "Integrator / app fees", "s1"], ["solver", "Solver spread at mid", "s2"], ["protocol", "Protocol fee", "s3"]];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="What users pay by trade size, in basis points">
      {segs.map(([, name, cls], i) => (
        <g key={name}>
          <rect x={padL + i * 250} y={8} width={14} height={14} rx={3} className={cls} />
          <text x={padL + i * 250 + 22} y={20} className="tick">{name}</text>
        </g>
      ))}
      {rows.map((r, j) => {
        const yy = padT + j * (rowH + gap);
        let x = padL;
        return (
          <g key={r.label}>
            <text x={padL - 10} y={yy + rowH / 2 + 5} textAnchor="end" className="lab">{r.label}</text>
            {segs.map(([k, name, cls]) => {
              const v = Math.max(0, r[k] as number), w = xs(v);
              const el = w > 0 ? (
                <rect key={name} x={x} y={yy} width={Math.max(w - 2, 0.8)} height={rowH} rx={4} className={cls}>
                  <title>{`${r.label}: ${name} ${(r[k] as number).toFixed(2)} bps`}</title>
                </rect>
              ) : null;
              x += w;
              return el;
            })}
            <text x={x + 8} y={yy + rowH / 2 + 5} className="lab">{tot(r).toFixed(1)} bps</text>
          </g>
        );
      })}
    </svg>
  );
}

export function SliceBars({ rows }: { rows: { label: string; bps: number; ci: number[]; quotes: number }[] }) {
  const W = 1000, rowH = 26, gap = 14, padL = 210, padR = 130, padT = 16;
  const H = padT + rows.length * (rowH + gap) + 20;
  const lo = Math.min(0, ...rows.map(r => r.ci?.[0] ?? r.bps)), hi = Math.max(...rows.map(r => r.ci?.[1] ?? r.bps));
  const xs = (v: number) => padL + ((W - padL - padR) * (v - lo)) / (hi - lo || 1);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="All-in user cost of confidential quotes by slice, basis points with 95% intervals">
      <line x1={xs(0)} x2={xs(0)} y1={padT - 6} y2={H - 20} className="grid" />
      {rows.map((r, j) => {
        const yy = padT + j * (rowH + gap);
        const x0 = xs(Math.min(0, r.bps)), x1 = xs(Math.max(0, r.bps));
        return (
          <g key={r.label}>
            <text x={padL - 10} y={yy + rowH / 2 + 5} textAnchor="end" className="lab">{r.label}</text>
            <rect x={x0} y={yy} width={Math.max(x1 - x0, 1)} height={rowH} rx={4} className="s1">
              <title>{`${r.label}: ${r.bps} bps (95% CI ${r.ci?.[0]} to ${r.ci?.[1]}), ${r.quotes} quotes`}</title>
            </rect>
            {r.ci && <line x1={xs(r.ci[0])} x2={xs(r.ci[1])} y1={yy + rowH / 2} y2={yy + rowH / 2} className="ci" />}
            <text x={xs(r.ci?.[1] ?? r.bps) + 8} y={yy + rowH / 2 + 5} className="lab">{r.bps.toFixed(1)} bps · {r.quotes}</text>
          </g>
        );
      })}
      <text x={xs(0)} y={H - 4} textAnchor="middle" className="tick">0 bps</text>
    </svg>
  );
}
