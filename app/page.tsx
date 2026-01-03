export default function Home() {
  return (
    <div>
      <h1>Clipboard PIN Relay</h1>
      <p className="muted">
        Send text from your phone to your computer with optional client-side
        encryption.
      </p>
      <div className="card">
        <h2>Get started</h2>
        <ul>
          <li>
            <a href="/receive">Open /receive on your computer</a>
          </li>
          <li>
            <a href="/send">Open /send on your phone</a>
          </li>
        </ul>
      </div>
    </div>
  );
}
