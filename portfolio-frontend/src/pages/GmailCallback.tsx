import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiService } from "@/lib/api";

/**
 * Lands here after the user consents on Google. We POST { code, state } to
 * the backend (which validates the state, exchanges for tokens, and stores
 * the encrypted refresh token), then bounce them back to the resume parser
 * with a query flag the Applications tab listens for.
 */
export default function GmailCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");

    if (oauthError) {
      setError(oauthError === "access_denied" ? "You cancelled the Gmail link." : oauthError);
      setStatus("error");
      return;
    }
    if (!code || !state) {
      setError("Missing authorization code or state.");
      setStatus("error");
      return;
    }

    (async () => {
      const resp = await apiService.finishGmailLink(code, state);
      if (resp.error) {
        setError(resp.error);
        setStatus("error");
        return;
      }
      setStatus("done");
      // Hop back into the Applications tab. The ?gmail=linked flag lets
      // ApplicationsTab refresh its Gmail status without a full reload.
      setTimeout(() => navigate("/resume-parser?tab=applications&gmail=linked", { replace: true }), 600);
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-gray-900/40 backdrop-blur p-6 text-center">
        {status === "working" && (
          <>
            <div className="w-10 h-10 rounded-full border-2 border-current border-t-transparent animate-spin mx-auto text-purple-500" />
            <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">Linking your Gmail…</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">This usually takes a couple of seconds.</p>
          </>
        )}
        {status === "done" && (
          <>
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-lg">✓</div>
            <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Gmail linked.</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Taking you back to your applications…</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto text-lg">!</div>
            <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Couldn't link Gmail</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{error}</p>
            <button
              onClick={() => navigate("/resume-parser?tab=applications", { replace: true })}
              className="mt-4 text-xs font-medium px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-500"
            >
              Back to Applications
            </button>
          </>
        )}
      </div>
    </div>
  );
}
