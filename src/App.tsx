import { useState } from "react";

/** --- 型定義（日本語キー） --- */
type ServiceItem = {
  ["サービス名"]?: string;
  ["サービスのコスト"]?: { ["毎月"]?: string };
};
type CalcJSON = {
  ["名前"]?: string;
  ["合計コスト"]?: { ["毎月"]?: string };
  ["メタデータ"]?: { ["通貨"]?: string };
  ["グループ"]?: { ["サービス"]?: ServiceItem[] };
};

type Row = { name: string; usd: number; jpy: number };

const toNumber = (v: unknown) =>
  Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0;

/** 為替取得（USD→JPY）。CORS等で失敗時はフォールバック */
async function getUsdJpyRate(): Promise<number> {
  try {
    const r1 = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=JPY"
    );
    if (r1.ok) {
      const d = await r1.json();
      const fx = Number(d?.rates?.JPY);
      if (fx) return fx;
    }
  } catch {}
  try {
    const r2 = await fetch("https://open.er-api.com/v6/latest/USD");
    if (r2.ok) {
      const d = await r2.json();
      const fx = Number(d?.rates?.JPY);
      if (fx) return fx;
    }
  } catch {}
  // 最後の手段：固定レート（通知用にconsoleにも出す）
  console.warn("FX API fallback: using default 150");
  return 150;
}

export default function App() {
  const [name, setName] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [totalUsd, setTotalUsd] = useState<number | null>(null);
  const [totalJpy, setTotalJpy] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [raw, setRaw] = useState<CalcJSON | null>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const json = JSON.parse(text) as CalcJSON;
    setRaw(json);
    setName(json["名前"] ?? "（名称未設定）");

    // 1) サービス行を抽出
    const services = json["グループ"]?.["サービス"] ?? [];
    const serviceUsdRows: Row[] = services.map((s) => {
      const name = (s["サービス名"] ?? "（不明）").trim();
      const usd = toNumber(s["サービスのコスト"]?.["毎月"]);
      return { name, usd, jpy: 0 };
    });

    // 2) 合計の月額USD（合計が無ければサービス合算）
    let monthlyUsd = toNumber(json["合計コスト"]?.["毎月"]);
    if (!monthlyUsd) {
      monthlyUsd = serviceUsdRows.reduce((sum, r) => sum + r.usd, 0);
    }

    // 3) 為替レート取得＆換算
    const fx = await getUsdJpyRate();
    const withJpy = serviceUsdRows.map((r) => ({ ...r, jpy: r.usd * fx }));

    setRate(fx);
    setRows(withJpy);
    setTotalUsd(monthlyUsd);
    setTotalJpy(monthlyUsd * fx);
  };

  const fmtUsd = (n?: number | null) =>
    n == null ? "-" : `${n.toFixed(2)} USD`;
  const fmtJpy = (n?: number | null) =>
    n == null ? "-" : `${Math.round(n).toLocaleString("ja-JP")} 円`;

  return (
    <div style={{ maxWidth: 920, margin: "40px auto", padding: 16 }}>
      <h1>Pricing Calculator JSON 換算ビューア</h1>

      <input
        type="file"
        accept="application/json"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <p style={{ fontSize: 12, color: "#666" }}>
        Pricing Calculator からエクスポートした JSON を選択してください。
      </p>

      {totalUsd !== null && (
        <>
          <h3>見積名：{name}</h3>

          {/* 合計カード */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
              <div>月額（USD）</div>
              <div style={{ fontSize: 28 }}>{fmtUsd(totalUsd)}</div>
            </div>
            <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
              <div>月額（JPY）</div>
              <div style={{ fontSize: 28 }}>{fmtJpy(totalJpy)}</div>
              <div style={{ fontSize: 12, color: "#666" }}>
                レート：1 USD = {rate?.toFixed(4)} JPY
              </div>
            </div>
          </div>

          {/* サービス別明細テーブル */}
          <h3 style={{ marginTop: 24 }}>サービス別 明細</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                    サービス名
                  </th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                    月額（USD）
                  </th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                    月額（JPY）
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>{r.name}</td>
                    <td style={{ padding: 8, textAlign: "right", borderBottom: "1px solid #f0f0f0" }}>
                      {fmtUsd(r.usd)}
                    </td>
                    <td style={{ padding: 8, textAlign: "right", borderBottom: "1px solid #f0f0f0" }}>
                      {fmtJpy(r.jpy)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th style={{ padding: 8, textAlign: "right" }}>合計</th>
                  <th style={{ padding: 8, textAlign: "right" }}>{fmtUsd(totalUsd)}</th>
                  <th style={{ padding: 8, textAlign: "right" }}>{fmtJpy(totalJpy)}</th>
                </tr>
              </tfoot>
            </table>
          </div>

          <details style={{ marginTop: 16 }}>
            <summary>原本JSONを見る</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(raw, null, 2)}</pre>
          </details>
        </>
      )}
    </div>
  );
}
