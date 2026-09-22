"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body style={{ alignItems: "center", display: "flex", fontFamily: "sans-serif", justifyContent: "center", minHeight: "100vh" }}>
        <main style={{ textAlign: "center" }}>
          <p>Đã có lỗi xảy ra. · Something went wrong.</p>
          <button type="button" onClick={reset}>Thử lại · Try again</button>
        </main>
      </body>
    </html>
  );
}
