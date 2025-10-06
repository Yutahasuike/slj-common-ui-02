import React, { useState, useMemo } from 'react';

// --- 仮のコンポーネント定義 (実際のプロジェクトに合わせて調整) ---

// Field: ラベルとヒントを持つ入力コンテナ
const Field: React.FC<{ label: string; hint: string; children: React.ReactNode }> = ({ label, hint, children }) => (
    <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
        {children}
        <p className="text-xs text-gray-500 mt-1">{hint}</p>
    </div>
);

// Button: スタイルと状態を持つボタン
const Button: React.FC<{ type: 'submit' | 'button'; disabled: boolean; children: React.ReactNode }> = ({ type, disabled, children }) => (
    <button 
        type={type} 
        disabled={disabled} 
        className={`w-full py-3 px-4 rounded-xl text-white font-bold transition duration-150 shadow-md ${
            disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
    >
        {children}
    </button>
);

// Layout: フォーム全体のコンテナ
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="container mx-auto p-4 max-w-xl mt-10">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            {children}
        </div>
    </div>
);

// --- メインロジック ---

// 【重要】: デプロイ前に、必ずこのプレースホルダーを実際の Lambda 関数 URL に置き換えてください。
const LAMBDA_URL = "https://YOUR_ACTUAL_LAMBDA_FUNCTION_URL_HERE"; 
const PLACEHOLDER_URL_CHECK = "https://YOUR_ACTUAL_LAMBDA_FUNCTION_URL_HERE";

const ProvisionForm = () => {
    // ユーザー入力の状態
    const [instanceName, setInstanceName] = useState('');
    const [email, setEmail] = useState('');
    
    // アプリケーションの状態
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Lambda側と一致するバリデーションルール
    const NAME_REGEX = /^[A-Za-z0-9-]{3,32}$/;
    const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

    // バリデーション結果の計算
    const isValidName = useMemo(() => NAME_REGEX.test(instanceName), [instanceName]);
    const isValidEmail = useMemo(() => EMAIL_REGEX.test(email), [email]);
    const isFormValid = isValidName && isValidEmail;
    
    // フォーム送信ハンドラ
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid || isSubmitting) return;

        setIsSubmitting(true);
        setMessage(null);

        // URLがプレースホルダーのままか、空文字列でないかをチェック
        if (!LAMBDA_URL || LAMBDA_URL === PLACEHOLDER_URL_CHECK) {
             setMessage({ 
                type: 'error', 
                text: '❌ 設定エラー: Lambda 関数 URL がコードに設定されていません。ProvisionForm.tsxを確認してください。' 
            });
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await fetch(LAMBDA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    instanceName: instanceName.trim(), 
                    requesterEmail: email.trim(), 
                }),
            });

            const data = await response.json();

            if (response.ok && data.ok) {
                // 成功メッセージ (Lambdaからの実行IDを含む)
                setMessage({ 
                    type: 'success', 
                    text: `✅ リクエストが正常に開始されました。承認ID: ${data.executionId}。` 
                });
                // フォームをクリア
                setInstanceName('');
                setEmail('');
            } else {
                // Lambdaからのエラー応答 (400 Bad Requestなど)
                setMessage({ 
                    type: 'error', 
                    text: `❌ リクエスト失敗: ${data.error || '不明なサーバーエラー'}` 
                });
            }
        } catch (error) {
            console.error("API呼び出しエラー:", error);
            setMessage({ 
                type: 'error', 
                text: 'ネットワークエラーが発生しました。コンソールを確認してください。' 
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Layout>
            <h1 className="text-2xl font-extrabold mb-8 text-gray-800 text-center">EC2 自動払い出しリクエスト</h1>
            
            <form onSubmit={handleSubmit}>
                
                {/* 1. インスタンス名入力欄 */}
                <Field label="インスタンス名" hint="半角英数字とハイフン、3〜32文字">
                    <input
                        value={instanceName}
                        onChange={(e) => setInstanceName(e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3 transition duration-150 focus:outline-none focus:ring-2 ${
                            isValidName || instanceName === '' ? "border-slate-300 focus:ring-indigo-300" : "border-red-500 focus:ring-red-300"
                        }`}
                        placeholder="win-2025-dev-01"
                        maxLength={32}
                        required
                    />
                    {!isValidName && instanceName !== '' && (
                        <p className="text-red-500 text-xs mt-1">半角英数字とハイフン、3〜32文字で入力してください。</p>
                    )}
                </Field>

                {/* 2. 申請者メール入力欄 */}
                <Field label="申請者メール" hint="払い出し結果とキーペアの通知に使用されます">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3 transition duration-150 focus:outline-none focus:ring-2 ${
                            isValidEmail || email === '' ? "border-slate-300 focus:ring-indigo-300" : "border-red-500 focus:ring-red-300"
                        }`}
                        placeholder="you@example.com"
                        required
                    />
                     {!isValidEmail && email !== '' && (
                        <p className="text-red-500 text-xs mt-1">有効なメールアドレス形式で入力してください。</p>
                    )}
                </Field>

                {/* 3. 送信ボタン */}
                <div className="mt-8">
                    <Button 
                        type="submit" 
                        disabled={!isFormValid || isSubmitting}
                    >
                        {isSubmitting ? "リクエストを送信中..." : "EC2払い出しをリクエスト"}
                    </Button>
                </div>

                {/* 4. メッセージ表示エリア */}
                {message && (
                    <div className={`mt-6 p-4 rounded-xl shadow-inner ${
                        message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'
                    }`}>
                        <p className="font-medium">{message.text}</p>
                    </div>
                )}
            </form>
        </Layout>
    );
};

export default ProvisionForm;
```eof

---

## 🚀 次のステップ

このコードを `src/components/ProvisionForm.tsx` に適用後、以下の手順を実行してください。

1.  **Lambda URLの置き換え**: `LAMBDA_URL` の値を、あなたの実際の Lambda 関数 URL に置き換えます。
2.  **`App.tsx` の修正**: `src/App.tsx` ファイルでこの `ProvisionForm` コンポーネントをインポートし、表示します。
3.  **GitHubにプッシュ**: 修正をGitHubにコミット＆プッシュし、Amplify Hostingの自動デプロイをトリガーします。
