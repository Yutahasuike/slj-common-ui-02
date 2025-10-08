// Single-file React (TSX) – EC2インスタンス払い出し（一般ユーザー向け・Lambda URL入力なし・自己テストなし）
// - Amplify でそのままホスティング可能な単一ファイル構成
// - Lambda Function URL は Amplify の Frontend 環境変数 VITE_LAMBDA_URL から取得
// - 入力は「インスタンス名」「申請者メールアドレス」のみ（AWS未経験者向けに文言を平易化）

import React, { useMemo, useState } from 'react'

// =============================
// 小さめのUIコンポーネント
// =============================
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`rounded-2xl border border-gray-200 shadow-md p-6 bg-white ${className ?? ''}`}>{children}</div>
)

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }>
  = ({ label, hint, children }) => (
  <div className="mb-5">
    <label className="block text-sm font-semibold text-gray-800 mb-1">{label}</label>
    {children}
    {hint ? <p className="text-xs text-gray-500 mt-1">{hint}</p> : null}
  </div>
)

const Button: React.FC<{
  type?: 'button' | 'submit';
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ type = 'button', disabled, children, onClick }) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    className={`w-full py-3 px-4 rounded-xl text-white font-bold transition duration-150 shadow ${
      disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
    }`}
  >
    {children}
  </button>
)

// =============================
// バリデーション（Lambdaと一致）
// =============================
const NAME_REGEX = /^[A-Za-z0-9-]{3,32}$/
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// =============================
// Lambda URL（Amplify環境変数から）
// =============================
const LAMBDA_URL: string | undefined = (import.meta as any)?.env?.VITE_LAMBDA_URL as string | undefined

// =============================
// メインコンポーネント
// =============================
const App: React.FC = () => {
  // 入力
  const [instanceName, setInstanceName] = useState('')
  const [email, setEmail] = useState('')

  // UI状態
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  // バリデーション
  const isValidName = useMemo(() => NAME_REGEX.test(instanceName), [instanceName])
  const isValidEmail = useMemo(() => EMAIL_REGEX.test(email), [email])
  const isFormValid = isValidName && isValidEmail

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isFormValid || isSubmitting) return

    if (!LAMBDA_URL) {
      setNotice({ type: 'error', text: '設定エラー：システム設定が未完了のため申請を送信できません。担当者にご連絡ください。（VITE_LAMBDA_URL 未設定）' })
      return
    }

    setIsSubmitting(true)
    setNotice({ type: 'info', text: '送信中です。画面を閉じずにお待ちください…' })

    try {
      const resp = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: instanceName.trim(),
          requesterEmail: email.trim(),
        }),
      })

      const ct = resp.headers.get('content-type') || ''
      const isJson = ct.includes('application/json')
      const data: any = isJson ? await resp.json().catch(() => ({})) : { raw: await resp.text() }

      if (resp.ok && data?.ok) {
        setNotice({ type: 'success', text: `申請を受け付けました。受付番号：${data.executionId || 'N/A'}` })
        setInstanceName('')
        setEmail('')
      } else {
        const reason = data?.error || (typeof data?.raw === 'string' ? data.raw.slice(0, 300) : `HTTP ${resp.status}`)
        setNotice({ type: 'error', text: `申請に失敗しました。もう一度お試しください。（詳細：${reason}）` })
      }
    } catch (err: any) {
      setNotice({ type: 'error', text: `通信エラーが発生しました。お手数ですが時間をおいて再度お試しください。(${String(err?.message || err)})` })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6 flex items-center justify-center">
      <div className="w-full max-w-3xl space-y-6">
        <Card>
          <h1 className="text-2xl font-extrabold mb-1 text-gray-900">EC2インスタンス払い出し</h1>
          <p className="text-sm text-gray-600 mb-6">
            下のフォームに入力して「申請を送信」ボタンを押してください。担当者の承認後にインスタンス作成が開始されます。
          </p>

          <form onSubmit={handleSubmit} className="grid gap-5">
            <Field label="インスタンス名" hint="半角英数字とハイフンのみ・3〜32文字（例：web-dev-001）">
              <input
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                className={`w-full rounded-xl border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  isValidName || instanceName === '' ? 'border-slate-300 focus:ring-indigo-300' : 'border-red-500 focus:ring-red-300'
                }`}
                placeholder="例）web-dev-001"
                maxLength={64}
                required
              />
              {!isValidName && instanceName !== '' && (
                <p className="text-red-600 text-xs mt-1 font-medium">半角英数字とハイフン、3〜32文字で入力してください。</p>
              )}
            </Field>

            <Field label="申請者メールアドレス" hint="払い出し結果のご連絡に使用します（会社のメールを推奨）">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-xl border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  isValidEmail || email === '' ? 'border-slate-300 focus:ring-indigo-300' : 'border-red-500 focus:ring-red-300'
                }`}
                placeholder="例）user@company.co.jp"
                required
              />
              {!isValidEmail && email !== '' && (
                <p className="text-red-600 text-xs mt-1 font-medium">有効なメールアドレス形式で入力してください。</p>
              )}
            </Field>

            <Button type="submit" disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? '申請を送信中…' : '申請を送信'}
            </Button>

            {notice && (
              <div className={`mt-1 p-4 rounded-xl border ${
                notice.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' :
                notice.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
                'bg-blue-50 text-blue-800 border-blue-200'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{notice.text}</p>
              </div>
            )}
          </form>
        </Card>

        <Card className="text-xs text-gray-600">
          <h2 className="text-sm font-semibold mb-2">ご案内</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>申請後、担当者の承認を経て作成が開始されます。承認状況により時間がかかる場合があります。</li>
            <li>複数回送信してしまった場合は、担当者へご連絡ください。</li>
            <li>この画面で入力した情報は、払い出し処理にのみ利用されます。</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}

export default App
