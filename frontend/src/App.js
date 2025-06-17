// frontend/src/App.js
import React, { useState, useEffect, useRef } from "react";
import { Amplify, Auth } from "aws-amplify";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import axios from "axios";
import "./App.css";

// 設定を読み込む関数
const loadConfig = () => {
  // ウィンドウオブジェクトから設定を取得
  if (window.REACT_APP_CONFIG) {
    return {
      apiEndpoint: window.REACT_APP_CONFIG.apiEndpoint,
      userPoolId: window.REACT_APP_CONFIG.userPoolId,
      userPoolClientId: window.REACT_APP_CONFIG.userPoolClientId,
      region: window.REACT_APP_CONFIG.region,
    };
  }

  // 環境変数から設定を取得（ローカル開発用）
  return {
    apiEndpoint: process.env.REACT_APP_API_ENDPOINT || "YOUR_API_ENDPOINT",
    userPoolId: process.env.REACT_APP_USER_POOL_ID || "YOUR_USER_POOL_ID",
    userPoolClientId:
      process.env.REACT_APP_USER_POOL_CLIENT_ID || "YOUR_USER_POOL_CLIENT_ID",
    region: process.env.REACT_APP_REGION || "us-east-1",
  };
};

// 設定を取得
const config = loadConfig();

// Amplify設定
Amplify.configure({
  Auth: {
    region: config.region,
    userPoolId: config.userPoolId,
    userPoolWebClientId: config.userPoolClientId,
  },
});

// ChatInterfaceコンポーネントの定義
function ChatInterface({ signOut, user }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pptxFile, setPptxFile] = useState(null);
  const [txtFile, setTxtFile] = useState(null);
  const messagesEndRef = useRef(null);

  // メッセージが追加されたら自動スクロール
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileSubmit = async (e) => {
    e.preventDefault();
    if (!pptxFile || !txtFile) {
      setError("両方のファイルを選択してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const session = await Auth.currentSession();
      const idToken = session.getIdToken().getJwtToken();

      const pptxBase64 = await toBase64(pptxFile);
      const txtBase64 = await toBase64(txtFile);

      const response = await axios.post(
        config.apiEndpoint,
        {
          pptxFile: pptxBase64,
          txtFile: txtBase64,
        },
        {
          headers: {
            Authorization: idToken,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: response.data.response,
          },
        ]);
      } else {
        setError("応答の取得に失敗しました");
      }
    } catch (err) {
      console.error("ファイル送信エラー:", err);
      setError(`エラーが発生しました: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Bedrock LLM チャットボット</h1>
        <div className="header-buttons">
          <button className="clear-button" onClick={() => setMessages([])}>
            会話をクリア
          </button>
          <button className="logout-button" onClick={signOut}>
            ログアウト ({user.username})
          </button>
        </div>
      </header>

      <main className="chat-container">
        <form onSubmit={handleFileSubmit} className="file-upload-form">
          <label>
            PPTXファイル:
            <input
              type="file"
              accept=".pptx"
              onChange={(e) => setPptxFile(e.target.files[0])}
            />
          </label>
          <label>
            誤字入りテキストファイル (.txt):
            <input
              type="file"
              accept=".txt"
              onChange={(e) => setTxtFile(e.target.files[0])}
            />
          </label>
          <button type="submit" disabled={loading}>
            送信
          </button>
        </form>

        <div className="messages-container">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-content">
                {msg.content.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div className="message assistant loading">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          {error && <div className="error-message">{error}</div>}
          <div ref={messagesEndRef} />
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => <ChatInterface signOut={signOut} user={user} />}
    </Authenticator>
  );
}

export default App;
