// Privacy policy for the ApplyPilot Chrome extension. Served at
// /applypilot/privacy and linked from the Chrome Web Store listing.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-3 text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

export default function ApplyPilotPrivacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex items-center gap-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl text-white font-bold"
            style={{ background: 'linear-gradient(135deg,#6d8bff,#8a6dff)' }}
          >
            ✓
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ApplyPilot — Privacy Policy</h1>
            <p className="text-sm text-gray-500">Last updated: June 5, 2026</p>
          </div>
        </div>

        <p className="mt-6 text-gray-700 leading-relaxed">
          ApplyPilot ("the extension") helps you fill job-application forms and draft answers to
          application questions. This policy explains what data it handles and where that data goes.
        </p>

        <Section title="What the extension stores">
          <p>The extension stores the following <strong>locally in your browser</strong> (chrome.storage.local):</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Your profile vault</strong> — name, contact details, address, links, skills, certifications, projects, education, experience, work-authorization answers, and any custom field answers you enter.</li>
            <li><strong>Your sign-in token</strong> — a session token (JWT) issued by your account, used to authenticate requests to the backend. It is stored only on your device.</li>
            <li><strong>Settings</strong> — the backend URL and your autofill preferences.</li>
          </ul>
          <p>This data stays on your device. It is not sold, shared, or transmitted to any third party.</p>
        </Section>

        <Section title="What the extension sends, and to whom">
          <p>The extension communicates only with <strong>its configured backend</strong> (the operator's own API). It sends data only when you take an action:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>When you sign in:</strong> your email and password are sent to the backend's authentication endpoint to obtain a session token.</li>
            <li><strong>When you click "Sync profile":</strong> the extension requests your profile data (resume, projects, skills, work authorization) from the backend to seed your local vault.</li>
            <li><strong>When you click "✨ Generate" on a question:</strong> the question text and the visible job description on the current page are sent to the backend, which uses an AI model to draft answers grounded in your resume. The drafted answers are returned to your browser.</li>
          </ul>
          <p>The extension does <strong>not</strong> send page contents, keystrokes, or browsing activity anywhere except the specific question/job-description text you choose to generate an answer for.</p>
        </Section>

        <Section title="What the extension does NOT do">
          <ul className="list-disc pl-6 space-y-1">
            <li>It does not track your browsing across sites.</li>
            <li>It does not collect analytics or telemetry.</li>
            <li>It only reads form fields and the on-page job description, and only acts when you click its controls (or enable optional autofill-on-load).</li>
            <li>It does not transmit data to any party other than its configured backend.</li>
          </ul>
        </Section>

        <Section title="Permissions">
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>storage</strong> — to save your profile vault, token, and settings locally.</li>
            <li><strong>activeTab / scripting</strong> — to read and fill form fields on the application page you're viewing.</li>
            <li><strong>host access to the backend</strong> — to call the authentication and answer-generation endpoints.</li>
          </ul>
        </Section>

        <Section title="Your control">
          <ul className="list-disc pl-6 space-y-1">
            <li>You can view and edit all stored data on the extension's Options page.</li>
            <li>You can sign out at any time from the popup, which clears your session token.</li>
            <li>Uninstalling the extension removes all locally-stored data.</li>
          </ul>
        </Section>

        <Section title="AI processing">
          <p>
            Generated answers are produced by an AI model (Anthropic Claude via the operator's backend)
            using your resume data and the job description you choose. Review every generated answer
            before submitting it — you are responsible for the content you submit on applications.
          </p>
        </Section>

        <Section title="Contact">
          <p>Questions about this policy: <a className="text-blue-600 hover:underline" href="mailto:sandeep@gnanalytica.com">sandeep@gnanalytica.com</a></p>
        </Section>
      </div>
    </div>
  );
}
