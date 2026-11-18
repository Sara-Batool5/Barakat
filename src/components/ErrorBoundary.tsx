import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Catches a crash anywhere below it and shows a message instead of a blank white page.
 * It deliberately uses fixed English and Arabic text and no app code, so it still works if the crash is in the app itself.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("BARAKAT crashed:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f4f8f3", fontFamily: "system-ui, sans-serif", color: "#101a12" }}>
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 4px", color: "#4a5a4d", lineHeight: 1.6 }}>Please reload the page. If it keeps happening, send the line below to the developer.</p>
          <p dir="rtl" style={{ margin: "0 0 16px", color: "#4a5a4d", lineHeight: 1.8 }}>حدث خطأ ما. يرجى إعادة تحميل الصفحة، وإن تكرر ذلك أرسل السطر أدناه إلى المطوّر.</p>
          <button type="button" onClick={() => window.location.assign("/")} style={{ background: "#2d9a4e", color: "#fff", border: 0, borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}>
            Reload / إعادة التحميل
          </button>
          <pre dir="ltr" style={{ marginTop: 18, padding: 12, background: "#fff", border: "1px solid #d9e4d8", borderRadius: 8, fontSize: 11, textAlign: "left", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{String(error.message || error)}</pre>
        </div>
      </div>
    );
  }
}
