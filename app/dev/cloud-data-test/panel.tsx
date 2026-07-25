"use client";

import { useState } from "react";
import { CloudDiagnosticSummary, readCloudDiagnosticSummary } from "../../lib/supabase/cloud-storage";

export default function CloudDataTestPanel() {
  const [summary, setSummary] = useState<CloudDiagnosticSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runReadTest() {
    setLoading(true);
    setError("");
    try {
      setSummary(await readCloudDiagnosticSummary());
    } catch (caught) {
      setSummary(null);
      setError(caught instanceof Error ? caught.message : "Cloud data test failed.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="page">
    <header className="page-header">
      <div>
        <p className="eyebrow">Development only</p>
        <h1>Cloud Data Test</h1>
      </div>
    </header>

    <section className="form-panel">
      <p className="settings-help">This safely reads Supabase cloud data through the GroovinLog cloud data layer. It does not write to Supabase or localStorage.</p>
      <button className="primary-button enabled" type="button" disabled={loading} onClick={runReadTest}>{loading ? "Reading…" : "Run Cloud Read Test"}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>

    {summary && <section className="form-panel">
      <h2>Summary</h2>
      <dl>
        <dt>Authenticated</dt>
        <dd>{summary.authenticated ? "true" : "false"}</dd>
        <dt>Class Reviews</dt>
        <dd>{summary.counts.classReviews}</dd>
        <dt>Practice Tasks</dt>
        <dd>{summary.counts.practiceTasks}</dd>
        <dt>Practice Logs</dt>
        <dd>{summary.counts.practiceLogs}</dd>
        <dt>Weekly Reflections</dt>
        <dd>{summary.counts.weeklyReflections}</dd>
        <dt>Preferences</dt>
        <dd>{summary.counts.preferences}</dd>
        <dt>ClassReview.tasks total</dt>
        <dd>{summary.counts.reconstructedClassTasks}</dd>
        <dt>Class reviews with tasks</dt>
        <dd>{summary.reconstruction.classReviewsWithTasks}</dd>
        <dt>Standalone tasks</dt>
        <dd>{summary.reconstruction.standaloneTasks}</dd>
      </dl>
    </section>}
  </main>;
}
