import React, { useMemo, useState } from "react";

// Lambda Function URL（Amplify の Frontend 環境変数）
const LAMBDA_URL = (import.meta as any)?.env?.VITE_LAMBDA_URL as
  | string
  | undefined;

// バリデーション（Lambda と同じルール）
const NAME_REGEX = /^[A-Za-z0-9-]{3,32}$/;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const App: React.FC = () => {
  // 入力値
  const [instanceName, setInstanceName] = useState("");
  const [email, setEmail] = useState("");

  // UI 状態
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<
    { type: "success" | "error" | "info"; text: string } | null
  >(null);

  // 入力チェック
  const isValidName = useMemo(() => NAME_REGEX.test(instanceName), [instanceName]);
  const isValidEmail = useMemo(() => EMAIL_REGEX.test(email), [email]);
  const isFormValid = isValidName && isValidEmail;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    if (!LAMBDA_URL) {
      setNotice({
        type: "error",
        text:
          "システム設定が未完了のため申請を送信できません（VITE_LAMBDA_URL が未設定）。担当者へご連絡ください。",
      });
      return;
    }

    setIsSubmitting(true);
    setNotice({ type: "info", text: "申請を送信しています。しばらくお待ちください…" });

    try {
      const resp = await fetch(LAMBDA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: instanceName.trim(),
          requesterEmail: email.trim(),
        }),
      });

      const ct = resp.headers.get("content-type") || "";
      const isJson = ct.includes("application/json");
      const data: any = isJson ? await resp.json().catch(() => ({})) : { raw: await resp.text() };

      if (resp.ok && data?.ok) {
        setNotice({
          type: "success",
          text: `申請を受け付けました。受付番号：${data.executionId || "N/A"}`,
        });
        setInstanceName("");
        setEmail("");
      } else {
        const reason =
          data?.error || (typeof data?.raw === "string" ? data.raw.slice(0, 300) : `HTTP ${resp.status}`);
        setNotice({
          type: "error",
          text: `申請に失敗しました。お手数ですが時間をおいて再度お試しください（詳細：${reason}）`,
        });
      }
    } catch (err: any) {
      setNotice({
        type: "error",
        text: `通信エラーが発生しました。時間をおいて再度お試しください（${String(
          err?.message || err
        )}）`,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="container">
        <header className="header">
          <h1>EC2インスタンス払い出し</h1>
          <p className="sub">
            下のフォームに入力して<strong>「申請を送信」</strong>を押してください。担当者の承認後にインスタンス作成が開始されます。
          </p>
        </header>

        <main className="grid">
          <section aria-label="申請フォーム">
            <form onSubmit={handleSubmit} className="card">
              <div className="form-group">
                <label htmlFor="instanceName">インスタンス名</label>
                <input
                  id="instanceName"
                  placeholder="例）web-dev-001"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  maxLength={64}
                  aria-invalid={instanceName !== "" && !isValidName}
                  aria-describedby="name-hint name-err"
                />
                <div id="name-hint" className="hint">
                  半角英数字とハイフンのみ・3〜32文字
                </div>
                {!isValidName && instanceName !== "" && (
                  <div id="name-err" className="error">
                    形式が正しくありません（半角英数字とハイフン、3〜32文字）。
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="email">申請者メールアドレス</label>
                <input
                  id="email"
                  type="email"
                  placeholder="例）user@company.co.jp"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={email !== "" && !isValidEmail}
                  aria-describedby="email-hint email-err"
                />
                <div id="email-hint" className="hint">
                  払い出し結果のご連絡に使用します（会社メール推奨）
                </div>
                {!isValidEmail && email !== "" && (
                  <div id="email-err" className="error">
                    メールアドレスの形式が正しくありません。
                  </div>
                )}
              </div>

              <button className="button primary" disabled={!isFormValid || isSubmitting} type="submit">
                {isSubmitting ? "申請を送信中…" : "申請を送信"}
              </button>

              {notice && (
                <div
                  role="status"
                  className={`notice ${notice.type === "success" ? "success" : notice.type === "error" ? "error" : "info"}`}
                >
                  {notice.text}
                </div>
              )}
            </form>
          </section>

          <aside className="card info">
            <h2>ご案内</h2>
            <ul className="bullets">
              <li>申請後、担当者の承認を経て作成が開始されます。承認状況により時間がかかる場合があります。</li>
              <li>誤って複数回送信した場合は、担当者へご連絡ください。</li>
              <li>この画面で入力した情報は、払い出し処理にのみ利用します。</li>
            </ul>
          </aside>
        </main>
      </div>
    </div>
  );
};

export default App;
