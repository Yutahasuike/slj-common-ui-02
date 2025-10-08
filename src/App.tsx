import React, { useState, useMemo } from 'react';
// Firebaseは未使用のためインポートは削除

// Tailwind CSSを使用するための全体的なスタイル設定
// スタイリングはLayoutコンポーネント内で処理されています。

// --- ヘルパーコンポーネント定義 ---

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
        className={`w-full py-3 px-4 rounded-xl text-white font-bold transition duration-150 shadow-lg ${
            disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 transform hover:scale-[1.005]'
        }`}
    >
        {children}
    </button>
);

// Layout: フォーム全体のコンテナ
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    // Tailwind CSSの設定をここで追加し、モバイルフレンドリーな中央揃えにする
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-100">
            {children}
        </div>
    </div>
);

// --- メインロジック (Appコンポーネントにリネーム) ---

// 【重要】: デプロイ前に、必ずこのプレースホルダーを実際の Lambda 関数 URL に置き換えてください。
const LAMBDA_URL = "https://2wfkhg5j2uztf2xrkglfr6vyne0rukze.lambda-url.ap-northeast-1.on.aws/"; 
const PLACEHOLDER_URL_CHECK = "https://YOUR_ACTUAL_LAMBDA_FUNCTION_URL_HERE";

// メインコンポーネントの名前を App に変更
const App = () => {
    // ユーザー入力の状態
    const [instanceName, setInstanceName] = useState('');
    const [email, setEmail] = useState('');
    
    // アプリケーションの状態
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Lambda側と一致するバリデーションルール
    const NAME_REGEX = /^[A-Za-z0-9-]{3,32}$/;
    const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

    // バリデーション結果の計算 (useMemoはパフォーマンス最適化のためそのまま残します)
    const isValidName = useMemo(() => NAME_REGEX.test(instanceName), [instanceName]);
    const isValidEmail = useMemo(() => EMAIL_REGEX.test(email), [email]);
    const isFormValid = isValidName && isValidEmail;
    
    // フォーム送信ハンドラ
    // ネットワークエラー時にリトライ処理などを追加する場合はこの部分を拡張します
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid || isSubmitting) return;

        setIsSubmitting(true);
        setMessage(null);

        // URLがプレースホルダーのままか、空文字列でないかをチェック
        if (!LAMBDA_URL || LAMBDA_URL === PLACEHOLDER_URL_CHECK) {
            setMessage({ 
                type: 'error', 
                text: '❌ 設定エラー: Lambda 関数 URL がコードに設定されていません。コード内の LAMBDA_URL 定数を確認してください。' 
            });
            setIsSubmitting(false);
            return;
        }

        try {
            // 指示に従い、指数バックオフを実装せずに単純な fetch を使用
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
                    text: `✅ リクエストが正常に開始されました。承認ID: ${data.executionId || 'N/A'}。` 
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
            <h1 className="text-3xl font-extrabold mb-2 text-gray-800 text-center">クラウド環境払い出し</h1>
            <p className="text-center text-gray-500 mb-8">EC2インスタンス作成リクエストフォーム</p>
            
            <form onSubmit={handleSubmit}>
                
                {/* 1. インスタンス名入力欄 */}
                <Field label="インスタンス名" hint="半角英数字とハイフンのみ、3〜32文字 (例: web-dev-001)">
                    <input
                        value={instanceName}
                        onChange={(e) => setInstanceName(e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3 transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                            isValidName || instanceName === '' ? "border-slate-300 focus:ring-indigo-300" : "border-red-500 focus:ring-red-300"
                        }`}
                        placeholder="instance-name-dev-01"
                        maxLength={32}
                        required
                    />
                    {!isValidName && instanceName !== '' && (
                        <p className="text-red-500 text-xs mt-1 font-medium">半角英数字とハイフン、3〜32文字で入力してください。</p>
                    )}
                </Field>

                {/* 2. 申請者メール入力欄 */}
                <Field label="申請者メールアドレス" hint="払い出し結果とキーペア情報の通知に使用されます">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3 transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                            isValidEmail || email === '' ? "border-slate-300 focus:ring-indigo-300" : "border-red-500 focus:ring-red-300"
                        }`}
                        placeholder="user@corporate.com"
                        required
                    />
                    {!isValidEmail && email !== '' && (
                        <p className="text-red-500 text-xs mt-1 font-medium">有効なメールアドレス形式で入力してください。</p>
                    )}
                </Field>

                {/* 3. 送信ボタン */}
                <div className="mt-8">
                    <Button 
                        type="submit" 
                        disabled={!isFormValid || isSubmitting}
                    >
                        {isSubmitting ? (
                            <div className="flex items-center justify-center">
                                <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                リクエストを送信中...
                            </div>
                        ) : "EC2払い出しをリクエスト"}
                    </Button>
                </div>

                {/* 4. メッセージ表示エリア */}
                {message && (
                    <div className={`mt-6 p-4 rounded-xl shadow-md ${
                        message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'
                    }`}>
                        <p className="font-medium text-sm whitespace-pre-wrap">{message.text}</p>
                    </div>
                )}
            </form>
        </Layout>
    );
};

export default App;
